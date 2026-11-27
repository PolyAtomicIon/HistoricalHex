// Тема интерфейса: тёмная (по умолчанию), светлая или как в системе. Хранится на устройстве.
// Применяется атрибутом <html data-theme>; ранний скрипт в index.html ставит его до отрисовки.

import { useSyncExternalStore } from 'react';

export type ThemeMode = 'dark' | 'light' | 'auto';
const KEY = 'hh.theme';
const subs = new Set<() => void>();

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'auto' || v === 'dark') return v;
  } catch {
    /* ok */
  }
  return 'dark';
}

let mode: ThemeMode = readMode();
const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: light)') : undefined;

function apply(): void {
  const t = mode === 'auto' ? (mq?.matches ? 'light' : 'dark') : mode;
  document.documentElement.dataset.theme = t;
  document.querySelector<HTMLMetaElement>('meta[name=theme-color]')?.setAttribute('content', t === 'light' ? '#e9edf1' : '#070b10');
}

if (typeof document !== 'undefined') {
  apply();
  mq?.addEventListener('change', () => mode === 'auto' && (apply(), subs.forEach((f) => f())));
}

export function setTheme(m: ThemeMode): void {
  mode = m;
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* ok */
  }
  apply();
  subs.forEach((f) => f());
}

export function useTheme(): [ThemeMode, (m: ThemeMode) => void] {
  const m = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => mode,
  );
  return [m, setTheme];
}
