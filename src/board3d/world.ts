// Мир 3D-доски: перевод целочисленной сетки движка в метры сцены (радиус гекса = 1),
// детерминированные хэши и поле расстояний до суши для пены на воде.

import * as THREE from 'three';
import type { EdgeId, HexId, Terrain, VertexId } from '../engine';
import type { LayoutKind } from '../engine/constants';
import { topologyFor } from '../engine/board/geometry';
import type { Topology } from '../engine/board/geometry';
import { seededRng } from '../engine/rng';

export const SQ3_2 = Math.sqrt(3) / 2;

/** Высота верхней грани плитки над уровнем моря. */
export const HEIGHT: Record<Terrain, number> = {
  forest: 0.22,
  hills: 0.3,
  pasture: 0.2,
  fields: 0.17,
  mountains: 0.34,
  desert: 0.15,
};

export interface World {
  topo: Topology;
  /** Центры гексов суши (x, z), остров центрирован в (0,0). */
  hex: Map<HexId, [number, number]>;
  vert: Map<VertexId, [number, number]>;
  /** Радиус описанной окружности острова. */
  radius: number;
  /** Точки для подбора камеры (вершины суши). */
  pts: [number, number][];
}

const worldCache = new Map<LayoutKind, World>();

export function worldFor(layout: LayoutKind): World {
  const cached = worldCache.get(layout);
  if (cached) return cached;
  const topo = topologyFor(layout);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const v of topo.vertices.values()) {
    const x = v.x * SQ3_2;
    const z = v.y / 2;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const hex = new Map<HexId, [number, number]>();
  const vert = new Map<VertexId, [number, number]>();
  const pts: [number, number][] = [];
  let radius = 0;
  for (const h of topo.hexes.values()) hex.set(h.id, [h.x * SQ3_2 - cx, h.y / 2 - cz]);
  for (const v of topo.vertices.values()) {
    const p: [number, number] = [v.x * SQ3_2 - cx, v.y / 2 - cz];
    vert.set(v.id, p);
    pts.push(p);
    radius = Math.max(radius, Math.hypot(p[0], p[1]));
  }
  const w: World = { topo, hex, vert, radius, pts };
  worldCache.set(layout, w);
  return w;
}

export interface HarborSpot {
  a: [number, number];
  b: [number, number];
  /** Центр причала в море. */
  p: [number, number];
}

export function harborSpot(world: World, edge: EdgeId): HarborSpot | null {
  const e = world.topo.edges.get(edge);
  if (!e) return null;
  const a = world.vert.get(e.vertices[0]);
  const b = world.vert.get(e.vertices[1]);
  const c = world.hex.get(e.hexes[0]);
  if (!a || !b || !c) return null;
  const mx = (a[0] + b[0]) / 2;
  const mz = (a[1] + b[1]) / 2;
  const len = Math.hypot(mx - c[0], mz - c[1]) || 1;
  const k = 0.62;
  return { a, b, p: [mx + ((mx - c[0]) / len) * k, mz + ((mz - c[1]) / len) * k] };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const rngFor = (s: string) => seededRng(hashStr(s));

export interface DistField {
  tex: THREE.DataTexture;
  min: number;
  size: number;
}

/** Поле расстояний до суши (R8): значение = (d + 0.3) / 3.3, d<0 внутри суши. */
export function buildDistField(centers: [number, number][], half: number, res = 192): DistField {
  const size = half * 2;
  const data = new Uint8Array(res * res);
  const a = SQ3_2 + 0.03;
  for (let j = 0; j < res; j++) {
    const z = -half + ((j + 0.5) / res) * size;
    for (let i = 0; i < res; i++) {
      const x = -half + ((i + 0.5) / res) * size;
      let d = 9;
      for (const [cx, cz] of centers) {
        const qx = x - cx;
        const qz = z - cz;
        const dd = Math.max(Math.abs(qx), Math.abs(qx * 0.5 + qz * SQ3_2), Math.abs(qx * 0.5 - qz * SQ3_2)) - a;
        if (dd < d) d = dd;
      }
      const v = (Math.min(3, Math.max(-0.3, d)) + 0.3) / 3.3;
      data[j * res + i] = Math.round(v * 255);
    }
  }
  const tex = new THREE.DataTexture(data, res, res, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { tex, min: -half, size };
}
