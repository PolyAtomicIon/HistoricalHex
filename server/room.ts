// Комната на сервере: единственный источник правды. Движок правил и боты работают здесь.

import type { Action, BotLevel, GameEvent, GameState, HostAction, PlayerColor, PlayerId, Rng } from '../src/engine';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLORS,
  applyAction,
  applyHostAction,
  createGame,
  cryptoRng,
  normalizeState,
  toPrivateView,
  toPublicView,
} from '../src/engine';
import type { ActionResult } from '../src/engine';
import type { BotMemory } from '../src/bots';
import { BOT_NAMES, botsToAct, decide } from '../src/bots';
import type { DiceSource, RoomSettings, RoomStatus, RoomView, Seat, ServerMsg } from '../src/proto';
import { DEFAULT_SETTINGS, OFFLINE_BOT_LEVEL } from '../src/proto';
import { RandomOrgDice } from '../src/net/randomOrg';

const BOT_DELAY_MS = Number(process.env.BOT_DELAY_MS ?? 1300);
const BOT_REPLY_MS = Number(process.env.BOT_REPLY_MS ?? 900);
export const NAME_MAX = 20;

/** Общий запас бросков random.org на весь сервер. */
const randomOrg = new RandomOrgDice();

export interface Client {
  me: PlayerId;
  send(msg: ServerMsg): void;
}

export interface SavedRoom {
  pin: string;
  hostId: PlayerId;
  created: number;
  touched: number;
  status: RoomStatus;
  settings: RoomSettings;
  seats: Omit<Seat, 'online'>[];
  kicked: PlayerId[];
  state?: GameState;
}

/** От кого игра сейчас ждёт действия. */
function waitingOn(state: GameState): PlayerId[] {
  if (state.phase === 'finished') return [];
  if (state.phase === 'discard') return Object.keys(state.pendingDiscards ?? {});
  return [state.order[state.current]];
}

/** Строка ошибки для человека. */
const err = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Кубики, которые движок выбросит, если rng вернёт эти значения. */
function fixedDiceRng(d: [number, number]): Rng {
  let i = 0;
  return () => (i < 2 ? (d[i++] - 0.5) / 6 : cryptoRng());
}

export class Room {
  readonly pin: string;
  hostId: PlayerId;
  created: number;
  touched: number;
  status: RoomStatus;
  settings: RoomSettings;
  seats = new Map<PlayerId, Omit<Seat, 'online'>>();
  kicked = new Set<PlayerId>();
  state?: GameState;
  diceSource?: DiceSource;

  private clients = new Set<Client>();
  /** Когда игрок ушёл из сети (если не в сети). */
  private offlineSince = new Map<PlayerId, number>();
  private waitingSince = new Map<PlayerId, number>();
  private botMemory: Record<PlayerId, BotMemory> = {};
  private botTimer?: ReturnType<typeof setTimeout>;
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;

  constructor(
    data: SavedRoom,
    private readonly onChange: (room: Room) => void,
  ) {
    this.pin = data.pin;
    this.hostId = data.hostId;
    this.created = data.created;
    this.touched = data.touched;
    this.status = data.status;
    this.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    for (const s of data.seats) this.seats.set(s.id, s);
    for (const k of data.kicked) this.kicked.add(k);
    if (data.state) {
      this.state = normalizeState(data.state);
      const now = Date.now();
      for (const pid of waitingOn(this.state)) this.waitingSince.set(pid, now);
      // После перезапуска сервера все считаются отключёнными, пока не подключатся снова
      for (const pid of this.state.order) if (!this.state.players[pid].bot) this.offlineSince.set(pid, now);
      this.scheduleBots();
    }
    if (this.settings.dice === 'randomOrg') void randomOrg.refill();
  }

  toJSON(): SavedRoom {
    return {
      pin: this.pin,
      hostId: this.hostId,
      created: this.created,
      touched: this.touched,
      status: this.status,
      settings: this.settings,
      seats: [...this.seats.values()],
      kicked: [...this.kicked],
      state: this.state,
    };
  }

  // ───────────────────────── подключения ─────────────────────────

