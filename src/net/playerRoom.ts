// Игрок: вход по PIN, выбор цвета, отправка действий, подписка на состояние.

import type { DatabaseReference, Unsubscribe } from 'firebase/database';
import { get, onDisconnect, onValue, push, ref, serverTimestamp, set, update } from 'firebase/database';
import type { Action, PlayerColor, PlayerId, PrivateView, PublicState } from '../engine';
import { PLAYER_COLORS, normalizePrivateView, normalizePublicView } from '../engine';
import type { Connection } from './firebase';
import { clean, describeError } from './firebase';
import type { ActionResultRecord, LobbyEntry, LobbyPlayer, Presence, RoomMeta } from './types';
import { lobbyList, roomPath } from './types';

export interface PlayerSnapshot {
  pin: string;
  uid: PlayerId;
  meta?: RoomMeta;
  lobby: LobbyPlayer[];
  /** Кто какой цвет занял. */
  colors: Partial<Record<PlayerColor, PlayerId>>;
  hostOnline: boolean;
  public?: PublicState;
  private?: PrivateView;
  /** Ответ хоста на последнее действие этого игрока. */
  lastResult?: ActionResultRecord;
  kicked: boolean;
  /** Ведущий закрыл комнату. */
  closed: boolean;
}

type Listener = (snap: PlayerSnapshot) => void;

export const NAME_MAX = 20;

export class PlayerRoom {
  private readonly room: DatabaseReference;
  private listeners = new Set<Listener>();
  private unsubs: Unsubscribe[] = [];
  private lobbyRaw: Record<PlayerId, LobbyEntry> = {};
  private presence: Record<PlayerId, Presence> = {};
  private snap: PlayerSnapshot;

  private constructor(
    private readonly conn: Connection,
    readonly pin: string,
  ) {
    this.room = ref(conn.db, roomPath(pin));
    this.snap = { pin, uid: conn.uid, lobby: [], colors: {}, hostOnline: true, kicked: false, closed: false };
  }

  /**
   * Войти в комнату. В лобби — записывает имя; если игра уже идёт —
   * пускает только тех, кто в ней участвует (переподключение).
   */
  static async join(conn: Connection, pin: string, name: string): Promise<PlayerRoom> {
    const cleanPin = pin.replace(/\D/g, '');
    if (cleanPin.length !== 6) throw new Error('PIN — это 6 цифр');
    const trimmed = name.trim().slice(0, NAME_MAX);
    const base = roomPath(cleanPin);

    const meta = (await get(ref(conn.db, `${base}/meta`))).val() as RoomMeta | null;
    if (!meta) throw new Error('Игра с таким PIN не найдена');
    if ((await get(ref(conn.db, `${base}/kicked/${conn.uid}`))).exists()) {
      throw new Error('Ведущий удалил тебя из этой игры');
    }

    if (meta.status === 'lobby') {
      if (!trimmed) throw new Error('Введи имя');
      const existing = await get(ref(conn.db, `${base}/lobby/${conn.uid}`));
      try {
        if (existing.exists()) await update(ref(conn.db, `${base}/lobby/${conn.uid}`), { name: trimmed });
        else await set(ref(conn.db, `${base}/lobby/${conn.uid}`), { name: trimmed, joinedAt: serverTimestamp() });
      } catch (e) {
        throw new Error('Не получилось войти: ' + describeError(e));
      }
    } else {
      const inGame = await get(ref(conn.db, `${base}/public/players/${conn.uid}`));
      if (!inGame.exists()) throw new Error('Игра уже началась — войти могут только её участники');
    }

    const room = new PlayerRoom(conn, cleanPin);
    room.attach();
    return room;
  }

  /** Есть ли у этого устройства место в комнате (для автоматического возвращения). */
  static async isMember(conn: Connection, pin: string): Promise<boolean> {
    const base = roomPath(pin);
    try {
      const meta = (await get(ref(conn.db, `${base}/meta`))).val() as RoomMeta | null;
      if (!meta) return false;
      const path = meta.status === 'lobby' ? `lobby/${conn.uid}` : `public/players/${conn.uid}`;
      return (await get(ref(conn.db, `${base}/${path}`))).exists();
    } catch {
      return false;
    }
  }

