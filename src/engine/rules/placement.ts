// Где можно строить. Использует только публичную информацию (поле, постройки, дороги),
// поэтому эти же функции подходят экрану игрока для подсветки доступных мест.

import type { EdgeId, HarborType, HexId, PlayerId, Resource, VertexId } from '../types';
import { RESOURCES } from '../types';
import type { GameState } from '../state';
import { topologyFor } from '../board/geometry';

export type BoardView = Pick<GameState, 'board' | 'buildings' | 'roads'>;

const topo = (s: BoardView) => topologyFor(s.board.layout);

/** Правило расстояния: на соседних перекрёстках не должно быть построек. */
export function satisfiesDistance(s: BoardView, v: VertexId): boolean {
  const vertex = topo(s).vertices.get(v);
  return !!vertex && vertex.neighbors.every((n) => !s.buildings[n]);
}

export function canBuildSettlement(s: BoardView, pid: PlayerId, v: VertexId, setup = false): boolean {
  const vertex = topo(s).vertices.get(v);
  if (!vertex || s.buildings[v] || !satisfiesDistance(s, v)) return false;
  if (setup) return true;
  return vertex.edges.some((e) => s.roads[e] === pid);
}

/**
 * Дорога должна примыкать к своей постройке или к своей дороге.
 * Продолжать дорогу через чужое поселение/город нельзя.
 * На расстановке (setupVertex) — только от только что поставленного поселения.
 */
export function canBuildRoad(s: BoardView, pid: PlayerId, e: EdgeId, setupVertex?: VertexId): boolean {
  const t = topo(s);
  const edge = t.edges.get(e);
  if (!edge || s.roads[e]) return false;
  if (setupVertex !== undefined) return edge.vertices.includes(setupVertex);
  return edge.vertices.some((v) => {
    const b = s.buildings[v];
    if (b) return b.owner === pid;
    return t.vertices.get(v)!.edges.some((other) => other !== e && s.roads[other] === pid);
  });
}

export function canBuildCity(s: BoardView, pid: PlayerId, v: VertexId): boolean {
  const b = s.buildings[v];
  return !!b && b.owner === pid && b.kind === 'settlement';
}

export function legalSettlementVertices(s: BoardView, pid: PlayerId, setup = false): VertexId[] {
  return [...topo(s).vertices.keys()].filter((v) => canBuildSettlement(s, pid, v, setup));
}

export function legalRoadEdges(s: BoardView, pid: PlayerId, setupVertex?: VertexId): EdgeId[] {
  return [...topo(s).edges.keys()].filter((e) => canBuildRoad(s, pid, e, setupVertex));
}

export function legalCityVertices(s: BoardView, pid: PlayerId): VertexId[] {
  return Object.keys(s.buildings).filter((v) => canBuildCity(s, pid, v));
}

/** Игроки (кроме pid), у которых есть постройка у гекса. Карты на руке не проверяются. */
export function playersAtHex(s: BoardView, hex: HexId, except?: PlayerId): PlayerId[] {
  const h = topo(s).hexes.get(hex);
  if (!h) return [];
  const owners = new Set<PlayerId>();
  for (const v of h.vertices) {
    const b = s.buildings[v];
    if (b && b.owner !== except) owners.add(b.owner);
  }
  return [...owners];
}

/** Гавани, доступные игроку (по его поселениям и городам). */
export function playerHarbors(s: BoardView, pid: PlayerId): HarborType[] {
  const t = topo(s);
  const result = new Set<HarborType>();
  for (const h of s.board.harbors) {
    const edge = t.edges.get(h.edge);
    if (edge?.vertices.some((v) => s.buildings[v]?.owner === pid)) result.add(h.type);
  }
  return [...result];
}

/** Курс обмена с банком по каждому ресурсу: 4, 3 или 2. */
export function tradeRatios(s: BoardView, pid: PlayerId): Record<Resource, number> {
  const harbors = playerHarbors(s, pid);
  const base = harbors.includes('any') ? 3 : 4;
  const ratios = {} as Record<Resource, number>;
  for (const r of RESOURCES) ratios[r] = harbors.includes(r) ? 2 : base;
  return ratios;
}