  attach(c: Client): void {
    this.clients.add(c);
    this.offlineSince.delete(c.me);
    this.touch();
    this.broadcast();
  }

  detach(c: Client): void {
    this.clients.delete(c);
    if (![...this.clients].some((o) => o.me === c.me)) this.offlineSince.set(c.me, Date.now());
    this.broadcast();
  }

  isOnline(pid: PlayerId): boolean {
    return [...this.clients].some((c) => c.me === pid);
  }

  get clientCount(): number {
    return this.clients.size;
  }

  // ───────────────────────── лобби ─────────────────────────

  join(me: PlayerId, name: string): void {
    if (this.kicked.has(me)) throw new Error('Ведущий убрал тебя из этой игры');
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
    if (this.seats.has(me)) {
      if (clean && this.status === 'lobby') this.seats.get(me)!.name = clean;
      return this.changed();
    }
    if (this.status !== 'lobby') {
      // Новый телефон/браузер: занять своё место по имени, если старое устройство не в сети
      const seat = [...this.seats.values()].find((x) => !x.bot && x.name.toLowerCase() === clean.toLowerCase());
      if (seat && !this.kicked.has(seat.id) && !this.isOnline(seat.id)) {
        this.rebind(seat.id, me);
        return this.changed();
      }
      throw new Error('Игра уже идёт — войти можно под своим именем из этой партии');
    }
    if (!clean) throw new Error('Напиши имя');
    if (this.seats.size >= MAX_PLAYERS) throw new Error(`За столом уже ${MAX_PLAYERS} игроков`);
    if ([...this.seats.values()].some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
      throw new Error('Такое имя уже занято');
    }
    const color = PLAYER_COLORS.find((c) => ![...this.seats.values()].some((s) => s.color === c));
    this.seats.set(me, { id: me, name: clean, color, joinedAt: Date.now() });
    this.changed();
  }

  /** Перенести место игрока на новый id (вход с другого устройства). */
  private rebind(oldId: PlayerId, newId: PlayerId): void {
    const seat = this.seats.get(oldId)!;
    this.seats.delete(oldId);
    this.seats.set(newId, { ...seat, id: newId });
    if (this.hostId === oldId) this.hostId = newId;
    if (this.state) {
      // id — случайные строки, в состоянии они встречаются только как id игрока
      this.state = normalizeState(JSON.parse(JSON.stringify(this.state).split(JSON.stringify(oldId)).join(JSON.stringify(newId))));
    }
    for (const m of [this.offlineSince, this.waitingSince]) {
      if (m.has(oldId)) {
        m.set(newId, m.get(oldId)!);
        m.delete(oldId);
      }
    }
    this.offlineSince.delete(newId);
    delete this.botMemory[oldId];
  }

  setColor(me: PlayerId, color: PlayerColor): void {
    this.lobbyOnly();
    const seat = this.seats.get(me);
    if (!seat) throw new Error('Сначала войди в игру');
    if (!PLAYER_COLORS.includes(color)) throw new Error('Нет такого цвета');
    const owner = [...this.seats.values()].find((s) => s.color === color);
    if (owner && owner.id !== me) throw new Error('Этот цвет уже занят');
    seat.color = color;
    this.changed();
  }

  leaveLobby(me: PlayerId): void {
    if (this.status !== 'lobby') return;
    this.seats.delete(me);
    this.changed();
  }

  updateSettings(me: PlayerId, patch: Partial<RoomSettings>): void {
    this.hostOnly(me);
    this.lobbyOnly();
    const next = { ...this.settings };
    if (patch.vpToWin !== undefined && [8, 10, 12].includes(patch.vpToWin)) next.vpToWin = patch.vpToWin;
    if (patch.reconnectSeconds !== undefined && patch.reconnectSeconds >= 15 && patch.reconnectSeconds <= 600) {
      next.reconnectSeconds = Math.round(patch.reconnectSeconds);
    }
    if (patch.offlineBot !== undefined) next.offlineBot = !!patch.offlineBot;
    if (patch.dice && ['randomOrg', 'balanced', 'random', 'physical'].includes(patch.dice)) next.dice = patch.dice;
    if (typeof patch.lore === 'string' && /^[a-z0-9-]{1,32}$/.test(patch.lore)) next.lore = patch.lore;
    this.settings = next;
    if (next.dice === 'randomOrg') void randomOrg.refill();
    this.changed();
  }

