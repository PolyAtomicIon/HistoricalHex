// Подключение к Firebase: приложение, анонимный вход, база, серверное время.
// Подход взят из кахута (common.js → initFirebase), но с LOCAL-persistence,
// чтобы игрок возвращался в игру даже после закрытия вкладки.

import type { FirebaseApp } from 'firebase/app';
import { deleteApp, initializeApp } from 'firebase/app';
import type { Auth, Persistence, User } from 'firebase/auth';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInAnonymously,
} from 'firebase/auth';
import type { Database } from 'firebase/database';
import { getDatabase, goOffline, onValue, ref } from 'firebase/database';
import { FIREBASE_CONFIG } from './config';

/**
 * local   — вход переживает закрытие вкладки (обычный режим);
 * session — свой вход у каждой вкладки (`?test=1`: несколько игроков в одном браузере);
 * memory  — без сохранения (тесты в Node).
 */
export type PersistenceMode = 'local' | 'session' | 'memory';

export interface Connection {
  app: FirebaseApp;
  auth: Auth;
  db: Database;
  user: User;
  uid: string;
  /** Текущее время сервера Firebase (мс). */
  now(): number;
  close(): Promise<void>;
}

export interface ConnectOptions {
  /** Имя экземпляра приложения (в тестах — свой у каждого «устройства»). */
  name?: string;
  persistence?: PersistenceMode;
}

const PERSISTENCE: Record<PersistenceMode, Persistence> = {
  local: browserLocalPersistence,
  session: browserSessionPersistence,
  memory: inMemoryPersistence,
};

/** В браузере: `?test=1` → session, иначе local. */
export function defaultPersistence(): PersistenceMode {
  if (typeof window === 'undefined') return 'memory';
  return new URLSearchParams(window.location.search).get('test') === '1' ? 'session' : 'local';
}

export async function connect(options: ConnectOptions = {}): Promise<Connection> {
  const app = initializeApp(FIREBASE_CONFIG, options.name ?? '[DEFAULT]');
  const auth = initializeAuth(app, { persistence: PERSISTENCE[options.persistence ?? defaultPersistence()] });
  const db = getDatabase(app);

  let offset = 0;
  const unsubOffset = onValue(ref(db, '.info/serverTimeOffset'), (s) => {
    offset = (s.val() as number | null) ?? 0;
  });

  let user: User;
  try {
    user = await new Promise<User>((resolve, reject) => {
      const unsub = onAuthStateChanged(auth, (u) => {
        if (u) {
          unsub();
          resolve(u);
        } else {
          signInAnonymously(auth).catch((e) => {
            unsub();
            reject(e);
          });
        }
      });
    });
  } catch (e) {
    unsubOffset();
    await deleteApp(app);
    throw new Error(
      'Не удалось подключиться к Firebase: ' +
        (e instanceof Error ? e.message : String(e)) +
        ' — проверь интернет и что в Firebase включён анонимный вход.',
    );
  }

  let closed = false;
  return {
    app,
    auth,
    db,
    user,
    uid: user.uid,
    now: () => Date.now() + offset,
    async close() {
      if (closed) return;
      closed = true;
      unsubOffset();
      goOffline(db);
      await deleteApp(app);
    },
  };
}

/** Убирает undefined (Firebase их не принимает), null оставляет (это удаление). */
export function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Понятный текст ошибки Firebase на русском. */
export function describeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/permission[_ ]denied/i.test(msg)) return 'Нет доступа (возможно, комната закрыта или тебя удалили из игры)';
  if (/network|offline|unavailable/i.test(msg)) return 'Нет связи с сервером — проверь интернет';
  return msg;
}
