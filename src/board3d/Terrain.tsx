// Плитки местности и процедурные «пропсы» (деревья, овцы, пшеница, горы…), всё инстансами.

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Terrain } from '../engine';
import { HEIGHT, rngFor } from './world';
import { useEnv } from './rig';

export interface TileInfo {
  id: string;
  terrain: Terrain;
  x: number;
  z: number;
}

const TOP: Record<Terrain, string> = {
  forest: '#3d7a3c',
  hills: '#c8693a',
  pasture: '#8fc95b',
  fields: '#e9c24c',
  mountains: '#8f98aa',
  desert: '#e7d09a',
};
const SIDE: Record<Terrain, string> = {
  forest: '#5a4630',
  hills: '#6e3d26',
  pasture: '#5f5a34',
  fields: '#7a5f2c',
  mountains: '#4d5360',
  desert: '#a98a5c',
};

// ---------- геометрия плиток ----------

function hexShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 3;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

/** Кольцо из 6 углов гекса радиуса r на высоте y. */
function hexRing(r: number, y: number): THREE.Vector3[] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  });
}

/** Сборщик «слоёного» гекса: крышка + пояса стенок, цвет в вершинах (даёт фаску, срез почвы и затемнение у воды). */
class HexBuilder {
  pos: number[] = [];
  col: number[] = [];
  private v(p: THREE.Vector3, c: THREE.Color) {
    this.pos.push(p.x, p.y, p.z);
    this.col.push(c.r, c.g, c.b);
  }
  cap(ring: THREE.Vector3[], cRing: THREE.Color, cCenter: THREE.Color) {
    const c = new THREE.Vector3(0, ring[0].y, 0);
    for (let i = 0; i < 6; i++) {
      this.v(c, cCenter);
      this.v(ring[(i + 1) % 6], cRing);
      this.v(ring[i], cRing);
    }
  }
  band(top: THREE.Vector3[], bot: THREE.Vector3[], cTop: THREE.Color, cBot: THREE.Color) {
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      this.v(top[i], cTop);
      this.v(top[j], cTop);
      this.v(bot[i], cBot);
      this.v(top[j], cTop);
      this.v(bot[j], cBot);
      this.v(bot[i], cBot);
    }
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

const TILE_R = 0.972;
const TILE_CHAMFER = 0.05;

const tileGeoCache = new Map<Terrain, THREE.BufferGeometry>();
function tileGeo(t: Terrain): THREE.BufferGeometry {
  let g = tileGeoCache.get(t);
  if (!g) {
    const h = HEIGHT[t];
    const top = new THREE.Color(TOP[t]);
    const side = new THREE.Color(SIDE[t]);
    const c = (base: THREE.Color, k: number) => base.clone().multiplyScalar(k);
    const b = new HexBuilder();
    const rTop = TILE_R - TILE_CHAMFER;
    // крышка: к краям чуть темнее — мягкая «виньетка» объёма
    b.cap(hexRing(rTop, h), c(top, 0.93), c(top, 1.05));
    // фаска: ловит свет, читается как скруглённая кромка
    b.band(hexRing(rTop, h), hexRing(TILE_R, h - TILE_CHAMFER), c(top, 1.08), c(top, 0.9));
    // дёрн: тёмная кромка цвета верха
    const turf = h - TILE_CHAMFER - 0.055;
    b.band(hexRing(TILE_R, h - TILE_CHAMFER), hexRing(TILE_R, turf), c(top, 0.74), c(top, 0.6));
    // срез почвы: темнеет к воде (ощущение AO)
    b.band(hexRing(TILE_R, turf), hexRing(TILE_R, 0.02), c(side, 1.0), c(side, 0.5));
    b.band(hexRing(TILE_R, 0.02), hexRing(TILE_R, -0.5), c(side, 0.5), c(side, 0.3));
    g = b.build();
    tileGeoCache.set(t, g);
  }
  return g;
}

/** Пляж-цоколь под плиткой: светлый песок у кромки, уходит под воду тёмным камнем. */
let skirtGeoCache: THREE.BufferGeometry | null = null;
function skirtGeo(): THREE.BufferGeometry {
  if (skirtGeoCache) return skirtGeoCache;
  const b = new HexBuilder();
  const dark = new THREE.Color('#2e241b');
  const sand = new THREE.Color('#e3cf9d');
  const wet = new THREE.Color('#b59c68');
  const rock = new THREE.Color('#3b3a3d');
  b.cap(hexRing(0.985, 0.05), dark, dark);
  b.band(hexRing(0.985, 0.05), hexRing(1.07, 0.04), dark, sand);
  b.band(hexRing(1.07, 0.04), hexRing(1.2, -0.04), sand, wet);
  b.band(hexRing(1.2, -0.04), hexRing(1.3, -0.5), wet, rock);
  skirtGeoCache = b.build();
  return skirtGeoCache;
}

/** Плоский гекс (для подсветок) в плоскости XZ, нормаль вверх. */
export function flatHexGeo(r: number): THREE.ShapeGeometry {
  const g = new THREE.ShapeGeometry(hexShape(r));
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Контур гекса (кольцо). */
export function hexRingGeo(rOuter: number, rInner: number): THREE.ShapeGeometry {
  const s = hexShape(rOuter);
  s.holes.push(hexShape(rInner));
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  return g;
}

// ---------- геометрия пропсов ----------

const V3 = THREE.Vector3;
type V = [number, number, number];

export function part(
  g: THREE.BufferGeometry,
  color: string,
  pos: V = [0, 0, 0],
  rot: V = [0, 0, 0],
  scl: V = [1, 1, 1],
): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new V3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new V3(...scl),
  );
  let c = g.clone().applyMatrix4(m);
  if (c.index) c = c.toNonIndexed();
  c.deleteAttribute('uv');
  const n = c.attributes.position.count;
  const arr = new Float32Array(n * 3);
  const col = new THREE.Color(color);
  for (let i = 0; i < n; i++) col.toArray(arr, i * 3);
  c.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return c;
}