  addBot(me: PlayerId, level: BotLevel): void {
    this.hostOnly(me);
    this.lobbyOnly();
    if (!['easy', 'medium', 'hard'].includes(level)) throw new Error('Нет такого уровня');
    if (this.seats.size >= MAX_PLAYERS) throw new Error(`Уже ${MAX_PLAYERS} игроков`);
    const used = new Set([...this.seats.values()].map((s) => s.name));
    const color = PLAYER_COLORS.find((c) => ![...this.seats.values()].some((s) => s.color === c));
    const base = BOT_NAMES.find((n) => !used.has(`🤖 ${n}`)) ?? `Бот ${this.seats.size + 1}`;
    const id = `bot-${Math.floor(cryptoRng() * 1e9).toString(36)}`;
    this.seats.set(id, { id, name: `🤖 ${base}`, color, bot: level, joinedAt: Date.now() });
    this.changed();
  }

  kick(me: PlayerId, pid: PlayerId, level: BotLevel = 'medium'): void {
    this.hostOnly(me);
    if (pid === this.hostId) throw new Error('Себя выгнать нельзя — нажми «Выйти»');
    if (this.status === 'lobby') {
      const seat = this.seats.get(pid);
      this.seats.delete(pid);
      if (seat && !seat.bot) this.kicked.add(pid);
      return this.changed();
    }
    const res = this.applyHost({ type: 'kick', player: pid, level });
    if (!res.ok) throw new Error(res.error);
    this.kicked.add(pid);
    this.changed();
  }

  start(me: PlayerId): void {
    this.hostOnly(me);
    this.lobbyOnly();
    const seats = [...this.seats.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    if (seats.length < MIN_PLAYERS) throw new Error(`Нужно минимум ${MIN_PLAYERS} игрока — добавь ботов`);
    if (seats.every((s) => s.bot)) throw new Error('Нужен хотя бы один живой игрок');
    const noColor = seats.filter((s) => !s.color);
    if (noColor.length) throw new Error('Не все выбрали цвет: ' + noColor.map((p) => p.name).join(', '));
    const state = createGame(
      seats.map((s) => ({ id: s.id, name: s.name, color: s.color!, ...(s.bot ? { bot: s.bot } : {}) })),
      cryptoRng,
      { vpToWin: this.settings.vpToWin, balancedDice: this.settings.dice === 'balanced' },
    );
    this.status = 'playing';
    this.commit(state, [{ type: 'gameStarted', order: state.order }]);
  }

  // ───────────────────────── ходы ─────────────────────────

  act(me: PlayerId, action: Action, dice?: [number, number]): Promise<ActionResult> {
    return this.enqueue(() => {
      const state = this.state;
      if (!state) return { ok: false, error: 'Игра ещё не началась' };
      if (this.kicked.has(me)) return { ok: false, error: 'Ведущий убрал тебя из игры' };
      if (!Object.hasOwn(state.players, me)) return { ok: false, error: 'Ты не участвуешь в этой партии' };
      if (!action || typeof action !== 'object' || typeof action.type !== 'string') return { ok: false, error: 'Непонятное действие' };
      if (state.players[me].bot && action.type !== 'returnFromBot') {
        return { ok: false, error: 'За тебя сейчас играет бот — нажми «Вернуться в игру»' };
      }
      if (action?.type === 'rollDice') {
        if (state.order[state.current] !== me) return { ok: false, error: 'Сейчас не твой ход' };
        if (state.phase !== 'roll') return { ok: false, error: 'Кубики уже брошены' };
      }
      let rng: Rng;
      try {
        rng = this.rngFor(action, dice);
      } catch (e) {
        return { ok: false, error: err(e) };
      }
      const res = applyAction(state, me, action, rng);
      if (res.ok) {
        if (action.type === 'handToBot' || action.type === 'returnFromBot') delete this.botMemory[me];
        this.commit(res.state, res.events);
      }
      return res;
    });
  }

  hostAction(me: PlayerId, action: HostAction): Promise<ActionResult> {
    return this.enqueue(() => {
      if (me !== this.hostId) return { ok: false, error: 'Это может только ведущий' };
      return this.applyHost(action);
    });
  }

  close(me: PlayerId): void {
    this.hostOnly(me);
    for (const c of this.clients) c.send({ t: 'error', message: 'Ведущий закрыл комнату', fatal: true });
    this.dispose();
  }

  react(me: PlayerId, emoji: string): void {
    if (!this.seats.has(me) && me !== this.hostId) return;
    if (typeof emoji !== 'string' || emoji.length > 8) return;
    const at = Date.now();
    for (const c of this.clients) c.send({ t: 'react', from: me, emoji, at });
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.botTimer);
    this.clients.clear();
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  // ───────────────────────── внутреннее ─────────────────────────

  private applyHost(action: HostAction): ActionResult {
    const state = this.state;
    if (!state) return { ok: false, error: 'Игра ещё не началась' };
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') return { ok: false, error: 'Непонятное действие' };
    if ('player' in action && !Object.hasOwn(state.players, action.player)) return { ok: false, error: 'Нет такого игрока' };
    const res = applyHostAction(state, action, cryptoRng);
    if (res.ok) {
      if (action.type === 'handToBot' || action.type === 'kick') delete this.botMemory[action.player];
      this.commit(res.state, res.events);
    }
    return res;
  }

  private rngFor(action: Action, dice?: [number, number]): Rng {
    if (action.type !== 'rollDice') return cryptoRng;
    const mode = this.settings.dice;
    if (mode === 'physical') {
      if (!dice) throw new Error('Введи, что выпало на кубиках');
      const ok = Array.isArray(dice) && dice.length === 2 && dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6);
      if (!ok) throw new Error('На кубике от 1 до 6');
      this.diceSource = 'physical';
      return fixedDiceRng(dice);
    }
    if (mode === 'randomOrg') {
      const { rng, source } = randomOrg.rollRng();
      this.diceSource = source;
      return rng;
    }
    this.diceSource = mode;
    return cryptoRng;
  }

