// Фишки игроков (дороги, поселения, города), призраки планов, разбойник, облачко при постройке.

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { dimmable } from './dim';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { PlayerColor } from '../engine';
import { PLAYER_HEX, PLAYER_STROKE } from '../ui/theme';
import { box, merge, part } from './Terrain';
import { hashStr, type World } from './world';
import { useEnv } from './rig';
import { Camp } from './Camp';
import { puff } from './units';

// ---------- геометрия ----------

// Дорога — низкая мощёная полоса, не «брусок»
const roadGeo = new RoundedBoxGeometry(0.6, 0.06, 0.13, 2, 0.025);

function prism(w: number, h: number, d: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}

// Фундамент — отдельной тёмной сваей под домом (без контура), чтобы не было «кольца» на земле
const foundGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.3, 8);
foundGeo.translate(0, -0.15, 0);
const foundMat = dimmable(new THREE.MeshStandardMaterial({ color: '#4a4540', roughness: 0.9 }));

// Дом (поселение): одноэтажная хата — белые стены, тёмная крыша, труба.
const houseGeo = merge([
  part(box(0.28, 0.13, 0.22), '#ffffff', [0, 0.065, 0]),
  part(prism(0.34, 0.13, 0.27), '#8f8f8f', [0, 0.13, 0]),
  part(box(0.045, 0.08, 0.045), '#6f6f6f', [0.07, 0.22, 0.04]),
  part(box(0.06, 0.08, 0.015), '#5a5a5a', [0, 0.04, 0.112]), // дверь
]);

// Город: особняк с башней — двухэтажный корпус, зубчатая башня со шпилем, светящиеся окна.
const cityGeo = merge([
  part(box(0.36, 0.2, 0.26), '#ffffff', [-0.05, 0.1, 0]), // два этажа
  part(box(0.37, 0.018, 0.27), '#bdbdbd', [-0.05, 0.1, 0]), // карниз между этажами
  part(prism(0.4, 0.12, 0.3), '#7a7a7a', [-0.05, 0.2, 0]),
  part(box(0.17, 0.36, 0.17), '#f4f4f4', [0.15, 0.18, 0]), // башня
  ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([dx, dz]) => part(box(0.05, 0.05, 0.05), '#e2e2e2', [0.15 + dx * 0.06, 0.385, dz * 0.06])),
  part(new THREE.ConeGeometry(0.06, 0.14, 4), '#6a6a6a', [0.15, 0.43, 0], [0, Math.PI / 4, 0]),
  part(box(0.07, 0.1, 0.015), '#5a5a5a', [-0.05, 0.05, 0.135]), // ворота
  part(box(0.045, 0.1, 0.045), '#5f5f5f', [-0.15, 0.27, -0.06]), // труба
]);
// Золотые детали города (не красятся в цвет игрока): навершие шпиля и пояс-карниз
const cityGoldGeo = merge([
  part(new THREE.SphereGeometry(0.03, 10, 8), '#ffffff', [0.15, 0.515, 0]),
  part(box(0.374, 0.02, 0.274), '#ffffff', [-0.05, 0.1, 0]),
  part(box(0.174, 0.02, 0.174), '#ffffff', [0.15, 0.36, 0]),
]);
const goldMat = new THREE.MeshStandardMaterial({ color: '#ffc93c', metalness: 0.5, roughness: 0.35, emissive: '#7a5200', emissiveIntensity: 0.45 });
/** Дымок из трубы города — город «живой», дом — нет. */
const citySmokeMats = Array.from({ length: 3 }, () => new THREE.SpriteMaterial({ map: puff(), color: '#e4e1dc', transparent: true, depthWrite: false, opacity: 0 }));
function CitySmoke() {
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const { reduced, lowPower } = useEnv();
  const ph = useMemo(() => Math.random() * 3, []);
  const mats = useMemo(() => citySmokeMats.map((m) => m.clone()), []);
  useFrame(({ clock }) => {
    refs.current.forEach((sp, i) => {
      if (!sp) return;
      const k = (((clock.elapsedTime + ph) / 3 + i / 3) % 1 + 1) % 1;
      sp.position.set(-0.195 + k * 0.06, 0.43 + k * 0.42, -0.078);
      sp.scale.setScalar(0.06 + k * 0.16);
      (sp.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.55;
    });
  });
  if (reduced || lowPower) return null;
  return (
    <>
      {mats.map((m, i) => (
        <sprite key={i} ref={(el) => (refs.current[i] = el)} material={m} />
      ))}
    </>
  );
}
// Окна города — отдельной тёплой подсветкой (не красятся в цвет игрока)
const cityWindowsGeo = merge(
  [
    ...[-0.17, 0.07].flatMap((x) => [
      [x, 0.06, 0.131],
      [x, 0.15, 0.131],
      [x, 0.15, -0.131],
    ]),
    [-0.05, 0.15, 0.131],
    [0.15, 0.2, 0.086],
    [0.15, 0.29, 0.086],
    [0.15, 0.29, -0.086],
  ].map(([x, y, z]) => part(box(0.04, 0.05, 0.008), '#ffffff', [x, y, z])),
);
const windowMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false });

