// Перевод интерфейса: L('Русский', 'Қазақша', 'English') — строка на текущем языке.
// Язык меняется редко (на главном экране); App перерисовывается целиком при смене языка.
// Для текстов с подстановками: L('Ход {name}', '{name} жүрісі', "{name}'s turn", { name }).

import { getLang } from '../app/learn/lang';
import type { Lang } from '../app/learn/lang';

export type { Lang };

export function L(ru: string, kz: string, en: string, vars?: Record<string, string | number | undefined>): string {
  const l = getLang();
  let s = l === 'en' ? en : l === 'kz' ? kz : ru;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v ?? ''));
  return s;
}

/** Выбор по языку для чего угодно (числа слов, массивы, разметка). */
export function pick<T>(ru: T, kz: T, en: T): T {
  const l = getLang();
  return l === 'en' ? en : l === 'kz' ? kz : ru;
}

/** Локаль для дат и чисел. */
export const locale = (): string => pick('ru-RU', 'kk-KZ', 'en-GB');
