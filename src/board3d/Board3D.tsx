// WebGL-карта Хексленда (React Three Fiber). Тот же контракт, что у SVG-<Board>, плюс режимы камеры,
// полёт камеры к месту события, призраки планов, тряска и режим экономии.

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { PlayerColor } from '../engine';
import type { BoardProps } from '../board/Board';
import { HEIGHT, worldFor, type World } from './world';
import { DEFAULT_PALETTE, EnvCtx, type Env, type Palette, type Rig } from './rig';
import Sea from './Sea';
import Tiles, { type TileInfo } from './Terrain';
import { EdgeMarker, Flashes, Harbors, HexMarker, Tokens, VertexMarker, useResetCursor } from './Markers';
import { Buildings, Ghosts, RaidZone, Robber, Roads, edgeY, vertexY, type GhostSpec, type PieceCtx } from './Pieces';

export type BoardMode = '2d' | '25d' | '3d';

export interface Board3DProps extends BoardProps {
  mode: BoardMode;
  palette?: Palette;
  /** Полёт камеры к цели: смена `key` запускает полёт и возврат (3d/25d); в 2d — мягкий наезд. */
  focus?: { hex?: string; vertex?: string; edge?: string; key: number };
  /** «Призраки» запланированных фигур. */
  ghosts?: GhostSpec[];
  /** Тряска экрана: смена значения — ~400 мс тряски. */
  shake?: number;
  lowPower?: boolean;
  /** Эпоха — для разбойника и эффекта захваченного гекса. */
  era?: string;
}

// ---------- камера ----------

interface Goal {
  az: number;
  pol: number;
  zoom: number;
  panX: number;
  panZ: number;
  fov: number;
  tiltK: number;
  amp: number;
}

