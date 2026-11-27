// Связь с сервером: WebSocket с переподключением, состояние комнаты и события для анимаций.

import { useSyncExternalStore } from 'react';
import { tgInitData } from '../app/tg';
import type { Action, GameEvent, HostAction, PlayerId } from '../engine';
import { L } from '../i18n/l';
import { getLang } from '../app/learn/lang';
import type { ClientMsg, DiceSource, FriendRow, LeaderRow, LiveGame, ProfileView, RecentGame, RoomSettings, RoomView, ServerMsg } from '../proto';

const SECRET_KEY = 'hh.secret';
const PIN_KEY = 'hh.pin';

const SETTINGS_KEY = 'hh.roomSettings';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // приватный режим — живём без памяти
  }
}

function secret(): string {
  // ?test=имя — отдельный игрок в каждой вкладке (для проверки в одном браузере)
  const test = import.meta.env.DEV ? new URLSearchParams(location.search).get('test') : null;
  if (test) return `test-${test}-0123456789abcdef`;
  let s = safeGet(SECRET_KEY);
  if (!s) {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    s = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    safeSet(SECRET_KEY, s);
  }
  return s;
}

export function wsUrl(): string {
  const env = import.meta.env.VITE_WS_URL as string | undefined;
  if (env) return env;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}${base}/ws`;
}

export interface ConnState {
  status: 'connecting' | 'online' | 'offline';
  me?: PlayerId;
  room?: RoomView;
  /** Ошибка, после которой комнату надо покинуть (PIN не найден, комнату закрыли). */
  fatal?: string;
  /** Последняя некритичная ошибка (тост). */
  notice?: { text: string; key: number };
  /** Разница часов сервера и устройства. */
  clockSkew: number;
  /** Профиль, рейтинг (приходит по запросу 'profile'). */
  profile?: { profile: ProfileView; leaders: LeaderRow[]; tgBot?: string; portal?: string; friends?: string[] };
  /** Ссылка на бота для входа (живёт 10 минут). */
  tgLink?: string;
  /** Код ожидания входа через AQL Portal (для адреса возврата). */
  portalCode?: string;
  /** Этот браузер завершил вход через портал за приложение на главном экране. */
  portalLinked?: boolean;
  /** Web Push: публичный ключ сервера и включены ли уведомления для этого устройства. */
  vapid?: string;
  pushOn?: boolean;
  /** Профиль игрока за столом (по запросу). */
  playerProfile?: { pid: string; profile: ProfileView | null };
  /** Лента главной: идущие партии и недавние (по запросу 'feed'). */
  feed?: { live: LiveGame[]; recent: RecentGame[] };
  /** Друзья со статусом (по запросу 'friends'). */
  friends?: FriendRow[];
  /** Друг зовёт в партию (всплывашка). */
  invite?: { from: string; pin: string; era: string; key: number };
}

export type EventListener = (events: GameEvent[], source?: DiceSource) => void;
export type ReactListener = (r: { from: PlayerId; emoji: string; at: number; name?: string; watcher?: boolean }) => void;

class Connection {
  private ws?: WebSocket;
  private state: ConnState = { status: 'connecting', clockSkew: 0 };
  private subs = new Set<() => void>();
  private eventSubs = new Set<EventListener>();
  private reactSubs = new Set<ReactListener>();
  private pending = new Map<string, (r: { ok: boolean; error?: string }) => void>();
  private outbox: ClientMsg[] = [];
  private retry = 0;
  /** Когда последний раз что-то пришло от сервера — по этому видно «тихо умершее» соединение. */
  private lastHeard = 0;
  private beat?: ReturnType<typeof setInterval>;
  private seq = 0;
  /** Что повторить после переподключения. */
  private resume?: ClientMsg;
  private started = false;
  /** Страница ушла в кэш «назад/вперёд»: соединение закрыто, не переподключаемся. */
  private frozen = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.connect();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.ws?.readyState !== WebSocket.OPEN) this.connect();
    });
    window.addEventListener('online', () => this.connect());
    // Кэш «назад/вперёд»: страницу с открытым WebSocket браузер не сохраняет — закрываем при уходе, открываем при возврате
    window.addEventListener('pagehide', () => {
      this.frozen = true;
      const ws = this.ws;
      this.ws = undefined;
      ws?.close();
    });
    window.addEventListener('pageshow', () => {
      if (!this.frozen) return;
      this.frozen = false;
      this.connect();
    });
  }

  private connect(): void {
    if (this.frozen) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.patch({ status: 'connecting' });
    const ws = new WebSocket(wsUrl());
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.lastHeard = Date.now();
      // Пульс: каждые 10 с короткий ping. Держит NAT раздачи с телефона «тёплым», а если сервер
      // молчит дольше 25 с — соединение мёртвое, хоть браузер этого и не заметил: рвём и
      // переподключаемся сразу, не дожидаясь системного таймаута.
      clearInterval(this.beat);
      this.beat = setInterval(() => {
        if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) return clearInterval(this.beat);
        if (Date.now() - this.lastHeard > 25_000) {
          clearInterval(this.beat);
          this.retry = 0;
          ws.close();
          ws.onclose?.(new CloseEvent('close'));
          return;
        }
        try {
          ws.send(JSON.stringify({ t: 'ping' } satisfies ClientMsg));
        } catch {
          /* закроется само */
        }
      }, 10_000);
      ws.send(JSON.stringify({ t: 'hello', secret: secret() } satisfies ClientMsg));
      if (this.resume) ws.send(JSON.stringify(this.resume));
      for (const m of this.outbox.splice(0)) ws.send(JSON.stringify(m));
      this.patch({ status: 'online' });
    };
    ws.onmessage = (e) => {
      this.lastHeard = Date.now();
      this.onMessage(JSON.parse(String(e.data)) as ServerMsg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      clearInterval(this.beat);
      this.patch({ status: 'offline' });
      for (const [, done] of this.pending) done({ ok: false, error: trServerError('Нет связи') });
      this.pending.clear();
      const delay = Math.min(8000, 400 * 2 ** this.retry++);
      setTimeout(() => this.connect(), delay);
    };
  }

  private onMessage(m: ServerMsg): void {
    switch (m.t) {
      case 'welcome': {
        // Внутри Telegram Mini App — входим автоматически
        const init = tgInitData();
        if (init) this.ws?.send(JSON.stringify({ t: 'tgAuth', initData: init } satisfies ClientMsg));
        // Пришли из AQL Portal: ссылка …?aql=<билет> — входим и убираем билет из адреса
        const aql = portalTicket();
        if (aql) this.ws?.send(JSON.stringify({ t: 'portalAuth', ticket: aql, link: portalLink ?? undefined } satisfies ClientMsg));
        if (typeof document !== 'undefined' && document.hidden) this.ws?.send(JSON.stringify({ t: 'vis', hidden: true } satisfies ClientMsg));
        return this.patch({ me: m.me, vapid: m.vapid, pushOn: m.push });
      }
      case 'tgLink':
        return this.patch({ tgLink: m.url });
      case 'portalWait':
        return this.patch({ portalCode: m.code });
      case 'portalLinked':
        return this.patch({ portalLinked: true });
      case 'playerProfile':
        return this.patch({ playerProfile: { pid: m.pid, profile: m.profile } });
      case 'feed':
        return this.patch({ feed: { live: m.live, recent: m.recent } });
      case 'friends':
        return this.patch({ friends: m.list });
      case 'invite':
        return this.patch({ invite: { from: m.from, pin: m.pin, era: m.era, key: Date.now() } });
      case 'profile':
        return this.patch({ profile: { profile: m.profile, leaders: m.leaders, tgBot: m.tgBot, portal: m.portal, friends: m.friends } });
      case 'created':
        safeSet(PIN_KEY, m.pin);
        this.resume = { t: 'open', pin: m.pin };
        return;
      case 'room':
        safeSet(PIN_KEY, m.room.pin);
        this.resume = { t: 'open', pin: m.room.pin };
        return this.patch({ room: m.room, clockSkew: m.room.serverNow - Date.now(), fatal: undefined });
      case 'events':
        for (const l of this.eventSubs) l(m.events, m.diceSource);
        return;
      case 'result': {
        const done = this.pending.get(m.id);
        this.pending.delete(m.id);
        const err = m.error ? trServerError(m.error) : m.error;
        done?.({ ok: m.ok, error: err });
        if (!m.ok && err) this.notify(err);
        return;
      }
      case 'react':
        for (const l of this.reactSubs) l(m);
        return;
      case 'error':
        if (m.fatal) {
          this.resume = undefined;
          safeSet(PIN_KEY, null);
          return this.patch({ fatal: trServerError(m.message), room: undefined });
        }
        return this.notify(trServerError(m.message));
    }
  }

  notify(text: string): void {
    this.patch({ notice: { text, key: Date.now() } });
  }

  private patch(p: Partial<ConnState>): void {
    this.state = { ...this.state, ...p };
    for (const s of this.subs) s();
  }

  send(m: ClientMsg): boolean {
    // Настройки ведущего запоминаем: следующая комната создаётся с ними же
    if (m.t === 'settings' && this.state.room?.isHost) {
      const { lore: _lore, ...rest } = m.settings ?? {};
      safeSet(SETTINGS_KEY, JSON.stringify({ ...this.savedSettings(), ...rest }));
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(m));
      return true;
    }
    // Ходы и создание комнаты без связи не копим: иначе после переподключения
    // выполнится то, что игрок уже считал неудачным
    if (m.t === 'act' || m.t === 'host' || m.t === 'create') return false;
    this.outbox.push(m);
    return true;
  }

  // ─── API для экранов ───

  subscribe = (f: () => void) => {
    this.subs.add(f);
    return () => this.subs.delete(f);
  };
  getState = () => this.state;

  onEvents(l: EventListener): () => void {
    this.eventSubs.add(l);
    return () => this.eventSubs.delete(l);
  }
  onReact(l: ReactListener): () => void {
    this.reactSubs.add(l);
    return () => this.reactSubs.delete(l);
  }

  lastPin(): string | null {
    return safeGet(PIN_KEY);
  }

  /** Последние настройки, которые я ставил как ведущий (темп, таймер, кубики…). */
  savedSettings(): Partial<RoomSettings> {
    try {
      const v = JSON.parse(safeGet(SETTINGS_KEY) ?? '{}');
      return v && typeof v === 'object' ? (v as Partial<RoomSettings>) : {};
    } catch {
      return {};
    }
  }

  create(settings?: Partial<RoomSettings>): void {
    if (!this.send({ t: 'create', settings: { ...this.savedSettings(), ...settings } })) this.notify(L('Нет связи с сервером', 'Серверге қосылу жоқ', 'No connection to the server'));
  }
  open(pin: string): void {
    this.patch({ fatal: undefined });
    this.resume = { t: 'open', pin };
    this.send(this.resume);
  }
  join(pin: string, name: string): void {
    this.patch({ fatal: undefined });
    this.send({ t: 'join', pin, name });
  }
  dismissInvite(): void {
    this.patch({ invite: undefined });
  }
  /** Уйти из комнаты на главную (в партии место остаётся за ботом). */
  forget(): void {
    this.resume = undefined;
    safeSet(PIN_KEY, null);
    this.patch({ room: undefined, fatal: undefined });
    // Переподключаемся, чтобы сервер перестал присылать комнату
    this.ws?.close();
  }

  act(action: Action, dice?: [number, number]): Promise<{ ok: boolean; error?: string }> {
    const id = `a${++this.seq}`;
    return new Promise((done) => {
      if (!this.send({ t: 'act', id, action, ...(dice ? { dice } : {}) })) {
        this.notify(L('Нет связи — попробуй ещё раз', 'Байланыс жоқ — қайталап көр', 'No connection — try again'));
        return done({ ok: false, error: trServerError('Нет связи') });
      }
      this.pending.set(id, done);
    });
  }
  host(action: HostAction): Promise<{ ok: boolean; error?: string }> {
    const id = `h${++this.seq}`;
    return new Promise((done) => {
      if (!this.send({ t: 'host', id, action })) return done({ ok: false, error: trServerError('Нет связи') });
      this.pending.set(id, done);
    });
  }
}

export const conn = new Connection();

export function useConn(): ConnState {
  return useSyncExternalStore(conn.subscribe, conn.getState);
}

// Свёрнута ли игра — сервер шлёт пуш «Твой ход», только когда игру не видно
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    conn.send({ t: 'vis', hidden: document.hidden });
  });
}

/** Билет входа из AQL Portal (?aql=…): берётся один раз и сразу убирается из адресной строки. */
let aqlTicket: string | null | undefined;
/** Код ожидающего устройства (?plink=…): вход закончился здесь, а ждёт приложение с главного экрана. */
let portalLink: string | null = null;
function portalTicket(): string | null {
  if (aqlTicket !== undefined) return aqlTicket;
  aqlTicket = null;
  try {
    const u = new URL(location.href);
    const t = u.searchParams.get('aql');
    portalLink = u.searchParams.get('plink');
    if (t || portalLink) {
      aqlTicket = t || null;
      u.searchParams.delete('aql');
      u.searchParams.delete('plink');
      history.replaceState(null, '', u.toString());
    }
  } catch {
    /* ok */
  }
  return aqlTicket;
}

// ─── Перевод ошибок сервера и движка (приходят по-русски) ───
// Точные строки и шаблоны с числами/именами; неизвестное проходит как есть.
const ERR: [string, string, string][] = [
  ['Нет связи', 'Байланыс жоқ', 'No connection'],
  ['Игра уже закончилась', 'Ойын аяқталды', 'The game is already over'],
  ['Ты не участник этой игры', 'Сен бұл ойынға қатыспайсың', "You're not in this game"],
  ['Неизвестное действие', 'Белгісіз әрекет', 'Unknown action'],
  ['Неизвестное действие хоста', 'Жүргізушінің белгісіз әрекеті', 'Unknown host action'],
  ['Сейчас не твой ход', 'Қазір сенің жүрісің емес', "It's not your turn"],
  ['Не хватает ресурсов', 'Ресурс жеткіліксіз', 'Not enough resources'],
  ['Неверный набор карт', 'Карталар жиыны дұрыс емес', 'Invalid set of cards'],
  ['Сначала поставь дорогу к своему поселению', 'Алдымен өз қонысыңа жол сал', 'Build the road to your settlement first'],
  ['Сюда нельзя поставить поселение', 'Бұған қоныс салуға болмайды', "You can't build a settlement here"],
  ['Поселения закончились — улучши какое-нибудь до города', 'Қоныстар таусылды — біреуін қалаға дейін жақсарт', 'No settlements left — upgrade one to a city'],
  ['Сначала поставь поселение', 'Алдымен қоныс сал', 'Place a settlement first'],
  ['Дорога должна примыкать к только что поставленному поселению', 'Жол жаңа салынған қонысқа жалғасуы керек', 'The road must connect to the settlement you just placed'],
  ['Дороги закончились', 'Жолдар таусылды', 'No roads left'],
  ['Сюда нельзя поставить дорогу', 'Бұған жол салуға болмайды', "You can't build a road here"],
  ['Города закончились', 'Қалалар таусылды', 'No cities left'],
  ['Город можно построить только на месте своего поселения', 'Қаланы тек өз қонысыңның орнына салуға болады', 'A city can only replace your own settlement'],
  ['Карты развития закончились', 'Даму карталары таусылды', 'No development cards left'],
  ['Тебе не нужно сбрасывать карты', 'Саған карта тастаудың қажеті жоқ', "You don't need to discard"],
  ['У тебя нет таких карт', 'Сенде мұндай карта жоқ', "You don't have those cards"],
  ['Сейчас некуда поставить дороги', 'Қазір жол салатын жер жоқ', 'No place to build roads right now'],
  ['Выбери два ресурса', 'Екі ресурс таңда', 'Choose two resources'],
  ['В банке нет столько таких карт', 'Банкте мұншама карта жоқ', "The bank doesn't have that many cards"],
  ['Выбери ресурс', 'Ресурс таңда', 'Choose a resource'],
  ['Выбери ресурсы для обмена', 'Айырбастау үшін ресурстарды таңда', 'Choose resources to trade'],
  ['Нельзя менять ресурс на такой же', 'Ресурсты өзіне айырбастауға болмайды', "You can't trade a resource for the same one"],
  ['Неверное количество', 'Саны дұрыс емес', 'Invalid amount'],
  ['В банке не осталось столько карт этого ресурса', 'Банкте бұл ресурстың мұншама картасы қалмады', "The bank doesn't have that many of this resource"],
  ['У тебя нет этих карт', 'Сенде бұл карталар жоқ', "You don't have these cards"],
  ['Выбери, кому предложить', 'Кімге ұсынатыныңды таңда', 'Choose who to offer to'],
  ['Такого игрока нет', 'Мұндай ойыншы жоқ', 'No such player'],
  ['Это предложение уже неактуально', 'Бұл ұсыныс енді өзекті емес', 'This offer is no longer valid'],
  ['Нельзя отвечать на своё предложение', 'Өз ұсынысыңа жауап беруге болмайды', "You can't answer your own offer"],
  ['Это предложение не тебе', 'Бұл ұсыныс саған емес', 'This offer is not for you'],
  ['У тебя нет нужных карт', 'Сенде керек карталар жоқ', "You don't have the cards needed"],
  ['У тебя нет карт для такого предложения', 'Сенде мұндай ұсынысқа карталар жоқ', "You don't have the cards for this offer"],
  ['Неверный ответ', 'Жауап дұрыс емес', 'Invalid response'],
  ['Этот игрок не согласился на обмен', 'Бұл ойыншы айырбасқа келіспеді', "This player didn't agree to the trade"],
  ['У тебя уже нет нужных карт', 'Сенде керек карталар енді жоқ', "You no longer have the cards needed"],
  ['У игрока уже нет нужных карт', 'Ойыншыда керек карталар енді жоқ', 'The player no longer has the cards needed'],
  ['Ведущий убрал тебя из игры', 'Жүргізуші сені ойыннан шығарды', 'The host removed you from the game'],
  ['За тебя сейчас не играет бот', 'Қазір сенің орныңа бот ойнамайды', "A bot isn't playing for you right now"],
  ['Нет активного предложения', 'Белсенді ұсыныс жоқ', 'No active offer'],
  ['Сначала брось кубики — карты развития играются после броска', 'Алдымен сүйек таста — даму карталары лақтырудан кейін ойналады', 'Roll the dice first — development cards are played after the roll'],
  ['За ход можно сыграть только одну карту развития', 'Бір жүрісте тек бір даму картасын ойнауға болады', 'You can play only one development card per turn'],
  ['Эту карту купили в этот ход — сыграть её можно со следующего', 'Бұл карта осы жүрісте сатып алынды — келесі жүрістен ойнауға болады', 'You bought this card this turn — you can play it from the next turn'],
  ['У тебя нет такой карты', 'Сенде мұндай карта жоқ', "You don't have this card"],
  ['Такого гекса нет', 'Мұндай гекс жоқ', 'No such hex'],
  ['Разбойника нужно переставить на другой гекс', 'Қарақшыны басқа гекске ауыстыру керек', 'The robber must move to a different hex'],
  ['У этого игрока здесь нельзя украсть', 'Бұл ойыншыдан мұнда ұрлауға болмайды', "You can't steal from this player here"],
  ['Выбери, у кого украсть карту', 'Кімнен карта ұрлайтыныңды таңда', 'Choose who to steal a card from'],
  ['Нужно и отдать, и получить хотя бы по одной карте', 'Кемінде бір картадан беріп, алу керек', 'You must give and get at least one card each'],
  ['Один и тот же ресурс не может быть с обеих сторон', 'Бір ресурс екі жақта да болмайды', 'The same resource cannot be on both sides'],
  ['Нет такого игрока', 'Мұндай ойыншы жоқ', 'No such player'],
  ['За этого игрока уже играет бот', 'Бұл ойыншының орнына бот ойнап жатыр', 'A bot is already playing for this player'],
  ['Это и так бот', 'Бұл бұрыннан бот', 'This is already a bot'],
  ['Неизвестный уровень бота', 'Боттың белгісіз деңгейі', 'Unknown bot level'],
  ['Этого игрока уже выгнали', 'Бұл ойыншы бұрын шығарылған', 'This player was already removed'],
  ['Это бот — выгонять некого', 'Бұл бот — шығаратын ешкім жоқ', "This is a bot — there's no one to remove"],
  ['Сначала нужно дождаться сброса карт (или сбросить за игроков)', 'Алдымен карта тастауды күту керек (немесе ойыншылардың орнына тастау)', 'Wait for the discards first (or discard for the players)'],
  ['Сейчас никто не сбрасывает карты', 'Қазір ешкім карта тастамайды', 'Nobody is discarding right now'],
  ['Этому игроку не нужно сбрасывать карты', 'Бұл ойыншыға карта тастаудың қажеті жоқ', "This player doesn't need to discard"],
  ['Повторяющиеся игроки', 'Ойыншылар қайталанады', 'Duplicate players'],
  ['У игроков должны быть разные цвета', 'Ойыншылардың түстері әртүрлі болуы керек', 'Players must have different colors'],
  ['Ведущий убрал тебя из этой игры', 'Жүргізуші сені бұл ойыннан шығарды', 'The host removed you from this game'],
  ['Игра уже идёт — войти можно под своим именем из этой партии', 'Ойын басталып кеткен — осы партиядағы өз атыңмен кіре аласың', 'The game is already running — you can join under your name from this game'],
  ['Напиши имя', 'Атыңды жаз', 'Enter a name'],
  ['Такое имя уже занято', 'Мұндай ат бос емес', 'This name is already taken'],
  ['Занять место бота можно только во время партии', 'Боттың орнын тек партия кезінде алуға болады', "You can take a bot's seat only during a game"],
  ['Ты уже за столом', 'Сен үстел басындасың', "You're already at the table"],
  ['Это место не бота', 'Бұл орын ботқа тиесілі емес', "This seat isn't a bot's"],
  ['Сначала войди в игру', 'Алдымен ойынға кір', 'Join the game first'],
  ['Нет такого цвета', 'Мұндай түс жоқ', 'No such color'],
  ['Этот цвет уже занят', 'Бұл түс бос емес', 'This color is taken'],
  ['Нет такого уровня', 'Мұндай деңгей жоқ', 'No such level'],
  ['Себя выгнать нельзя — нажми «Выйти»', 'Өзіңді шығаруға болмайды — «Шығу» бас', "You can't remove yourself — tap “Leave”"],
  ['Нужен хотя бы один живой игрок', 'Кемінде бір тірі ойыншы керек', 'At least one human player is needed'],
  ['Игра ещё не началась', 'Ойын әлі басталған жоқ', "The game hasn't started yet"],
  ['Ты не участвуешь в этой партии', 'Сен бұл партияға қатыспайсың', "You're not in this game"],
  ['Непонятное действие', 'Түсініксіз әрекет', 'Unclear action'],
  ['Партия на паузе — сначала «Продолжить»', 'Партия үзілісте — алдымен «Жалғастыру»', 'The game is paused — tap “Resume” first'],
  ['За тебя сейчас играет бот — нажми «Вернуться в игру»', 'Қазір сенің орныңа бот ойнап жатыр — «Ойынға оралу» бас', 'A bot is playing for you — tap “Return to game”'],
  ['Кубики уже брошены', 'Сүйек бұрын тасталған', 'The dice are already rolled'],
  ['Отменить уже нельзя — после постройки что-то произошло', 'Енді болдырмауға болмайды — құрылыстан кейін бірдеңе болды', "Can't undo — something happened after the build"],
  ['Это может только ведущий', 'Мұны тек жүргізуші жасай алады', 'Only the host can do this'],
  ['Партия на паузе', 'Партия үзілісте', 'The game is paused'],
  ['Пауза — только во время партии', 'Үзіліс — тек партия кезінде', 'Pause works only during a game'],
  ['Паузу ставят игроки за столом', 'Үзілісті үстел басындағы ойыншылар қояды', 'Only players at the table can pause'],
  ['Ведущий закрыл комнату', 'Жүргізуші бөлмені жапты', 'The host closed the room'],
  ['Введи, что выпало на кубиках', 'Сүйекке не түскенін енгіз', 'Enter what the dice show'],
  ['На кубике от 1 до 6', 'Сүйекте 1-ден 6-ға дейін', 'A die shows 1 to 6'],
  ['Это можно только в лобби', 'Мұны тек лобби кезінде жасауға болады', 'This is possible only in the lobby'],
  ['Такого игрока нет', 'Мұндай ойыншы жоқ', 'No such player'],
  ['Не удалось придумать PIN', 'PIN ойлап табу мүмкін болмады', "Couldn't generate a PIN"],
  ['Плохой ключ клиента', 'Клиент кілті жарамсыз', 'Bad client key'],
  ['Сначала hello', 'Алдымен hello', 'Say hello first'],
  ['Плохое имя', 'Жарамсыз ат', 'Bad name'],
  ['Не удалось включить уведомления', 'Хабарландыруларды қосу мүмкін болмады', "Couldn't enable notifications"],
  ['Сначала открой комнату', 'Алдымен бөлмені аш', 'Open a room first'],
  ['Плохой запрос', 'Жарамсыз сұрау', 'Bad request'],
  ['Нет такого игрока', 'Мұндай ойыншы жоқ', 'No such player'],
  ['Сначала сядь за стол', 'Алдымен үстелге отыр', 'Sit at the table first'],
  ['Звать можно только друзей', 'Тек достарды шақыруға болады', 'You can invite friends only'],
  ['Уже позвали — подожди немного', 'Шақырылды — аздап күте тұр', 'Already invited — wait a bit'],
  ['Вход через Telegram ещё не настроен', 'Telegram арқылы кіру әлі бапталмаған', 'Telegram sign-in is not set up yet'],
  ['Вход через AQL Portal ещё не настроен', 'AQL Portal арқылы кіру әлі бапталмаған', 'AQL Portal sign-in is not set up yet'],
  ['Ссылка входа из AQL Portal устарела — открой игру из портала ещё раз', 'AQL Portal кіру сілтемесі ескірген — ойынды порталдан қайта аш', 'The AQL Portal sign-in link has expired — open the game from the portal again'],
  ['Telegram не подтвердил вход', 'Telegram кіруді растамады', "Telegram didn't confirm the sign-in"],
  ['Слишком много новых комнат — подожди', 'Жаңа бөлмелер тым көп — күте тұр', 'Too many new rooms — wait a bit'],
  ['Сервер переполнен, попробуй позже', 'Сервер толып кетті, кейінірек көр', 'The server is full, try later'],
  ['Игра с таким PIN не найдена', 'Мұндай PIN-ді ойын табылмады', 'No game with this PIN'],
  ['Отменить нельзя', 'Болдырмауға болмайды', "Can't undo"],
  ['Непонятное сообщение', 'Түсініксіз хабар', 'Unclear message'],
  ['Слишком много действий — подожди', 'Әрекет тым көп — күте тұр', 'Too many actions — wait a bit'],
  ['Слишком много сообщений', 'Хабар тым көп', 'Too many messages'],
  ['Друзей уже 100 — убери кого-нибудь', 'Достар қазірдің өзінде 100 — біреуін өшір', 'You already have 100 friends — remove someone'],
];
// Шаблоны с подстановкой: захваты → {1}, {2}. Склонение числа карт для ru не нужно (ru идёт без перевода).
const ERR_RE: [RegExp, string, string][] = [
  [/^Нужно от (\d+) до (\d+) игроков$/, '{1}–{2} ойыншы керек', '{1} to {2} players are needed'],
  [/^За столом уже (\d+) игроков$/, 'Үстел басында қазірдің өзінде {1} ойыншы', 'The table already has {1} players'],
  [/^Уже (\d+) игроков$/, 'Қазірдің өзінде {1} ойыншы', 'Already {1} players'],
  [/^Нужно минимум (\d+) игрока — добавь ботов$/, 'Кемінде {1} ойыншы керек — бот қос', 'At least {1} players are needed — add bots'],
  [/^Не все выбрали цвет: (.*)$/, 'Барлығы түс таңдаған жоқ: {1}', "Not everyone picked a color: {1}"],
  [/^Нужно сбросить ровно (\d+) (?:карту|карты|карт)$/, 'Дәл {1} карта тастау керек', 'You must discard exactly {1}'],
  [/^Нужно (\d+) (?:карта|карты|карт) этого ресурса$/, 'Бұл ресурстан {1} карта керек', 'You need {1} of this resource'],
];

/** Ошибка сервера на языке игрока; незнакомая строка проходит без изменений. */
export function trServerError(text: string): string {
  const lang = getLang();
  if (lang === 'ru' || !text) return text;
  const i = lang === 'kz' ? 1 : 2;
  const hit = ERR.find((e) => e[0] === text);
  if (hit) return hit[i];
  for (const [re, kz, en] of ERR_RE) {
    const m = re.exec(text);
    if (m) return (lang === 'kz' ? kz : en).replace(/\{(\d)\}/g, (_, n) => m[Number(n)] ?? '');
  }
  return text;
}