export const merge = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts, false) as THREE.BufferGeometry;
export const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);

function jitterHash(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Один гранёный конус-скала: неровные грани, снег выше snowY, к подножию темнее. */
function rockCone(r: number, H: number, ox: number, oz: number, seed: number, snowY: number): THREE.BufferGeometry {
  const cone = new THREE.ConeGeometry(r, H, 6, 3, false);
  cone.translate(0, H / 2, 0);
  const pos = cone.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = y / H < 0.99 ? 1 : 0;
    const hx = jitterHash(Math.round(x * 100) + seed, Math.round(y * 100), Math.round(z * 100));
    const hz = jitterHash(Math.round(z * 100) + 5 + seed, Math.round(y * 100), Math.round(x * 100));
    const hy = jitterHash(Math.round(y * 100) + 9 + seed, Math.round(x * 100), Math.round(z * 100));
    pos.setXYZ(i, x + (hx - 0.5) * 0.4 * r * k + ox, y > 0.01 ? y + (hy - 0.5) * 0.1 * k : y, z + (hz - 0.5) * 0.4 * r * k + oz);
  }
  const g = cone.toNonIndexed();
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let t = 0; t < p.count; t += 3) {
    const cy = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3;
    const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3;
    const cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3;
    const j = jitterHash(Math.round(cx * 100) + seed, Math.round(cz * 100), 3);
    if (cy > snowY + (j - 0.5) * 0.08) c.set('#f6f9ff').multiplyScalar(0.94 + j * 0.06);
    else c.set('#7f8799').multiplyScalar((0.72 + j * 0.3) * (0.78 + 0.5 * Math.min(1, cy / 0.45)));
    for (let k = 0; k < 3; k++) c.toArray(col, (t + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Горный массив: главный пик со снежной шапкой + плечо пониже. */
function makePeak(): THREE.BufferGeometry {
  return merge([rockCone(0.27, 0.86, 0, 0, 0, 0.5), rockCone(0.19, 0.5, 0.15, 0.1, 17, 0.5), rockCone(0.13, 0.3, -0.16, 0.1, 41, 0.5)]);
}

export type PropKind =
  | 'tree'
  | 'oak'
  | 'mound'
  | 'kiln'
  | 'bump'
  | 'sheep'
  | 'wheat'
  | 'furrow'
  | 'peak'
  | 'rock'
  | 'dune'
  | 'cactus';

let GEOS: Record<PropKind, THREE.BufferGeometry> | null = null;
function geos(): Record<PropKind, THREE.BufferGeometry> {
  if (GEOS) return GEOS;
  const ico = (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d);
  const cyl = (rt: number, rb: number, h: number, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
  const cone = (r: number, h: number, s = 6) => new THREE.ConeGeometry(r, h, s);

  const wheatParts: THREE.BufferGeometry[] = [];
  // Плотный ряд пшеницы: золотой массив стеблей + крупные колосья сверху (читается с любой высоты камеры)
  wheatParts.push(part(box(0.86, 0.12, 0.13), '#c99a2e', [0, 0.06, 0]));
  wheatParts.push(part(box(0.84, 0.05, 0.11), '#e2b43f', [0, 0.14, 0]));
  for (let i = 0; i < 15; i++) {
    const x = -0.41 + i * 0.0585;
    const z = (i % 3) * 0.03 - 0.03;
    const tall = 0.02 * ((i * 7) % 3);
    wheatParts.push(part(box(0.05, 0.09 + tall, 0.05), i % 2 ? '#ffd95e' : '#f2c447', [x, 0.2 + tall / 2, z], [0, 0, (i % 3 - 1) * 0.08]));
  }

  const sheepParts = [
    part(box(0.14, 0.09, 0.09), '#f6f6f0', [0, 0.085, 0]),
    part(box(0.06, 0.06, 0.06), '#3a3532', [0.095, 0.1, 0]),
    ...[
      [0.045, 0.03],
      [0.045, -0.03],
      [-0.045, 0.03],
      [-0.045, -0.03],
    ].map(([x, z]) => part(box(0.02, 0.04, 0.02), '#3a3532', [x, 0.02, z])),
  ];

  const g: Record<PropKind, THREE.BufferGeometry> = {
    tree: merge([
      part(cyl(0.025, 0.04, 0.12, 5), '#6b4a2b', [0, 0.06, 0]),
      part(cone(0.16, 0.24, 7), '#2a6f37', [0, 0.21, 0]),
      part(cone(0.125, 0.22, 7), '#34853f', [0, 0.35, 0], [0, 0.4, 0]),
      part(cone(0.09, 0.2, 7), '#44994a', [0, 0.48, 0], [0, 0.8, 0]),
      part(cone(0.05, 0.14, 6), '#5fb45a', [0, 0.61, 0]),
    ]),
    oak: merge([
      part(cyl(0.03, 0.045, 0.2, 5), '#6b4a2b', [0, 0.1, 0]),
      part(ico(0.16, 0), '#3f8f43', [0, 0.3, 0], [0.3, 0.2, 0], [1, 0.85, 1]),
      part(ico(0.11, 0), '#57a84f', [0.09, 0.4, 0.04], [0.1, 0.9, 0.4]),
      part(ico(0.1, 0), '#33803d', [-0.1, 0.25, -0.05], [0.7, 0.1, 0.2]),
    ]),
    mound: part(ico(0.2, 0), '#b8532e', [0, 0.0, 0], [0, 0.4, 0], [1, 0.6, 1]),
    kiln: merge([
      part(box(0.22, 0.13, 0.17), '#a2472a', [0, 0.065, 0]),
      part(box(0.24, 0.03, 0.19), '#5e2a1a', [0, 0.14, 0]),
      part(box(0.05, 0.12, 0.05), '#3a2d2a', [0.06, 0.2, 0.0]),
      part(box(0.07, 0.08, 0.02), '#2a1a14', [-0.05, 0.05, 0.09]),
      part(box(0.06, 0.035, 0.035), '#d9805a', [-0.12, 0.018, 0.12]),
      part(box(0.06, 0.035, 0.035), '#c4673e', [-0.12, 0.053, 0.12]),
    ]),
    bump: part(ico(0.13, 0), '#7ab648', [0, 0, 0], [0, 0.7, 0], [1, 0.5, 1]),
    sheep: merge(sheepParts),
    wheat: merge(wheatParts),
    furrow: part(box(0.86, 0.02, 0.1), '#8a6a30', [0, 0.008, 0]),
    peak: makePeak(),
    rock: part(ico(0.08, 0), '#7c8497', [0, 0.02, 0], [0.3, 0.5, 0], [1, 0.7, 1]),
    dune: part(ico(0.3, 1), '#e0c27c', [0, 0, 0], [0, 0, 0], [1, 0.26, 0.6]),
    cactus: merge([
      part(cyl(0.032, 0.036, 0.22, 6), '#4f8b4b', [0, 0.11, 0]),
      part(cyl(0.022, 0.022, 0.08, 5), '#4f8b4b', [0.06, 0.13, 0], [0, 0, 0]),
      part(box(0.06, 0.022, 0.022), '#4f8b4b', [0.035, 0.1, 0]),
      part(cyl(0.022, 0.022, 0.07, 5), '#4f8b4b', [-0.06, 0.16, 0]),
      part(box(0.06, 0.022, 0.022), '#4f8b4b', [-0.035, 0.13, 0]),
    ]),
  };
  GEOS = g;
  return g;
}

// ---------- расстановка пропсов ----------

export interface Inst {
  x: number;
  y: number;
  z: number;
  ry: number;
  s: number;
  sy?: number;
  ph: number;
  tint: number;
}

type Rng = () => number;

/** Углы гекса (вершины, где стоят постройки) — пропсы туда не ставим, чтобы не закрывать фишки. */
const CORNERS: [number, number][] = Array.from({ length: 6 }, (_, k) => {
  const a = Math.PI / 6 + (k * Math.PI) / 3;
  return [Math.cos(a), Math.sin(a)];
});
const nearCorner = (p: [number, number], d = 0.46) => CORNERS.some((c) => Math.hypot(c[0] - p[0], c[1] - p[1]) < d);

function scatter(rng: Rng, n: number, rMin: number, rMax: number, minDist: number, taken: [number, number][] = []): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    for (let tries = 0; tries < 40; tries++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rMin * rMin + rng() * (rMax * rMax - rMin * rMin));
      const p: [number, number] = [Math.cos(a) * r, Math.sin(a) * r];
      const clear = !nearCorner(p) && [...out, ...taken].every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= minDist);
      if (clear) {
        out.push(p);
        break;
      }
    }
  }
  return out;
}

