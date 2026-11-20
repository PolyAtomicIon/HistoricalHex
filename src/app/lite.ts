// Лёгкий режим для старых и слабых телефонов (iPhone 7/8 на iOS 15, бюджетные Android):
// карта в SVG без WebGL, без размытия стекла и фоновых анимаций, простые шторки.

import { useSyncExternalStore } from 'react';

export type LitePref = 'auto' | 'on' | 'off';
const KEY = 'hh.lite';

function iosMajor(): number | null {
  const m = navigator.userAgent.match(/OS (\d+)_\d+(?:_\d+)? like Mac OS X/);
  return m ? Number(m[1]) : null;
}

/** Похоже ли устройство на слабое. */
export function detectLowEnd(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ios = iosMajor();
  if (ios !== null && ios < 16) return true;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return true;
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return true;
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid && (navigator.hardwareConcurrency ?? 8) <= 4) return true;
  return false;
}

function readPref(): LitePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'on' || v === 'off' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

let pref: LitePref = readPref();
const auto = detectLowEnd();
const subs = new Set<() => void>();

export const isLite = () => (pref === 'auto' ? auto : pref === 'on');

function apply(): void {
  document.documentElement.classList.toggle('lite', isLite());
}
apply();

export function setLitePref(p: LitePref): void {
  pref = p;
  try {
    localStorage.setItem(KEY, p);
  } catch {
    /* ok */
  }
  apply();
  subs.forEach((f) => f());
}

export function useLite(): { lite: boolean; pref: LitePref; auto: boolean } {
  const lite = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    isLite,
  );
  return { lite, pref, auto };
}
