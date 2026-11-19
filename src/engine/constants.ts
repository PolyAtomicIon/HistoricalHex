// Состав игры и стоимость построек. Цифры сверены с правилами (см. PLAN.md, раздел 3).
import type { DevCardType, HarborType, ResourceMap, Terrain } from './types';
import { resourceMap } from './types';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
export const DEFAULT_VP_TO_WIN = 10;
export const LONGEST_ROAD_MIN = 5;
export const LARGEST_ARMY_MIN = 3;
/** Сбрасывают при семёрке те, у кого карт БОЛЬШЕ этого числа. */
export const DISCARD_LIMIT = 7;
export const LOG_LIMIT = 60;

export const COSTS = {
  road: resourceMap({ brick: 1, wood: 1 }),
  settlement: resourceMap({ brick: 1, wood: 1, sheep: 1, wheat: 1 }),
  city: resourceMap({ ore: 3, wheat: 2 }),
  devCard: resourceMap({ ore: 1, sheep: 1, wheat: 1 }),
} satisfies Record<string, ResourceMap>;

export const PIECES = { roads: 15, settlements: 5, cities: 4 };

export type LayoutKind = 'standard' | 'extended';

export interface LayoutSpec {
  /** Сколько гексов в каждом горизонтальном ряду, сверху вниз. */
  rows: number[];
  terrain: Record<Terrain, number>;
  numbers: number[];
  harbors: HarborType[];
  bankPerResource: number;
  devCards: Record<DevCardType, number>;
}

const BASE_NUMBERS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
const EXTRA_NUMBERS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

export const LAYOUTS: Record<LayoutKind, LayoutSpec> = {
  // 3–4 игрока
  standard: {
    rows: [3, 4, 5, 4, 3],
    terrain: { forest: 4, pasture: 4, fields: 4, hills: 3, mountains: 3, desert: 1 },
    numbers: BASE_NUMBERS,
    harbors: ['any', 'any', 'any', 'any', 'brick', 'wood', 'sheep', 'wheat', 'ore'],
    bankPerResource: 19,
    devCards: { knight: 14, victoryPoint: 5, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2 },
  },
  // 5–6 игроков
  extended: {
    rows: [3, 4, 5, 6, 5, 4, 3],
    terrain: { forest: 6, pasture: 6, fields: 6, hills: 5, mountains: 5, desert: 2 },
    numbers: [...BASE_NUMBERS, ...EXTRA_NUMBERS],
    harbors: ['any', 'any', 'any', 'any', 'any', 'brick', 'wood', 'sheep', 'sheep', 'wheat', 'ore'],
    bankPerResource: 24,
    devCards: { knight: 20, victoryPoint: 5, roadBuilding: 3, yearOfPlenty: 3, monopoly: 3 },
  },
};

export function layoutForPlayerCount(n: number): LayoutKind {
  return n >= 5 ? 'extended' : 'standard';
}
