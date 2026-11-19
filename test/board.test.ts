import { describe, expect, it } from 'vitest';
import type { LayoutKind } from '../src/engine';
import { LAYOUTS, generateBoard, harborEdges, redNumbersApart, seededRng, topologyFor } from '../src/engine';

describe('геометрия поля', () => {
  it('обычное поле: 19 гексов, 54 перекрёстка, 72 пути, берег из 30 рёбер', () => {
    const t = topologyFor('standard');
    expect(t.hexes.size).toBe(19);
    expect(t.vertices.size).toBe(54);
    expect(t.edges.size).toBe(72);
    expect(t.coast.length).toBe(30);
    expect(t.sea.length).toBe(18);
  });

  it('большое поле: 30 гексов', () => {
    const t = topologyFor('extended');
    expect(t.hexes.size).toBe(30);
    expect([...t.hexes.values()].every((h) => h.vertices.length === 6 && h.edges.length === 6)).toBe(true);
  });

  for (const layout of ['standard', 'extended'] as LayoutKind[]) {
    it(`${layout}: ряды гексов как в спецификации`, () => {
      const t = topologyFor(layout);
      const rows = new Map<number, number>();
      for (const h of t.hexes.values()) rows.set(h.r, (rows.get(h.r) ?? 0) + 1);
      const sorted = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
      expect(sorted).toEqual(LAYOUTS[layout].rows);
    });

    it(`${layout}: у перекрёстка 1–3 гекса и 2–3 соседа`, () => {
      const t = topologyFor(layout);
      for (const v of t.vertices.values()) {
        expect(v.hexes.length).toBeGreaterThanOrEqual(1);
        expect(v.hexes.length).toBeLessThanOrEqual(3);
        expect(v.neighbors.length).toBeGreaterThanOrEqual(2);
        expect(v.neighbors.length).toBeLessThanOrEqual(3);
      }
    });

    it(`${layout}: берег — замкнутая цепочка соседних рёбер`, () => {
      const t = topologyFor(layout);
      const coast = t.coast;
      expect(new Set(coast).size).toBe(coast.length);
      for (let i = 0; i < coast.length; i++) {
        const a = t.edges.get(coast[i])!.vertices;
        const b = t.edges.get(coast[(i + 1) % coast.length])!.vertices;
        expect(a.some((v) => b.includes(v))).toBe(true);
      }
    });

    it(`${layout}: гавани не делят перекрёстки`, () => {
      const t = topologyFor(layout);
      const edges = harborEdges(t, LAYOUTS[layout].harbors.length);
      const used = new Set<string>();
      for (const e of edges) {
        for (const v of t.edges.get(e)!.vertices) {
          expect(used.has(v)).toBe(false);
          used.add(v);
        }
      }
    });
  }
});

describe('генерация поля', () => {
  for (const layout of ['standard', 'extended'] as LayoutKind[]) {
    it(`${layout}: правильный состав`, () => {
      const spec = LAYOUTS[layout];
      const { board, robberHex } = generateBoard(layout, seededRng(7));
      const terrain: Record<string, number> = {};
      for (const h of board.hexes) terrain[h.terrain] = (terrain[h.terrain] ?? 0) + 1;
      expect(terrain).toEqual(spec.terrain);

      const numbers = board.hexes.filter((h) => h.number !== undefined).map((h) => h.number!);
      expect(numbers.sort((a, b) => a - b)).toEqual([...spec.numbers].sort((a, b) => a - b));
      expect(board.hexes.filter((h) => h.terrain === 'desert').every((h) => h.number === undefined)).toBe(true);

      expect(board.harbors.map((h) => h.type).sort()).toEqual([...spec.harbors].sort());
      expect(board.hexes.find((h) => h.id === robberHex)!.terrain).toBe('desert');
    });

    it(`${layout}: 6 и 8 никогда не стоят рядом (200 раскладок)`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const { board } = generateBoard(layout, seededRng(seed));
        expect(redNumbersApart(board.hexes, layout)).toBe(true);
      }
    });
  }

  it('одно и то же зерно даёт одну и ту же карту, разные — разные', () => {
    const a = generateBoard('standard', seededRng(1)).board;
    const b = generateBoard('standard', seededRng(1)).board;
    const c = generateBoard('standard', seededRng(2)).board;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