houseGeo.scale(1.4, 1.4, 1.4);
cityGeo.scale(1.3, 1.3, 1.3);
cityWindowsGeo.scale(1.3, 1.3, 1.3);
cityGoldGeo.scale(1.3, 1.3, 1.3);

// Толстый мультяшный контур: та же геометрия, чуть больше, тёмная, вывернута внутрь (BackSide)
const hullCache = new Map<string, THREE.MeshBasicMaterial>();
function hullMat(color: PlayerColor): THREE.MeshBasicMaterial {
  let m = hullCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: color === 'white' ? '#1d1d1d' : PLAYER_STROKE[color], side: THREE.BackSide });
    hullCache.set(color, m);
  }
  return m;
}
// Мягкая тень под постройкой (вместо цветной площадки)
const shadowGeo = new THREE.CircleGeometry(0.26, 24).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false });
// «Это твоё»: светлый контур вместо тёмного и мягкий ореол цвета игрока на земле
// Метка «твоё» — золото: читается на любом цвете игрока, включая белый
const GOLD = '#ffc93c';
const mineHullMat = new THREE.MeshBasicMaterial({ color: GOLD, side: THREE.BackSide, toneMapped: false });
const gemGeo = new THREE.OctahedronGeometry(0.095, 0).scale(1, 1.45, 1);
const gemMat = new THREE.MeshStandardMaterial({ color: '#ffd24a', metalness: 0.3, roughness: 0.35, emissive: '#b07800', emissiveIntensity: 0.6, flatShading: true });
let haloTex: THREE.CanvasTexture | null = null;
function haloTexture(): THREE.CanvasTexture {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  gr.addColorStop(0.66, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.74, 'rgba(255,255,255,1)');
  gr.addColorStop(0.86, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
}
const haloGeo = new THREE.PlaneGeometry(0.78, 0.78).rotateX(-Math.PI / 2);
const haloCache = new Map<string, THREE.MeshBasicMaterial>();
function haloMat(color: PlayerColor): THREE.MeshBasicMaterial {
  let m = haloCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: haloTexture(), color: GOLD, transparent: true, depthWrite: false, toneMapped: false });
    haloCache.set(color, m);
  }
  return m;
}
// Подсветка постройки игрока, которого сейчас смотрят: белый контур + ореол его цвета
const spotHullMat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.BackSide, toneMapped: false });
const spotHaloCache = new Map<string, THREE.MeshBasicMaterial>();
function spotHaloMat(color: PlayerColor): THREE.MeshBasicMaterial {
  let m = spotHaloCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: haloTexture(), color: color === 'white' ? '#ffffff' : PLAYER_HEX[color], transparent: true, depthWrite: false, toneMapped: false });
    spotHaloCache.set(color, m);
  }
  return m;
}
function SpotHalo({ color }: { color: PlayerColor }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const k = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 4);
    m.scale.setScalar(1.05 + k * 0.2);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.7 + k * 0.3;
  });
  return <mesh ref={ref} geometry={haloGeo} material={spotHaloMat(color)} position={[0, 0.014, 0]} renderOrder={3} />;
}

