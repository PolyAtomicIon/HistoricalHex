// Хост: создаёт комнату, ведёт лобби, запускает игру и обрабатывает очередь действий.
// Страница хоста — единственный «мозг» игры: только она меняет состояние.

import type { DatabaseReference, Unsubscribe } from 'firebase/database';
import { get, onChildAdded, onDisconnect, onValue, ref, remove, serverTimestamp, set, update } from 'firebase/database';
import type { GameState, HostAction, PlayerId, PublicState } from '../engine';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  applyAction,
  applyHostAction,
  createGame,
  cryptoRng,
  normalizeState,
  toPrivateView,
  toPublicView,
} from '../engine';
import type { ActionResult } from '../engine';
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

  /** Выгнать игрока из лобби (повторно войти он не сможет). */
  async kick(uid: PlayerId): Promise<void> {
    if (this.snap.status !== 'lobby') throw new Error('Выгнать игрока можно только в лобби');
    const color = this.lobbyRaw[uid]?.color;
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

    const state = createGame(
      players.map((p) => ({ id: p.uid, name: p.name, color: p.color! })),
      cryptoRng,
      { vpToWin: this.snap.settings.vpToWin },
    );
    await this.write({ ...this.stateUpdates(state, true), 'meta/status': 'playing' });
    this.snap = { ...this.snap, status: 'playing', state };
    this.listenActions();
    this.emit({});
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
    if (this.snap.status === 'playing') this.listenActions();
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
