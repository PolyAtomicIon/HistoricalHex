// Фишки игроков (дороги, поселения, города), призраки планов, разбойник, облачко при постройке.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { PlayerColor } from '../engine';
import { PLAYER_HEX } from '../ui/theme';
import { box, merge, part } from './Terrain';
import { hashStr, type World } from './world';
import { useEnv } from './rig';

// ---------- геометрия ----------

const roadGeo = new RoundedBoxGeometry(0.74, 0.08, 0.13, 2, 0.03);

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

const plinth = () => part(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 8), '#6e6a66', [0, -0.13, 0]);

const houseGeo = merge([
  plinth(),
  part(box(0.28, 0.13, 0.22), '#ffffff', [0, 0.065, 0]),
  part(prism(0.33, 0.13, 0.26), '#8a8a8a', [0, 0.13, 0]),
  part(box(0.045, 0.07, 0.045), '#7a7a7a', [0.07, 0.22, 0.04]),
]);

const cityGeo = merge([
  plinth(),
  part(box(0.36, 0.14, 0.26), '#ffffff', [-0.04, 0.07, 0]),
  part(prism(0.4, 0.12, 0.3), '#8a8a8a', [-0.04, 0.14, 0]),
  part(box(0.16, 0.3, 0.16), '#f2f2f2', [0.13, 0.15, 0]),
  part(new THREE.ConeGeometry(0.125, 0.14, 4), '#777777', [0.13, 0.37, 0], [0, Math.PI / 4, 0]),
  part(box(0.05, 0.07, 0.02), '#8b8b8b', [0.13, 0.2, 0.085]),
  part(box(0.05, 0.07, 0.02), '#8b8b8b', [-0.08, 0.08, 0.135]),
]);

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function pieceMat(color: PlayerColor): THREE.MeshStandardMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: PLAYER_HEX[color], vertexColors: true, flatShading: true, roughness: 0.5, metalness: 0.05 });
    matCache.set(color, m);
  }
  return m;
}
const roadMatCache = new Map<string, THREE.MeshStandardMaterial>();
function roadMat(color: PlayerColor): THREE.MeshStandardMaterial {
  let m = roadMatCache.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: PLAYER_HEX[color], roughness: 0.45, metalness: 0.05 });
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

function Road({ id, color, ctx }: { id: string; color: PlayerColor; ctx: PieceCtx }) {
  const recent = ctx.recent.has(id);
  const g = usePop(recent);
  const xf = edgeXform(ctx, id);
  if (!xf) return null;
  return (
    <group position={[xf.x, xf.y + 0.045, xf.z]} rotation={[0, xf.ang, 0]}>
      <group ref={g} scale={recent ? 0 : 1}>
        <mesh geometry={roadGeo} material={roadMat(color)} castShadow receiveShadow />
      </group>
      {recent && <Puff color={PLAYER_HEX[color]} />}
    </group>
  );
}

export function Roads({ roads, colors, ctx }: { roads: Record<string, string>; colors: Record<string, PlayerColor>; ctx: PieceCtx }) {
  return (
    <>
      {Object.entries(roads).map(([id, owner]) => {
        const c = colors[owner];
        return c ? <Road key={`${id}:${ctx.recent.has(id)}`} id={id} color={c} ctx={ctx} /> : null;
      })}
    </>
  );
}

// ---------- здания ----------

function Building({ id, kind, color, ctx }: { id: string; kind: 'settlement' | 'city'; color: PlayerColor; ctx: PieceCtx }) {
  const recent = ctx.recent.has(id);
  const g = usePop(recent);
  const p = ctx.world.vert.get(id);
  const yaw = useMemo(() => ((hashStr(id) % 6) * Math.PI) / 3 / 2, [id]);
  if (!p) return null;
  const y = vertexY(ctx, id);
  return (
    <group position={[p[0], y + 0.02, p[1]]} rotation={[0, yaw, 0]}>
      <group ref={g} scale={recent ? 0 : 1}>
        <mesh geometry={kind === 'city' ? cityGeo : houseGeo} material={pieceMat(color)} castShadow receiveShadow />
      </group>
      {recent && <Puff color="#f4efe4" />}
    </group>
  );
}

export function Buildings({
  buildings,
  colors,
  ctx,
}: {
  buildings: Record<string, { owner: string; kind: 'settlement' | 'city' }>;
  colors: Record<string, PlayerColor>;
  ctx: PieceCtx;
}) {
  return (
    <>
      {Object.entries(buildings).map(([id, b]) => {
        const c = colors[b.owner];
        return c ? <Building key={`${id}:${b.kind}:${ctx.recent.has(id)}`} id={id} kind={b.kind} color={c} ctx={ctx} /> : null;
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

export function Robber({ target, hexH }: { target: [number, number] | null; hexH: number }) {
  const { rig, reduced } = useEnv();
  const g = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const cur = useRef<{ from: [number, number]; to: [number, number]; t0: number | null; at: [number, number] } | null>(null);

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
    const hop = u < 1 ? Math.sin(u * Math.PI) * 0.7 : 0;
    const t = reduced ? 0 : clock.elapsedTime;
    const idle = Math.sin(t * 2) * 0.012;
    const land = u >= 1 && c.t0 !== -99 ? Math.max(0, 1 - (clock.elapsedTime - c.t0 - T) * 4) : 0;
    o.position.set(x, hexH + hop + idle, z);
    body.current.scale.set(1 + land * 0.18 * Math.sin(land * 9), 1 - land * 0.18 * Math.sin(land * 9), 1 + land * 0.18 * Math.sin(land * 9));
    body.current.rotation.y = rig.az + Math.sin(t * 0.7) * 0.15;
  });

  if (!target) return null;
  return (
    <group ref={g} position={[target[0], hexH, target[1]]}>
      <group ref={body}>
        <mesh geometry={robberGeo} material={robberMat} castShadow />
        <mesh geometry={eyeGeo} material={eyeMat} position={[-0.035, 0.405, 0.085]} />
        <mesh geometry={eyeGeo} material={eyeMat} position={[0.035, 0.405, 0.085]} />
      </group>
    </group>
  );
}