export function genProps(tiles: TileInfo[]): Record<PropKind, Inst[]> {
  const out: Record<PropKind, Inst[]> = {
    tree: [],
    oak: [],
    mound: [],
    kiln: [],
    bump: [],
    sheep: [],
    wheat: [],
    furrow: [],
    peak: [],
    rock: [],
    dune: [],
    cactus: [],
  };
  for (const t of tiles) {
    const rng = rngFor(t.id);
    const h = HEIGHT[t.terrain];
    const add = (kind: PropKind, lx: number, lz: number, s = 1, sy?: number, ry = rng() * Math.PI * 2) =>
      out[kind].push({ x: t.x + lx, y: h, z: t.z + lz, ry, s, sy, ph: rng() * 6.28, tint: 0.85 + rng() * 0.3 });
    switch (t.terrain) {
      case 'forest':
        for (const [x, z] of scatter(rng, 10, 0.5, 0.78, 0.2)) {
          if (rng() < 0.3) add('oak', x, z, 0.8 + rng() * 0.4);
          else {
            const sc = 0.62 + rng() * 0.4;
            add('tree', x, z, sc, sc * (0.9 + rng() * 0.4));
          }
        }
        break;
      case 'hills': {
        const ka = Math.floor(rng() * 6) * (Math.PI / 3);
        const kp: [number, number] = [Math.cos(ka) * 0.56, Math.sin(ka) * 0.56];
        add('kiln', kp[0], kp[1], 1, undefined, ka + Math.PI / 2);
        for (const [x, z] of scatter(rng, 4, 0.42, 0.72, 0.36, [kp])) add('mound', x, z, 0.8 + rng() * 0.6, 0.7 + rng() * 0.6);
        break;
      }
      case 'pasture': {
        const bumps = scatter(rng, 7, 0.4, 0.76, 0.2);
        for (const [x, z] of bumps) add('bump', x, z, 0.7 + rng() * 0.8);
        for (const [x, z] of scatter(rng, 4, 0.44, 0.72, 0.28)) add('sheep', x, z, 0.9 + rng() * 0.3);
        break;
      }
      case 'fields': {
        const rot = Math.floor(rng() * 3) * (Math.PI / 3);
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        for (const z of [-0.44, -0.28, 0.28, 0.44]) add('wheat', z * s, z * c, 1, undefined, rot);
        for (const z of [-0.36, 0.36]) add('furrow', z * s, z * c, 1, undefined, rot);
        break;
      }
      case 'mountains': {
        // Пики — к серединам сторон, не к углам (там постройки)
        const a0 = Math.floor(rng() * 2) * (Math.PI / 3);
        for (let i = 0; i < 3; i++) {
          const a = a0 + (i * Math.PI * 2) / 3;
          const r = 0.5 + rng() * 0.05;
          add('peak', Math.cos(a) * r, Math.sin(a) * r, 0.85 + rng() * 0.3, 0.8 + rng() * 0.35);
        }
        for (const [x, z] of scatter(rng, 3, 0.5, 0.74, 0.25)) add('rock', x, z, 0.8 + rng() * 0.8);
        break;
      }
      case 'desert':
        for (const [x, z] of scatter(rng, 3, 0.35, 0.62, 0.5)) add('dune', x, z, 0.7 + rng() * 0.5, 0.8 + rng() * 0.6);
        for (const [x, z] of scatter(rng, 2, 0.5, 0.72, 0.4)) add('cactus', x, z, 0.8 + rng() * 0.5);
        break;
    }
  }
  return out;
}