const PRESET: Record<BoardMode, Pick<Goal, 'fov' | 'tiltK' | 'amp'> & { az?: number; pol?: number }> = {
  '2d': { az: 0, pol: 0, fov: 5, tiltK: 0, amp: 0 },
  '25d': { az: 0.5, pol: 0.96, fov: 5, tiltK: 0.7, amp: 0.65 },
  '3d': { fov: 36, tiltK: 1, amp: 1 },
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const damp = THREE.MathUtils.damp;

/** Видимая высота (в метрах на плоскости цели), чтобы остров целиком влез при данных углах. */
function fitHeight(world: World, az: number, pol: number, aspect: number, persp: number) {
  const cA = Math.cos(az);
  const sA = Math.sin(az);
  const cP = Math.cos(pol);
  const sP = Math.sin(pol);
  let mr = 0;
  let mu = 0;
  let gr = 0;
  let gf = 0;
  for (const [x, z] of world.pts) {
    const r = x * cA - z * sA;
    const f = -(x * sA + z * cA);
    gr = Math.max(gr, Math.abs(r));
    gf = Math.max(gf, Math.abs(f));
    mr = Math.max(mr, Math.abs(r));
    mu = Math.max(mu, Math.abs(f * cP), Math.abs(f * cP + sP * 0.7), Math.abs(f * cP - 0.0));
  }
  const m = 0.7; // запас на гавани
  const H = 2 * Math.max((mu + m) * (1 + persp * 0.08), (mr + m) / aspect);
  return { H, extR: gr + m, extF: gf + m };
}

function CameraRig({
  mode,
  world,
  focus,
  shake,
  rig,
  reduced,
}: {
  mode: BoardMode;
  world: World;
  focus: Board3DProps['focus'];
  shake: number | undefined;
  rig: Rig;
  reduced: boolean;
}) {
  const { camera, gl, size } = useThree();
  const goal = useRef<Goal>({ az: 0.3, pol: 0.88, zoom: 1, panX: 0, panZ: 0, ...PRESET[mode] });
  const cur = useRef<Goal | null>(null);
  const orbit = useRef({ az: 0.3, pol: 0.88 });
  const modeRef = useRef(mode);
  const shakeT0 = useRef(-1);
  const flight = useRef<{ base: { zoom: number; panX: number; panZ: number }; timer: number } | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  if (cur.current === null) {
    const g = goal.current;
    if (mode === '3d') {
      g.az = orbit.current.az;
      g.pol = orbit.current.pol;
    }
    cur.current = { ...g };
  }

  const persp = (fov: number) => (fov > 20 ? 1 : 0);

  const clampPan = (g: Goal, zoom: number) => {
    const s = sizeRef.current;
    const aspect = s.width / Math.max(1, s.height);
    const { H, extR, extF } = fitHeight(world, g.az, g.pol, aspect, persp(g.fov));
    const Hv = H / zoom;
    const visR = (Hv * aspect) / 2;
    const visF = Hv / 2 / Math.max(0.3, Math.cos(g.pol));
    const maxR = Math.max(0, extR - visR);
    const maxF = Math.max(0, extF - visF);
    const cA = Math.cos(g.az);
    const sA = Math.sin(g.az);
    let r = g.panX * cA - g.panZ * sA;
    let f = -(g.panX * sA + g.panZ * cA);
    r = clamp(r, -maxR, maxR);
    f = clamp(f, -maxF, maxF);
    g.panX = r * cA - f * sA;
    g.panZ = -r * sA - f * cA;
  };

  // смена режима: плавный пролёт камеры
  useEffect(() => {
    if (modeRef.current === mode && cur.current && goal.current.fov === PRESET[mode].fov) return;
    modeRef.current = mode;
    const g = goal.current;
    const p = PRESET[mode];
    g.fov = p.fov;
    g.tiltK = p.tiltK;
    g.amp = p.amp;
    g.az = p.az ?? orbit.current.az;
    g.pol = p.pol ?? orbit.current.pol;
    g.zoom = 1;
    g.panX = 0;
    g.panZ = 0;
  }, [mode]);

  // полёт к месту события
  const prevFocus = useRef(focus?.key);
  useEffect(() => {
    if (!focus || focus.key === prevFocus.current) return;
    prevFocus.current = focus.key;
    let pt: [number, number] | undefined;
    if (focus.hex) pt = world.hex.get(focus.hex);
    else if (focus.vertex) pt = world.vert.get(focus.vertex);
    else if (focus.edge) {
      const e = world.topo.edges.get(focus.edge);
      const a = e && world.vert.get(e.vertices[0]);
      const b = e && world.vert.get(e.vertices[1]);
      if (a && b) pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
    if (!pt) return;
    const g = goal.current;
    if (!flight.current) flight.current = { base: { zoom: g.zoom, panX: g.panX, panZ: g.panZ }, timer: 0 };
    window.clearTimeout(flight.current.timer);
    if (modeRef.current === '2d') {
      g.zoom = 1.6;
      g.panX = pt[0] * 0.7;
      g.panZ = pt[1] * 0.7;
    } else {
      g.zoom = 2.5;
      g.panX = pt[0];
      g.panZ = pt[1];
    }
    clampPan(g, g.zoom);
    const f = flight.current;
    f.timer = window.setTimeout(() => {
      g.zoom = f.base.zoom;
      g.panX = f.base.panX;
      g.panZ = f.base.panZ;
      flight.current = null;
    }, 1900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);
  useEffect(
    () => () => {
      if (flight.current) window.clearTimeout(flight.current.timer);
    },
    [],
  );

  // тряска
  const prevShake = useRef(shake);
  useEffect(() => {
    if (shake === prevShake.current) return;
    prevShake.current = shake;
    if (!reduced) shakeT0.current = performance.now();
  }, [shake, reduced]);

  // жесты
  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = 'none';
    const ptrs = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const zoomBy = (k: number) => {
      const g = goal.current;
      const lo = modeRef.current === '3d' ? 0.75 : 1;
      g.zoom = clamp(g.zoom * k, lo, 3.5);
      if (modeRef.current !== '3d') clampPan(g, g.zoom);
    };
    const mid = () => {
      const a = [...ptrs.values()];
      return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) };
    };
    const panBy = (dx: number, dy: number) => {
      const g = goal.current;
      const c = cur.current!;
      const s = sizeRef.current;
      const aspect = s.width / Math.max(1, s.height);
      const H = fitHeight(world, c.az, c.pol, aspect, persp(c.fov)).H / c.zoom;
      const upp = H / Math.max(1, s.height);
      const cA = Math.cos(g.az);
      const sA = Math.sin(g.az);
      const cP = Math.max(0.3, Math.cos(g.pol));
      const r = -dx * upp;
      const f = (dy * upp) / cP;
      g.panX += r * cA - f * sA;
      g.panZ += -r * sA - f * cA;
      clampPan(g, g.zoom);
    };
    const down = (e: PointerEvent) => {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (ptrs.size === 2) pinch = mid().d;
    };
    const move = (e: PointerEvent) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (ptrs.size === 1) {
        // Один палец — двигаем карту (как в картах на телефоне); мышь с Shift — вращение
        if (modeRef.current === '3d' && e.pointerType === 'mouse' && e.shiftKey) {
          const g = goal.current;
          g.az -= dx * 0.006;
          g.pol = clamp(g.pol - dy * 0.005, 0.35, 1.3);
          orbit.current = { az: g.az, pol: g.pol };
        } else panBy(dx, dy);
      } else if (ptrs.size === 2) {
        const ang = () => {
          const [a, b] = [...ptrs.values()];
          return Math.atan2(b.y - a.y, b.x - a.x);
        };
        const before = mid();
        const a0 = ang();
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const after = mid();
        if (pinch > 0 && after.d > 0) zoomBy(after.d / pinch);
        pinch = after.d;
        panBy(after.x - before.x, after.y - before.y);
        // Два пальца — поворот карты
        if (modeRef.current === '3d') {
          let da = ang() - a0;
          if (da > Math.PI) da -= 2 * Math.PI;
          if (da < -Math.PI) da += 2 * Math.PI;
          const g = goal.current;
          g.az -= da;
          orbit.current = { az: g.az, pol: g.pol };
        }
        return;
      }
      p.x = e.clientX;
      p.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      ptrs.delete(e.pointerId);
      pinch = ptrs.size === 2 ? mid().d : 0;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, world]);

  const basis = useMemo(
    () => ({ m: new THREE.Matrix4(), r: new THREE.Vector3(), u: new THREE.Vector3(), d: new THREE.Vector3() }),
    [],
  );

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const g = goal.current;
    const c = cur.current!;
    const L = reduced ? 20 : 5.5;
    c.az = damp(c.az, g.az, L, dt);
    c.pol = damp(c.pol, g.pol, L, dt);
    c.zoom = damp(c.zoom, g.zoom, L, dt);
    c.panX = damp(c.panX, g.panX, L, dt);
    c.panZ = damp(c.panZ, g.panZ, L, dt);
    c.fov = damp(c.fov, g.fov, L, dt);
    c.tiltK = damp(c.tiltK, g.tiltK, L, dt);
    c.amp = damp(c.amp, g.amp, L, dt);

    const aspect = size.width / Math.max(1, size.height);
    const H = fitHeight(world, c.az, c.pol, aspect, persp(c.fov)).H / c.zoom;
    const fov = c.fov;
    const dist = H / 2 / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const sP = Math.sin(c.pol);
    const cP = Math.cos(c.pol);
    const sA = Math.sin(c.az);
    const cA = Math.cos(c.az);
    basis.r.set(cA, 0, -sA);
    basis.u.set(-cP * sA, sP, -cP * cA);
    basis.d.set(sP * sA, cP, sP * cA);

    let sx = 0;
    let sy = 0;
    if (shakeT0.current >= 0) {
      const t = (performance.now() - shakeT0.current) / 400;
      if (t >= 1) shakeT0.current = -1;
      else {
        const a = (1 - t) ** 2 * H * 0.014;
        sx = Math.sin(t * 90) * a;
        sy = Math.cos(t * 73) * a;
      }
    }
    camera.position.set(c.panX + basis.d.x * dist, basis.d.y * dist, c.panZ + basis.d.z * dist);
    camera.position.addScaledVector(basis.r, sx).addScaledVector(basis.u, sy);
    basis.m.makeBasis(basis.r, basis.u, basis.d);
    camera.quaternion.setFromRotationMatrix(basis.m);
    const pc = camera as THREE.PerspectiveCamera;
    pc.fov = fov;
    pc.aspect = aspect;
    pc.near = Math.max(0.5, dist - 45);
    pc.far = dist + 70;
    pc.updateProjectionMatrix();

    rig.az = c.az;
    rig.pol = c.pol;
    rig.tilt = c.pol * c.tiltK;
    rig.amp = c.amp;
  });

  return null;
}

