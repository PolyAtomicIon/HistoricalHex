// Профили игроков: статистика, рейтинг, серия дней, коллекция эпох, вход через Telegram.
// Хранилище — SQLite (node:sqlite, Node 22) в DATA_DIR/hh.sqlite; без него (Node 20, тесты) — в памяти.
//
// Личность: устройство = id из секрета (как раньше). Профиль создаётся на устройство при первой партии.
// Вход через Telegram привязывает устройство к профилю с tg_id — так статистика собирается с разных телефонов.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { ProfileView, LeaderRow } from '../src/proto';

export interface Profile {
  id: string;
  tgId?: string;
  name: string;
  username?: string;
  photo?: string;
  rating: number;
  rated: number;
  games: number;
  wins: number;
  streakCur: number;
  streakBest: number;
  lastDay?: string;
  eras: Record<string, { games: number; wins: number }>;
  created: number;
}

export interface FinishedGame {
  id: string;
  era: string;
  finishedAt: number;
  /** Места по порядку: победитель первым. */
  players: { pid: string; name: string; bot?: 'easy' | 'medium' | 'hard'; vp: number; winner: boolean }[];
}

interface Store {
  getProfile(id: string): Profile | undefined;
  getByTg(tgId: string): Profile | undefined;
  putProfile(p: Profile): void;
  deviceProfile(pid: string): string | undefined;
  linkDevice(pid: string, profileId: string): void;
  hasGame(id: string): boolean;
  putGame(g: FinishedGame): void;
  top(n: number): Profile[];
}

// ───────────────────────── хранилища ─────────────────────────

class MemoryStore implements Store {
  profiles = new Map<string, Profile>();
  devices = new Map<string, string>();
  games = new Set<string>();
  getProfile = (id: string) => this.profiles.get(id);
  getByTg = (tg: string) => [...this.profiles.values()].find((p) => p.tgId === tg);
  putProfile = (p: Profile) => void this.profiles.set(p.id, structuredClone(p));
  deviceProfile = (pid: string) => this.devices.get(pid);
  linkDevice = (pid: string, id: string) => void this.devices.set(pid, id);
  hasGame = (id: string) => this.games.has(id);
  putGame = (g: FinishedGame) => void this.games.add(g.id);
  top = (n: number) => [...this.profiles.values()].filter((p) => p.games > 0).sort((a, b) => b.rating - a.rating).slice(0, n);
}

type Db = {
  exec(sql: string): void;
  prepare(sql: string): { get(...a: unknown[]): unknown; all(...a: unknown[]): unknown[]; run(...a: unknown[]): unknown };
};

