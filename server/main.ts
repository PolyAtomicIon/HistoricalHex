// Сервер HistoricalHex: WebSocket на /ws, комнаты в памяти + снимки на диске.
//   PORT=8790 DATA_DIR=/var/lib/historicalhex node dist-server/server.mjs

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMsg, ServerMsg } from '../src/proto';
import { DEFAULT_SETTINGS } from '../src/proto';
import { cryptoRng, victoryPoints } from '../src/engine';
import type { Client, SavedRoom } from './room';
import { Room } from './room';
import { TgBot } from './tgbot';
import { addSubscription, hasPush, initPush, removeSubscriptions, sendPush, vapidPublicKey } from './push';
import { findProfile, leaderboard, openAccounts, profileByPortal, profileByTg, profileOf, runAiLeague, recordGame, renameProfile, signInPortal, signInTelegram, verifyMiniApp, verifyPortalTicket, verifyWidget, view } from './accounts';

const TG_TOKEN = process.env.TG_BOT_TOKEN ?? '';
const TG_BOT = process.env.TG_BOT_NAME ?? '';
const APP_URL = process.env.APP_URL ?? 'https://bekzaty.abmco.kz/catan/';
const PORTAL_KEY = process.env.PORTAL_API_KEY ?? '';
/** Секрет подписи билетов входа из AQL Portal (по умолчанию — тот же ключ API). */
const PORTAL_SECRET = process.env.PORTAL_LOGIN_SECRET ?? PORTAL_KEY;
/** Адрес портала для кнопки входа; кнопка видна, только когда задан и есть секрет. */
const PORTAL_URL = PORTAL_SECRET ? (process.env.PORTAL_URL ?? '') : '';
const bot = TG_TOKEN && TG_BOT ? new TgBot(TG_TOKEN, TG_BOT, APP_URL) : undefined;
bot?.start();

const PORT = Number(process.env.PORT ?? 8790);
const HOST = process.env.HOST ?? '127.0.0.1';
const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), '.data');
/** Комнату без подключений и изменений удаляем через это время. */
const IDLE_MS = 1000 * 60 * 60 * 24 * 2;
const MAX_ROOMS = 500;
/** Пустое лобби без подключений живёт час. */
const LOBBY_IDLE_MS = 1000 * 60 * 60;

mkdirSync(DATA_DIR, { recursive: true });

const rooms = new Map<string, Room>();
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function save(room: Room): void {
  if (saveTimers.has(room.pin)) return;
  saveTimers.set(
    room.pin,
    setTimeout(() => {
      saveTimers.delete(room.pin);
      if (room.isDisposed) return;
      const file = join(DATA_DIR, `${room.pin}.json`);
      try {
        writeFileSync(file + '.tmp', JSON.stringify(room.toJSON()));
        renameSync(file + '.tmp', file);
      } catch (e) {
        console.error('save failed', room.pin, e);
      }
    }, 300),
  );
}

function drop(pin: string): void {
  rooms.get(pin)?.dispose();
  rooms.delete(pin);
  rmSync(join(DATA_DIR, `${pin}.json`), { force: true });
}

void openAccounts(join(DATA_DIR, 'hh.sqlite')).then((kind) => {
  console.log(`accounts: ${kind}`);
  if (process.env.AI_LEAGUE !== '0') runAiLeague();
});
initPush(DATA_DIR);
/** Игроки, у которых вкладка свёрнута (по id). */
const hiddenTabs = new Set<string>();
// «Твой ход»: если через 8 с человек всё ещё не ответил и он не в сети или игра свёрнута — пуш
Room.onWaiting = (room, pid) => {
  if (!hasPush(pid)) return;
  setTimeout(() => {
    if (!room.isWaitingOn(pid) || room.isDisposed) return;
    if (room.isOnline(pid) && !hiddenTabs.has(pid)) return;
    const st = room.state;
    const discard = st?.phase === 'discard';
    void sendPush(pid, {
      title: discard ? 'Сбрось карты' : 'Твой ход',
      body: discard ? `Выпала семёрка — нужно сбросить половину. Комната ${room.pin}` : `HistoricalHex · комната ${room.pin}. Кубики ждут!`,
      url: `${APP_URL}?pin=${room.pin}`,
      tag: `turn-${room.pin}`,
    });
  }, 8000);
};