/** «Это твоё»: золотой ореол на земле («дышит») и золотой ромб над крышей (крутится, покачивается). */
function MineHalo({ color, top }: { color: PlayerColor; top: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const gem = useRef<THREE.Mesh>(null);
  const { reduced } = useEnv();
  const ph = useMemo(() => Math.random() * 6, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const k = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2 + ph);
    if (ref.current) {
      ref.current.scale.setScalar(0.95 + k * 0.12);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.6 + k * 0.4;
    }
    if (gem.current) {
      gem.current.position.y = top + (reduced ? 0 : Math.sin(t * 2.2 + ph) * 0.035);
      gem.current.rotation.y = reduced ? 0 : t * 1.6 + ph;
    }
  });
  return (
    <>
      <mesh ref={ref} geometry={haloGeo} material={haloMat(color)} position={[0, 0.012, 0]} renderOrder={3} />
      <mesh ref={gem} geometry={gemGeo} material={gemMat} position={[0, top, 0]} castShadow />
    </>
  );
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function pieceMat(color: PlayerColor): THREE.MeshStandardMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = dimmable(new THREE.MeshStandardMaterial({ color: PLAYER_HEX[color], vertexColors: true, flatShading: true, roughness: 0.5, metalness: 0.05, emissive: PLAYER_HEX[color], emissiveIntensity: color === 'white' ? 0.18 : 0.08 }));
    matCache.set(color, m);
  }
  return m;
}
const roadMatCache = new Map<string, THREE.MeshStandardMaterial>();
function roadMat(color: PlayerColor): THREE.MeshStandardMaterial {
  let m = roadMatCache.get(color);
  if (!m) {
    m = dimmable(new THREE.MeshStandardMaterial({ color: PLAYER_HEX[color], roughness: 0.45, metalness: 0.05 }));
    roadMatCache.set(color, m);
  }
  return m;
}

let dotTex: THREE.CanvasTexture | null = null;
function dot(): THREE.CanvasTexture {
  if (!dotTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    dotTex = new THREE.CanvasTexture(c);
  }
  return dotTex;
}

// ---------- анимации ----------

const spring = (t: number) => (t <= 0 ? 0 : t >= 1.4 ? 1 : 1 - Math.exp(-7 * t) * Math.cos(14 * t));

function usePop(recent: boolean) {
  const g = useRef<THREE.Group>(null);
  const born = useRef<number | null>(recent ? null : -99);
  useFrame(({ clock }) => {
    const o = g.current;
    if (!o || born.current === -99 || born.current === 1e9) return;
    if (born.current === null) born.current = clock.elapsedTime;
    const t = clock.elapsedTime - born.current;
    const k = spring(t);
    o.scale.set(k, Math.max(0, k * (1 + 0.15 * Math.sin(Math.min(t, 0.5) * 12))), k);
    if (t > 1.4) {
      o.scale.setScalar(1);
      born.current = 1e9;
    }
  });
  return g;
}

function Puff({ color }: { color: string }) {
  const { reduced } = useEnv();
  const N = 18;
  const data = useMemo(() => {
    const pos = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + Math.random();
      const sp = 0.35 + Math.random() * 0.45;
      vel[i * 3] = Math.cos(a) * sp;
      vel[i * 3 + 1] = 0.4 + Math.random() * 0.6;
      vel[i * 3 + 2] = Math.sin(a) * sp;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { pos, vel, geo };
  }, []);
  const ref = useRef<THREE.Points>(null);
  const mat = useRef<THREE.PointsMaterial>(null);
  const t0 = useRef<number | null>(null);
  useEffect(() => () => data.geo.dispose(), [data]);
  useFrame(({ clock }) => {
    if (!ref.current || !mat.current) return;
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = clock.elapsedTime - t0.current;
    const life = 0.9;
    if (t > life || reduced) {
      ref.current.visible = false;
      return;
    }
    for (let i = 0; i < N; i++) {
      data.pos[i * 3] = data.vel[i * 3] * t;
      data.pos[i * 3 + 1] = data.vel[i * 3 + 1] * t - 1.2 * t * t;
      data.pos[i * 3 + 2] = data.vel[i * 3 + 2] * t;
    }
    data.geo.attributes.position.needsUpdate = true;
    mat.current.opacity = 1 - t / life;
    mat.current.size = 0.1 + 0.12 * t;
  });
  return (
    <points ref={ref} geometry={data.geo} frustumCulled={false} renderOrder={7}>
      <pointsMaterial ref={mat} map={dot()} color={color} size={0.1} transparent depthWrite={false} sizeAttenuation />
    </points>
  );
}

// ---------- дороги ----------

export interface PieceCtx {
  world: World;
  hexH: Map<string, number>;
  recent: Set<string>;
}

export function vertexY(ctx: PieceCtx, v: string): number {
  const vx = ctx.world.topo.vertices.get(v);
  let y = 0.15;
  if (vx) for (const h of vx.hexes) y = Math.max(y, ctx.hexH.get(h) ?? 0);
  return y;
}
export function edgeY(ctx: PieceCtx, e: string): number {
  const ed = ctx.world.topo.edges.get(e);
  let y = 0.15;
  if (ed) for (const h of ed.hexes) y = Math.max(y, ctx.hexH.get(h) ?? 0);
  return y;
}

export function edgeXform(ctx: PieceCtx, e: string) {
  const ed = ctx.world.topo.edges.get(e);
  if (!ed) return null;
  const a = ctx.world.vert.get(ed.vertices[0]);
  const b = ctx.world.vert.get(ed.vertices[1]);
  if (!a || !b) return null;
  return { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, ang: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), y: edgeY(ctx, e) };
}

