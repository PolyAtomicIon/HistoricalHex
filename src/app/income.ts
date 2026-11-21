// Доход игрока по числам кубиков: какие числа что приносят (поселение — 1, город — 2),
// что сейчас заблокировано захватчиками, и сколько карт в среднем за бросок.

import type { PlayerId, PublicState, Resource } from '../engine';
import { TERRAIN_RESOURCE, topologyFor } from '../engine';

export interface IncomeRow {
  n: number;
  /** Сколько чего приносит это число (без заблокированного). */
  res: Partial<Record<Resource, number>>;
  /** Заблокировано захватчиками на этом числе. */
  blocked: Partial<Record<Resource, number>>;
  /** Шанс выпадения числа из 36. */
  ways: number;
}

const WAYS = (n: number) => 6 - Math.abs(n - 7);

export function incomeByNumber(pub: Pick<PublicState, 'board' | 'buildings' | 'robberHex'>, pid: PlayerId): { rows: IncomeRow[]; perRoll: number } {
  const topo = topologyFor(pub.board.layout);
  const byN = new Map<number, IncomeRow>();
  for (const [v, b] of Object.entries(pub.buildings)) {
    if (b.owner !== pid) continue;
    const amount = b.kind === 'city' ? 2 : 1;
    for (const hid of topo.vertices.get(v)?.hexes ?? []) {
      const hex = pub.board.hexes.find((h) => h.id === hid);
      if (!hex || !hex.number || hex.terrain === 'desert') continue;
      const r = TERRAIN_RESOURCE[hex.terrain];
      const row = byN.get(hex.number) ?? { n: hex.number, res: {}, blocked: {}, ways: WAYS(hex.number) };
      const bucket = hex.id === pub.robberHex ? row.blocked : row.res;
      bucket[r] = (bucket[r] ?? 0) + amount;
      byN.set(hex.number, row);
    }
  }
  const rows = [...byN.values()].sort((a, b) => b.ways - a.ways || a.n - b.n);
  const perRoll = rows.reduce((s, r) => s + (r.ways / 36) * Object.values(r.res).reduce((a, x) => a + (x ?? 0), 0), 0);
  return { rows, perRoll };
}
