// Геометрия поля: гексы «острым верхом» (pointy-top) в осевых координатах (q, r).
//
// Чтобы вершины и рёбра соседних гексов совпадали точно, все точки считаются
// в целочисленной сетке: X в единицах √3/2, Y в единицах 1/2 от радиуса гекса.
// Центр гекса (q, r) → X = 2q + r, Y = 3r. Углы — смещения из CORNERS.

import type { EdgeId, HexId, VertexId } from '../types';
import type { LayoutKind } from '../constants';
import { LAYOUTS } from '../constants';

export interface HexCoord {
  q: number;
  r: number;
}

/** Углы гекса по часовой стрелке, начиная с верхнего (смещения в сетке от центра). */
export const HEX_CORNERS: ReadonlyArray<readonly [number, number]> = [
  [0, -2],
  [1, -1],
  [1, 1],
  [0, 2],
  [-1, 1],
  [-1, -1],
];

const HEX_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export const hexId = (q: number, r: number): HexId => `h${q}_${r}`;
export const vertexId = (x: number, y: number): VertexId => `v${x}_${y}`;
export const edgeId = (a: VertexId, b: VertexId): EdgeId => (a < b ? `${a}~${b}` : `${b}~${a}`);

export interface TopoHex {
  id: HexId;
  q: number;
  r: number;
  /** Центр в сетке (X, Y). */
  x: number;
  y: number;
  vertices: VertexId[];
  edges: EdgeId[];
  neighbors: HexId[];
}

export interface TopoVertex {
  id: VertexId;
  x: number;
  y: number;
  hexes: HexId[];
  neighbors: VertexId[];
  edges: EdgeId[];
}

export interface TopoEdge {
  id: EdgeId;
  vertices: [VertexId, VertexId];
  hexes: HexId[];
}

export interface Topology {
  hexes: Map<HexId, TopoHex>;
  vertices: Map<VertexId, TopoVertex>;
  edges: Map<EdgeId, TopoEdge>;
  /** Прибрежные рёбра по порядку обхода берега. */
  coast: EdgeId[];
  /** Морские гексы вокруг суши (для отрисовки рамки). */
  sea: HexCoord[];
}

/** Координаты гексов по длинам рядов (ряды центрированы по горизонтали). */
export function layoutCoords(rows: readonly number[]): HexCoord[] {
  if (rows.length % 2 !== 1) throw new Error('Число рядов должно быть нечётным');
  const mid = (rows.length - 1) / 2;
  const shift = (rows[mid] - 1) % 2; // чтобы q получался целым
  const coords: HexCoord[] = [];
  rows.forEach((n, i) => {
    const r = i - mid;
    const offset = (n - 1 + r + shift) / 2;
    if (!Number.isInteger(offset)) throw new Error('Соседние ряды должны отличаться на 1 гекс');
    for (let k = 0; k < n; k++) coords.push({ q: k - offset, r });
  });
  return coords;
}

