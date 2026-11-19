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

export function generateBoard(layout: LayoutKind, rng: Rng): { board: Board; robberHex: HexId } {
  const spec = LAYOUTS[layout];
  const topo = topologyFor(layout);
  const hexOrder = [...topo.hexes.values()];

  const terrainPool: Terrain[] = [];
  for (const [t, count] of Object.entries(spec.terrain) as [Terrain, number][]) {
    for (let i = 0; i < count; i++) terrainPool.push(t);
  }
  if (terrainPool.length !== hexOrder.length) throw new Error('Состав местности не совпадает с числом гексов');

  const terrains = shuffle(rng, terrainPool);
  const hexes: BoardHex[] = hexOrder.map((h, i) => ({ id: h.id, q: h.q, r: h.r, terrain: terrains[i] }));
  const land = hexes.filter((h) => h.terrain !== 'desert');
  if (land.length !== spec.numbers.length) throw new Error('Число жетонов не совпадает с числом гексов');

  let placed = false;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !placed; attempt++) {
    const numbers = shuffle(rng, spec.numbers);
    land.forEach((h, i) => (h.number = numbers[i]));
    placed = redNumbersApart(hexes, layout);
  }
  if (!placed) throw new Error('Не удалось разложить жетоны так, чтобы 6 и 8 не стояли рядом');

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
