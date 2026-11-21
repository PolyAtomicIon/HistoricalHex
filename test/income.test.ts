import { describe, expect, it } from 'vitest';
import { incomeByNumber, tableHarvest } from '../src/app/income';
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
  it('урожай стола: кто что получит на каждом числе, что в достатке и в дефиците', () => {
    const s = mainPhase(newGame(3));
    const t = topologyFor(s.board.layout);
    const vs = [...t.vertices.values()];
    s.buildings[vs[5].id] = { owner: s.order[0], kind: 'settlement' };
    s.buildings[vs[20].id] = { owner: s.order[1], kind: 'city' };
    s.buildings[vs[40].id] = { owner: s.order[2], kind: 'settlement' };
    const { rows, supply } = tableHarvest(s);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.n)).toEqual([...rows.map((r) => r.n)].sort((a, b) => a - b));
    for (const r of rows) for (const g of r.gets) expect(s.order).toContain(g.who);
    // сумма по столу = сумме доходов игроков
    const total = supply.reduce((a, x) => a + x.perRoll, 0);
    const byPlayers = s.order.reduce((a, p) => a + incomeByNumber(s, p).perRoll, 0);
    expect(total).toBeCloseTo(byPlayers, 6);
    const tags = supply.map((x) => x.tag);
    if (supply.filter((x) => x.perRoll > 0).length > 1) expect(tags).toContain('plenty');
    for (const x of supply) if (x.perRoll === 0) expect(x.tag).toBe('none');
  });
});