// Магистраль («Самая длинная дорога»): золотая кромка и светлая разметка по центру, разметка «бежит»
const laneGeo = merge([-0.2, 0, 0.2].map((x) => part(box(0.1, 0.012, 0.034), '#ffffff', [x, 0.036, 0])));
const laneMat = new THREE.MeshBasicMaterial({ color: '#fff1b8', toneMapped: false, transparent: true });
const longHullMat = new THREE.MeshBasicMaterial({ color: '#ffc93c', side: THREE.BackSide, toneMapped: false });
function LaneFx() {
  const { reduced } = useEnv();
  useFrame(({ clock }) => {
    laneMat.opacity = reduced ? 1 : 0.65 + 0.35 * Math.abs(Math.sin(clock.elapsedTime * 2.4));
  });
  return null;
}

function Road({ id, color, ctx, mine, longest, lit }: { id: string; color: PlayerColor; ctx: PieceCtx; mine?: boolean; longest?: boolean; lit?: boolean }) {
  const recent = ctx.recent.has(id);
  const g = usePop(recent);
  const xf = edgeXform(ctx, id);
  if (!xf) return null;
  return (
    <group position={[xf.x, xf.y + 0.032, xf.z]} rotation={[0, xf.ang, 0]}>
      <group ref={g} scale={recent ? 0 : 1}>
        <mesh geometry={roadGeo} material={lit ? spotHullMat : longest ? longHullMat : mine ? mineHullMat : hullMat(color)} scale={longest || lit ? [1.06, 1.7, 1.7] : [1.04, 1.5, 1.35]} position={[0, 0.002, 0]} />
        {longest && <mesh geometry={laneGeo} material={laneMat} renderOrder={4} />}
        <mesh geometry={roadGeo} material={roadMat(color)} castShadow receiveShadow />
      </group>
      {recent && <Puff color={PLAYER_HEX[color]} />}
    </group>
  );
}

export function Roads({ roads, colors, ctx, me, longest, spot }: { roads: Record<string, string>; colors: Record<string, PlayerColor>; ctx: PieceCtx; me?: string; longest?: string[]; spot?: string }) {
  const lset = new Set(longest ?? []);
  return (
    <>
      {lset.size > 0 && <LaneFx />}
      {Object.entries(roads).map(([id, owner]) => {
        const c = colors[owner];
        return c ? <Road key={`${id}:${ctx.recent.has(id)}`} id={id} color={c} ctx={ctx} mine={owner === me} longest={lset.has(id)} lit={!!spot && owner === spot} /> : null;
      })}
    </>
  );
}

// ---------- свободные места: кружки под дома, штрихи под дороги ----------

const slotRingGeo = new THREE.RingGeometry(0.08, 0.115, 28).rotateX(-Math.PI / 2);
const slotDotGeo = new THREE.CircleGeometry(0.08, 28).rotateX(-Math.PI / 2);
const slotLineGeo = new THREE.PlaneGeometry(0.44, 0.05).rotateX(-Math.PI / 2);
const slotRingMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false });
const slotDotMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false });
// Место, где строить нельзя (сосед уже занят): тёмный диск с тёмным кольцом
const slotBanMat = new THREE.MeshBasicMaterial({ color: '#0d0d0f', transparent: true, opacity: 0.55, depthWrite: false });
const slotBanRingMat = new THREE.MeshBasicMaterial({ color: '#0d0d0f', transparent: true, opacity: 0.75, depthWrite: false });
const slotLineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false });

function Instances({ geo, mat, mats, order }: { geo: THREE.BufferGeometry; mat: THREE.Material; mats: THREE.Matrix4[]; order: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    mats.forEach((x, i) => m.setMatrixAt(i, x));
    m.instanceMatrix.needsUpdate = true;
  }, [mats]);
  if (mats.length === 0) return null;
  return <instancedMesh key={mats.length} ref={ref} args={[geo, mat, mats.length]} renderOrder={order} frustumCulled={false} />;
}

