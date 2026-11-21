import { describe, expect, it } from 'vitest';
import { incomeByNumber } from '../src/app/income';
import { topologyFor } from '../src/engine';
import { mainPhase, newGame } from './helpers';

describe('доход по числам', () => {
  it('поселение даёт 1, город 2, захваченное — отдельно, шанс по числу', () => {
    const s = mainPhase(newGame(3));
    for (const k of Object.keys(s.buildings)) delete s.buildings[k];
    const t = topologyFor(s.board.layout);
    const hex = s.board.hexes.find((h) => h.number && h.terrain !== 'desert')!;
    const vs = [...t.vertices.values()].filter((v) => v.hexes.includes(hex.id));
    s.buildings[vs[0].id] = { owner: 'a', kind: 'settlement' };
    s.buildings[vs[3].id] = { owner: 'a', kind: 'city' };
    s.robberHex = s.board.hexes.find((h) => h.terrain === 'desert')!.id;
    const { rows, perRoll } = incomeByNumber(s, 'a');
    const row = rows.find((r) => r.n === hex.number)!;
    const total = Object.values(row.res).reduce((a, x) => a + (x ?? 0), 0);
    expect(total).toBeGreaterThanOrEqual(3); // 1 + 2 с этого гекса (плюс соседние гексы)
    expect(row.ways).toBe(6 - Math.abs(hex.number! - 7));
    expect(perRoll).toBeGreaterThan(0);
    // захватчики на этом гексе — доход уходит в blocked
    s.robberHex = hex.id;
    const blockedRow = incomeByNumber(s, 'a').rows.find((r) => r.n === hex.number)!;
    expect(Object.values(blockedRow.blocked).reduce((a, x) => a + (x ?? 0), 0)).toBe(3);
  });
  it('без построек — пусто', () => {
    const s = mainPhase(newGame(3));
    for (const k of Object.keys(s.buildings)) delete s.buildings[k];
    expect(incomeByNumber(s, 'a')).toEqual({ rows: [], perRoll: 0 });
  });
});
