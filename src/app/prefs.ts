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