/** Сетка поля: где можно поставить дом (белый кружок), где нельзя — сосед занят (тёмный), и дорогу (штрих). */
export function Slots({ ctx, buildings, roads }: { ctx: PieceCtx; buildings: Record<string, unknown>; roads: Record<string, unknown> }) {
  const bKey = Object.keys(buildings).sort().join(',');
  const rKey = Object.keys(roads).sort().join(',');
  const { verts, edges, banned } = useMemo(() => {
    const o = new THREE.Object3D();
    const verts: THREE.Matrix4[] = [];
    const banned: THREE.Matrix4[] = [];
    for (const [v, info] of ctx.world.topo.vertices) {
      if (v in buildings) continue;
      const ban = info.neighbors.some((n) => n in buildings);
      const p = ctx.world.vert.get(v);
      if (!p) continue;
      o.position.set(p[0], vertexY(ctx, v) + 0.012, p[1]);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      (ban ? banned : verts).push(o.matrix.clone());
    }
    const edges: THREE.Matrix4[] = [];
    for (const e of ctx.world.topo.edges.keys()) {
      if (e in roads) continue;
      const xf = edgeXform(ctx, e);
      if (!xf) continue;
      o.position.set(xf.x, xf.y + 0.01, xf.z);
      o.rotation.set(0, xf.ang, 0);
      o.updateMatrix();
      edges.push(o.matrix.clone());
    }
    return { verts, edges, banned };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, bKey, rKey]);
  return (
    <>
      <Instances geo={slotLineGeo} mat={slotLineMat} mats={edges} order={2} />
      <Instances geo={slotDotGeo} mat={slotDotMat} mats={verts} order={2} />
      <Instances geo={slotRingGeo} mat={slotRingMat} mats={verts} order={3} />
      <Instances geo={slotDotGeo} mat={slotBanMat} mats={banned} order={2} />
      <Instances geo={slotRingGeo} mat={slotBanRingMat} mats={banned} order={3} />
    </>
  );
}

// ---------- здания ----------

function Building({ id, kind, color, ctx, mine, lit }: { id: string; kind: 'settlement' | 'city'; color: PlayerColor; ctx: PieceCtx; mine?: boolean; lit?: boolean }) {
  const recent = ctx.recent.has(id);
  const g = usePop(recent);
  const p = ctx.world.vert.get(id);
  const yaw = useMemo(() => ((hashStr(id) % 6) * Math.PI) / 3 / 2, [id]);
  if (!p) return null;
  const y = vertexY(ctx, id);
  return (
    <group position={[p[0], y + 0.02, p[1]]} rotation={[0, yaw, 0]}>
      <group ref={g} scale={recent ? 0 : 1}>
        <mesh geometry={foundGeo} material={foundMat} />
        <mesh geometry={shadowGeo} material={shadowMat} position={[0, 0.006, 0]} renderOrder={2} />
        {mine && !lit && <MineHalo color={color} top={kind === 'city' ? 0.86 : 0.64} />}
        {lit && <SpotHalo color={color} />}
        <mesh geometry={kind === 'city' ? cityGeo : houseGeo} material={lit ? spotHullMat : mine ? mineHullMat : hullMat(color)} scale={lit ? [1.14, 1.09, 1.14] : mine ? [1.1, 1.07, 1.1] : [1.08, 1.06, 1.08]} position={[0, 0.004, 0]} />
        <mesh geometry={kind === 'city' ? cityGeo : houseGeo} material={pieceMat(color)} castShadow receiveShadow />
        {kind === 'city' && (
          <>
            <mesh geometry={cityWindowsGeo} material={windowMat} />
            <mesh geometry={cityGoldGeo} material={goldMat} />
            <CitySmoke />
          </>
        )}
      </group>
      {recent && <Puff color="#f4efe4" />}
    </group>
  );
}

export function Buildings({
  buildings,
  colors,
  ctx,
  me,
  spot,
}: {
  buildings: Record<string, { owner: string; kind: 'settlement' | 'city' }>;
  colors: Record<string, PlayerColor>;
  ctx: PieceCtx;
  me?: string;
  spot?: string;
}) {
  return (
    <>
      {Object.entries(buildings).map(([id, b]) => {
        const c = colors[b.owner];
        return c ? <Building key={`${id}:${b.kind}:${ctx.recent.has(id)}`} id={id} kind={b.kind} color={c} ctx={ctx} mine={b.owner === me} lit={!!spot && b.owner === spot} /> : null;
      })}
    </>
  );
}

// ---------- призраки ----------

export interface GhostSpec {
  vertex?: string;
  edge?: string;
  kind: 'road' | 'settlement' | 'city';
  color: PlayerColor;
  broken?: boolean;
}

const outlineCache = new Map<string, THREE.BufferGeometry>();
const strokeCache = new Map<string, THREE.LineBasicMaterial>();
/** Тёмный контур фишки цветом игрока — чтобы чужие постройки читались на любом гексе. */
function strokeMat(color: PlayerColor): THREE.LineBasicMaterial {
  let m = strokeCache.get(color);
  if (!m) {
    m = new THREE.LineBasicMaterial({ color: PLAYER_STROKE[color] });
    strokeCache.set(color, m);
  }
  return m;
}

