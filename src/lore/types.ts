// Пакет эпохи (сеттинг): как называются ресурсы, местность, карты и что рассказывает рассказчик.
// Механика игры от пакета не зависит — меняются только слова, цвета и факты.

import type { DevCardType, Resource, Terrain } from '../engine';

export interface LoreFact {
  /** 1–2 предложения, по-русски. Только проверяемые факты. */
  text: string;
  /** Год или период, например «1219» или «1941–1945». */
  year?: string;
  /** Факт про историю Казахстана (true) или мировую (false). */
  kz: boolean;
  /** Откуда факт: учебник/книга (автор, класс, год) или файл данных Zaman. */
  source: string;
}

/** Строки рассказчика. Подстановки: {player}, {victim}, {res}, {count}, {n}. */
export type NarrationKey =
  | 'gameStarted'
  | 'settlement'
  | 'city'
  | 'road'
  | 'seven'
  | 'robberMoved'
  | 'stole'
  | 'knight'
  | 'monopoly'
  | 'yearOfPlenty'
  | 'roadBuilding'
  | 'longestRoad'
  | 'largestArmy'
  | 'tradeCompleted'
  | 'bigHarvest'
  | 'gameWon';

export interface LorePack {
  id: string;
  /** Короткое название эпохи: «Эпоха Чингисхана». */
  title: string;
  /** Подзаголовок одной строкой. */
  subtitle: string;
  years: string;
  region: string;
  /** Эмодзи-герб эпохи для лобби. */
  emblem: string;
  palette: {
    /** Цвет моря (мелководье) и глубины — для шейдера. */
    sea: string;
    seaDeep: string;
    /** Основной акцент интерфейса. */
    accent: string;
    /** Тёплый/холодный оттенок света сцены. */
    light: string;
  };
  resources: Record<Resource, { name: string; emoji: string; note: string }>;
  terrains: Record<Terrain, { name: string; note: string }>;
  pieces: { road: string; settlement: string; city: string };
  devCards: Record<DevCardType, { name: string; flavor: string }>;
  robber: { name: string; note: string };
  bonuses: { longestRoad: string; largestArmy: string };
  /** Вступление перед партией: 3–5 коротких абзацев. */
  intro: string[];
  /** На каждое событие — 2–4 варианта строки, выбираются случайно. */
  narration: Record<NarrationKey, string[]>;
  /** Факты, которые показываются, пока ждёшь хода. Не меньше 20, из них не меньше 8 про Казахстан. */
  facts: LoreFact[];
  /** Финальная фраза победителю. Подстановка {player}. */
  victory: string;
  /** Список литературы пакета. */
  sources: string[];
}
