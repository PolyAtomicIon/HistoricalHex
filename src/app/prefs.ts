// Настройки интерфейса партии: показывать ли факты истории и насколько крупно показывать события.
// «Авто» у заставок: на невысоком телефоне (iPhone 12/13 mini и т.п.) — мини-плашки, иначе — как раньше.

import { useSyncExternalStore } from 'react';

export type FxStyle = 'auto' | 'full' | 'mini';
const FX_KEY = 'hh.fxStyle';
const FACTS_KEY = 'hh.facts';

function read<T extends string>(key: string, ok: readonly T[], def: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && ok.includes(v) ? v : def;
  } catch {
    return def;
  }
}

let fxStyle: FxStyle = read(FX_KEY, ['auto', 'full', 'mini'] as const, 'auto');
let facts: 'on' | 'off' = read(FACTS_KEY, ['on', 'off'] as const, 'on');
const subs = new Set<() => void>();
const save = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ok */
  }
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

/** Невысокий экран телефона: заставки на весь экран закрывают карту и док. */
export const shortScreen = () => typeof window !== 'undefined' && window.innerHeight < 720 && !!window.matchMedia?.('(pointer: coarse)').matches;

export function setFxStyle(v: FxStyle): void {
  fxStyle = v;
  save(FX_KEY, v);
}
export function setFacts(on: boolean): void {
  facts = on ? 'on' : 'off';
  save(FACTS_KEY, facts);
}
export const factsOn = () => facts === 'on';

export function useFxStyle(): { style: FxStyle; mini: boolean } {
  const style = useSyncExternalStore(subscribe, () => fxStyle);
  return { style, mini: style === 'mini' || (style === 'auto' && shortScreen()) };
}
export function useFacts(): boolean {
  return useSyncExternalStore(subscribe, () => facts) === 'on';
}

// ─── Графика карты на вкус игрока: размер и густота объектов на гексах, размер жетонов ───
export interface BoardLook {
  /** Масштаб деревьев, гор, овец, колосьев (0.5–1.3). */
  decor: number;
  /** Доля объектов (0.3–1): меньше — карта чище. */
  density: number;
  /** Масштаб жетонов с числами (0.6–1.4). */
  tokens: number;
}
const LOOK_KEY = 'hh.boardLook';
export const LOOK_DEFAULT: BoardLook = { decor: 1, density: 1, tokens: 1 };
let look: BoardLook = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(LOOK_KEY) ?? 'null') as Partial<BoardLook> | null;
    return { ...LOOK_DEFAULT, ...(v ?? {}) };
  } catch {
    return LOOK_DEFAULT;
  }
})();
export function setBoardLook(patch: Partial<BoardLook>): void {
  look = { ...look, ...patch };
  save(LOOK_KEY, JSON.stringify(look));
}
export function useBoardLook(): BoardLook {
  return useSyncExternalStore(subscribe, () => look);
}

// ─── Плашка «Пока ждёшь — наметь ход» (кому-то помогает, кого-то раздражает) ───
const NUDGE_KEY = 'hh.planNudge';
let nudge: 'on' | 'off' = read(NUDGE_KEY, ['on', 'off'] as const, 'off');
export function setPlanNudge(on: boolean): void {
  nudge = on ? 'on' : 'off';
  save(NUDGE_KEY, nudge);
}
export function usePlanNudge(): boolean {
  return useSyncExternalStore(subscribe, () => nudge) === 'on';
}