function outlineGeo(kind: 'road' | 'settlement' | 'city'): THREE.BufferGeometry {
  let g = outlineCache.get(kind);
  if (!g) {
    g = new THREE.EdgesGeometry(kind === 'road' ? roadGeo : kind === 'city' ? cityGeo : houseGeo, 25);
    outlineCache.set(kind, g);
  }
  return g;
}

function Ghost({ spec, ctx }: { spec: GhostSpec; ctx: PieceCtx }) {
  const { reduced } = useEnv();
  const fill = useRef<THREE.MeshBasicMaterial>(null);
  const line = useRef<THREE.LineDashedMaterial>(null);
  const lineObj = useRef<THREE.LineSegments>(null);
  const col = spec.broken ? '#ff5a4a' : PLAYER_HEX[spec.color];
  useEffect(() => {
    lineObj.current?.computeLineDistances();
  }, [spec.kind]);
  useFrame(({ clock }) => {
    const t = reduced ? 0 : clock.elapsedTime;
    const p = 0.5 + 0.5 * Math.sin(t * 3.4);
    const flick = spec.broken ? (Math.sin(t * 17) > 0.35 ? 1 : 0.35) : 1;
    if (fill.current) fill.current.opacity = (0.25 + 0.25 * p) * flick;
    if (line.current) {
      line.current.opacity = (0.7 + 0.3 * p) * flick;
      line.current.dashSize = 0.05;
      line.current.gapSize = 0.04;
    }
  });
  let pos: [number, number, number];
  let rot = 0;
  if (spec.kind === 'road') {
    if (!spec.edge) return null;
    const xf = edgeXform(ctx, spec.edge);
    if (!xf) return null;
    pos = [xf.x, xf.y + 0.045, xf.z];
    rot = xf.ang;
  } else {
    if (!spec.vertex) return null;
    const p = ctx.world.vert.get(spec.vertex);
    if (!p) return null;
    pos = [p[0], vertexY(ctx, spec.vertex) + 0.02, p[1]];
    rot = ((hashStr(spec.vertex) % 6) * Math.PI) / 6;
  }
  const geo = spec.kind === 'road' ? roadGeo : spec.kind === 'city' ? cityGeo : houseGeo;
  const nonIdx = geo;
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh geometry={nonIdx} renderOrder={4}>
        <meshBasicMaterial ref={fill} color={col} transparent opacity={0.4} depthWrite={false} vertexColors={false} />
      </mesh>
      <lineSegments ref={lineObj} geometry={outlineGeo(spec.kind)} renderOrder={4}>
        <lineDashedMaterial ref={line} color={col} transparent opacity={0.9} depthWrite={false} dashSize={0.05} gapSize={0.04} />
      </lineSegments>
    </group>
  );
}

export function Ghosts({ ghosts, ctx }: { ghosts: GhostSpec[]; ctx: PieceCtx }) {
  return (
    <>
      {ghosts.map((g, i) => (
        <Ghost key={`${i}:${g.kind}:${g.vertex ?? g.edge}`} spec={g} ctx={ctx} />
      ))}
    </>
  );
}

// ---------- разбойник ----------

const robberGeo = merge([
  part(new THREE.CylinderGeometry(0.075, 0.16, 0.34, 8), '#2b2735', [0, 0.17, 0]),
  part(new THREE.CylinderGeometry(0.165, 0.18, 0.04, 8), '#15131b', [0, 0.02, 0]),
  part(new THREE.IcosahedronGeometry(0.095, 1), '#1d1a25', [0, 0.4, 0]),
  part(new THREE.ConeGeometry(0.125, 0.22, 8), '#3b2f55', [0, 0.5, -0.015], [-0.12, 0, 0]),
  part(new THREE.BoxGeometry(0.2, 0.05, 0.09), '#4a3d6b', [0, 0.25, 0.1], [0.4, 0, 0]),
]);
const eyeGeo = new THREE.SphereGeometry(0.02, 8, 6);
const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffcf4a', toneMapped: false });
const robberMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 });

