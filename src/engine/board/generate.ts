// Случайная генерация поля: местность, жетоны чисел, гавани, стартовая позиция разбойника.

import type { EdgeId, HarborType, HexId, Terrain } from '../types';
import type { LayoutKind } from '../constants';
import { LAYOUTS } from '../constants';
import type { Rng } from '../rng';
import { pick, shuffle } from '../rng';
import { harborEdges, topologyFor } from './geometry';

export interface BoardHex {
  id: HexId;
  q: number;
  r: number;
  terrain: Terrain;
  /** У пустыни числа нет (поле отсутствует). */
  number?: number;
}

export interface Harbor {
  edge: EdgeId;
  type: HarborType;
}

export interface Board {
  layout: LayoutKind;
  hexes: BoardHex[];
  harbors: Harbor[];
}

const RED_NUMBERS = new Set([6, 8]);
const MAX_ATTEMPTS = 5000;
const TERRAIN_ATTEMPTS = 3000;

export function generateBoard(layout: LayoutKind, rng: Rng): { board: Board; robberHex: HexId } {
  const spec = LAYOUTS[layout];
  const topo = topologyFor(layout);
  const hexOrder = [...topo.hexes.values()];

  const terrainPool: Terrain[] = [];
  for (const [t, count] of Object.entries(spec.terrain) as [Terrain, number][]) {
    for (let i = 0; i < count; i++) terrainPool.push(t);
  }
  if (terrainPool.length !== hexOrder.length) throw new Error('Состав местности не совпадает с числом гексов');

  // Местность: как в правилах «для опытных» — одинаковые ресурсы не слипаются в кучу.
  // Берём лучшую из нескольких случайных раскладок (меньше всего соседних пар одного ресурса).
  const nbr = (id: HexId) => topo.hexes.get(id)!.neighbors;
  const hexes: BoardHex[] = hexOrder.map((h) => ({ id: h.id, q: h.q, r: h.r, terrain: 'desert' as Terrain }));
  const byId = new Map(hexes.map((h) => [h.id, h]));
  let best: Terrain[] = terrainPool;
  let bestScore = Infinity;
  for (let attempt = 0; attempt < TERRAIN_ATTEMPTS && bestScore > 0; attempt++) {
    const t = shuffle(rng, terrainPool);
    hexes.forEach((h, i) => (h.terrain = t[i]));
    const score = terrainClumps(hexes, nbr, byId);
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  hexes.forEach((h, i) => (h.terrain = best[i]));
  const land = hexes.filter((h) => h.terrain !== 'desert');
  if (land.length !== spec.numbers.length) throw new Error('Число жетонов не совпадает с числом гексов');

  // Жетоны: 6 и 8 не рядом (обязательно); одинаковые числа и 2/12 не рядом, у одного ресурса
  // не больше одного красного числа — желательно (берём раскладку с наименьшим числом нарушений).
  let bestNums: number[] | null = null;
  let bestSoft = Infinity;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && bestSoft > 0; attempt++) {
    const numbers = shuffle(rng, spec.numbers);
    land.forEach((h, i) => (h.number = numbers[i]));
    if (!redNumbersApart(hexes, layout)) continue;
    const soft = numberClumps(hexes, nbr, byId);
    if (soft < bestSoft) {
      bestSoft = soft;
      bestNums = numbers;
    }
  }
  if (!bestNums) throw new Error('Не удалось разложить жетоны так, чтобы 6 и 8 не стояли рядом');
  land.forEach((h, i) => (h.number = bestNums![i]));

  const types = shuffle(rng, spec.harbors);
  const harbors: Harbor[] = harborEdges(topo, types.length).map((edge, i) => ({ edge, type: types[i] }));

  const deserts = hexes.filter((h) => h.terrain === 'desert');
  const robberHex = pick(rng, deserts).id;

  return { board: { layout, hexes, harbors }, robberHex };
}

/** true, если никакие два гекса с 6/8 не соседствуют. */
export function redNumbersApart(hexes: readonly BoardHex[], layout: LayoutKind): boolean {
  const topo = topologyFor(layout);
  const byId = new Map(hexes.map((h) => [h.id, h]));
  for (const h of hexes) {
    if (h.number === undefined || !RED_NUMBERS.has(h.number)) continue;
    for (const nid of topo.hexes.get(h.id)!.neighbors) {
      const n = byId.get(nid);
      if (n?.number !== undefined && RED_NUMBERS.has(n.number)) return false;
    }
  }
  return true;
}

type Nbr = (id: HexId) => readonly HexId[];

/** Сколько пар соседних гексов с одинаковым ресурсом (пустыня не в счёт). */
export function terrainClumps(hexes: readonly BoardHex[], nbr: Nbr, byId: Map<HexId, BoardHex>): number {
  let n = 0;
  for (const h of hexes) {
    if (h.terrain === 'desert') continue;
    for (const id of nbr(h.id)) if (id > h.id && byId.get(id)?.terrain === h.terrain) n++;
  }
  return n;
}

/** Мягкие нарушения раскладки чисел: одинаковые числа рядом, 2 и 12 рядом, два красных числа на одном ресурсе. */
export function numberClumps(hexes: readonly BoardHex[], nbr: Nbr, byId: Map<HexId, BoardHex>): number {
  let n = 0;
  const redByTerrain = new Map<Terrain, number>();
  for (const h of hexes) {
    if (h.number === undefined) continue;
    if (RED_NUMBERS.has(h.number)) redByTerrain.set(h.terrain, (redByTerrain.get(h.terrain) ?? 0) + 1);
    for (const id of nbr(h.id)) {
      if (id <= h.id) continue;
      const o = byId.get(id)?.number;
      if (o === undefined) continue;
      if (o === h.number) n++;
      if ((o === 2 && h.number === 12) || (o === 12 && h.number === 2)) n++;
    }
  }
  for (const c of redByTerrain.values()) if (c > 1) n += c - 1;
  return n;
}
