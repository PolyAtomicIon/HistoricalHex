// Сервер HistoricalHex: WebSocket на /ws, комнаты в памяти + снимки на диске.
//   PORT=8790 DATA_DIR=/var/lib/historicalhex node dist-server/server.mjs

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMsg, FriendRow, ServerMsg } from '../src/proto';
import { DEFAULT_SETTINGS } from '../src/proto';
import { cryptoRng, victoryPoints } from '../src/engine';
import type { Client, SavedRoom } from './room';
import { Room, randomOrg } from './room';
import { TgBot } from './tgbot';
import { addSubscription, hasPush, initPush, removeSubscriptions, sendPush, vapidPublicKey } from './push';
import { devicesOf, findProfile, getProfileById, recentGames, setFriend, ipHash, logEvent, leaderboard, openAccounts, profileByPortal, profileByTg, profileOf, runAiLeague, recordGame, renameProfile, signInPortal, signInTelegram, verifyMiniApp, verifyPortalTicket, verifyWidget, view } from './accounts';

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

/** Живые подключения: кто (устройство) и в какой комнате — для статуса друзей и приглашений. */
interface LiveConn {
  me?: string;
  room?: Room;
  send: (m: ServerMsg) => void;
}
const conns = new Set<LiveConn>();
/** Профиль устройства (без создания нового). */
const profileIdOf = (pid: string) => findProfile(pid)?.id ?? pid;

/** Друзья со статусом: в сети, в лобби или за столом. Сначала играющие, потом в сети. */
function friendsList(me: string): FriendRow[] {
  const ids = findProfile(me)?.friends ?? [];
  if (!ids.length) return [];
  const want = new Set(ids);
  const at = new Map<string, { online: boolean; where?: FriendRow['where']; seatName?: string }>();
  for (const c of conns) {
    if (!c.me) continue;
    const id = profileIdOf(c.me);
    if (!want.has(id)) continue;
    const cur = at.get(id) ?? { online: true };
    const r = c.room;
    if (r && r.isSeated(c.me) && r.status !== 'finished' && !cur.where) {
      cur.where = { pin: r.pin, state: r.status === 'lobby' ? 'lobby' : 'playing', era: r.settings.lore };
      cur.seatName = r.seats.get(c.me)?.name;
    }
    at.set(id, cur);
  }
  const rank = (f: FriendRow) => (f.where?.state === 'playing' ? 0 : f.where ? 1 : f.online ? 2 : 3);
  return ids
    .map((id) => {
      const p = getProfileById(id);
      if (!p) return undefined;
      const s = at.get(id);
      // Профиль без своего имени («Игрок») — показываем имя, под которым сидит за столом
      const name = p.name === 'Игрок' && s?.seatName ? s.seatName : p.name;
      return { id, name, rating: Math.round(p.rating), online: !!s, ...(p.photo ? { photo: p.photo } : {}), ...(s?.where ? { where: s.where } : {}) };
    })
    .filter((x): x is FriendRow => !!x)
    .sort((a, b) => rank(a) - rank(b) || b.rating - a.rating);
}

/** Сообщение профиля (одно на все места, где он отправляется). */
const profileMsg = (me: string): ServerMsg => {
  const p = profileOf(me);
  return { t: 'profile', profile: view(p), leaders: leaderboard(30), tgBot: TG_BOT || undefined, portal: PORTAL_URL || undefined, friends: p.friends ?? [] };
};

/** Кого кто звал недавно: не чаще раза в 30 секунд на друга. */
const invitedAt = new Map<string, number>();
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
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, dice: { ...randomOrg.stats, pool: randomOrg.size, failures: randomOrg.failures } }));
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server: http, maxPayload: 64 * 1024 });

wss.on('error', (e) => console.error('wss error', e));

const alive = new WeakMap<WebSocket, boolean>();
/** События интерфейса, которые клиент может прислать в журнал. */
const TRACK = new Set(['tutorialStart', 'tutorialDone', 'tutorialSkip', 'rulesOpen', 'rulesSearch']);
/** Сколько комнат создало соединение (защита от спама комнатами). */
const CREATE_LIMIT = 5;