export function Robber({ target, hexH, sprite, era }: { target: [number, number] | null; hexH: number; sprite?: string; era?: string }) {
  const { rig, reduced } = useEnv();
  const g = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const cur = useRef<{ from: [number, number]; to: [number, number]; t0: number | null; at: [number, number] } | null>(null);
  // Спрайт эпохи (лучники / ниндзя / бомбардировщики) — если загрузился; иначе фигурка
  const [spriteMat, setSpriteMat] = useState<THREE.SpriteMaterial | null>(null);
  useEffect(() => {
    if (!sprite) return;
    let alive = true;
    const done = (tex: THREE.Texture) => {
      if (!alive) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      setSpriteMat(new THREE.SpriteMaterial({ map: tex, transparent: false, alphaTest: 0.5, depthWrite: true }));
    };
    const loader = new THREE.TextureLoader();
    // Лагерь эпохи; если его нет — отряд
    loader.load(sprite, done, undefined, () => loader.load(sprite.replace('/camp.webp', '/robber-unit.webp'), done));
    return () => {
      alive = false;
    };
  }, [sprite]);

  useEffect(() => {
    if (!target) return;
    const c = cur.current;
    if (!c) cur.current = { from: target, to: target, t0: -99, at: target };
    else if (c.to[0] !== target[0] || c.to[1] !== target[1]) cur.current = { from: c.at, to: target, t0: null, at: c.at };
  }, [target]);

  useFrame(({ clock }) => {
    const c = cur.current;
    const o = g.current;
    if (!c || !o || !body.current) return;
    const T = reduced ? 0.01 : 0.9;
    if (c.t0 === null) c.t0 = clock.elapsedTime;
    const u = c.t0 === -99 ? 1 : Math.min(1, (clock.elapsedTime - c.t0) / T);
    const e = u * u * (3 - 2 * u);
    const x = c.from[0] + (c.to[0] - c.from[0]) * e;
    const z = c.from[1] + (c.to[1] - c.from[1]) * e;
    c.at = [x, z];
    const hop = era ? 0 : u < 1 ? Math.sin(u * Math.PI) * 0.7 : 0;
    const t = reduced ? 0 : clock.elapsedTime;
    const idle = spriteMat || era ? 0 : Math.sin(t * 2) * 0.012;
    const land = u >= 1 && c.t0 !== -99 ? Math.max(0, 1 - (clock.elapsedTime - c.t0 - T) * 4) : 0;
    if (era) {
      // Лагерь не прыгает: стоит на старом месте, пока идёт налёт, потом вырастает на новом гексе
      const D = reduced || c.t0 === -99 ? 0 : era === 'ww2' ? 6.4 : era === 'japan' ? 4.6 : 5.6;
      const el = c.t0 === -99 ? 99 : clock.elapsedTime - c.t0;
      if (el < D) {
        o.position.set(c.from[0], hexH, c.from[1]);
        body.current.scale.setScalar(Math.max(0.001, 1 - Math.max(0, el - (D - 0.3)) / 0.3));
      } else {
        const g = Math.min(1, (el - D) / 0.55);
        const k = g < 1 ? 1 - Math.pow(1 - g, 3) + Math.sin(g * Math.PI) * 0.12 : 1;
        o.position.set(c.to[0], hexH, c.to[1]);
        body.current.scale.set(k, k, k);
        c.at = c.to;
      }
      return;
    }
    o.position.set(x, hexH + hop + idle, z);
    body.current.scale.set(1 + land * 0.18 * Math.sin(land * 9), 1 - land * 0.18 * Math.sin(land * 9), 1 + land * 0.18 * Math.sin(land * 9));
    body.current.rotation.y = spriteMat || era ? 0 : rig.az + Math.sin(t * 0.7) * 0.15;
  });

  if (!target) return null;
  return (
    <group ref={g} position={[target[0], hexH, target[1]]}>
      <group ref={body}>
        {era ? (
          <Camp era={era} />
        ) : spriteMat ? (
          <sprite material={spriteMat} position={[0, 0.5, 0]} scale={[1.15, 1.15, 1.15]} />
        ) : (
          <>
            <mesh geometry={robberGeo} material={robberMat} castShadow />
            <mesh geometry={eyeGeo} material={eyeMat} position={[-0.035, 0.405, 0.085]} />
            <mesh geometry={eyeGeo} material={eyeMat} position={[0.035, 0.405, 0.085]} />
          </>
        )}
      </group>
    </group>
  );
}

// ---------- захваченный гекс: тлеющий контур, тень, дым (и огонь во ВОВ) ----------

let smokeTex: THREE.Texture | undefined;
function smokeTexture(): THREE.Texture {
  if (smokeTex) return smokeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  smokeTex = new THREE.CanvasTexture(c);
  return smokeTex;
}

const zoneRing = new THREE.CircleGeometry(0.86, 6, Math.PI / 2);
const zoneDisc = new THREE.CircleGeometry(0.9, 6, Math.PI / 2);

