// Эпоха партии: подменяет названия ресурсов/карт во всех текстах и цвета интерфейса.

import { useEffect, useMemo } from 'react';
import { DEV_CARD_TYPES, RESOURCES } from '../engine';
import type { LorePack } from '../lore/types';
import { getLorePack } from '../lore';
import { DEV_CARD_NAME, RESOURCE_NAME, ROBBER, TERRAIN_NAME } from '../i18n/ru';
import { RESOURCE_ICON } from '../ui/theme';
import { playEraMusic } from '../fx/music';
import { getLang, useLang } from './learn/lang';

const BASE = {
  res: { ...RESOURCE_NAME },
  ter: { ...TERRAIN_NAME },
  dev: { ...DEV_CARD_NAME },
  icon: { ...RESOURCE_ICON },
};

let applied: string | undefined;
/** Эпоха, которая сейчас применена (для иконок ресурсов). */
export let currentEra = 'genghis';

export function applyEra(pack: LorePack | undefined): void {
  // ключ с языком: при смене языка названия ресурсов/карт берутся из переведённого пакета
  const key = `${pack?.id ?? ''}:${getLang()}`;
  if (applied === key) return;
  applied = key;
  if (pack) currentEra = pack.id;
  playEraMusic(pack?.id ?? null);
  ROBBER.name = pack ? pack.robber.name : 'Разбойник';
  for (const r of RESOURCES) {
    RESOURCE_NAME[r] = pack ? pack.resources[r].name.toLowerCase() : BASE.res[r];
    RESOURCE_ICON[r] = pack ? pack.resources[r].emoji : BASE.icon[r];
  }
  for (const t of Object.keys(BASE.ter) as (keyof typeof TERRAIN_NAME)[]) {
    TERRAIN_NAME[t] = pack ? pack.terrains[t].name.toLowerCase() : BASE.ter[t];
  }
  for (const d of DEV_CARD_TYPES) DEV_CARD_NAME[d] = pack ? pack.devCards[d].name : BASE.dev[d];
  const root = document.documentElement.style;
  if (pack) {
    root.setProperty('--accent', pack.palette.accent);
    root.setProperty('--accent-rgb', hexRgb(pack.palette.accent));
    root.setProperty('--sea', pack.palette.sea);
    root.setProperty('--sea-deep', pack.palette.seaDeep);
  }
}

export function useEra(id: string | undefined): LorePack {
  const [lang] = useLang();
  const pack = useMemo(() => getLorePack(id ?? ''), [id]);
  applyEra(pack);
  useEffect(() => applyEra(pack), [pack, lang]);
  return pack;
}

/** Обложка эпохи (сгенерирована через Codex, лежит в public/eras). */
export const eraCover = (id: string) => `${import.meta.env.BASE_URL}eras/${id}.webp`;
/** Средняя обложка (800px, ~45 КБ) — для крупных карточек на телефоне. */
export const eraCoverMd = (id: string) => `${import.meta.env.BASE_URL}eras/${id}-md.webp`;
/** Маленькая обложка (360px, ~12 КБ) — для плиток, списков и размытого фона. */
export const eraThumb = (id: string) => `${import.meta.env.BASE_URL}eras/${id}-sm.webp`;

/** Авторская иконка эпохи (сгенерирована через Codex): emblem, robber, res-<ресурс>, dev-<карта>. */
export const eraIcon = (id: string, name: string) => `${import.meta.env.BASE_URL}eras/${id}/${name}.webp`;

function hexRgb(hex: string): string {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(v, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