  get snapshot(): PlayerSnapshot {
    return this.snap;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snap);
    return () => this.listeners.delete(listener);
  }

  async chooseColor(color: PlayerColor): Promise<void> {
    if (!PLAYER_COLORS.includes(color)) throw new Error('Такого цвета нет');
    const owner = this.snap.colors[color];
    if (owner === this.conn.uid) return;
    if (owner) throw new Error('Этот цвет уже занят');
    const old = this.lobbyRaw[this.conn.uid]?.color;
    try {
      await update(this.room, {
        [`colors/${color}`]: this.conn.uid,
        [`lobby/${this.conn.uid}/color`]: color,
        ...(old ? { [`colors/${old}`]: null } : {}),
      });
    } catch {
      throw new Error('Этот цвет уже занят');
    }
  }

  /** Выйти из лобби (место и цвет освобождаются). */
  async leave(): Promise<void> {
    const color = this.lobbyRaw[this.conn.uid]?.color;
    this.dispose();
    if (this.snap.meta?.status !== 'lobby') return;
    await update(this.room, {
      [`lobby/${this.conn.uid}`]: null,
      ...(color ? { [`colors/${color}`]: null } : {}),
    }).catch(() => undefined);
  }

  /** Отправить действие хосту. Возвращает id действия; ответ придёт в snapshot.lastResult. */
  async send(action: Action): Promise<string> {
    const r = await push(ref(this.conn.db, `${roomPath(this.pin)}/actions`), clean({
      uid: this.conn.uid,
      action,
      at: serverTimestamp(),
    }));
    return r.key!;
  }

  dispose(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    try {
      void onDisconnect(ref(this.conn.db, `${roomPath(this.pin)}/presence/${this.conn.uid}`))
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
    const uid = this.conn.uid;
    const watch = (path: string, fn: (v: unknown) => void) => {
      this.unsubs.push(
        onValue(
          ref(db, `${base}/${path}`),
          (s) => fn(s.val()),
          () => undefined, // нет доступа (например, комнату закрыли) — просто молчим
        ),
      );
    };

    // «в сети / не в сети» — на этом построен таймер переподключения у хоста
    this.unsubs.push(
      onValue(ref(db, '.info/connected'), (s) => {
        if (s.val() !== true) return;
        const presRef = ref(db, `${base}/presence/${uid}`);
        void onDisconnect(presRef)
          .set({ online: false, changedAt: serverTimestamp() })
          .then(() => set(presRef, { online: true, changedAt: serverTimestamp() }))
          .catch(() => undefined);
      }),
    );

    watch('meta', (v) => {
      if (v) this.emit({ meta: v as RoomMeta });
      else this.emit({ closed: true });
    });
    watch('lobby', (v) => {
      this.lobbyRaw = (v as Record<PlayerId, LobbyEntry> | null) ?? {};
      this.emit({ lobby: lobbyList(this.lobbyRaw, this.presence) });
    });
    watch('presence', (v) => {
      this.presence = (v as Record<PlayerId, Presence> | null) ?? {};
      this.emit({ lobby: lobbyList(this.lobbyRaw, this.presence) });
    });
    watch('colors', (v) => this.emit({ colors: (v as PlayerSnapshot['colors'] | null) ?? {} }));
    watch('host', (v) => this.emit({ hostOnline: (v as Presence | null)?.online ?? false }));
    watch(`kicked/${uid}`, (v) => this.emit({ kicked: v === true }));
    watch('public', (v) => this.emit({ public: v ? normalizePublicView(v as PublicState) : undefined }));
    watch(`private/${uid}`, (v) => this.emit({ private: v ? normalizePrivateView(v as PrivateView) : undefined }));
    watch(`results/${uid}`, (v) => this.emit({ lastResult: (v as ActionResultRecord | null) ?? undefined }));
  }

  private emit(patch: Partial<PlayerSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l(this.snap);
  }
}
