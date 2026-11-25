// Профили игроков: статистика, рейтинг, серия дней, коллекция эпох, вход через Telegram.
// Хранилище — SQLite (node:sqlite, Node 22) в DATA_DIR/hh.sqlite; без него (Node 20, тесты) — в памяти.
//
// Личность: устройство = id из секрета (как раньше). Профиль создаётся на устройство при первой партии.
// Вход через Telegram привязывает устройство к профилю с tg_id — так статистика собирается с разных телефонов.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { ProfileView, LeaderRow } from '../src/proto';
import { PERSONAS, personaById, simulateGame } from './personas';

export interface Profile {
  id: string;
  tgId?: string;
  /** Аккаунт AQL Portal (id пользователя портала). */
  portalId?: string;
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
  /** Гостевой профиль влит в аккаунт (Telegram/AQL Portal) — в таблице лидеров не показывается. */
  mergedInto?: string;
  /** ИИ-персонаж (src: server/personas.ts). */
  ai?: { persona: string; style: string; bio: string; level: 'easy' | 'medium' | 'hard' };
}

export interface FinishedGame {
  id: string;
  era: string;
  finishedAt: number;
  /** Места по порядку: победитель первым. */
  players: { pid: string; name: string; bot?: 'easy' | 'medium' | 'hard'; persona?: string; vp: number; winner: boolean }[];
}

interface Store {
  getProfile(id: string): Profile | undefined;
  getByTg(tgId: string): Profile | undefined;
  getByPortal(portalId: string): Profile | undefined;
  putProfile(p: Profile): void;
  deviceProfile(pid: string): string | undefined;
  linkDevice(pid: string, profileId: string): void;
  hasGame(id: string): boolean;
  putGame(g: FinishedGame): void;
  top(n: number): Profile[];
  aiGames(): number;
  logEvent(kind: string, pid: string | undefined, data?: unknown, ipHash?: string): void;
}

// ───────────────────────── хранилища ─────────────────────────