const ANIM: Partial<Record<PropKind, 'sway' | 'bob' | 'wave'>> = { tree: 'sway', oak: 'sway', sheep: 'bob', wheat: 'wave' };

let propMat: THREE.MeshStandardMaterial | null = null;
const getPropMat = () =>
  (propMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 }));

function PropField({ kind, insts }: { kind: PropKind; insts: Inst[] }) {
  const { reduced, lowPower } = useEnv();
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const anim = ANIM[kind];
  const frame = useRef(0);

  const apply = (t: number) => {
    const m = ref.current;
    if (!m) return;
    dummy.rotation.order = 'YXZ';
    for (let i = 0; i < insts.length; i++) {
      const o = insts[i];
      let y = o.y;
      let rx = 0;
      let ry = o.ry;
      let rz = 0;
      if (anim === 'sway') {
        rz = Math.sin(t * 1.3 + o.ph) * 0.05;
        rx = Math.cos(t * 1.1 + o.ph * 1.7) * 0.04;
      } else if (anim === 'bob') {
        y += Math.max(0, Math.sin(t * 2.2 + o.ph)) * 0.025;
        ry += Math.sin(t * 0.5 + o.ph) * 0.35;
      } else if (anim === 'wave') {
        rx = Math.sin(t * 1.7 + o.ph) * 0.1;
        rz = Math.sin(t * 1.1 + o.ph) * 0.03;
      }
      dummy.position.set(o.x, y, o.z);
      dummy.rotation.set(rx, ry, rz);
      dummy.scale.set(o.s, o.sy ?? o.s, o.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    apply(0);
    const c = new THREE.Color();
    insts.forEach((o, i) => m.setColorAt(i, c.setScalar(o.tint)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insts]);

  useFrame(({ clock }) => {
    if (!anim || reduced) return;
    frame.current++;
    if (lowPower && frame.current % 2) return;
    apply(clock.elapsedTime);
  });

  if (insts.length === 0) return null;
  return (
    <instancedMesh
      key={insts.length}
      ref={ref}
      args={[geos()[kind], getPropMat(), insts.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
}

// ---------- плитки ----------

const TERRAINS: Terrain[] = ['forest', 'hills', 'pasture', 'fields', 'mountains', 'desert'];

function TileGroup({ terrain, tiles }: { terrain: Terrain; tiles: TileInfo[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    tiles.forEach((t, i) => {
      o.position.set(t.x, 0, t.z);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      const r = rngFor(`${t.id}:tint`)();
      m.setColorAt(i, c.setScalar(0.93 + r * 0.14));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [tiles, terrain]);
  if (tiles.length === 0) return null;
  return (
    <instancedMesh key={tiles.length} ref={ref} args={[tileGeo(terrain), mat, tiles.length]} castShadow receiveShadow frustumCulled={false} />
  );
}

let skirtMat: THREE.MeshStandardMaterial | null = null;
function Skirt({ tiles }: { tiles: TileInfo[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    tiles.forEach((t, i) => {
      o.position.set(t.x, 0, t.z);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [tiles]);
  if (tiles.length === 0) return null;
  skirtMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
  return <instancedMesh key={tiles.length} ref={ref} args={[skirtGeo(), skirtMat, tiles.length]} receiveShadow frustumCulled={false} />;
}

export default function Tiles({ tiles }: { tiles: TileInfo[] }) {
  const props = useMemo(() => genProps(tiles), [tiles]);
  const byTerrain = useMemo(() => {
    const m = {} as Record<Terrain, TileInfo[]>;
    for (const t of TERRAINS) m[t] = tiles.filter((x) => x.terrain === t);
    return m;
  }, [tiles]);
  return (
    <group>
      <Skirt tiles={tiles} />
      {TERRAINS.map((t) => (
        <TileGroup key={t} terrain={t} tiles={byTerrain[t]} />
      ))}
      {(Object.keys(props) as PropKind[]).map((k) => (
        <PropField key={k} kind={k} insts={props[k]} />
      ))}
    </group>
  );
}
