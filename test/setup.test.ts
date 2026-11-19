import { describe, expect, it } from 'vitest';
import { TERRAIN_RESOURCE, legalSettlementVertices, seededRng, topologyFor, totalResources } from '../src/engine';
import { act, actFail, newGame, playSetup, setupStep } from './helpers';

describe('расстановка', () => {
  it('идёт змейкой: a, b, c, c, b, a', () => {
    let s = newGame(3);
    const rng = seededRng(5);
    const turns: string[] = [];
    while (s.phase === 'setup') {
      const pid = s.order[s.current];
      if (s.setup!.step === 'settlement') turns.push(pid);
      s = setupStep(s, rng);
    }
    expect(turns).toEqual(['a', 'b', 'c', 'c', 'b', 'a']);
    expect(s.phase).toBe('roll');
    expect(s.turn).toBe(1);
    expect(s.order[s.current]).toBe('a');
    for (const pid of s.order) {
      expect(s.players[pid].pieces).toEqual({ roads: 13, settlements: 3, cities: 4 });
    }
  });

  it('нельзя ходить не в свою очередь', () => {
    const s = newGame(3);
    const v = legalSettlementVertices(s, 'b', true)[0];
    expect(actFail(s, 'b', { type: 'buildSettlement', vertex: v })).toBe('Сейчас не твой ход');
  });

  it('правило расстояния и дорога только от нового поселения', () => {
    let s = newGame(3);
    const t = topologyFor(s.board.layout);
    const v = [...t.vertices.values()].find((x) => x.neighbors.length === 3)!;
    expect(actFail(s, 'a', { type: 'buildRoad', edge: v.edges[0] })).toBe('Сначала поставь поселение');
    s = act(s, 'a', { type: 'buildSettlement', vertex: v.id });
    expect(actFail(s, 'a', { type: 'buildSettlement', vertex: v.neighbors[0] })).toBe('Сначала поставь дорогу к своему поселению');

    const far = [...t.edges.values()].find((e) => !e.vertices.includes(v.id))!;
    expect(actFail(s, 'a', { type: 'buildRoad', edge: far.id })).toMatch(/примыкать/);
    s = act(s, 'a', { type: 'buildRoad', edge: v.edges[0] });

    // Игрок b не может поставить поселение рядом с поселением a
    expect(actFail(s, 'b', { type: 'buildSettlement', vertex: v.neighbors[1] })).toBe('Сюда нельзя поставить поселение');
  });

  it('за второе поселение даётся по ресурсу с соседних гексов, за первое — ничего', () => {
    let s = newGame(3, 3);
    const rng = seededRng(11);
    // Первые три поселения (раунд 1)
    for (let i = 0; i < 6; i++) s = setupStep(s, rng);
    expect(s.order.every((p) => totalResources(s.players[p].resources) === 0)).toBe(true);

    // Второе поселение игрока c
    const pid = s.order[s.current];
    expect(pid).toBe('c');
    const v = legalSettlementVertices(s, pid, true)[0];
    s = act(s, pid, { type: 'buildSettlement', vertex: v });
    const t = topologyFor(s.board.layout);
    const expected: Record<string, number> = {};
    for (const hid of t.vertices.get(v)!.hexes) {
      const hex = s.board.hexes.find((h) => h.id === hid)!;
      if (hex.terrain === 'desert') continue;
      const r = TERRAIN_RESOURCE[hex.terrain];
      expected[r] = (expected[r] ?? 0) + 1;
    }
    for (const [r, n] of Object.entries(expected)) {
      expect(s.players[pid].resources[r as keyof typeof s.bank]).toBe(n);
    }
  });

  it('после расстановки у всех по 2 поселения и 2 дороги (6 игроков, большое поле)', () => {
    const s = playSetup(newGame(6), seededRng(8));
    expect(s.board.layout).toBe('extended');
    expect(Object.keys(s.buildings)).toHaveLength(12);
    expect(Object.keys(s.roads)).toHaveLength(12);
  });
});