class MemoryStore implements Store {
  profiles = new Map<string, Profile>();
  devices = new Map<string, string>();
  games = new Set<string>();
  getProfile = (id: string) => this.profiles.get(id);
  getByTg = (tg: string) => [...this.profiles.values()].find((p) => p.tgId === tg);
  getByPortal = (id: string) => [...this.profiles.values()].find((p) => p.portalId === id);
  putProfile = (p: Profile) => void this.profiles.set(p.id, structuredClone(p));
  deviceProfile = (pid: string) => this.devices.get(pid);
  linkDevice = (pid: string, id: string) => void this.devices.set(pid, id);
  hasGame = (id: string) => this.games.has(id);
  putGame = (g: FinishedGame) => void this.games.add(g.id);
  top = (n: number) => [...this.profiles.values()].filter((p) => p.games > 0 && !p.mergedInto).sort((a, b) => b.rating - a.rating).slice(0, n);
  aiGames = () => [...this.profiles.values()].filter((p) => p.ai).reduce((a, p) => a + p.games, 0);
  logEvent = () => {};
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
      CREATE TABLE IF NOT EXISTS events (ts INTEGER NOT NULL, kind TEXT NOT NULL, pid TEXT, ip TEXT, data TEXT);
      CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
      CREATE INDEX IF NOT EXISTS events_pid ON events(pid);
    `);
    // AQL Portal: колонка добавляется к старой базе один раз
    try {
      db.exec('ALTER TABLE profiles ADD COLUMN portal_id TEXT');
    } catch {
      /* уже есть */
    }
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS profiles_portal ON profiles(portal_id)');
  }
  private row = (r: unknown) => (r ? (JSON.parse((r as { data: string }).data) as Profile) : undefined);
  getProfile = (id: string) => this.row(this.db.prepare('SELECT data FROM profiles WHERE id = ?').get(id));
  getByTg = (tg: string) => this.row(this.db.prepare('SELECT data FROM profiles WHERE tg_id = ?').get(tg));
  getByPortal = (id: string) => this.row(this.db.prepare('SELECT data FROM profiles WHERE portal_id = ?').get(id));
  putProfile = (p: Profile) =>
    void this.db
      .prepare('INSERT INTO profiles (id, tg_id, portal_id, data, rating, games) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET tg_id = excluded.tg_id, portal_id = excluded.portal_id, data = excluded.data, rating = excluded.rating, games = excluded.games')
      .run(p.id, p.tgId ?? null, p.portalId ?? null, JSON.stringify(p), p.rating, p.games);
  deviceProfile = (pid: string) => (this.db.prepare('SELECT profile_id FROM devices WHERE pid = ?').get(pid) as { profile_id: string } | undefined)?.profile_id;
  linkDevice = (pid: string, id: string) =>
    void this.db.prepare('INSERT INTO devices (pid, profile_id) VALUES (?, ?) ON CONFLICT(pid) DO UPDATE SET profile_id = excluded.profile_id').run(pid, id);
  hasGame = (id: string) => !!this.db.prepare('SELECT 1 FROM games WHERE id = ?').get(id);
  putGame = (g: FinishedGame) => void this.db.prepare('INSERT OR IGNORE INTO games (id, data, finished_at) VALUES (?, ?, ?)').run(g.id, JSON.stringify(g), g.finishedAt);
  top = (n: number) => this.db.prepare('SELECT data FROM profiles WHERE games > 0 ORDER BY rating DESC LIMIT ?').all(n).map((r) => this.row(r)!);
  aiGames = () => (this.db.prepare("SELECT COALESCE(SUM(games), 0) AS g FROM profiles WHERE id LIKE 'ai-%'").get() as { g: number }).g;
  logEvent = (kind: string, pid: string | undefined, data?: unknown, ip?: string) =>
    void this.db.prepare('INSERT INTO events (ts, kind, pid, ip, data) VALUES (?, ?, ?, ?, ?)').run(Date.now(), kind, pid ?? null, ip ?? null, data === undefined ? null : JSON.stringify(data).slice(0, 2000));
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
    portal: !!p.portalId,
    rating: Math.round(p.rating),
    games: p.games,
    wins: p.wins,
    streak: alive ? p.streakCur : 0,
    streakBest: p.streakBest,
    playedToday: p.lastDay === today,
    eras: p.eras,
    ...(p.ai ? { ai: { style: p.ai.style, bio: p.ai.bio, level: p.ai.level } } : {}),
  };
}

export function leaderboard(n = 30): LeaderRow[] {
  return store.top(n).map((p, i) => ({ place: i + 1, id: p.id, name: p.name, rating: Math.round(p.rating), games: p.games, wins: p.wins, photo: p.photo, ...(p.ai ? { ai: true } : {}) }));
}

// ───────────────────────── итоги партии ─────────────────────────

const BOT_RATING = { easy: 800, medium: 1000, hard: 1200 } as const;

/** Записать партию: игры, победы, эпохи, серия, рейтинг. Повторная запись той же партии ничего не меняет. */
export function recordGame(g: FinishedGame): void {
  if (store.hasGame(g.id)) return;
  store.putGame(g);
  // Участники с профилем: люди и ИИ-персонажи. Безымянные боты — неподвижные ориентиры рейтинга.
  const rated = g.players.filter((p) => !p.bot || p.persona);
  if (!rated.length) return;
  const humansN = g.players.filter((p) => !p.bot).length;
  const profiles = new Map(
    rated.map((h) => [h.pid, h.persona ? personaProfile(h.persona) : profileOf(h.pid, h.name)] as const).filter((x): x is [string, Profile] => !!x[1]),
  );
  const ratingOf = (p: FinishedGame['players'][number]) => profiles.get(p.pid)?.rating ?? BOT_RATING[p.bot ?? 'medium'];
  const place = (p: FinishedGame['players'][number]) => (p.winner ? 1e9 : p.vp);
  const day = dayOf(g.finishedAt);

  const deltas = new Map<string, number>();
  for (const h of rated) {
    const prof = profiles.get(h.pid);
    if (!prof) continue;
    const K = prof.rated < 10 ? 40 : 24;
    let d = 0;
    for (const o of g.players) {
      if (o.pid === h.pid) continue;
      // Человеку бот засчитывается вполсилы; ИИ между собой — полностью
      const w = !h.bot && o.bot ? 0.5 : 1;
      const s = place(h) > place(o) ? 1 : place(h) < place(o) ? 0 : 0.5;
      const e = 1 / (1 + Math.pow(10, (ratingOf(o) - prof.rating) / 400));
      d += w * (s - e);
    }
    // Человек без живых соперников — рейтинг вдвое слабее
    const soft = !h.bot && humansN < 2 ? 0.5 : 1;
    deltas.set(h.pid, (K / Math.max(1, g.players.length - 1)) * d * soft);
  }

  for (const h of rated) {
    const p = profiles.get(h.pid);
    if (!p) continue;
    if (!p.tgId && !p.ai) p.name = h.name || p.name;
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

// ───────────────────────── ИИ-персонажи ─────────────────────────

const START_RATING = { easy: 850, medium: 1000, hard: 1150 } as const;

/** Профиль ИИ-персонажа (создаётся при первом обращении). */
export function personaProfile(id: string): Profile | undefined {
  const per = personaById(id);
  if (!per) return undefined;
  const pid = `ai-${per.id}`;
  let p = store.getProfile(pid);
  if (!p) {
    p = { ...newProfile(pid, per.name), rating: START_RATING[per.level] };
    p.ai = { persona: per.id, style: per.style, bio: per.bio, level: per.level };
    store.putProfile(p);
  }
  return p;
}

/** Профиль по id игрока за столом (человек — по устройству, ИИ — по персонажу). Не создаёт новых. */
export function findProfile(pid: string, persona?: string): Profile | undefined {
  if (persona) return personaProfile(persona);
  const linked = store.deviceProfile(pid);
  return (linked && store.getProfile(linked)) || store.getProfile(pid);
}

/** ИИ-лига: если у персонажей мало партий, они доигрывают в фоне (по партии за тик, не блокируя сервер). */
export function runAiLeague(target = 120, eras = ['genghis', 'japan', 'ww2', 'khanate', 'silk', 'saka']): void {
  for (const per of PERSONAS) personaProfile(per.id);
  let left = Math.max(0, Math.ceil((target * 4 - store.aiGames()) / 4));
  if (!left) return;
  console.log(`ai league: ${left} games to simulate`);
  const step = () => {
    if (left-- <= 0) return console.log('ai league: done');
    const pool = [...PERSONAS].sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 2));
    const era = eras[Math.floor(Math.random() * eras.length)];
    try {
      const r = simulateGame(pool, era);
      if (r) recordGame({ id: `league-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, era: r.era, finishedAt: Date.now(), players: r.players });
    } catch (e) {
      console.error('ai league game failed', e);
    }
    setTimeout(step, 50);
  };
  setTimeout(step, 2000);
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

