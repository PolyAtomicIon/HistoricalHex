// Жетоны чисел, гавани, подсветки мест, вспышки доходов.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { HarborType } from '../engine';
import { HEIGHT, harborSpot, type World } from './world';
import { useEnv } from './rig';
import { flatHexGeo, hexRingGeo, type TileInfo } from './Terrain';

// ---------- вспомогательное ----------

/** Поворачивает группу лицом к камере (с учётом азимута и наклона). */
function useBillboard(ref: React.RefObject<THREE.Object3D | null>, baseY: number, r: number) {
  const { rig } = useEnv();
  useFrame(() => {
    const o = ref.current;
    if (!o) return;
    o.rotation.order = 'YXZ';
    o.rotation.y = rig.az;
    o.rotation.x = rig.tilt;
    o.position.y = baseY + Math.sin(rig.tilt) * r + 0.02;
  });
}

const texCache = new Map<string, THREE.CanvasTexture>();
function canvasTexture(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

const FONT = '"Georgia","Times New Roman",serif';

function tokenTexture(n: number): THREE.CanvasTexture {
  return canvasTexture(`tok${n}`, 256, (g, s) => {
    const red = n === 6 || n === 8;
    const grd = g.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s / 2);
    grd.addColorStop(0, '#fbf1d9');
    grd.addColorStop(1, '#eed9ae');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = red ? '#c0392b' : '#b49a68';
    g.lineWidth = s * 0.03;
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2 - s * 0.06, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = red ? '#c0281f' : '#2a2018';
    g.font = `bold ${n >= 10 ? s * 0.4 : s * 0.46}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), s / 2, s * 0.46);
    const pips = 6 - Math.abs(7 - n);
    for (let i = 0; i < pips; i++) {
      g.beginPath();
      g.arc(s / 2 + (i - (pips - 1) / 2) * s * 0.07, s * 0.74, s * 0.021, 0, Math.PI * 2);
      g.fill();
    }
  });
}

const HARBOR_COLOR: Record<string, string> = { brick: '#c8643c', wood: '#2f7d3a', sheep: '#9fd06a', wheat: '#e8b931', ore: '#7d889c' };

function harborTexture(type: HarborType): THREE.CanvasTexture {
  return canvasTexture(`hb${type}`, 256, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s / 2);
    grd.addColorStop(0, '#fff6df');
    grd.addColorStop(1, '#f1dcae');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1b4f79';
    g.lineWidth = s * 0.05;
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2 - s * 0.05, 0, Math.PI * 2);
    g.stroke();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (type === 'any') {
      // якорь линиями
      g.strokeStyle = '#143a5c';
      g.lineWidth = s * 0.045;
      g.lineCap = 'round';
      const cx = s / 2, top = s * 0.18, bot = s * 0.5;
      g.beginPath(); g.arc(cx, top + s * 0.035, s * 0.035, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(cx, top + s * 0.07); g.lineTo(cx, bot); g.stroke();
      g.beginPath(); g.moveTo(cx - s * 0.08, top + s * 0.12); g.lineTo(cx + s * 0.08, top + s * 0.12); g.stroke();
      g.beginPath(); g.arc(cx, bot - s * 0.1, s * 0.12, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
    } else {
      g.fillStyle = HARBOR_COLOR[type] ?? '#888';
      g.beginPath();
      g.arc(s / 2, s * 0.36, s * 0.14, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = s * 0.02;
      g.stroke();
    }
    g.fillStyle = '#143a5c';
    g.font = `bold ${s * 0.27}px ${FONT}`;
    g.fillText(type === 'any' ? '3:1' : '2:1', s / 2, s * 0.7);
  });
}

// ---------- жетоны ----------

const discGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 28);
const faceGeo = (() => {
  const g = new THREE.CircleGeometry(0.285, 28);
  g.rotateX(-Math.PI / 2);
  return g;
})();
const discMat = new THREE.MeshStandardMaterial({ color: '#e2cc9c', roughness: 0.6 });

function Token({ tile, number }: { tile: TileInfo; number: number }) {
  const g = useRef<THREE.Group>(null);
  useBillboard(g, HEIGHT[tile.terrain] + 0.05, 0.3);
  const tex = useMemo(() => tokenTexture(number), [number]);
  return (
    <group position={[tile.x, 0, tile.z]}>
      <group ref={g}>
        <mesh geometry={discGeo} material={discMat} castShadow />
        <mesh geometry={faceGeo} position={[0, 0.032, 0]}>
          <meshStandardMaterial map={tex} roughness={0.55} transparent alphaTest={0.4} />
        </mesh>
      </group>
    </group>
  );
}

export function Tokens({ tiles, numbers }: { tiles: TileInfo[]; numbers: Map<string, number> }) {
  return (
    <>
      {tiles.map((t) => {
        const n = numbers.get(t.id);
        return n === undefined ? null : <Token key={t.id} tile={t} number={n} />;
      })}
    </>
  );
}

// ---------- гавани ----------

const woodMat = new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.9, flatShading: true });
const plankGeo = new THREE.BoxGeometry(1, 0.05, 0.09);
const deckGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.06, 10);

function Pier({ a, b }: { a: [number, number]; b: [number, number] }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  return (
    <mesh
      geometry={plankGeo}
      material={woodMat}
      position={[(a[0] + b[0]) / 2, 0.08, (a[1] + b[1]) / 2]}
      rotation={[0, ang, 0]}
      scale={[len, 1, 1]}
      castShadow
      receiveShadow
    />
  );
}

function Harbor({ world, edge, type }: { world: World; edge: string; type: HarborType }) {
  const spot = useMemo(() => harborSpot(world, edge), [world, edge]);
  const g = useRef<THREE.Group>(null);
  const { rig, reduced } = useEnv();
  useFrame(({ clock }) => {
    const o = g.current;
    if (!o) return;
    o.rotation.order = 'YXZ';
    o.rotation.y = rig.az;
    o.rotation.x = rig.tilt;
    o.position.y = 0.3 + Math.sin(rig.tilt) * 0.22 + (reduced ? 0 : Math.sin(clock.elapsedTime * 1.2 + spot!.p[0]) * 0.015);
  });
  const tex = useMemo(() => harborTexture(type), [type]);
  if (!spot) return null;
  return (
    <group>
      <Pier a={spot.a} b={spot.p} />
      <Pier a={spot.b} b={spot.p} />
      <mesh geometry={deckGeo} material={woodMat} position={[spot.p[0], 0.08, spot.p[1]]} castShadow receiveShadow />
      <group position={[spot.p[0], 0, spot.p[1]]}>
        <group ref={g}>
          <mesh geometry={faceGeo} scale={1.05}>
            <meshStandardMaterial map={tex} roughness={0.6} transparent alphaTest={0.4} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function Harbors({ world, harbors }: { world: World; harbors: { edge: string; type: HarborType }[] }) {
  return (
    <>
      {harbors.map((h) => (
        <Harbor key={h.edge} world={world} edge={h.edge} type={h.type} />
      ))}
    </>
  );
}

// ---------- вспышка дохода ----------

const FLASH_GEO = flatHexGeo(0.97);

function Flash({ tile, k }: { tile: TileInfo; k: number }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const t0 = useRef<number | null>(null);
  const { palette } = useEnv();
  void k;
  useFrame(({ clock }) => {
    const m = mat.current;
    if (!m) return;
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = (clock.elapsedTime - t0.current) / 1.5;
    const v = t >= 1 ? 0 : Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * (1 - t) ** 1.4;
    m.opacity = v * (0.75 + 0.25 * Math.sin(t * 30));
  });
  return (
    <mesh geometry={FLASH_GEO} position={[tile.x, HEIGHT[tile.terrain] + 0.012, tile.z]} renderOrder={5}>
      <meshBasicMaterial ref={mat} color={palette.accent} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export function Flashes({ tiles, ids, k }: { tiles: Map<string, TileInfo>; ids: string[]; k: number }) {
  return (
    <>
      {ids.map((id) => {
        const t = tiles.get(id);
        return t ? <Flash key={`${k}:${id}`} tile={t} k={k} /> : null;
      })}
    </>
  );
}

// ---------- подсветки и зоны нажатия ----------

const ringGeo = new THREE.TorusGeometry(1, 0.14, 8, 36);
ringGeo.rotateX(Math.PI / 2);
const discFlat = new THREE.CircleGeometry(1, 28);
discFlat.rotateX(-Math.PI / 2);
const HEX_FILL = flatHexGeo(0.9);
const HEX_RING = hexRingGeo(0.94, 0.84);
const barGeo = new THREE.BoxGeometry(1, 1, 1);
const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

type Click = (e: ThreeEvent<MouseEvent>) => void;
const mk = (fn?: () => void): Click | undefined =>
  fn
    ? (e) => {
        if (e.delta > 8) return;
        e.stopPropagation();
        fn();
      }
    : undefined;

const setCursor = (e: ThreeEvent<PointerEvent>, v: string) => {
  const el = e.target as unknown as HTMLElement | undefined;
  void el;
  document.body.style.cursor = v;
};

function useGlow(selected: boolean, base = 1) {
  const m1 = useRef<THREE.MeshBasicMaterial>(null);
  const m2 = useRef<THREE.MeshBasicMaterial>(null);
  const g = useRef<THREE.Group>(null);
  const { reduced } = useEnv();
  useFrame(({ clock }) => {
    const t = reduced ? 0 : clock.elapsedTime;
    const p = 0.5 + 0.5 * Math.sin(t * (selected ? 5 : 3));
    if (m1.current) m1.current.opacity = (selected ? 0.95 : 0.55 + 0.35 * p) * base;
    if (m2.current) m2.current.opacity = (selected ? 0.5 : 0.12 + 0.2 * p) * base;
    if (g.current) g.current.scale.setScalar(1 + p * (selected ? 0.12 : 0.08));
  });
  return { m1, m2, g };
}

export function VertexMarker({ pos, y, selected, onClick }: { pos: [number, number]; y: number; selected?: boolean; onClick?: () => void }) {
  const { palette } = useEnv();
  const { m1, m2, g } = useGlow(!!selected);
  const col = selected ? '#ffffff' : palette.accent;
  const R = selected ? 0.25 : 0.19;
  return (
    <group position={[pos[0], y + 0.07, pos[1]]}>
      <group ref={g}>
        <mesh geometry={ringGeo} scale={[R, R * (selected ? 0.5 : 0.4), R]} renderOrder={6}>
          <meshBasicMaterial ref={m1} color={col} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh geometry={discFlat} scale={R * 0.95} renderOrder={6}>
          <meshBasicMaterial ref={m2} color={col} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      {onClick && (
        <mesh
          material={hitMat}
          position={[0, 0.12, 0]}
          onClick={mk(onClick)}
          onPointerOver={(e) => setCursor(e, 'pointer')}
          onPointerOut={(e) => setCursor(e, '')}
        >
          <sphereGeometry args={[0.34, 10, 8]} />
        </mesh>
      )}
    </group>
  );
}

export function EdgeMarker({ a, b, y, selected, onClick }: { a: [number, number]; b: [number, number]; y: number; selected?: boolean; onClick?: () => void }) {
  const { palette } = useEnv();
  const { m1, m2, g } = useGlow(!!selected);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  const col = selected ? '#ffffff' : palette.accent;
  const w = selected ? 0.17 : 0.12;
  return (
    <group position={[(a[0] + b[0]) / 2, y + 0.07, (a[1] + b[1]) / 2]} rotation={[0, ang, 0]}>
      <group ref={g}>
        <mesh geometry={barGeo} scale={[len * 0.74, 0.03, w]} renderOrder={6}>
          <meshBasicMaterial ref={m1} color={col} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh geometry={barGeo} scale={[len * 0.8, 0.02, w * 2.2]} renderOrder={6}>
          <meshBasicMaterial ref={m2} color={col} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      {onClick && (
        <mesh
          geometry={barGeo}
          material={hitMat}
          scale={[len * 0.85, 0.3, 0.34]}
          position={[0, 0.1, 0]}
          onClick={mk(onClick)}
          onPointerOver={(e) => setCursor(e, 'pointer')}
          onPointerOut={(e) => setCursor(e, '')}
        />
      )}
    </group>
  );
}

export function HexMarker({ tile, selected, onClick }: { tile: TileInfo; selected?: boolean; onClick?: () => void }) {
  const { palette } = useEnv();
  const { m1, m2, g } = useGlow(!!selected);
  const col = selected ? '#ffffff' : palette.accent;
  return (
    <group position={[tile.x, HEIGHT[tile.terrain] + 0.03, tile.z]}>
      <group ref={g}>
        <mesh geometry={HEX_RING} renderOrder={6}>
          <meshBasicMaterial ref={m1} color={col} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh geometry={HEX_FILL} renderOrder={6}>
          <meshBasicMaterial ref={m2} color={col} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      {onClick && (
        <mesh
          geometry={HEX_FILL}
          material={hitMat}
          position={[0, 0.02, 0]}
          onClick={mk(onClick)}
          onPointerOver={(e) => setCursor(e, 'pointer')}
          onPointerOut={(e) => setCursor(e, '')}
        />
      )}
    </group>
  );
}

/** Снять курсор-руку при размонтировании. */
export function useResetCursor() {
  useEffect(() => () => void (document.body.style.cursor = ''), []);
}
