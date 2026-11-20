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

const tileGeoCache = new Map<Terrain, THREE.ExtrudeGeometry>();
function tileGeo(t: Terrain): THREE.ExtrudeGeometry {
  let g = tileGeoCache.get(t);
  if (!g) {
    const h = HEIGHT[t];
    const bt = 0.035;
    const depth = h + 0.5;
    g = new THREE.ExtrudeGeometry(hexShape(0.945), {
      depth,
      bevelEnabled: true,
      bevelThickness: bt,
      bevelSize: 0.04,
      bevelSegments: 1,
      steps: 1,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, h - depth - bt, 0);
    tileGeoCache.set(t, g);
  }
  return g;
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

function makePeak(): THREE.BufferGeometry {
  const H = 0.7;
  const cone = new THREE.ConeGeometry(0.3, H, 5, 3, false);
  cone.translate(0, H / 2, 0);
  const pos = cone.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = (y / H) < 0.99 ? 1 : 0;
    const hx = jitterHash(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100));
    const hz = jitterHash(Math.round(z * 100) + 5, Math.round(y * 100), Math.round(x * 100));
    const hy = jitterHash(Math.round(y * 100) + 9, Math.round(x * 100), Math.round(z * 100));
    pos.setXYZ(i, x + (hx - 0.5) * 0.12 * k, y > 0.01 ? y + (hy - 0.5) * 0.1 * k : y, z + (hz - 0.5) * 0.12 * k);
  }
  const g = cone.toNonIndexed();
  g.deleteAttribute('uv');
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const rock = new THREE.Color();
  const snow = new THREE.Color('#f4f8ff');
  for (let t = 0; t < p.count; t += 3) {
    const cy = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3 / H;
    const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3;
    const cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3;
    const shade = 0.78 + jitterHash(Math.round(cx * 100), Math.round(cz * 100), 3) * 0.3;
    if (cy > 0.58) snow.toArray(col, t * 3), snow.toArray(col, t * 3 + 3), snow.toArray(col, t * 3 + 6);
    else {
      rock.set('#7a8396').multiplyScalar(shade);
      rock.toArray(col, t * 3);
      rock.toArray(col, t * 3 + 3);
      rock.toArray(col, t * 3 + 6);
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export type PropKind =
  | 'tree'
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
  for (let i = 0; i < 9; i++) {
    const x = -0.4 + i * 0.1;
    wheatParts.push(part(box(0.012, 0.15, 0.012), '#a9a043', [x, 0.075, 0]));
    wheatParts.push(part(box(0.03, 0.06, 0.03), '#f4d25c', [x, 0.17, 0]));
    wheatParts.push(part(box(0.012, 0.15, 0.012), '#b6a947', [x + 0.03, 0.075, 0.035], [0, 0, 0.05]));
    wheatParts.push(part(box(0.03, 0.06, 0.03), '#ffdc6a', [x + 0.036, 0.17, 0.035], [0, 0, 0.05]));
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
      part(cyl(0.025, 0.035, 0.1, 5), '#6b4a2b', [0, 0.05, 0]),
      part(cone(0.14, 0.24, 6), '#2f7a3a', [0, 0.2, 0]),
      part(cone(0.1, 0.2, 6), '#3d9347', [0, 0.34, 0]),
      part(cone(0.06, 0.14, 6), '#58ad55', [0, 0.46, 0]),
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

function scatter(rng: Rng, n: number, rMin: number, rMax: number, minDist: number, taken: [number, number][] = []): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    for (let tries = 0; tries < 40; tries++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rMin * rMin + rng() * (rMax * rMax - rMin * rMin));
      const p: [number, number] = [Math.cos(a) * r, Math.sin(a) * r];
      const clear = [...out, ...taken].every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= minDist);
      if (clear || tries === 39) {
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
        for (const [x, z] of scatter(rng, 9, 0.42, 0.74, 0.21)) add('tree', x, z, 0.75 + rng() * 0.55);
        break;
      case 'hills': {
        const ka = rng() * 6.28;
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
        const a0 = rng() * 6.28;
        for (let i = 0; i < 3; i++) {
          const a = a0 + (i * Math.PI * 2) / 3 + (rng() - 0.5) * 0.4;
          const r = 0.45 + rng() * 0.12;
          add('peak', Math.cos(a) * r, Math.sin(a) * r, 0.75 + rng() * 0.55);
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

const ANIM: Partial<Record<PropKind, 'sway' | 'bob' | 'wave'>> = { tree: 'sway', sheep: 'bob', wheat: 'wave' };

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
  const mats = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: TOP[terrain], flatShading: true, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: SIDE[terrain], flatShading: true, roughness: 1 }),
    ],
    [terrain],
  );
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
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
  }, [tiles]);
  if (tiles.length === 0) return null;
  return (
    <instancedMesh key={tiles.length} ref={ref} args={[tileGeo(terrain), mats as unknown as THREE.Material, tiles.length]} castShadow receiveShadow frustumCulled={false} />
  );
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
      {TERRAINS.map((t) => (
        <TileGroup key={t} terrain={t} tiles={byTerrain[t]} />
      ))}
      {(Object.keys(props) as PropKind[]).map((k) => (
        <PropField key={k} kind={k} insts={props[k]} />
      ))}
    </group>
  );
}
