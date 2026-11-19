import { useEffect, useState } from 'react';

/** Текущее время (по серверу, если передать now), обновляется раз в intervalMs. */
export function useNow(now: () => number = Date.now, intervalMs = 1000): number {
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setT(now()), intervalMs);
    return () => clearInterval(id);
  }, [now, intervalMs]);
  return t;
}

/** Подписка на объект с методом subscribe (HostRoom / PlayerRoom). */
export function useSnapshot<S>(source: { subscribe(l: (s: S) => void): () => void; snapshot: S } | undefined): S | undefined {
  const [snap, setSnap] = useState<S | undefined>(source?.snapshot);
  useEffect(() => {
    if (!source) {
      setSnap(undefined);
      return;
    }
    return source.subscribe(setSnap);
  }, [source]);
  return snap;
}

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* приватный режим — не страшно */
    }
  },
  del(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ничего */
    }
  },
};

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