Room.onFinished = (room) => {
  try {
    const st = room.state!;
    recordGame({
      id: `${room.pin}-${room.created}`,
      era: room.settings.lore,
      finishedAt: Date.now(),
      players: st.order.map((pid) => {
        const seat = room.seats.get(pid);
        const pl = st.players[pid];
        return { pid, name: pl.name, bot: seat?.bot, persona: seat?.persona, vp: victoryPoints(st, pid), winner: st.winner === pid };
      }),
    });
  } catch (e) {
    console.error('recordGame failed', e);
  }
};

// Восстановить комнаты после перезапуска
for (const f of readdirSync(DATA_DIR)) {
  if (!/^\d{6}\.json$/.test(f)) continue;
  try {
    const data = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8')) as SavedRoom;
    if (Date.now() - data.touched > IDLE_MS) {
      rmSync(join(DATA_DIR, f), { force: true });
      continue;
    }
    rooms.set(data.pin, new Room(data, save));
  } catch (e) {
    console.error('load failed', f, e);
  }
}
console.log(`loaded ${rooms.size} rooms from ${DATA_DIR}`);

/** Публичный id игрока из секрета клиента: секрет никому не показываем. */
const playerId = (secret: string) => 'p' + createHash('sha256').update('hh:' + secret).digest('base64url').slice(0, 12);

function newPin(): string {
  for (let i = 0; i < 50; i++) {
    const pin = String(100000 + Math.floor(cryptoRng() * 900000));
    if (!rooms.has(pin)) return pin;
  }
  throw new Error('Не удалось придумать PIN');
}

const http = createServer((req, res) => {
  // Для AQL Portal: статистика по Telegram id. GET /api/portal/players?tg_ids=1,2  (Authorization: Bearer <PORTAL_API_KEY>)
  if (req.url?.includes('/api/portal/players')) {
    if (!PORTAL_KEY || req.headers.authorization !== `Bearer ${PORTAL_KEY}`) {
      res.writeHead(401).end();
      return;
    }
    const q = new URL(req.url, 'http://x').searchParams;
    const ids = (q.get('tg_ids') ?? '').split(',').filter((x) => /^\d{1,20}$/.test(x)).slice(0, 500);
    const pids = (q.get('portal_ids') ?? '').split(',').filter((x) => /^[\w-]{1,64}$/.test(x)).slice(0, 500);
    const out = [
      ...ids.flatMap((id) => {
        const p = profileByTg(id);
        return p ? [{ tg_id: id, ...view(p) }] : [];
      }),
      ...pids.flatMap((id) => {
        const p = profileByPortal(id);
        return p ? [{ portal_id: id, ...view(p) }] : [];
      }),
    ];
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(out));
    return;
  }
  if (req.url?.endsWith('/api/leaderboard')) {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'max-age=30' });
    res.end(JSON.stringify(leaderboard(50)));
    return;
  }
  if (req.url?.endsWith('/health')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server: http, maxPayload: 64 * 1024 });

wss.on('error', (e) => console.error('wss error', e));

const alive = new WeakMap<WebSocket, boolean>();
/** Сколько комнат создало соединение (защита от спама комнатами). */
const CREATE_LIMIT = 5;