/** Плашка над лагерем: какой ресурс и какое число сейчас заблокированы. */
/**
 * Значок над куполом: [эмблема захватчика] [ресурс] [зачёркнутое число].
 * Эмблема (отряд эпохи в красном круге) отвечает на вопрос «чей купол».
 */
function useBlockedBadge(era?: string, res?: string, num?: number): THREE.SpriteMaterial | null {
  const [mat, setMat] = useState<THREE.SpriteMaterial | null>(null);
  useEffect(() => {
    if (!era || !res || num === undefined) {
      setMat(null);
      return;
    }
    const W = 352;
    const H = 104;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    let unit: HTMLImageElement | undefined;
    let resImg: HTMLImageElement | undefined;
    const draw = () => {
      g.clearRect(0, 0, W, H);
      g.fillStyle = 'rgba(18,12,12,0.92)';
      g.beginPath();
      g.roundRect(4, 4, W - 8, H - 8, (H - 8) / 2);
      g.fill();
      // эмблема захватчика: красный круг (концентрично: 48 − 6)
      g.fillStyle = '#c8321f';
      g.beginPath();
      g.arc(52, 52, 42, 0, Math.PI * 2);
      g.fill();
      if (unit) g.drawImage(unit, 18, 18, 68, 68);
      if (resImg) g.drawImage(resImg, 110, 18, 68, 68);
      g.fillStyle = num === 6 || num === 8 ? '#ff7a6e' : '#f6f3ec';
      g.font = 'bold 56px Unbounded, Manrope, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(num), 260, 56);
      g.strokeStyle = '#ff3b2f';
      g.lineWidth = 9;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(206, 80);
      g.lineTo(316, 26);
      g.stroke();
    };
    draw();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    setMat(m);
    const load = (src: string, set: (i: HTMLImageElement) => void) => {
      const img = new Image();
      img.onload = () => {
        set(img);
        draw();
        tex.needsUpdate = true;
      };
      img.src = src;
    };
    load(`${import.meta.env.BASE_URL}eras/${era}/robber-unit.webp`, (i) => (unit = i));
    load(`${import.meta.env.BASE_URL}eras/${era}/res-${res}.webp`, (i) => (resImg = i));
  }, [era, res, num]);
  return mat;
}

export function RaidZone({ target, hexH, era, res, num }: { target: [number, number] | null; hexH: number; era?: string; res?: string; num?: number }) {
  const badge = useBlockedBadge(era, res, num);
  const { reduced } = useEnv();
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const puffs = useRef<(THREE.Sprite | null)[]>([]);
  const color = era === 'genghis' ? '#c9a676' : era === 'ww2' ? '#3a3a3a' : '#2e2c38';
  const mats = useMemo(
    () => Array.from({ length: 12 }, () => new THREE.SpriteMaterial({ map: smokeTexture(), color, transparent: true, depthWrite: false, opacity: 0 })),
    [color],
  );
  useFrame(({ clock }) => {
    const t = reduced ? 1 : clock.elapsedTime;
    if (ring.current) ring.current.opacity = 0.22 + Math.sin(t * 3) * 0.1;
    if (light.current) light.current.intensity = 1.6 + Math.sin(t * 17) * 0.4 + Math.sin(t * 7.3) * 0.3;
    puffs.current.forEach((p, i) => {
      if (!p) return;
      const k = ((t * 0.26 + i / 12) % 1 + 1) % 1;
      p.position.set(Math.sin(i * 2.1) * 0.42 + k * 0.15, 0.3 + k * 2.0, Math.cos(i * 1.7) * 0.36);
      const s = 0.45 + k * 1.25;
      p.scale.set(s, s, s);
      (p.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.85;
    });
  });
  if (!target) return null;
  return (
    <group position={[target[0], hexH + 0.02, target[1]]}>
      <mesh geometry={zoneDisc} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} renderOrder={5}>
        <meshBasicMaterial color="#14060a" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh geometry={zoneRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={6}>
        <meshBasicMaterial ref={ring} color="#ff3b2f" transparent opacity={0.25} depthWrite={false} />
      </mesh>
      {mats.map((m, i) => (
        <sprite key={i} ref={(el) => (puffs.current[i] = el)} material={m} />
      ))}
      {era === 'ww2' && <pointLight ref={light} color="#ff7a1a" distance={2.6} intensity={1.6} position={[0, 0.4, 0]} />}
      {badge && <sprite material={badge} position={[0, 1.62, 0]} scale={[1.3, 0.385, 1]} renderOrder={20} />}
    </group>
  );
}
