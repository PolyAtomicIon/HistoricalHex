// Хост: создаёт комнату, ведёт лобби, запускает игру и обрабатывает очередь действий.
// Страница хоста — единственный «мозг» игры: только она меняет состояние.

import type { DatabaseReference, Unsubscribe } from 'firebase/database';
import { get, onChildAdded, onDisconnect, onValue, ref, remove, serverTimestamp, set, update } from 'firebase/database';
import type { BotLevel, GameState, HostAction, PlayerColor, PlayerId, PublicState } from '../engine';
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
} from '../engine';
import type { ActionResult } from '../engine';
import type { BotMemory } from '../bots';
import { BOT_NAMES, botsToAct, decide } from '../bots';
import type { Connection } from './firebase';
import { clean, describeError } from './firebase';
import type { LobbyEntry, LobbyPlayer, Presence, QueuedAction, RoomMeta, RoomSettings, RoomStatus } from './types';
import { DEFAULT_ROOM_SETTINGS, lobbyList, roomPath } from './types';

export interface HostSnapshot {
  pin: string;
  status: RoomStatus;
  settings: RoomSettings;
  lobby: LobbyPlayer[];
  presence: Record<PlayerId, Presence>;
  /** Полное состояние игры (только у хоста). */
  state?: GameState;
  /** Последняя ошибка записи в базу, если была. */
  error?: string;
}

type Listener = (snap: HostSnapshot) => void;

/** Пауза перед ходом бота (чтобы на телевизоре было видно, что он делает). */
const BOT_DELAY_MS = 1300;
/** Пауза перед ответом бота на обмен / сбросом на 7. */
const BOT_REPLY_MS = 900;

export class HostRoom {
  private readonly room: DatabaseReference;
  private listeners = new Set<Listener>();
  private unsubs: Unsubscribe[] = [];
  private actionsUnsub?: Unsubscribe;
  private queue: Promise<void> = Promise.resolve();
  private lobbyRaw: Record<PlayerId, LobbyEntry> = {};
  private presence: Record<PlayerId, Presence> = {};
  private lastPublic: Partial<Record<keyof PublicState, string>> = {};
  private lastPrivate: Record<PlayerId, string> = {};
  private snap: HostSnapshot;
  private disposed = false;
  private botTimer?: ReturnType<typeof setTimeout>;
  private botMemory: Record<PlayerId, BotMemory> = {};

  private constructor(
    private readonly conn: Connection,
    readonly pin: string,
    meta: RoomMeta,
    state?: GameState,
  ) {
    this.room = ref(conn.db, roomPath(pin));
    this.snap = { pin, status: meta.status, settings: meta.settings, lobby: [], presence: {}, state };
  }

  /** Новая комната со случайным 6-значным PIN. */
  static async create(conn: Connection, settings: Partial<RoomSettings> = {}): Promise<HostRoom> {
    const meta = {
      hostUid: conn.uid,
      created: serverTimestamp(),
      status: 'lobby' as RoomStatus,
      settings: { ...DEFAULT_ROOM_SETTINGS, ...settings },
    };
    let lastError: unknown;
    for (let attempt = 0; attempt < 10; attempt++) {
      const pin = String(100000 + Math.floor(cryptoRng() * 900000));
      try {
        // Правила разрешают создать meta, только если комнаты с таким PIN ещё нет.
        await set(ref(conn.db, `${roomPath(pin)}/meta`), meta);
        const room = new HostRoom(conn, pin, { ...meta, created: conn.now() });
        room.attach();
        return room;
      } catch (e) {
        lastError = e;
      }
    }
    throw new Error('Не удалось создать комнату: ' + describeError(lastError));
  }

