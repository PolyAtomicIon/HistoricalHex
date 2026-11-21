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
  // Chrome округляет память вниз до степени двойки (3 ГБ → 2), поэтому слабым считаем только ≤1 ГБ.
  // По числу ядер не судим: Samsung и другие Android часто отдают браузеру 4 ядра и на мощных телефонах.
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 1) return true;
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

// ─── Детальная графика: больше деталей на карте, облака и птицы, тени выше качеством ───
// «Авто» — включена на ноутбуке/компьютере (большой экран + мышь), на телефоне выключена.

export type GfxPref = 'auto' | 'hi' | 'normal';
const GFX_KEY = 'hh.gfx';

function readGfx(): GfxPref {
  try {
    const v = localStorage.getItem(GFX_KEY);
    return v === 'hi' || v === 'normal' ? v : 'auto';
  } catch {
    return 'auto';
  }
}
let gfx: GfxPref = readGfx();
const gfxAuto =
  typeof matchMedia !== 'undefined' && matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches;
const gfxSubs = new Set<() => void>();
const isHiGfx = () => !isLite() && (gfx === 'auto' ? gfxAuto : gfx === 'hi');

export function setGfxPref(p: GfxPref): void {
  gfx = p;
  try {
    localStorage.setItem(GFX_KEY, p);
  } catch {
    /* ok */
  }
  gfxSubs.forEach((f) => f());
}

export function useGfx(): { hi: boolean; pref: GfxPref; auto: boolean } {
  const hi = useSyncExternalStore(
    (f) => {
      gfxSubs.add(f);
      subs.add(f);
      return () => {
        gfxSubs.delete(f);
        subs.delete(f);
      };
    },
    isHiGfx,
  );
  return { hi, pref: gfx, auto: gfxAuto };
}