wss.on('connection', (ws: WebSocket) => {
  let me: string | undefined;
  let created = 0;
  alive.set(ws, true);
  ws.on('pong', () => alive.set(ws, true));
  ws.on('error', () => ws.terminate());
  let room: Room | undefined;
  let msgCount = 0;
  const window = setInterval(() => (msgCount = 0), 10_000);

  const send = (msg: ServerMsg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };
  const client: Client = {
    get me() {
      return me!;
    },
    send,
  };

  const enter = (r: Room) => {
    if (room === r) return;
    room?.detach(client);
    room = r;
    r.attach(client);
  };

  const handle = async (msg: ClientMsg) => {
    if (msg.t === 'ping') return send({ t: 'pong', now: Date.now() });
    if (msg.t === 'hello') {
      if (typeof msg.secret !== 'string' || msg.secret.length < 16 || msg.secret.length > 128) {
        throw new Error('Плохой ключ клиента');
      }
      me = playerId(msg.secret);
      return send({ t: 'welcome', me, vapid: vapidPublicKey(), push: hasPush(me) });
    }
    if (!me) throw new Error('Сначала hello');

    switch (msg.t) {
      case 'profile':
        return send({ t: 'profile', profile: view(profileOf(me)), leaders: leaderboard(30), tgBot: TG_BOT || undefined, portal: PORTAL_URL || undefined });
      case 'rename': {
        if (typeof msg.name !== 'string') throw new Error('Плохое имя');
        renameProfile(me, msg.name);
        return send({ t: 'profile', profile: view(profileOf(me)), leaders: leaderboard(30), tgBot: TG_BOT || undefined, portal: PORTAL_URL || undefined });
      }
      case 'pushSub':
        if (!addSubscription(me, msg.sub)) throw new Error('Не удалось включить уведомления');
        return send({ t: 'welcome', me, vapid: vapidPublicKey(), push: true });
      case 'pushOff':
        removeSubscriptions(me);
        return send({ t: 'welcome', me, vapid: vapidPublicKey(), push: false });
      case 'vis':
        if (msg.hidden) hiddenTabs.add(me);
        else hiddenTabs.delete(me);
        return;
      case 'takeSeat': {
        if (!room) throw new Error('Сначала открой комнату');
        if (typeof msg.pid !== 'string' || typeof msg.name !== 'string') throw new Error('Плохой запрос');
        room.takeBotSeat(me, msg.pid, msg.name);
        return;
      }
      case 'playerProfile': {
        if (typeof msg.pid !== 'string' || msg.pid.length > 64) throw new Error('Нет такого игрока');
        // Ищем место за столом в любой комнате этого соединения: ИИ — по персонажу
        const seat = room?.seats.get(msg.pid);
        const prof = findProfile(msg.pid, seat?.persona);
        return send({ t: 'playerProfile', pid: msg.pid, profile: prof ? view(prof) : null });
      }
      case 'tgLink': {
        if (!bot) throw new Error('Вход через Telegram ещё не настроен');
        const who = me;
        const url = bot.loginLink(who, (u) => {
          signInTelegram(who, u);
          send({ t: 'profile', profile: view(profileOf(who)), leaders: leaderboard(30), tgBot: TG_BOT || undefined, portal: PORTAL_URL || undefined });
        });
        return send({ t: 'tgLink', url });
      }
      case 'portalAuth': {
        if (!PORTAL_SECRET) throw new Error('Вход через AQL Portal ещё не настроен');
        const u = verifyPortalTicket(String(msg.ticket ?? ''), PORTAL_SECRET);
        if (!u) throw new Error('Ссылка входа из AQL Portal устарела — открой игру из портала ещё раз');
        signInPortal(me, u);
        return send({ t: 'profile', profile: view(profileOf(me)), leaders: leaderboard(30), tgBot: TG_BOT || undefined, portal: PORTAL_URL || undefined });
      }
      case 'tgAuth': {
        if (!TG_TOKEN) throw new Error('Вход через Telegram ещё не настроен');
        const u =
          typeof msg.initData === 'string'
            ? verifyMiniApp(msg.initData, TG_TOKEN)
            : msg.widget && typeof msg.widget === 'object'
              ? verifyWidget(msg.widget, TG_TOKEN)
              : null;
        if (!u || typeof u.id !== 'number') throw new Error('Telegram не подтвердил вход');
        signInTelegram(me, u);
        return send({ t: 'profile', profile: view(profileOf(me)), leaders: leaderboard(30), tgBot: TG_BOT || undefined, portal: PORTAL_URL || undefined });
      }
      case 'create': {
        if (++created > CREATE_LIMIT) throw new Error('Слишком много новых комнат — подожди');
        if (rooms.size >= MAX_ROOMS) throw new Error('Сервер переполнен, попробуй позже');
        const pin = newPin();
        const r = new Room(
          {
            pin,
            hostId: me,
            created: Date.now(),
            touched: Date.now(),
            status: 'lobby',
            settings: { ...DEFAULT_SETTINGS },
            seats: [],
            kicked: [],
          },
          save,
        );
        if (msg.settings) r.updateSettings(me, msg.settings);
        rooms.set(pin, r);
        save(r);
        send({ t: 'created', pin });
        return enter(r);
      }
      case 'open': {
        const r = rooms.get(String(msg.pin).replace(/\D/g, ''));
        if (!r) throw Object.assign(new Error('Игра с таким PIN не найдена'), { fatal: true });
        return enter(r);
      }
      case 'join': {
        const r = rooms.get(String(msg.pin).replace(/\D/g, ''));
        if (!r) throw Object.assign(new Error('Игра с таким PIN не найдена'), { fatal: true });
        r.join(me, String(msg.name ?? ''));
        return enter(r);
      }
    }

    if (!room) throw new Error('Сначала открой комнату');
    const r = room;
    switch (msg.t) {
      case 'color':
        return r.setColor(me, msg.color);
      case 'leaveLobby':
        return r.leaveLobby(me);
      case 'settings':
        return r.updateSettings(me, msg.settings ?? {});
      case 'addBot':
        return r.addBot(me, msg.level);
      case 'kick':
        return r.kick(me, msg.player, msg.level);
      case 'start':
        return r.start(me);
      case 'act': {
        const res = await r.act(me, msg.action, msg.dice);
        return send({ t: 'result', id: msg.id, ok: res.ok, ...(res.ok ? {} : { error: res.error }) });
      }
      case 'host': {
        const res = await r.hostAction(me, msg.action);
        return send({ t: 'result', id: msg.id, ok: res.ok, ...(res.ok ? {} : { error: res.error }) });
      }
      case 'react':
        return r.react(me, msg.emoji);
      case 'undo': {
        const res = await r.undo(me);
        if (!res.ok) send({ t: 'error', message: res.error ?? 'Отменить нельзя' });
        return;
      }
      case 'close':
        r.close(me);
        return drop(r.pin);
    }
  };

  ws.on('message', (raw) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return send({ t: 'error', message: 'Непонятное сообщение' });
    }
    if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') {
      return send({ t: 'error', message: 'Непонятное сообщение' });
    }
    if (++msgCount > 200) {
      const id = (msg as { id?: unknown }).id;
      if (typeof id === 'string') return send({ t: 'result', id, ok: false, error: 'Слишком много действий — подожди' });
      return send({ t: 'error', message: 'Слишком много сообщений' });
    }
    handle(msg).catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      const fatal = !!(e as { fatal?: boolean })?.fatal;
      const id = (msg as { id?: unknown })?.id;
      if (typeof id === 'string' && (msg.t === 'act' || msg.t === 'host')) send({ t: 'result', id, ok: false, error: message });
      else send({ t: 'error', message, ...(fatal ? { fatal } : {}) });
    });
  });

  ws.on('close', () => {
    clearInterval(window);
    room?.detach(client);
  });
});

// Таймеры: замена отвалившихся ботами и уборка старых комнат
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    r.tick();
    const idle = now - r.touched;
    if (r.clientCount === 0 && (idle > IDLE_MS || (r.status === 'lobby' && idle > LOBBY_IDLE_MS))) drop(r.pin);
  }
}, 2000);

// Пинг: держит соединение через прокси и закрывает «мёртвые» (телефон уснул, пропала сеть),
// чтобы игрок считался отключённым и его вовремя заменил бот.
setInterval(() => {
  for (const ws of wss.clients) {
    if (alive.get(ws) === false) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    if (ws.readyState === ws.OPEN) ws.ping();
  }
}, 15_000);

process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
process.on('uncaughtException', (e) => console.error('uncaughtException', e));

http.listen(PORT, HOST, () => console.log(`historicalhex server on ${HOST}:${PORT}`));