export function buildTopology(coords: readonly HexCoord[]): Topology {
  const hexes = new Map<HexId, TopoHex>();
  const vertices = new Map<VertexId, TopoVertex>();
  const edges = new Map<EdgeId, TopoEdge>();

  const ensureVertex = (x: number, y: number): TopoVertex => {
    const id = vertexId(x, y);
    let v = vertices.get(id);
    if (!v) {
      v = { id, x, y, hexes: [], neighbors: [], edges: [] };
      vertices.set(id, v);
    }
    return v;
  };

  for (const { q, r } of coords) {
    const id = hexId(q, r);
    const x = 2 * q + r;
    const y = 3 * r;
    const corner = HEX_CORNERS.map(([dx, dy]) => ensureVertex(x + dx, y + dy));
    const hexEdges: EdgeId[] = [];
    corner.forEach((v, i) => {
      v.hexes.push(id);
      const w = corner[(i + 1) % 6];
      const eid = edgeId(v.id, w.id);
      let e = edges.get(eid);
      if (!e) {
        e = { id: eid, vertices: [v.id, w.id], hexes: [] };
        edges.set(eid, e);
        v.edges.push(eid);
        w.edges.push(eid);
        v.neighbors.push(w.id);
        w.neighbors.push(v.id);
      }
      e.hexes.push(id);
      hexEdges.push(eid);
    });
    hexes.set(id, { id, q, r, x, y, vertices: corner.map((v) => v.id), edges: hexEdges, neighbors: [] });
  }

  const seaKeys = new Set<string>();
  const sea: HexCoord[] = [];
  for (const h of hexes.values()) {
    for (const [dq, dr] of HEX_DIRECTIONS) {
      const nq = h.q + dq;
      const nr = h.r + dr;
      const nid = hexId(nq, nr);
      if (hexes.has(nid)) h.neighbors.push(nid);
      else if (!seaKeys.has(nid)) {
        seaKeys.add(nid);
        sea.push({ q: nq, r: nr });
      }
    }
  }

  return { hexes, vertices, edges, coast: orderCoast(vertices, edges), sea };
}

/** Обход берега: рёбра, принадлежащие ровно одному гексу суши, по порядку. */
function orderCoast(vertices: Map<VertexId, TopoVertex>, edges: Map<EdgeId, TopoEdge>): EdgeId[] {
  const coastal = [...edges.values()].filter((e) => e.hexes.length === 1);
  if (coastal.length === 0) return [];
  const byVertex = new Map<VertexId, EdgeId[]>();
  for (const e of coastal) {
    for (const v of e.vertices) {
      const list = byVertex.get(v) ?? [];
      list.push(e.id);
      byVertex.set(v, list);
    }
  }
  // Детерминированный старт: ребро, середина которого выше всех (а при равенстве — левее).
  const mid = (e: TopoEdge) => {
    const [a, b] = e.vertices.map((id) => vertices.get(id)!);
    return { x: a.x + b.x, y: a.y + b.y };
  };
  const start = coastal.slice().sort((e1, e2) => {
    const m1 = mid(e1);
    const m2 = mid(e2);
    return m1.y - m2.y || m1.x - m2.x;
  })[0];

  const order: EdgeId[] = [start.id];
  // Идём по часовой: из вершины с бо́льшим X.
  const [s0, s1] = start.vertices.map((id) => vertices.get(id)!);
  let at = s0.x > s1.x ? s0.id : s1.id;
  let prev = start.id;
  for (let guard = 0; guard < coastal.length + 1; guard++) {
    const next = (byVertex.get(at) ?? []).find((id) => id !== prev);
    if (!next || next === start.id) break;
    order.push(next);
    const e = edges.get(next)!;
    at = e.vertices[0] === at ? e.vertices[1] : e.vertices[0];
    prev = next;
  }
  if (order.length !== coastal.length) throw new Error('Берег не образует замкнутый контур');
  return order;
}

/** Позиции гаваней: равномерно по берегу. */
export function harborEdges(topo: Topology, count: number): EdgeId[] {
  const n = topo.coast.length;
  return Array.from({ length: count }, (_, i) => topo.coast[Math.floor((i * n) / count + n / count / 2)]);
}

const topologyCache = new Map<LayoutKind, Topology>();

/** Топология зависит только от формы поля, поэтому кэшируется по типу раскладки. */
export function topologyFor(layout: LayoutKind): Topology {
  let topo = topologyCache.get(layout);
  if (!topo) {
    topo = buildTopology(layoutCoords(LAYOUTS[layout].rows));
    topologyCache.set(layout, topo);
  }
  return topo;
}

/** Перевод точки сетки в пиксели для гекса с радиусом size. */
export function toPixel(x: number, y: number, size: number): { px: number; py: number } {
  return { px: (x * Math.sqrt(3) * size) / 2, py: (y * size) / 2 };
}
