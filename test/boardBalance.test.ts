import { expect, test } from 'vitest';
import { generateBoard, numberClumps, redNumbersApart, terrainClumps } from '../src/engine/board/generate';
import { topologyFor } from '../src/engine/board/geometry';
import type { HexId } from '../src/engine/types';

test('стандартное поле: ресурсы не слипаются, 6/8 и одинаковые числа не рядом', () => {
  const topo = topologyFor('standard');
  const nbr = (id: HexId) => topo.hexes.get(id)!.neighbors;
  let clumps = 0;
  for (let i = 0; i < 40; i++) {
    const { board } = generateBoard('standard', Math.random);
    const byId = new Map(board.hexes.map((h) => [h.id, h]));
    expect(redNumbersApart(board.hexes, 'standard')).toBe(true);
    expect(numberClumps(board.hexes, nbr, byId)).toBe(0);
    clumps += terrainClumps(board.hexes, nbr, byId);
  }
  expect(clumps / 40).toBeLessThan(1);
});
