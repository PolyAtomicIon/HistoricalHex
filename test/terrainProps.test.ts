import { describe, expect, it } from 'vitest';
import { genProps, type PropKind } from '../src/board3d/Terrain';

const TERR = ['forest', 'hills', 'pasture', 'fields', 'mountains', 'desert'] as const;
const tiles = TERR.map((terrain, i) => ({ id: `h${i}`, terrain, x: i * 3, z: 0, number: 6 }));

describe('детальная графика: декор гексов', () => {
  it('добавляет детали, не трогая обычную раскладку', () => {
    const base = genProps(tiles as never);
    const rich = genProps(tiles as never, true);
    const count = (p: Record<PropKind, unknown[]>) => Object.values(p).reduce((a, x) => a + x.length, 0);
    expect(count(rich)).toBeGreaterThan(count(base) * 1.3);
    // обычные пропсы на тех же местах
    for (const k of Object.keys(base) as PropKind[]) expect(rich[k].slice(0, base[k].length)).toEqual(base[k]);
  });
  it('новые детали не лезут под фишку с числом и за край гекса', () => {
    const base = genProps(tiles as never);
    const rich = genProps(tiles as never, true);
    for (const k of Object.keys(rich) as PropKind[]) {
      for (const p of rich[k].slice(base[k].length)) {
        const t = tiles.find((t) => Math.abs(t.x - p.x) < 1.2)!;
        const r = Math.hypot(p.x - t.x, p.z - t.z);
        expect(r).toBeGreaterThanOrEqual(0.3);
        expect(r).toBeLessThanOrEqual(0.82);
      }
    }
  });
});
