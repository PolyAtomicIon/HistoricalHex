import { getLang, onLangChange } from '../app/learn/lang';
import { localizePacks } from './tr';
// Реестр пакетов эпох и рассказчик.

import { GENGHIS_PACK } from './packs/genghis';
import { JAPAN_PACK } from './packs/japan';
import { WW2_PACK } from './packs/ww2';
import { KHANATE_PACK } from './packs/khanate';
import { SILK_PACK } from './packs/silk';
import { SAKA_PACK } from './packs/saka';
import { CLASSIC_PACK } from './packs/classic';
import type { LorePack, NarrationKey } from './types';

export type { LoreFact, LorePack, NarrationKey } from './types';
export { CLASSIC_PACK, GENGHIS_PACK, JAPAN_PACK, WW2_PACK, KHANATE_PACK, SILK_PACK, SAKA_PACK };

export const LORE_PACKS: LorePack[] = [CLASSIC_PACK, GENGHIS_PACK, JAPAN_PACK, WW2_PACK, KHANATE_PACK, SILK_PACK, SAKA_PACK];

// Тексты эпох — на языке интерфейса (перевод накладывается на месте при смене языка)
if (typeof window !== 'undefined') {
  localizePacks(LORE_PACKS, getLang());
  onLangChange(() => localizePacks(LORE_PACKS, getLang()));
}

/** Пакет по id; если такого нет — первый в списке. */
export function getLorePack(id?: string | null): LorePack {
  return LORE_PACKS.find((p) => p.id === id) ?? GENGHIS_PACK;
}

export type NarrationVars = Partial<Record<'player' | 'victim' | 'res' | 'count' | 'n', string | number>> &
  Record<string, string | number | undefined>;

/** Подставляет {player}, {victim}, {res}, {count}, {n}; неизвестные подстановки оставляет как есть. */
export function fillPlaceholders(template: string, vars: NarrationVars = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = vars[name];
    return value === undefined ? whole : String(value);
  });
}

/** Случайная строка рассказчика для события. rng — функция, возвращающая число в [0, 1). */
export function narrate(
  pack: LorePack,
  key: NarrationKey,
  vars: NarrationVars = {},
  rng: () => number = Math.random,
): string {
  const lines = pack.narration[key];
  if (!lines || lines.length === 0) return '';
  const index = Math.min(lines.length - 1, Math.max(0, Math.floor(rng() * lines.length)));
  return fillPlaceholders(lines[index], vars);
}