/**
 * Гостевую статистику устройства — в аккаунт: человек играл с 2–4 устройств гостем,
 * потом вошёл через Telegram или AQL Portal — все партии собираются в одном профиле.
 * Рейтинг переносится приростом гостя (рейтинг − 1000), остальное суммируется.
 */
export function mergeGuest(into: Profile, guest: Profile): void {
  if (guest.id === into.id || guest.tgId || guest.portalId || guest.ai || guest.mergedInto) return;
  if (!guest.games && !guest.rated) return;
  into.games += guest.games;
  into.wins += guest.wins;
  into.rated += guest.rated;
  into.rating = Math.round((into.rating + (guest.rating - 1000)) * 10) / 10;
  into.streakBest = Math.max(into.streakBest, guest.streakBest);
  if ((guest.lastDay ?? '') > (into.lastDay ?? '')) {
    into.lastDay = guest.lastDay;
    into.streakCur = guest.streakCur;
  }
  for (const [era, e] of Object.entries(guest.eras ?? {})) {
    const t = (into.eras[era] ??= { games: 0, wins: 0 });
    t.games += e.games;
    t.wins += e.wins;
  }
  into.created = Math.min(into.created, guest.created);
  store.putProfile({ ...guest, mergedInto: into.id, games: 0, wins: 0, rated: 0 });
}

/** Гостевой профиль, к которому сейчас привязано устройство (если это не аккаунт). */
function guestOf(pid: string): Profile | undefined {
  const id = store.deviceProfile(pid) ?? pid;
  const g = store.getProfile(id);
  return g && !g.tgId && !g.portalId && !g.ai ? g : undefined;
}