  /** Вернуться в свою комнату после перезагрузки страницы. null — комнаты нет или она чужая. */
  static async resume(conn: Connection, pin: string): Promise<HostRoom | null> {
    const metaSnap = await get(ref(conn.db, `${roomPath(pin)}/meta`));
    const meta = metaSnap.val() as RoomMeta | null;
    if (!meta || meta.hostUid !== conn.uid) return null;
    let state: GameState | undefined;
    if (meta.status !== 'lobby') {
      const s = (await get(ref(conn.db, `${roomPath(pin)}/hostOnly/state`))).val() as GameState | null;
      if (s) state = normalizeState(s);
    }
    const room = new HostRoom(conn, pin, { ...meta, settings: { ...DEFAULT_ROOM_SETTINGS, ...meta.settings } }, state);
    room.attach();
    if (state) {
      // Перезаписываем представления целиком: вдруг прошлая запись не дошла.
      await room.write(room.stateUpdates(state, true));
    }
    return room;
  }

  get snapshot(): HostSnapshot {
    return this.snap;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snap);
    return () => this.listeners.delete(listener);
  }

  /** Адрес для QR-кода: страница игрока с PIN. */
  joinUrl(base: string): string {
    const url = new URL(base);
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/[^/]*$/, '');
    url.searchParams.set('pin', this.pin);
    return url.toString();
  }

  async updateSettings(settings: Partial<RoomSettings>): Promise<void> {
    if (this.snap.status !== 'lobby') throw new Error('Настройки меняются только в лобби');
    const next = { ...this.snap.settings, ...settings };
    await update(this.room, { 'meta/settings': next });
    this.emit({ settings: next });
  }

  /** Добавить бота в лобби: имя и свободный цвет выбираются сами. */
  async addBot(level: BotLevel): Promise<void> {
    if (this.snap.status !== 'lobby') throw new Error('Ботов можно добавлять только в лобби');
    if (Object.keys(this.lobbyRaw).length >= MAX_PLAYERS) throw new Error(`Уже ${MAX_PLAYERS} игроков`);
    const colors = ((await get(ref(this.conn.db, `${roomPath(this.pin)}/colors`))).val() ?? {}) as Partial<
      Record<PlayerColor, string>
    >;
    const color = PLAYER_COLORS.find((c) => !colors[c]);
    if (!color) throw new Error('Свободных цветов не осталось');
    const used = new Set(Object.values(this.lobbyRaw).map((e) => e.name));
    const base = BOT_NAMES.find((n) => !used.has(`🤖 ${n}`)) ?? `Бот ${Object.keys(this.lobbyRaw).length + 1}`;
    const id = `bot-${Math.floor(cryptoRng() * 1e9).toString(36)}`;
    await update(this.room, {
      [`lobby/${id}`]: { name: `🤖 ${base}`, color, joinedAt: serverTimestamp(), bot: level },
      [`colors/${color}`]: id,
    });
  }

  /** Выгнать игрока из лобби (повторно войти он не сможет). Бота — просто убрать. */
  async kick(uid: PlayerId): Promise<void> {
    if (this.snap.status !== 'lobby') throw new Error('Выгнать игрока можно только в лобби');
    const color = this.lobbyRaw[uid]?.color;
    if (this.lobbyRaw[uid]?.bot) {
      await update(this.room, { [`lobby/${uid}`]: null, ...(color ? { [`colors/${color}`]: null } : {}) });
      return;
    }
    await update(this.room, {
      [`kicked/${uid}`]: true,
      [`lobby/${uid}`]: null,
      [`presence/${uid}`]: null,
      ...(color ? { [`colors/${color}`]: null } : {}),
    });
  }

  /** Начать игру с игроками из лобби. */
  async start(): Promise<void> {
    if (this.snap.status !== 'lobby') throw new Error('Игра уже идёт');
    const players = this.snap.lobby;
    if (players.length < MIN_PLAYERS) throw new Error(`Нужно минимум ${MIN_PLAYERS} игрока`);
    if (players.length > MAX_PLAYERS) throw new Error(`Максимум ${MAX_PLAYERS} игроков — лишних нужно убрать`);
    const noColor = players.filter((p) => !p.color);
    if (noColor.length) throw new Error('Не все выбрали цвет: ' + noColor.map((p) => p.name).join(', '));

    if (players.every((p) => p.bot)) throw new Error('Нужен хотя бы один живой игрок');
    const state = createGame(
      players.map((p) => ({ id: p.uid, name: p.name, color: p.color!, ...(p.bot ? { bot: p.bot } : {}) })),
      cryptoRng,
      { vpToWin: this.snap.settings.vpToWin },
    );
    await this.write({ ...this.stateUpdates(state, true), 'meta/status': 'playing' });
    this.snap = { ...this.snap, status: 'playing', state };
    this.listenActions();
    this.emit({});
    this.scheduleBots();
  }

  /** Кнопки хоста: пропустить ход, сбросить карты за игрока. */
  hostAction(action: HostAction): Promise<ActionResult> {
    return this.enqueue(async () => {
      const state = this.snap.state;
      if (!state) return { ok: false, error: 'Игра ещё не началась' };
      const res = applyHostAction(state, action, cryptoRng);
      if (res.ok) await this.commit(res.state);
      return res;
    });
  }

  /** Закрыть комнату: удалить всё из базы. */
  async close(): Promise<void> {
    this.dispose();
    await remove(this.room);
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.botTimer);
    this.botTimer = undefined;
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.actionsUnsub?.();
    this.actionsUnsub = undefined;
    try {
      void onDisconnect(ref(this.conn.db, `${roomPath(this.pin)}/host`))
        .cancel()
        .catch(() => undefined);
    } catch {
      // соединение уже закрыто — отменять нечего
    }
    this.listeners.clear();
  }

  // ───────────────────────── внутреннее ─────────────────────────

  private attach(): void {
    const db = this.conn.db;
    const base = roomPath(this.pin);

    // Отметка «хост в сети», чтобы игроки видели «Ждём ведущего…»
    this.unsubs.push(
      onValue(ref(db, '.info/connected'), (s) => {
        if (s.val() !== true) return;
        const hostRef = ref(db, `${base}/host`);
        void onDisconnect(hostRef)
          .set({ online: false, changedAt: serverTimestamp() })
          .then(() => set(hostRef, { online: true, changedAt: serverTimestamp() }))
          .catch((e) => this.emit({ error: describeError(e) }));
      }),
    );
    this.unsubs.push(
      onValue(ref(db, `${base}/lobby`), (s) => {
        this.lobbyRaw = (s.val() as Record<PlayerId, LobbyEntry> | null) ?? {};
        this.emit({ lobby: lobbyList(this.lobbyRaw, this.presence) });
      }),
    );
    this.unsubs.push(
      onValue(ref(db, `${base}/presence`), (s) => {
        this.presence = (s.val() as Record<PlayerId, Presence> | null) ?? {};
        this.emit({ presence: this.presence, lobby: lobbyList(this.lobbyRaw, this.presence) });
      }),
    );
    if (this.snap.status === 'playing') {
      this.listenActions();
      this.scheduleBots();
    }
  }

  private listenActions(): void {
    if (this.actionsUnsub) return;
    this.actionsUnsub = onChildAdded(ref(this.conn.db, `${roomPath(this.pin)}/actions`), (s) => {
      const key = s.key!;
      const queued = s.val() as QueuedAction;
      void this.enqueue(() => this.processAction(key, queued));
    });
  }

  /** Действия обрабатываются строго по одному, в порядке поступления. */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job);
    this.queue = run.then(
      () => undefined,
      (e) => this.emit({ error: describeError(e) }),
    );
    return run;
  }

  private async processAction(key: string, queued: QueuedAction): Promise<void> {
    const state = this.snap.state;
    const updates: Record<string, unknown> = { [`actions/${key}`]: null };
    if (!state || !queued?.uid) {
      await this.write(updates);
      return;
    }
    const res = applyAction(state, queued.uid, queued.action, cryptoRng);
    updates[`results/${queued.uid}`] = {
      actionId: key,
      ok: res.ok,
      ...(res.ok ? {} : { error: res.error }),
      at: serverTimestamp(),
    };
    if (res.ok) Object.assign(updates, this.stateUpdates(res.state, false));
    await this.write(updates);
    if (res.ok) this.setState(res.state);
  }

  private async commit(state: GameState): Promise<void> {
    await this.write(this.stateUpdates(state, false));
    this.setState(state);
  }

  private setState(state: GameState): void {
    const status: RoomStatus = state.phase === 'finished' ? 'finished' : 'playing';
    if (status !== this.snap.status) void this.write({ 'meta/status': status });
    this.emit({ state, status });
    this.scheduleBots();
  }

  // ───────────────────────── боты ─────────────────────────
  // За ботов решает хост: они видят только публичное состояние и свою руку (честная игра).

  private isBot = (id: PlayerId) => !!this.snap.state?.players[id]?.bot;

  /** Поставить таймер на следующий ход бота, если от какого-то бота сейчас ждут действия. */
  private scheduleBots(delay?: number): void {
    if (this.botTimer || this.disposed) return;
    const state = this.snap.state;
    if (!state || state.phase === 'finished') return;
    const pub = toPublicView(state);
    const actors = botsToAct(pub, this.isBot);
    if (!actors.length) return;
    const isTurn = actors[0] === pub.order[pub.current] && pub.phase !== 'discard';
    this.botTimer = setTimeout(
      () => {
        this.botTimer = undefined;
        void this.enqueue(() => this.runBots());
      },
      delay ?? (isTurn ? BOT_DELAY_MS : BOT_REPLY_MS),
    );
  }

  private async runBots(): Promise<void> {
    if (this.disposed) return;
    const state = this.snap.state;
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
        now: this.conn.now(),
      };
      const action = decide(ctx);
      if (!action) continue; // бот ждёт (например, ответов людей на свой обмен)
      let res = applyAction(state, id, action, cryptoRng);
      if (!res.ok) {
        // Подстраховка: если бот ошибся — делаем ход за него как лёгкий бот, потом — действием хоста
        const fallback = decide({ ...ctx, level: 'easy', memory: {} });
        if (fallback) res = applyAction(state, id, fallback, cryptoRng);
        if (!res.ok && pub.phase === 'discard') res = applyHostAction(state, { type: 'forceDiscard', player: id }, cryptoRng);
        else if (!res.ok && pub.order[pub.current] === id) res = applyHostAction(state, { type: 'skipTurn' }, cryptoRng);
      }
      if (res.ok) {
        await this.commit(res.state); // commit → setState → scheduleBots
        return;
      }
    }
    // Никто из ботов не сделал ход — проверим ещё раз чуть позже
    this.scheduleBots(1500);
  }

  /**
   * Что записать в базу для нового состояния. Публичную часть пишем по полям
   * и только изменившиеся — так телефоны скачивают меньше данных.
   */
  private stateUpdates(state: GameState, full: boolean): Record<string, unknown> {
    const updates: Record<string, unknown> = { 'hostOnly/state': state };
    const pub = toPublicView(state);
    for (const key of Object.keys(pub) as (keyof PublicState)[]) {
      const json = JSON.stringify(pub[key]);
      if (full || this.lastPublic[key] !== json) {
        updates[`public/${key}`] = pub[key] ?? null;
        this.lastPublic[key] = json;
      }
    }
    // Поля, которые исчезли (например trade после обмена)
    for (const key of Object.keys(this.lastPublic) as (keyof PublicState)[]) {
      if (!(key in pub)) {
        updates[`public/${key}`] = null;
        delete this.lastPublic[key];
      }
    }
    for (const pid of state.order) {
      const priv = toPrivateView(state, pid);
      const json = JSON.stringify(priv);
      if (full || this.lastPrivate[pid] !== json) {
        updates[`private/${pid}`] = priv;
        this.lastPrivate[pid] = json;
      }
    }
    return updates;
  }

  private async write(updates: Record<string, unknown>): Promise<void> {
    try {
      await update(this.room, clean(updates));
    } catch (e) {
      // Кэш публичной части мог разойтись с базой — в следующий раз пишем всё.
      this.lastPublic = {};
      this.lastPrivate = {};
      throw e;
    }
  }

  private emit(patch: Partial<HostSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l(this.snap);
  }
}