wss.on('connection', (ws: WebSocket, req) => {
  const ip = ipHash(String(req.headers['x-real-ip'] ?? req.socket.remoteAddress ?? ''));
  let me: string | undefined;
  let created = 0;
  let errs = 0;
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

  const live: LiveConn = { send };
  conns.add(live);
  const enter = (r: Room) => {
    if (room === r) return;
    room?.detach(client);
    room = r;
    live.room = r;
    r.attach(client);
  };

  const handle = async (msg: ClientMsg) => {
    if (msg.t === 'ping') return send({ t: 'pong', now: Date.now() });
    if (msg.t === 'hello') {
      if (typeof msg.secret !== 'string' || msg.secret.length < 16 || msg.secret.length > 128) {
        throw new Error('Плохой ключ клиента');
      }
      const first = !me;
      me = playerId(msg.secret);
      live.me = me;
      if (first) logEvent('hello', me, undefined, ip);
      return send({ t: 'welcome', me, vapid: vapidPublicKey(), push: hasPush(me) });
    }
    if (!me) throw new Error('Сначала hello');

    switch (msg.t) {
      case 'profile':
        return send(profileMsg(me));
      case 'rename': {
        if (typeof msg.name !== 'string') throw new Error('Плохое имя');
        renameProfile(me, msg.name);
        return send(profileMsg(me));
      }
      case 'pushSub':
        if (!addSubscription(me, msg.sub)) throw new Error('Не удалось включить уведомления');
        return send({ t: 'welcome', me, vapid: vapidPublicKey(), push: true });
      case 'pushOff':
        removeSubscriptions(me);
        return send({ t: 'welcome', me, vapid: vapidPublicKey(), push: false });
      case 'clientError':
        // Ошибки браузера игрока — в журнал сервера (не больше 20 за соединение), чтобы видеть, что ломается у людей.
        if (++errs <= 20) {
          console.warn(`client error [${me}] ${String(msg.ua ?? '').slice(0, 160)} :: ${String(msg.msg ?? '').slice(0, 600)}`);
          logEvent('clientError', me, { msg: String(msg.msg ?? '').slice(0, 600), ua: String(msg.ua ?? '').slice(0, 200) }, ip);
        }
        return;
      case 'track':
        // Небольшая статистика интерфейса: прошёл ли обучение, открывал ли правила
        if (TRACK.has(String(msg.event)) && ++errs <= 40) logEvent(String(msg.event), me, msg.data, ip);
        return;
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
      case 'friends':
        return send({ t: 'friends', list: friendsList(me) });
      case 'friend': {
        if (typeof msg.id !== 'string' || msg.id.length > 64) throw new Error('Такого игрока нет');
        setFriend(me, msg.id, !!msg.on);
        send(profileMsg(me));
        return send({ t: 'friends', list: friendsList(me) });
      }
      case 'invite': {
        if (typeof msg.id !== 'string' || msg.id.length > 64) throw new Error('Такого игрока нет');
        const r = room;
        if (!r || !r.isSeated(me) || r.status === 'finished') throw new Error('Сначала сядь за стол');
        const my = findProfile(me);
        if (!my?.friends?.includes(msg.id)) throw new Error('Звать можно только друзей');
        const key = `${my.id}>${msg.id}`;
        if (Date.now() - (invitedAt.get(key) ?? 0) < 30_000) throw new Error('Уже позвали — подожди немного');
        invitedAt.set(key, Date.now());
        const from = my.name;
        // Онлайн — всплывашка на главной; плюс пуш на все его устройства
        for (const c of conns) if (c.me && profileIdOf(c.me) === msg.id) c.send({ t: 'invite', from, pin: r.pin, era: r.settings.lore });
        for (const d of devicesOf(msg.id)) void sendPush(d, { title: `${from} зовёт в партию`, body: `HistoricalHex · комната ${r.pin}. Заходи!`, url: `${APP_URL}?pin=${r.pin}`, tag: `invite-${r.pin}` });
        logEvent('invite', me, { pin: r.pin, to: msg.id }, ip);
        return;
      }
      case 'feed': {
        // Идущие партии: сначала мои, потом где больше людей в сети
        const fr = new Set(findProfile(me)?.friends ?? []);
        const games = [...rooms.values()]
          .map((x) => {
            const g = x.liveSummary(me);
            if (!g || !fr.size) return g;
            const names = [...x.seats.values()].filter((st) => !st.bot && x.isSeated(st.id) && fr.has(profileIdOf(st.id))).map((st) => st.name);
            return names.length ? { ...g, friends: names } : g;
          })
          .filter((x): x is NonNullable<typeof x> => !!x)
          .sort((a, b) => Number(!!b.mine) - Number(!!a.mine) || Number(!!b.friends) - Number(!!a.friends) || b.players.filter((p) => !p.bot && p.online).length - a.players.filter((p) => !p.bot && p.online).length)
          .slice(0, 12);
        return send({ t: 'feed', live: games, recent: recentGames(me, 8) });
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
          send(profileMsg(who));
        });
        return send({ t: 'tgLink', url });
      }
      case 'portalAuth': {
        if (!PORTAL_SECRET) throw new Error('Вход через AQL Portal ещё не настроен');
        const u = verifyPortalTicket(String(msg.ticket ?? ''), PORTAL_SECRET);
        if (!u) throw new Error('Ссылка входа из AQL Portal устарела — открой игру из портала ещё раз');
        signInPortal(me, u);
        return send(profileMsg(me));
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
        return send(profileMsg(me));
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
        logEvent('create', me, { pin, era: r.settings.lore }, ip);
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
      case 'start': {
        const res = r.start(me);
        logEvent('start', me, { pin: r.pin, era: r.settings.lore, seats: r.seats.size, bots: [...r.seats.values()].filter((x) => x.bot).length, settings: r.settings }, ip);
        return res;
      }
      case 'act': {
        const res = await r.act(me, msg.action, msg.dice);
        return send({ t: 'result', id: msg.id, ok: res.ok, ...(res.ok ? {} : { error: res.error }) });
      }
      case 'host': {
        const res = await r.hostAction(me, msg.action);
        return send({ t: 'result', id: msg.id, ok: res.ok, ...(res.ok ? {} : { error: res.error }) });
      }
      case 'react':
        r.react(me, String(msg.emoji ?? ''), r.isSeated(me) ? undefined : findProfile(me)?.name);
        return;
      case 'ban':
        if (typeof msg.player !== 'string') throw new Error('Плохой запрос');
        return r.setBan(me, msg.player, !!msg.on);
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
    conns.delete(live);
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