export function signInTelegram(pid: string, u: TgUser): Profile {
  const tg = String(u.id);
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username || 'Игрок';
  let p = store.getByTg(tg);
  if (!p) {
    // Первый вход: «повышаем» гостевой профиль этого устройства, если в нём ещё нет Telegram
    const own = profileOf(pid, name);
    p = own.tgId ? { ...newProfile('t' + tg, name) } : own;
    p.tgId = tg;
  } else {
    // Аккаунт уже есть — партии этого устройства (гостем) переносим в него
    const g = guestOf(pid);
    if (g) mergeGuest(p, g);
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

// ───────────────────────── AQL Portal ─────────────────────────
//
// Вход через портал: портал подписывает короткий билет общим секретом (PORTAL_LOGIN_SECRET, иначе PORTAL_API_KEY)
// и отправляет ученика в игру по ссылке …/catan/?aql=<билет>. Билет = base64url(JSON) + "." + hex(HMAC-SHA256).
// JSON: { v: 1, uid, name, photo?, exp (unix-секунды), jti (одноразовый) }. Живёт ≤ 5 минут, повтор не принимается.

export interface PortalUser {
  uid: string;
  name: string;
  photo?: string;
}

const usedTickets = new Map<string, number>();

export function signPortalTicket(u: PortalUser & { exp: number; jti: string }, secret: string): string {
  const body = Buffer.from(JSON.stringify({ v: 1, ...u })).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('hex')}`;
}

export function verifyPortalTicket(ticket: string, secret: string, now = Date.now()): PortalUser | null {
  if (!secret || typeof ticket !== 'string' || ticket.length > 4000) return null;
  const [body, sig] = ticket.split('.');
  if (!body || !sig) return null;
  const calc = createHmac('sha256', secret).update(body).digest('hex');
  if (!safeEq(calc, sig)) return null;
  let p: { v?: number; uid?: unknown; name?: unknown; photo?: unknown; exp?: unknown; jti?: unknown };
  try {
    p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const t = now / 1000;
  if (p.v !== 1 || typeof p.uid !== 'string' || !p.uid || typeof p.exp !== 'number' || typeof p.jti !== 'string') return null;
  if (!(p.exp > t && p.exp - t <= 300)) return null;
  for (const [k, e] of usedTickets) if (e < t) usedTickets.delete(k);
  if (usedTickets.has(p.jti)) return null;
  usedTickets.set(p.jti, p.exp);
  return {
    uid: p.uid.slice(0, 64),
    name: (typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'Игрок').slice(0, 40),
    photo: typeof p.photo === 'string' && p.photo.startsWith('https://') ? p.photo.slice(0, 500) : undefined,
  };
}

/** Войти через AQL Portal: устройство привязывается к профилю этого ученика (первый вход «повышает» гостевой). */
export function signInPortal(pid: string, u: PortalUser): Profile {
  let p = store.getByPortal(u.uid);
  if (!p) {
    const own = profileOf(pid, u.name);
    p = own.portalId ? { ...newProfile('p' + u.uid, u.name) } : own;
    p.portalId = u.uid;
  } else {
    const g = guestOf(pid);
    if (g) mergeGuest(p, g);
  }
  p.name = u.name;
  if (u.photo) p.photo = u.photo;
  store.putProfile(p);
  store.linkDevice(pid, p.id);
  return p;
}

export function profileByPortal(uid: string): Profile | undefined {
  return store.getByPortal(uid);
}

// ───────────────────────── журнал событий ─────────────────────────
// Что происходит в игре (подключения, партии, обучение, ошибки) — в таблицу events, для статистики.
// IP не храним: только короткий хэш с солью — чтобы видеть, что несколько устройств одного человека.

const IP_SALT = process.env.HH_IP_SALT || 'historicalhex';
export function ipHash(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return createHash('sha256').update(IP_SALT + ip).digest('hex').slice(0, 16);
}
export function logEvent(kind: string, pid?: string, data?: unknown, ip?: string): void {
  try {
    store.logEvent(kind, pid, data, ip);
  } catch (e) {
    console.warn('events: не записалось', e);
  }
}
