// Жетоны чисел, гавани, подсветки мест, вспышки доходов.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { HarborType } from '../engine';
import { HEIGHT, harborSpot, type World } from './world';
import { useEnv } from './rig';
import { box, flatHexGeo, hexRingGeo, merge, part, type TileInfo } from './Terrain';

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

// Шрифты приложения (Google Fonts в index.html): цифры — Unbounded, подписи — Manrope.
const NUM_FONT = '"Unbounded","Manrope",system-ui,sans-serif';
const TXT_FONT = '"Manrope",system-ui,sans-serif';

/** Перерисовка канвас-текстур, когда догрузятся веб-шрифты (иначе на канвасе останется запасной шрифт). */
const redraws = new Set<() => void>();
let fontsHooked = false;
function hookFonts() {
  if (fontsHooked || typeof document === 'undefined' || !document.fonts) return;
  fontsHooked = true;
  const again = () => redraws.forEach((f) => f());
  const fs = document.fonts;
  Promise.all([fs.load('800 64px "Unbounded"', '0123456789'), fs.load('800 64px "Manrope"', '0123456789:')]).then(again, again);
  fs.ready.then(again, () => undefined);
}

function tokenTexture(n: number): THREE.CanvasTexture {
  const key = `tok${n}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const s = 320;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const paint = () => {
    const red = n === 6 || n === 8;
    const ink = red ? '#c9271c' : '#1d2230';
    g.clearRect(0, 0, s, s);
    g.shadowColor = 'transparent';
    // слоновая кость: свет сверху-слева, к краю теплее
    const grd = g.createRadialGradient(s * 0.42, s * 0.36, s * 0.05, s / 2, s / 2, s / 2);
    grd.addColorStop(0, '#fffdf6');
    grd.addColorStop(0.7, '#f7ecd4');
    grd.addColorStop(1, '#e9d6ad');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
    g.fill();
    // тонкая гравированная линия у края
    g.strokeStyle = 'rgba(122, 92, 44, 0.42)';
    g.lineWidth = s * 0.011;
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.435, 0, Math.PI * 2);
    g.stroke();
    // цифра: Unbounded 800, лёгкий «тиснёный» блик снизу
    const str = String(n);
    let px = s * (n >= 10 ? 0.36 : 0.45);
    g.font = `800 ${px}px ${NUM_FONT}`;
    (g as unknown as { letterSpacing?: string }).letterSpacing = n >= 10 ? `${-s * 0.014}px` : '0px';
    const w = g.measureText(str).width;
    const maxW = s * 0.64;
    if (w > maxW) {
      px *= maxW / w;
      g.font = `800 ${px}px ${NUM_FONT}`;
    }
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    const m = g.measureText(str);
    const asc = m.actualBoundingBoxAscent || px * 0.72;
    const desc = m.actualBoundingBoxDescent || 0;
    g.shadowColor = 'rgba(255,255,255,0.85)';
    g.shadowOffsetY = s * 0.008;
    g.shadowBlur = 0;
    g.fillStyle = ink;
    g.fillText(str, s / 2, s * 0.45 + (asc - desc) / 2);
    g.shadowColor = 'transparent';
    g.shadowOffsetY = 0;
    // точки вероятности
    const pips = 6 - Math.abs(7 - n);
    for (let i = 0; i < pips; i++) {
      g.beginPath();
      g.arc(s / 2 + (i - (pips - 1) / 2) * s * 0.072, s * 0.77, s * 0.023, 0, Math.PI * 2);
      g.fill();
    }
  };
  paint();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  texCache.set(key, t);
  redraws.add(() => {
    paint();
    t.needsUpdate = true;
  });
  hookFonts();
  return t;
}

/** Мягкая тень-пятно под парящим жетоном. */
function blobTexture(): THREE.CanvasTexture {
  return canvasTexture('blob', 64, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(10,14,24,0.55)');
    grd.addColorStop(0.55, 'rgba(10,14,24,0.28)');
    grd.addColorStop(1, 'rgba(10,14,24,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
}

const HARBOR_COLOR: Record<string, string> = { brick: '#c8643c', wood: '#2f7d3a', sheep: '#9fd06a', wheat: '#e8b931', ore: '#7d889c' };

/** Значок гавани: светлый диск, иконка ресурса эпохи (или якорь для 3:1) и курс. Без цветных обводок. */
function harborTexture(type: HarborType, era?: string): THREE.CanvasTexture {
  const key = `hb${type}:${era ?? ''}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const base = () => {
    g.clearRect(0, 0, s, s);
    const grd = g.createRadialGradient(s / 2, s * 0.42, s * 0.1, s / 2, s / 2, s / 2);
    grd.addColorStop(0, '#fffaf0');
    grd.addColorStop(1, '#ead7ad');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2 - 3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(60, 40, 20, 0.55)';
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = '#2b2118';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 ${s * 0.23}px ${TXT_FONT}`;
    g.fillText(type === 'any' ? '3:1' : '2:1', s / 2, s * 0.76);
  };
  let icon: HTMLImageElement | null = null;
  let iconFailed = false;
  const paint = () => {
  base();
  if (type === 'any') {
    g.strokeStyle = '#2b2118';
    g.lineWidth = s * 0.045;
    g.lineCap = 'round';
    const cx = s / 2, top = s * 0.16, bot = s * 0.52;
    g.beginPath(); g.arc(cx, top + s * 0.035, s * 0.035, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(cx, top + s * 0.07); g.lineTo(cx, bot); g.stroke();
    g.beginPath(); g.moveTo(cx - s * 0.08, top + s * 0.12); g.lineTo(cx + s * 0.08, top + s * 0.12); g.stroke();
    g.beginPath(); g.arc(cx, bot - s * 0.1, s * 0.12, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
  }
  if (icon) g.drawImage(icon, s * 0.24, s * 0.08, s * 0.52, s * 0.52);
  else if (iconFailed) {
    g.fillStyle = HARBOR_COLOR[type] ?? '#888';
    g.beginPath();
    g.arc(s / 2, s * 0.36, s * 0.14, 0, Math.PI * 2);
    g.fill();
  }
  };
  paint();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  redraws.add(() => {
    paint();
    t.needsUpdate = true;
  });
  hookFonts();
  if (type !== 'any' && era) {
    const img = new Image();
    img.onload = () => {
      icon = img;
      paint();
      t.needsUpdate = true;
    };
    img.onerror = () => {
      iconFailed = true;
      paint();
      t.needsUpdate = true;
    };
    img.src = `${import.meta.env.BASE_URL}eras/${era}/res-${type}.webp`;
  }
  return t;
}


// ---------- жетоны ----------

const TOKEN_R = 0.29;
/** Насколько жетон парит над плиткой: выше пропсов своей местности. */
const TOKEN_LIFT: Record<string, number> = { forest: 0.5, mountains: 0.6, hills: 0.42, pasture: 0.37, fields: 0.39, desert: 0.37 };
// Латунный ободок: верх уже низа — скошенная грань ловит блик
const discGeo = new THREE.CylinderGeometry(TOKEN_R - 0.018, TOKEN_R, 0.055, 40);
const tokFaceGeo = (() => {
  const g = new THREE.CircleGeometry(TOKEN_R - 0.036, 40);
  g.rotateX(-Math.PI / 2);
  return g;
})();
/** Диск значка гавани. */
const faceGeo = (() => {
  const g = new THREE.CircleGeometry(0.285, 28);
  g.rotateX(-Math.PI / 2);
  return g;
})();
const discMat = new THREE.MeshStandardMaterial({ color: '#e6bd66', roughness: 0.3, metalness: 0.35, emissive: '#6b4a12', emissiveIntensity: 0.3 });
const pinGeo = new THREE.CylinderGeometry(0.02, 0.028, 1, 6);
pinGeo.translate(0, 0.5, 0);
const pinMat = new THREE.MeshStandardMaterial({ color: '#4a3826', roughness: 0.7 });
const blobGeo = (() => {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  return g;
})();
let blobMat: THREE.MeshBasicMaterial | null = null;
const getBlobMat = () =>
  (blobMat ??= new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, toneMapped: false, fog: false }));

function Token({ tile, number }: { tile: TileInfo; number: number }) {
  const g = useRef<THREE.Group>(null);
  const h = HEIGHT[tile.terrain];
  const lift = TOKEN_LIFT[tile.terrain] ?? 0.45;
  useBillboard(g, h + lift, TOKEN_R);
  const tex = useMemo(() => tokenTexture(number), [number]);
  return (
    <group position={[tile.x, 0, tile.z]}>
      <mesh geometry={blobGeo} material={getBlobMat()} position={[0, h + 0.014, 0]} scale={0.78} renderOrder={1} />
      <mesh geometry={pinGeo} material={pinMat} position={[0, h, 0]} scale={[1, lift + 0.04, 1]} />
      <group ref={g}>
        <mesh geometry={discGeo} material={discMat} castShadow />
        <mesh geometry={tokFaceGeo} position={[0, 0.029, 0]}>
          <meshStandardMaterial map={tex} roughness={0.5} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.16} />
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

const shipGeo = merge([
  part(box(0.42, 0.07, 0.15), '#7a4a26', [0, 0.035, 0]),
  part(box(0.12, 0.06, 0.11), '#7a4a26', [0.25, 0.05, 0], [0, Math.PI / 4, 0]),
  part(box(0.36, 0.02, 0.13), '#b98a55', [0, 0.08, 0]),
  part(box(0.08, 0.06, 0.08), '#a36a3a', [-0.1, 0.12, 0.02]),
  part(box(0.07, 0.05, 0.07), '#a36a3a', [-0.02, 0.115, -0.03]),
  part(new THREE.CylinderGeometry(0.012, 0.014, 0.42, 5), '#5a3a1e', [0.06, 0.29, 0]),
  part(box(0.012, 0.24, 0.22), '#f4ecd8', [0.06, 0.32, 0]),
]);
shipGeo.scale(1.45, 1.45, 1.45);
const shipMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });

/** Кораблик у причала: покачивается; при обмене через эту гавань уходит в рейс и возвращается. */
function Ship({ spot, sailKey }: { spot: { a: [number, number]; b: [number, number]; p: [number, number] }; sailKey?: number }) {
  const g = useRef<THREE.Group>(null);
  const { reduced } = useEnv();
  const t0 = useRef<number | null>(null);
  const last = useRef(sailKey);
  const dir = useMemo(() => {
    const mx = (spot.a[0] + spot.b[0]) / 2;
    const mz = (spot.a[1] + spot.b[1]) / 2;
    const dx = spot.p[0] - mx;
    const dz = spot.p[1] - mz;
    const l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l] as const;
  }, [spot]);
  // Стоянка: сбоку от причала, носом в море
  const side: [number, number] = [-dir[1], dir[0]];
  const home: [number, number] = [spot.p[0] + dir[0] * 0.25 + side[0] * 0.42, spot.p[1] + dir[1] * 0.25 + side[1] * 0.42];
  const yaw = Math.atan2(-dir[1], dir[0]);
  useFrame(({ clock }) => {
    const o = g.current;
    if (!o) return;
    if (sailKey !== last.current) {
      last.current = sailKey;
      t0.current = clock.elapsedTime;
    }
    const t = reduced ? 0 : clock.elapsedTime;
    let out = 0;
    let turn = 0;
    if (t0.current !== null) {
      const u = (clock.elapsedTime - t0.current) / 3.2;
      if (u >= 1) t0.current = null;
      else {
        out = Math.sin(Math.min(1, u) * Math.PI) * 1.6;
        turn = u > 0.5 ? Math.PI : 0;
      }
    }
    o.position.set(home[0] + dir[0] * out, 0.02 + Math.sin(t * 1.6 + home[0]) * 0.015, home[1] + dir[1] * out);
    o.rotation.set(Math.sin(t * 1.3 + home[1]) * 0.05, yaw + turn, Math.sin(t * 1.1) * 0.06);
  });
  return (
    <group ref={g}>
      <mesh geometry={shipGeo} material={shipMat} castShadow />
    </group>
  );
}

function Harbor({ world, edge, type, era, sailKey }: { world: World; edge: string; type: HarborType; era?: string; sailKey?: number }) {
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
  const tex = useMemo(() => harborTexture(type, era), [type, era]);
  if (!spot) return null;
  return (
    <group>
      <Pier a={spot.a} b={spot.p} />
      <Pier a={spot.b} b={spot.p} />
      <mesh geometry={deckGeo} material={woodMat} position={[spot.p[0], 0.08, spot.p[1]]} castShadow receiveShadow />
      <Ship spot={spot} sailKey={sailKey} />
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

export function Harbors({ world, harbors, era, sail }: { world: World; harbors: { edge: string; type: HarborType }[]; era?: string; sail?: { type: HarborType; key: number } }) {
  return (
    <>
      {harbors.map((h) => (
        <Harbor key={h.edge} world={world} edge={h.edge} type={h.type} era={era} sailKey={sail && sail.type === h.type ? sail.key : undefined} />
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
