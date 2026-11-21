// Связь с сервером: WebSocket с переподключением, состояние комнаты и события для анимаций.

import { useSyncExternalStore } from 'react';
import { tgInitData } from '../app/tg';
import type { Action, GameEvent, HostAction, PlayerId } from '../engine';
import type { ClientMsg, DiceSource, LeaderRow, ProfileView, RoomSettings, RoomView, ServerMsg } from '../proto';

const SECRET_KEY = 'hh.secret';
const PIN_KEY = 'hh.pin';

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
  profile?: { profile: ProfileView; leaders: LeaderRow[]; tgBot?: string };
  /** Ссылка на бота для входа (живёт 10 минут). */
  tgLink?: string;
}

export type EventListener = (events: GameEvent[], source?: DiceSource) => void;
export type ReactListener = (r: { from: PlayerId; emoji: string; at: number }) => void;

class Connection {
  private ws?: WebSocket;
  private state: ConnState = { status: 'connecting', clockSkew: 0 };
  private subs = new Set<() => void>();
  private eventSubs = new Set<EventListener>();
  private reactSubs = new Set<ReactListener>();
  private pending = new Map<string, (r: { ok: boolean; error?: string }) => void>();
  private outbox: ClientMsg[] = [];
  private retry = 0;
  private seq = 0;
  /** Что повторить после переподключения. */
  private resume?: ClientMsg;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.connect();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.ws?.readyState !== WebSocket.OPEN) this.connect();
    });
    window.addEventListener('online', () => this.connect());
  }

  private connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.patch({ status: 'connecting' });
    const ws = new WebSocket(wsUrl());
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      ws.send(JSON.stringify({ t: 'hello', secret: secret() } satisfies ClientMsg));
      if (this.resume) ws.send(JSON.stringify(this.resume));
      for (const m of this.outbox.splice(0)) ws.send(JSON.stringify(m));
      this.patch({ status: 'online' });
    };
    ws.onmessage = (e) => this.onMessage(JSON.parse(String(e.data)) as ServerMsg);
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.patch({ status: 'offline' });
      for (const [, done] of this.pending) done({ ok: false, error: 'Нет связи' });
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
        return this.patch({ me: m.me });
      }
      case 'tgLink':
        return this.patch({ tgLink: m.url });
      case 'profile':
        return this.patch({ profile: { profile: m.profile, leaders: m.leaders, tgBot: m.tgBot } });
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
        done?.({ ok: m.ok, error: m.error });
        if (!m.ok && m.error) this.notify(m.error);
        return;
      }
      case 'react':
        for (const l of this.reactSubs) l(m);
        return;
      case 'error':
        if (m.fatal) {
          this.resume = undefined;
          safeSet(PIN_KEY, null);
          return this.patch({ fatal: m.message, room: undefined });
        }
        return this.notify(m.message);
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

  create(settings?: Partial<RoomSettings>): void {
    if (!this.send({ t: 'create', settings })) this.notify('Нет связи с сервером');
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
        this.notify('Нет связи — попробуй ещё раз');
        return done({ ok: false, error: 'Нет связи' });
      }
      this.pending.set(id, done);
    });
  }
  host(action: HostAction): Promise<{ ok: boolean; error?: string }> {
    const id = `h${++this.seq}`;
    return new Promise((done) => {
      if (!this.send({ t: 'host', id, action })) return done({ ok: false, error: 'Нет связи' });
      this.pending.set(id, done);
    });
  }
}

export const conn = new Connection();

export function useConn(): ConnState {
  return useSyncExternalStore(conn.subscribe, conn.getState);
}
