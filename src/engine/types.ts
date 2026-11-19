// Базовые типы игры: ресурсы, местность, карты развития, гавани.

export const RESOURCES = ['brick', 'wood', 'sheep', 'wheat', 'ore'] as const;
export type Resource = (typeof RESOURCES)[number];
export type ResourceMap = Record<Resource, number>;

export type Terrain = 'hills' | 'forest' | 'pasture' | 'fields' | 'mountains' | 'desert';
export const TERRAIN_RESOURCE: Record<Exclude<Terrain, 'desert'>, Resource> = {
  hills: 'brick',
  forest: 'wood',
  pasture: 'sheep',
  fields: 'wheat',
  mountains: 'ore',
};

export const DEV_CARD_TYPES = ['knight', 'victoryPoint', 'roadBuilding', 'yearOfPlenty', 'monopoly'] as const;
export type DevCardType = (typeof DEV_CARD_TYPES)[number];

/** 'any' — гавань 3:1, иначе гавань 2:1 для конкретного ресурса. */
export type HarborType = 'any' | Resource;

export const PLAYER_COLORS = ['red', 'blue', 'white', 'orange', 'green', 'purple'] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

/** Уровень бота (у людей поля нет). */
export type BotLevel = 'easy' | 'medium' | 'hard';
export const BOT_LEVELS: readonly BotLevel[] = ['easy', 'medium', 'hard'];

export type PlayerId = string;
export type HexId = string;
export type VertexId = string;
export type EdgeId = string;

export function emptyResources(): ResourceMap {
  return { brick: 0, wood: 0, sheep: 0, wheat: 0, ore: 0 };
}

export function resourceMap(partial: Partial<ResourceMap> = {}): ResourceMap {
  return { ...emptyResources(), ...partial };
}

export function totalResources(m: ResourceMap): number {
  return RESOURCES.reduce((sum, r) => sum + (m[r] ?? 0), 0);
}

export function hasResources(have: ResourceMap, need: ResourceMap): boolean {
  return RESOURCES.every((r) => (have[r] ?? 0) >= (need[r] ?? 0));
}

/** target += sign * delta (по каждому ресурсу). */
export function addResources(target: ResourceMap, delta: ResourceMap, sign: 1 | -1 = 1): void {
  for (const r of RESOURCES) target[r] = (target[r] ?? 0) + sign * (delta[r] ?? 0);
}

/** Карта ресурсов из произвольного ввода: только целые неотрицательные числа. */
export function isValidResourceMap(m: unknown): m is ResourceMap {
  if (!m || typeof m !== 'object') return false;
  const rec = m as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    if (!(RESOURCES as readonly string[]).includes(key)) return false;
  }
  return RESOURCES.every((r) => {
    const v = rec[r] ?? 0;
    return typeof v === 'number' && Number.isInteger(v) && v >= 0;
  });
}

export function isResource(x: unknown): x is Resource {
  return typeof x === 'string' && (RESOURCES as readonly string[]).includes(x);
}
