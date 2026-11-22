// Поиск по правилам. Запрос → слова без служебных и окончаний («как выиграть» → «выигр»).
// Слово ищется с начала слова в тексте («порт» не найдёт «спорт»). Выше — разделы, где нашлось
// больше слов запроса; при равенстве — где совпал заголовок или ключевое слово, а не только текст.

import type { Lang } from './lang';
import { t3 } from './lang';
import type { RuleSection } from './rulesContent';

/** Нижний регистр, ё = е — длина строки не меняется (нужно для подсветки). */
export const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/** Служебные слова запроса — не несут смысла для поиска. */
const STOP = new Set([
  'как', 'что', 'где', 'когда', 'можно', 'ли', 'и', 'в', 'на', 'с', 'по', 'а', 'мне', 'меня', 'я', 'у', 'если', 'это', 'про',
  'почему', 'сколько', 'чтобы', 'надо', 'нужно', 'же', 'ведь', 'вот', 'такое', 'там', 'тут', 'мой', 'моё', 'мое', 'мою', 'есть',
  'how', 'the', 'to', 'a', 'an', 'do', 'i', 'can', 'is', 'what', 'when', 'where', 'of', 'in', 'my', 'me', 'why', 'many', 'much', 'does',
  'қалай', 'не', 'және', 'мен', 'ма', 'ме', 'ба', 'бе', 'па', 'пе', 'қашан', 'қайда', 'неше', 'қанша', 'неге', 'бола', 'ма?',
]);

/** Слова запроса: «3:1» остаётся целым, у длинных слов отрезается окончание. */
export function queryTerms(query: string): string[] {
  const words = norm(query).match(/\d+:\d+|[\p{L}\p{N}]+/gu) ?? [];
  return [
    ...new Set(
      words
        .filter((w) => !STOP.has(w))
        .map((w) => (/\d/.test(w) ? w : w.length >= 7 ? w.slice(0, w.length - 3) : w.length >= 5 ? w.slice(0, w.length - 2) : w)),
    ),
  ];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Слово с начала слова; у чисел — целиком («7» не совпадёт с «17»). */
const termRe = (t: string) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(t)}${/^\d+$/.test(t) ? '(?![\\p{N}:])' : ''}`, 'gu');
const exactRe = (t: string) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(t)}(?![\\p{L}\\p{N}])`, 'u');

/** Где в тексте подсветить: каждое совпадение — до конца слова. Возвращает [начало, конец] по нормализованному тексту. */
export function matchRanges(text: string, terms: string[]): [number, number][] {
  const src = norm(text);
  const out: [number, number][] = [];
  for (const t of terms) {
    for (const m of src.matchAll(termRe(t))) {
      let end = (m.index ?? 0) + t.length;
      if (!/^\d/.test(t)) while (end < src.length && /[\p{L}]/u.test(src[end])) end++;
      out.push([m.index ?? 0, end]);
    }
  }
  out.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

/** Сколько слов запроса нашлось в разделе и насколько удачно: заголовок и ключевые слова важнее текста. */
export function sectionMatch(sec: RuleSection, terms: string[], lang: Lang): { found: number; score: number } {
  const title = norm(t3(sec.title, lang));
  const keys = (sec.keywords ?? []).map(norm);
  const body = sec.body.map((b) => norm(t3(b, lang)));
  let found = 0;
  let score = 0;
  for (const t of terms) {
    const re = termRe(t);
    const has = (s: string) => {
      re.lastIndex = 0;
      return re.test(s);
    };
    const s =
      (has(title) ? (exactRe(t).test(title) ? 8 : 5) : 0) +
      (keys.some(has) ? (keys.some((k) => exactRe(t).test(k)) ? 5 : 3) : 0) +
      Math.min(4, body.filter(has).length);
    if (s) {
      found++;
      score += s;
    }
  }
  return { found, score };
}

/** Разделы для запроса: те, где нашлось больше всего слов запроса; среди них — по весу совпадений. */
export function searchRules(sections: RuleSection[], terms: string[], lang: Lang): RuleSection[] {
  if (!terms.length) return sections;
  const scored = sections.map((s, i) => ({ s, i, ...sectionMatch(s, terms, lang) })).filter((x) => x.found > 0);
  if (!scored.length) return [];
  const best = Math.max(...scored.map((x) => x.found));
  return scored
    .filter((x) => x.found === best)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.s);
}