// ---------- сцена ----------

function useReducedMotion(): boolean {
  const [r, setR] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const q = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return r;
}

function Scene(props: Board3DProps & { rig: Rig }) {
  const { view, colors, highlight, onVertex, onEdge, onHex, recent = [], selected, flash, ghosts = [], mode, shake, focus, rig, era } = props;
  const palette = props.palette ?? DEFAULT_PALETTE;
  const lowPower = !!props.lowPower;
  const reduced = useReducedMotion();
  useResetCursor();

  const world = useMemo(() => worldFor(view.board.layout), [view.board.layout]);

  const sig = view.board.hexes.map((h) => `${h.id}:${h.terrain}:${h.number ?? ''}`).join('|');
  const { tiles, tileMap, numbers, hexH } = useMemo(() => {
    const tiles: TileInfo[] = [];
    const tileMap = new Map<string, TileInfo>();
    const numbers = new Map<string, number>();
    const hexH = new Map<string, number>();
    for (const h of view.board.hexes) {
      const p = world.hex.get(h.id);
      if (!p) continue;
      const t: TileInfo = { id: h.id, terrain: h.terrain, x: p[0], z: p[1] };
      tiles.push(t);
      tileMap.set(h.id, t);
      hexH.set(h.id, HEIGHT[h.terrain]);
      if (h.number !== undefined) numbers.set(h.id, h.number);
    }
    return { tiles, tileMap, numbers, hexH };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, world]);

  const recentKey = recent.join('|');
  const ctx = useMemo<PieceCtx>(
    () => ({ world, hexH, recent: new Set(recent) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world, hexH, recentKey],
  );

  const env = useMemo<Env>(() => ({ palette, reduced, lowPower, rig }), [palette, reduced, lowPower, rig]);

  const centers = useMemo(() => [...world.hex.values()], [world]);
  const sunDir = useMemo(() => new THREE.Vector3(-0.42, 0.78, 0.46).normalize(), []);
  const R = world.radius + 2;

  const hl = {
    vertices: new Set(highlight?.vertices ?? []),
    edges: new Set(highlight?.edges ?? []),
    hexes: new Set(highlight?.hexes ?? []),
  };
  if (selected) {
    if (world.topo.vertices.has(selected)) hl.vertices.add(selected);
    else if (world.topo.edges.has(selected)) hl.edges.add(selected);
    else if (world.topo.hexes.has(selected)) hl.hexes.add(selected);
  }

  const robberPos = useMemo<[number, number] | null>(() => {
    const p = world.hex.get(view.robberHex);
    return p ? [p[0] - 0.44, p[1] + 0.2] : null;
  }, [world, view.robberHex]);
  const robberH = HEIGHT[tileMap.get(view.robberHex)?.terrain ?? 'desert'];

  return (
    <EnvCtx.Provider value={env}>
      <CameraRig mode={mode} world={world} focus={focus} shake={shake} rig={rig} reduced={reduced} />

      <hemisphereLight args={['#dff0ff', '#6d5a3c', 1.15]} />
      <directionalLight
        position={[sunDir.x * 22, sunDir.y * 22, sunDir.z * 22]}
        intensity={2.5}
        color={palette.light}
        castShadow={!lowPower}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-R}
        shadow-camera-right={R}
        shadow-camera-top={R}
        shadow-camera-bottom={-R}
        shadow-camera-near={2}
        shadow-camera-far={50}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={3}
      />

      <Sea centers={centers} radius={world.radius} sunDir={sunDir} />
      <Tiles tiles={tiles} />
      <Tokens tiles={tiles} numbers={numbers} />
      <Harbors world={world} harbors={view.board.harbors} />
      <Roads roads={view.roads} colors={colors} ctx={ctx} />
      <Buildings buildings={view.buildings} colors={colors} ctx={ctx} />
      <Ghosts ghosts={ghosts} ctx={ctx} />
      <RaidZone target={robberPos} hexH={robberH} era={era} />
      <Robber target={robberPos} hexH={robberH} sprite={era ? `${import.meta.env.BASE_URL}eras/${era}/robber-unit.webp` : undefined} />
      {flash && <Flashes tiles={tileMap} ids={flash.hexes} k={flash.key} />}

      {[...hl.hexes].map((id) => {
        const t = tileMap.get(id);
        return t ? <HexMarker key={`h${id}`} tile={t} selected={id === selected} onClick={onHex ? () => onHex(id) : undefined} /> : null;
      })}
      {[...hl.edges].map((id) => {
        const e = world.topo.edges.get(id);
        const a = e && world.vert.get(e.vertices[0]);
        const b = e && world.vert.get(e.vertices[1]);
        return a && b ? (
          <EdgeMarker key={`e${id}`} a={a} b={b} y={edgeY(ctx, id) + 0.04} selected={id === selected} onClick={onEdge ? () => onEdge(id) : undefined} />
        ) : null;
      })}
      {[...hl.vertices].map((id) => {
        const p = world.vert.get(id);
        return p ? (
          <VertexMarker key={`v${id}`} pos={p} y={vertexY(ctx, id) + 0.03} selected={id === selected} onClick={onVertex ? () => onVertex(id) : undefined} />
        ) : null;
      })}
    </EnvCtx.Provider>
  );
}

export default function Board3D(props: Board3DProps) {
  const rig = useMemo<Rig>(() => ({ az: 0, pol: 0, tilt: 0, amp: 0 }), []);
  const lowPower = !!props.lowPower;
  return (
    <div className={props.className} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', touchAction: 'none' }}>
      <Canvas
        dpr={lowPower ? 1 : [1, 2]}
        shadows={lowPower ? false : 'percentage'}
        flat
        frameloop="always"
        gl={{ alpha: true, antialias: !lowPower, powerPreference: lowPower ? 'low-power' : 'high-performance' }}
        camera={{ fov: 5, near: 1, far: 400, position: [0, 100, 0] }}
        style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      >
        <Scene {...props} rig={rig} />
      </Canvas>
    </div>
  );
}

export type { PlayerColor };
