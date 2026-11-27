// Перевод пакета эпохи на казахский и английский. Всё необязательное: чего нет — останется по-русски.
// Механика и иконки не переводятся — только слова.

import type { DevCardType, Resource, Terrain } from '../../engine';
import type { NarrationKey } from '../types';

export interface LorePackText {
  title?: string;
  short?: string;
  subtitle?: string;
  years?: string;
  region?: string;
  resources?: Partial<Record<Resource, { name?: string; note?: string }>>;
  terrains?: Partial<Record<Terrain, { name?: string; note?: string }>>;
  pieces?: Partial<{ road: string; settlement: string; city: string }>;
  devCards?: Partial<Record<DevCardType, { name?: string; flavor?: string }>>;
  robber?: { name?: string; note?: string };
  bonuses?: Partial<{ longestRoad: string; largestArmy: string }>;
  intro?: string[];
  /** Те же подстановки, что и в русском: {player}, {victim}, {res}, {count}, {n}. */
  narration?: Partial<Record<NarrationKey, string[]>>;
  victory?: string;
}

/** Перевод фактов: по индексу в pack.facts (тот же порядок). */
export interface LoreFactsText {
  /** text по порядку фактов; source можно не переводить. */
  facts: string[];
}

export interface LoreTr {
  kz?: LorePackText;
  en?: LorePackText;
}
export interface LoreFactsTr {
  kz?: LoreFactsText;
  en?: LoreFactsText;
}
