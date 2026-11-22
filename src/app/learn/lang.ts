// Язык обучения и справочника правил: русский, казахский, английский.
// Переведены: главный экран, обучение и правила. Остальной интерфейс партии пока на русском.

import { useSyncExternalStore } from 'react';

export type Lang = 'ru' | 'kz' | 'en';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'ru', label: 'RU' },
  { id: 'kz', label: 'KZ' },
  { id: 'en', label: 'EN' },
];
const KEY = 'hh.lang';

function read(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'ru' || v === 'kz' || v === 'en') return v;
  } catch {
    /* ok */
  }
  // Игра делается для Казахстана: по умолчанию русский, как и весь интерфейс; казахский — если телефон на казахском.
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'ru';
  if (nav.startsWith('kk')) return 'kz';
  return 'ru';
}

let lang: Lang = read();
const subs = new Set<() => void>();

export function setLang(l: Lang): void {
  lang = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ok */
  }
  subs.forEach((f) => f());
}

export function useLang(): [Lang, (l: Lang) => void] {
  const l = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => lang,
  );
  return [l, setLang];
}

/** Текст на трёх языках. */
export type T3 = Record<Lang, string>;
export const t3 = (t: T3, l: Lang): string => t[l] ?? t.ru;

/** Прошёл ли игрок обучение на этом устройстве. */
export const LANG_DONE_KEY = 'hh.tutorialDone';
export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(LANG_DONE_KEY) === '1';
  } catch {
    return true;
  }
}
export function markTutorialDone(): void {
  try {
    localStorage.setItem(LANG_DONE_KEY, '1');
  } catch {
    /* ok */
  }
}