  /** Боты бросают с random.org, даже если люди бросают настоящие кубики. */
  private botRng(action: Action): Rng {
    if (action.type !== 'rollDice') return cryptoRng;
    if (this.settings.dice === 'balanced') {
      this.diceSource = 'balanced';
      return cryptoRng;
    }
    const { rng, source } = randomOrg.rollRng();
    this.diceSource = source;
    return rng;
  }

  private enqueue<T>(job: () => T | Promise<T>): Promise<T> {
    const run = this.queue.then(job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private commit(state: GameState, events: GameEvent[]): void {
    this.state = state;
    if (state.phase === 'finished') this.status = 'finished';
    const now = Date.now();
    const next = new Map<PlayerId, number>();
    for (const pid of waitingOn(state)) next.set(pid, this.waitingSince.get(pid) ?? now);
    this.waitingSince = next;
    this.changed();
    this.sendEvents(events);
    this.scheduleBots();
  }

  private sendEvents(events: GameEvent[]): void {
    if (!events.length) return;
    for (const c of this.clients) {
      const own = events.map((e) =>
        e.type === 'stole' && c.me !== e.thief && c.me !== e.victim ? { ...e, resource: undefined } : e,
      );
      c.send({ t: 'events', events: own, diceSource: this.diceSource });
    }
  }

  private changed(): void {
    this.touch();
    this.broadcast();
    this.onChange(this);
  }

  private touch(): void {
    this.touched = Date.now();
  }

  private hostOnly(me: PlayerId): void {
    if (me !== this.hostId) throw new Error('Это может только ведущий');
  }

  private lobbyOnly(): void {
    if (this.status !== 'lobby') throw new Error('Это можно только в лобби');
  }

  /** Кто будет заменён ботом и когда. */
  deadlines(): Record<PlayerId, number> {
    const out: Record<PlayerId, number> = {};
    const state = this.state;
    if (!state || !this.settings.offlineBot) return out;
    for (const [pid, since] of this.waitingSince) {
      if (state.players[pid]?.bot) continue;
      const off = this.offlineSince.get(pid);
      if (off === undefined) continue;
      out[pid] = Math.max(off, since) + this.settings.reconnectSeconds * 1000;
    }
    return out;
  }

  /** Раз в пару секунд (из main): заменить ботом тех, кто не вернулся вовремя. */
  tick(): void {
    if (this.disposed || !this.state || this.state.phase === 'finished') return;
    const now = Date.now();
    for (const [pid, deadline] of Object.entries(this.deadlines())) {
      if (now < deadline) continue;
      void this.enqueue(() => {
        if (this.state?.players[pid]?.bot) return;
        this.applyHost({ type: 'handToBot', player: pid, level: OFFLINE_BOT_LEVEL, auto: true });
      }).catch((e) => console.error('takeover failed', this.pin, e));
    }
  }

  view(me: PlayerId): RoomView {
    const state = this.state;
    const online: Record<PlayerId, boolean> = {};
    for (const s of this.seats.values()) online[s.id] = s.bot ? true : this.isOnline(s.id);
    const lobby: Seat[] = [...this.seats.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((s) => ({ ...s, online: online[s.id] }));
    const seated = this.seats.has(me) && !this.kicked.has(me);
    return {
      pin: this.pin,
      status: this.status,
      settings: this.settings,
      lobby,
      hostId: this.hostId,
      me,
      seated,
      isHost: me === this.hostId,
      ...(this.kicked.has(me) ? { kicked: true } : {}),
      ...(state ? { public: toPublicView(state) } : {}),
      ...(state && Object.hasOwn(state.players, me) && !this.kicked.has(me) ? { private: toPrivateView(state, me) } : {}),
      deadlines: this.deadlines(),
      online,
      diceSource: this.diceSource,
      serverNow: Date.now(),
    };
  }

  private broadcast(): void {
    for (const c of this.clients) c.send({ t: 'room', room: this.view(c.me) });
  }

  // ───────────────────────── боты ─────────────────────────

  private isBot = (id: PlayerId) => !!this.state?.players[id]?.bot;

  private scheduleBots(delay?: number): void {
    if (this.botTimer || this.disposed) return;
    const state = this.state;
    if (!state || state.phase === 'finished') return;
    const pub = toPublicView(state);
    const actors = botsToAct(pub, this.isBot);
    if (!actors.length) return;
    const isTurn = actors[0] === pub.order[pub.current] && pub.phase !== 'discard';
    this.botTimer = setTimeout(
      () => {
        this.botTimer = undefined;
        void this.enqueue(() => {
          try {
            this.runBots();
          } catch (e) {
            console.error('bot failed', this.pin, e);
            this.scheduleBots(3000);
          }
        }).catch((e) => console.error('bot queue failed', this.pin, e));
      },
      delay ?? (isTurn ? BOT_DELAY_MS : BOT_REPLY_MS),
    );
  }

  private runBots(): void {
    if (this.disposed) return;
    const state = this.state;
    if (!state || state.phase === 'finished') return;
    const pub = toPublicView(state);
    for (const id of botsToAct(pub, this.isBot)) {
      const ctx = {
        level: state.players[id].bot!,
        pub,
        priv: toPrivateView(state, id),
        me: id,
        rng: cryptoRng,
        memory: (this.botMemory[id] ??= {}),
        now: Date.now(),
      };
      const action = decide(ctx);
      if (!action) continue;
      let res = applyAction(state, id, action, this.botRng(action));
      if (!res.ok) {
        const fallback = decide({ ...ctx, level: 'easy', memory: {} });
        if (fallback) res = applyAction(state, id, fallback, this.botRng(fallback));
        if (!res.ok && pub.phase === 'discard') res = applyHostAction(state, { type: 'forceDiscard', player: id }, cryptoRng);
        else if (!res.ok && pub.order[pub.current] === id) res = applyHostAction(state, { type: 'skipTurn' }, cryptoRng);
      }
      if (res.ok) {
        this.commit(res.state, res.events);
        return;
      }
    }
    this.scheduleBots(1500);
  }
}