class SqliteStore implements Store {
  constructor(private db: Db) {
    db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, tg_id TEXT UNIQUE, data TEXT NOT NULL, rating REAL NOT NULL, games INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS devices (pid TEXT PRIMARY KEY, profile_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, data TEXT NOT NULL, finished_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS profiles_rating ON profiles(rating DESC);
    `);
  }
  private row = (r: unknown) => (r ? (JSON.parse((r as { data: string }).data) as Profile) : undefined);
  getProfile = (id: string) => this.row(this.db.prepare('SELECT data FROM profiles WHERE id = ?').get(id));
  getByTg = (tg: string) => this.row(this.db.prepare('SELECT data FROM profiles WHERE tg_id = ?').get(tg));
  putProfile = (p: Profile) =>
    void this.db
      .prepare('INSERT INTO profiles (id, tg_id, data, rating, games) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET tg_id = excluded.tg_id, data = excluded.data, rating = excluded.rating, games = excluded.games')
      .run(p.id, p.tgId ?? null, JSON.stringify(p), p.rating, p.games);
  deviceProfile = (pid: string) => (this.db.prepare('SELECT profile_id FROM devices WHERE pid = ?').get(pid) as { profile_id: string } | undefined)?.profile_id;
  linkDevice = (pid: string, id: string) =>
    void this.db.prepare('INSERT INTO devices (pid, profile_id) VALUES (?, ?) ON CONFLICT(pid) DO UPDATE SET profile_id = excluded.profile_id').run(pid, id);
  hasGame = (id: string) => !!this.db.prepare('SELECT 1 FROM games WHERE id = ?').get(id);
  putGame = (g: FinishedGame) => void this.db.prepare('INSERT OR IGNORE INTO games (id, data, finished_at) VALUES (?, ?, ?)').run(g.id, JSON.stringify(g), g.finishedAt);
  top = (n: number) => this.db.prepare('SELECT data FROM profiles WHERE games > 0 ORDER BY rating DESC LIMIT ?').all(n).map((r) => this.row(r)!);
}

let store: Store = new MemoryStore();

export async function openAccounts(file: string): Promise<string> {
  try {
    const mod = (await import('node:sqlite')) as unknown as { DatabaseSync: new (f: string) => Db };
    store = new SqliteStore(new mod.DatabaseSync(file));
    return 'sqlite';
  } catch (e) {
    console.warn('accounts: node:sqlite недоступен, профили в памяти', (e as Error).message);
    return 'memory';
  }
}

/** Для тестов. */
export function useMemoryAccounts(): void {
  store = new MemoryStore();
}

// ───────────────────────── профиль ─────────────────────────

const newProfile = (id: string, name: string): Profile => ({
  id,
  name,
  rating: 1000,
  rated: 0,
  games: 0,
  wins: 0,
  streakCur: 0,
  streakBest: 0,
  eras: {},
  created: Date.now(),
});

/** Профиль устройства (создаётся при первом обращении). */
export function profileOf(pid: string, name = 'Игрок'): Profile {
  const linked = store.deviceProfile(pid);
  const p = (linked && store.getProfile(linked)) || store.getProfile(pid);
  if (p) return p;
  const fresh = newProfile(pid, name);
  store.putProfile(fresh);
  store.linkDevice(pid, pid);
  return fresh;
}

const dayOf = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date(t));
const prevDay = (d: string) => {
  const t = new Date(d + 'T12:00:00Z').getTime() - 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
};

export function view(p: Profile): ProfileView {
  const today = dayOf(Date.now());
  const alive = p.lastDay === today || (p.lastDay !== undefined && p.lastDay === prevDay(today));
  return {
    id: p.id,
    name: p.name,
    username: p.username,
    photo: p.photo,
    telegram: !!p.tgId,
    rating: Math.round(p.rating),
    games: p.games,
    wins: p.wins,
    streak: alive ? p.streakCur : 0,
    streakBest: p.streakBest,
    playedToday: p.lastDay === today,
    eras: p.eras,
  };
}

export function leaderboard(n = 30): LeaderRow[] {
  return store.top(n).map((p, i) => ({ place: i + 1, id: p.id, name: p.name, rating: Math.round(p.rating), games: p.games, wins: p.wins, photo: p.photo }));
}

// ───────────────────────── итоги партии ─────────────────────────

const BOT_RATING = { easy: 800, medium: 1000, hard: 1200 } as const;

/** Записать партию: игры, победы, эпохи, серия, рейтинг. Повторная запись той же партии ничего не меняет. */
export function recordGame(g: FinishedGame): void {
  if (store.hasGame(g.id)) return;
  store.putGame(g);
  const humans = g.players.filter((p) => !p.bot);
  if (!humans.length) return;
  const rated = humans.length >= 2;
  const profiles = new Map(humans.map((h) => [h.pid, profileOf(h.pid, h.name)]));
  const ratingOf = (p: FinishedGame['players'][number]) => (p.bot ? BOT_RATING[p.bot] : profiles.get(p.pid)!.rating);
  // Места: по очкам, победитель первый
  const place = (p: FinishedGame['players'][number]) => (p.winner ? 1e9 : p.vp);
  const day = dayOf(g.finishedAt);

  const deltas = new Map<string, number>();
  for (const h of humans) {
    const prof = profiles.get(h.pid)!;
    const K = prof.rated < 10 ? 40 : 24;
    let d = 0;
    for (const o of g.players) {
      if (o.pid === h.pid) continue;
      const w = o.bot ? 0.5 : 1;
      const s = place(h) > place(o) ? 1 : place(h) < place(o) ? 0 : 0.5;
      const e = 1 / (1 + Math.pow(10, (ratingOf(o) - prof.rating) / 400));
      d += w * (s - e);
    }
    // С ботами рейтинг меняется вдвое слабее; без живых соперников — ещё слабее
    deltas.set(h.pid, (K / Math.max(1, g.players.length - 1)) * d * (rated ? 1 : 0.5));
  }

  for (const h of humans) {
    const p = profiles.get(h.pid)!;
    p.name = p.tgId ? p.name : h.name || p.name;
    p.games += 1;
    if (h.winner) p.wins += 1;
    p.rating = Math.max(100, p.rating + (deltas.get(h.pid) ?? 0));
    p.rated += 1;
    const e = (p.eras[g.era] ??= { games: 0, wins: 0 });
    e.games += 1;
    if (h.winner) e.wins += 1;
    if (p.lastDay !== day) {
      p.streakCur = p.lastDay === prevDay(day) ? p.streakCur + 1 : 1;
      p.lastDay = day;
      p.streakBest = Math.max(p.streakBest, p.streakCur);
    }
    store.putProfile(p);
  }
}

// ───────────────────────── Telegram ─────────────────────────

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

const MAX_AGE_S = 60 * 60 * 24;

/** Проверка initData из Telegram Mini App (HMAC с ключом "WebAppData"). */
export function verifyMiniApp(initData: string, token: string, now = Date.now()): TgUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dcs = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const calc = createHmac('sha256', secret).update(dcs).digest('hex');
  if (!safeEq(calc, hash)) return null;
  const age = now / 1000 - Number(params.get('auth_date') ?? 0);
  if (!(age >= -60 && age < MAX_AGE_S)) return null;
  try {
    return JSON.parse(params.get('user') ?? 'null') as TgUser;
  } catch {
    return null;
  }
}

/** Проверка данных Telegram Login Widget (ключ — SHA256 от токена). */
export function verifyWidget(data: Record<string, string | number>, token: string, now = Date.now()): TgUser | null {
  const { hash, ...rest } = data;
  if (typeof hash !== 'string') return null;
  const dcs = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('\n');
  const secret = createHash('sha256').update(token).digest();
  const calc = createHmac('sha256', secret).update(dcs).digest('hex');
  if (!safeEq(calc, hash)) return null;
  const age = now / 1000 - Number(rest.auth_date ?? 0);
  if (!(age >= -60 && age < MAX_AGE_S)) return null;
  return { id: Number(rest.id), first_name: rest.first_name as string, last_name: rest.last_name as string, username: rest.username as string, photo_url: rest.photo_url as string };
}

function safeEq(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Войти через Telegram: устройство привязывается к профилю с этим tg_id. */
export function signInTelegram(pid: string, u: TgUser): Profile {
  const tg = String(u.id);
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username || 'Игрок';
  let p = store.getByTg(tg);
  if (!p) {
    // Первый вход: «повышаем» гостевой профиль этого устройства, если в нём ещё нет Telegram
    const own = profileOf(pid, name);
    p = own.tgId ? { ...newProfile('t' + tg, name) } : own;
    p.tgId = tg;
  }
  p.name = name.slice(0, 40);
  p.username = u.username;
  p.photo = typeof u.photo_url === 'string' && u.photo_url.startsWith('https://') ? u.photo_url : p.photo;
  store.putProfile(p);
  store.linkDevice(pid, p.id);
  return p;
}

/** Профиль по Telegram id (для интеграции с AQL Portal). */
export function profileByTg(tgId: string): Profile | undefined {
  return store.getByTg(tgId);
}

export function renameProfile(pid: string, name: string): Profile {
  const p = profileOf(pid);
  p.name = name.trim().slice(0, 24) || p.name;
  store.putProfile(p);
  return p;
}
