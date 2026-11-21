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

const RESOURCES: Resource[] = ['brick', 'wood', 'sheep', 'wheat', 'ore'];

export interface HarvestRow {
  n: number;
  ways: number;
  /** Кто сколько чего получит, если выпадет это число. */
  gets: { who: PlayerId; res: Partial<Record<Resource, number>> }[];
  /** На этом числе есть гекс под захватчиками. */
  blocked: boolean;
}

export interface Supply {
  r: Resource;
  /** Сколько карт этого ресурса весь стол в среднем получает за бросок. */
  perRoll: number;
  bank: number;
  tag?: 'plenty' | 'scarce' | 'none';
}

/** Урожай всего стола по числам (для ТВ): кто что получит на каждом числе + что в достатке, что в дефиците. */
export function tableHarvest(pub: Pick<PublicState, 'board' | 'buildings' | 'robberHex' | 'order' | 'bank'>): { rows: HarvestRow[]; supply: Supply[] } {
  const byN = new Map<number, HarvestRow>();
  const per: Record<Resource, number> = { brick: 0, wood: 0, sheep: 0, wheat: 0, ore: 0 };
  for (const pid of pub.order) {
    for (const r of incomeByNumber(pub, pid).rows) {
      const row = byN.get(r.n) ?? { n: r.n, ways: r.ways, gets: [], blocked: false };
      if (Object.keys(r.res).length) row.gets.push({ who: pid, res: r.res });
      if (Object.keys(r.blocked).length) row.blocked = true;
      for (const [res, c] of Object.entries(r.res) as [Resource, number][]) per[res] += (r.ways / 36) * c;
      byN.set(r.n, row);
    }
  }
  const supply: Supply[] = RESOURCES.map((r) => ({ r, perRoll: per[r], bank: pub.bank[r] }));
  const live = supply.filter((s) => s.perRoll > 0);
  for (const s of supply) if (s.perRoll === 0) s.tag = 'none';
  if (live.length > 1) {
    const max = Math.max(...live.map((s) => s.perRoll));
    const min = Math.min(...live.map((s) => s.perRoll));
    if (max - min > 0.05) {
      for (const s of live) {
        if (s.perRoll === max) s.tag = 'plenty';
        else if (s.perRoll === min) s.tag = 'scarce';
      }
    }
  }
  return { rows: [...byN.values()].sort((a, b) => a.n - b.n), supply };
}
