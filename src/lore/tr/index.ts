// Перевод пакетов эпох: накладывается на русские тексты при смене языка (мутация на месте,
// как applyEra для названий ресурсов: все, кто держит ссылку на пакет, видят новый язык).

import type { Lang } from '../../app/learn/lang';
import type { LorePack } from '../types';
import type { LoreFactsTr, LoreTr } from './types';
import { TR as classic } from './classic';
import { FACTS as classicF } from './classic.facts';
import { TR as genghis } from './genghis';
import { FACTS as genghisF } from './genghis.facts';
import { TR as japan } from './japan';
import { FACTS as japanF } from './japan.facts';
import { TR as ww2 } from './ww2';
import { FACTS as ww2F } from './ww2.facts';
import { TR as khanate } from './khanate';
import { FACTS as khanateF } from './khanate.facts';
import { TR as silk } from './silk';
import { FACTS as silkF } from './silk.facts';
import { TR as saka } from './saka';
import { FACTS as sakaF } from './saka.facts';

const TEXT: Record<string, LoreTr> = { classic, genghis, japan, ww2, khanate, silk, saka };
const FACTS: Record<string, LoreFactsTr> = { classic: classicF, genghis: genghisF, japan: japanF, ww2: ww2F, khanate: khanateF, silk: silkF, saka: sakaF };

const base = new Map<string, LorePack>();

/** Привести пакеты к языку: сначала вернуть русский оригинал, потом наложить перевод. */
export function localizePacks(packs: LorePack[], lang: Lang): void {
  for (const p of packs) {
    if (!base.has(p.id)) base.set(p.id, structuredClone(p));
    const orig = base.get(p.id)!;
    // вернуть оригинал (кроме палитры/иконок — они не меняются)
    p.title = orig.title;
    p.short = orig.short;
    p.subtitle = orig.subtitle;
    p.years = orig.years;
    p.region = orig.region;
    p.resources = structuredClone(orig.resources);
    p.terrains = structuredClone(orig.terrains);
    p.pieces = { ...orig.pieces };
    p.devCards = structuredClone(orig.devCards);
    p.robber = { ...orig.robber };
    p.bonuses = { ...orig.bonuses };
    p.intro = [...orig.intro];
    p.narration = structuredClone(orig.narration);
    p.facts = structuredClone(orig.facts);
    p.victory = orig.victory;
    if (lang === 'ru') continue;
    const t = TEXT[p.id]?.[lang];
    if (t) {
      if (t.title) p.title = t.title;
      if (t.short) p.short = t.short;
      if (t.subtitle) p.subtitle = t.subtitle;
      if (t.years) p.years = t.years;
      if (t.region) p.region = t.region;
      for (const [k, v] of Object.entries(t.resources ?? {})) Object.assign(p.resources[k as keyof typeof p.resources], strip(v));
      for (const [k, v] of Object.entries(t.terrains ?? {})) Object.assign(p.terrains[k as keyof typeof p.terrains], strip(v));
      Object.assign(p.pieces, strip(t.pieces ?? {}));
      for (const [k, v] of Object.entries(t.devCards ?? {})) Object.assign(p.devCards[k as keyof typeof p.devCards], strip(v));
      Object.assign(p.robber, strip(t.robber ?? {}));
      Object.assign(p.bonuses, strip(t.bonuses ?? {}));
      if (t.intro?.length) p.intro = [...t.intro];
      for (const [k, v] of Object.entries(t.narration ?? {})) if (v?.length) p.narration[k as keyof typeof p.narration] = [...v];
      if (t.victory) p.victory = t.victory;
    }
    const f = FACTS[p.id]?.[lang];
    if (f) f.facts.forEach((text, i) => p.facts[i] && text && (p.facts[i].text = text));
  }
}

const strip = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;
