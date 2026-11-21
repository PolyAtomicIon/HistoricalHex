// Атаки эпох на 3D-карте — низкополигональные отряды вместо картинок:
//   genghis  · налёт (барымта) — конные лучники влетают, кружат вокруг гекса и бьют огненными стрелами;
//            · рыцарь         — тяжёлая конница с копьями таранит лагерь и проносится насквозь;
//   japan    · налёт          — ниндзя появляются в дыму, прыжком окружают гекс, мечут сюрикены, исчезают;
//            · рыцарь         — самураи бегут к лагерю и рубят катанами.
// Все фигуры смотрят вдоль +X; поворот считается по скорости движения.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { box, merge, part } from './Terrain';
import { fireT, puff } from './units';

export interface Attack3DEvent {
  key: number;
  at: [number, number, number];
  era: string;
  kind: 'robber' | 'knight';
}

export const ATTACK3D_MS: Record<string, number> = { 'genghis:robber': 6500, 'genghis:knight': 5200, 'japan:robber': 5600, 'japan:knight': 5200 };

const V = THREE.Vector3;
const cyl = (rt: number, rb: number, h: number, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
/** Масштаб отрядов на карте (фигуры моделировались мелко). */
const K = 1.35;
/** Конница — компактнее, чтобы не закрывать гекс. */
const KR = 1.05;
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });

// ---------- конь (длина ≈0.5): обтекаемые формы вместо коробок ----------
const capX = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 4, 8).rotateZ(Math.PI / 2);
const horseBody = (coat: string, mane: string) =>
  merge([
    part(capX(0.07, 0.2), coat, [0, 0.27, 0], [0, 0, 0], [1, 1, 0.85]), // туловище
    part(new THREE.CylinderGeometry(0.035, 0.05, 0.17, 8), coat, [0.15, 0.36, 0], [0, 0, -0.75]), // шея
    part(new THREE.CapsuleGeometry(0.03, 0.08, 4, 8), coat, [0.235, 0.42, 0], [0, 0, -1.25]), // голова
    part(new THREE.ConeGeometry(0.012, 0.035, 4), coat, [0.2, 0.47, 0.018]), // уши
    part(new THREE.ConeGeometry(0.012, 0.035, 4), coat, [0.2, 0.47, -0.018]),
    part(box(0.03, 0.12, 0.016), mane, [0.13, 0.41, 0], [0, 0, -0.75]), // грива
    part(new THREE.ConeGeometry(0.025, 0.16, 6), mane, [-0.2, 0.24, 0], [0, 0, -0.5]), // хвост
    part(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 10), '#7a2a1c', [-0.01, 0.335, 0], [0, 0, 0], [1, 1, 0.95]), // попона
  ]);
const legGeo = (() => {
  const g = new THREE.CylinderGeometry(0.014, 0.011, 0.2, 6);
  g.translate(0, -0.1, 0); // ось вращения — у плеча
  return part(g, '#3b2a1e');
})();
const LEGS: [number, number, number][] = [
  [0.11, 0.22, 0.035],
  [0.11, 0.22, -0.035],
  [-0.11, 0.22, 0.035],
  [-0.11, 0.22, -0.035],
];
// Всадник: лучник (шапка с отворотом, лук) / копейщик (шлем-шишак, копьё)
const archerGeo = merge([
  part(new THREE.CapsuleGeometry(0.04, 0.07, 4, 8), '#2f4a5c', [0, 0.45, 0]),
  part(new THREE.SphereGeometry(0.032, 10, 8), '#d9a77c', [0.01, 0.54, 0]),
  part(new THREE.ConeGeometry(0.04, 0.07, 8), '#6b3a1f', [0.01, 0.6, 0]),
  part(cyl(0.045, 0.045, 0.012, 10), '#4a2c16', [0.01, 0.57, 0]),
  part(new THREE.TorusGeometry(0.07, 0.006, 4, 12, Math.PI), '#5a3a1a', [0.05, 0.47, 0.05], [0, 0, -Math.PI / 2]),
]);
const lancerGeo = merge([
  part(new THREE.CapsuleGeometry(0.042, 0.075, 4, 8), '#6d6f73', [0, 0.45, 0]),
  part(new THREE.SphereGeometry(0.032, 10, 8), '#d9a77c', [0.01, 0.54, 0]),
  part(new THREE.ConeGeometry(0.036, 0.09, 8), '#9a9ca0', [0.01, 0.6, 0]),
  part(cyl(0.005, 0.005, 0.6, 4), '#5a3a1a', [0.18, 0.47, 0.05], [0, 0, -Math.PI / 2 + 0.12]),
  part(new THREE.ConeGeometry(0.013, 0.05, 4), '#d0d4d8', [0.48, 0.51, 0.05], [0, 0, -Math.PI / 2 + 0.12]),
  part(box(0.05, 0.035, 0.004), '#a5221a', [0.41, 0.52, 0.05]),
]);
const horseBodies = [horseBody('#7a4a2a', '#2a1a10'), horseBody('#3a2a22', '#120c08'), horseBody('#b08a5a', '#4a3020'), horseBody('#5a3a28', '#1a120c')];

// ---------- люди (рост ≈0.36) ----------
const humanLeg = (color: string) => {
  const g = box(0.04, 0.15, 0.045);
  g.translate(0, -0.075, 0);
  return part(g, color);
};
const ninjaBody = merge([
  part(box(0.09, 0.15, 0.11), '#1d2233', [0, 0.23, 0]),
  part(box(0.075, 0.08, 0.08), '#1d2233', [0.005, 0.35, 0]),
  part(box(0.078, 0.018, 0.082), '#b3241b', [0.005, 0.365, 0]), // повязка
  part(box(0.02, 0.018, 0.04), '#e8d7c0', [0.044, 0.35, 0]), // прорезь для глаз
  part(box(0.012, 0.22, 0.012), '#2a2a2a', [-0.05, 0.27, 0], [0.6, 0, 0.5]), // катана за спиной
]);
const ninjaLeg = humanLeg('#161a28');
const samuraiBody = merge([
  part(box(0.1, 0.16, 0.13), '#8f1d16', [0, 0.24, 0]),
  part(box(0.11, 0.05, 0.15), '#2a1a14', [0, 0.17, 0]), // кусадзури
  part(box(0.065, 0.065, 0.065), '#d9a77c', [0.005, 0.36, 0]),
  part(cyl(0.055, 0.06, 0.04, 8), '#1e1e22', [0.005, 0.405, 0]), // кабуто
  part(box(0.012, 0.05, 0.08), '#d9b24a', [0.035, 0.44, 0], [0, 0, -0.3]), // кувагата
  part(cyl(0.005, 0.005, 0.32, 4), '#3a2a1a', [-0.06, 0.42, 0]), // древко сасимоно
  part(box(0.006, 0.12, 0.07), '#f2ede2', [-0.06, 0.52, 0.035]),
]);
const samuraiLeg = humanLeg('#2a1a14');
const katanaGeo = (() => {
  const g = merge([part(box(0.012, 0.26, 0.006), '#e8ecf0', [0, 0.13, 0]), part(box(0.02, 0.06, 0.012), '#1a1a1a', [0, -0.02, 0])]);
  return g;
})();

// ---------- снаряды ----------
const arrowGeo = merge([part(cyl(0.004, 0.004, 0.2, 4), '#4a3220', [0, 0, 0], [0, 0, Math.PI / 2]), part(new THREE.ConeGeometry(0.01, 0.03, 4), '#bbbbbb', [0.11, 0, 0], [0, 0, -Math.PI / 2])]);
const shurikenGeo = (() => {
  const sh = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 0.012 : 0.045;
    const a = (i / 8) * Math.PI * 2;
    if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return part(g, '#c9ced6');
})();
const slashGeo = new THREE.RingGeometry(0.22, 0.27, 20, 1, 0, Math.PI * 0.9);

// ---------- общая система вспышек (огонь / пыль / дым / искры) ----------
type BurstKind = 'fire' | 'dust' | 'smoke' | 'spark';
interface Burst {
  t: number;
  x: number;
  z: number;
  kind: BurstKind;
  size?: number;
}
const PER = 5;
const BURST_COLOR: Record<BurstKind, string> = { fire: '#ffffff', dust: '#b59a72', smoke: '#2a2830', spark: '#fff2c0' };

function Bursts({ list, y, clock0 }: { list: Burst[]; y: number; clock0: React.MutableRefObject<number | null> }) {
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const mats = useMemo(
    () =>
      list.flatMap((b) =>
        Array.from({ length: PER }, () =>
          new THREE.SpriteMaterial({
            map: b.kind === 'fire' || b.kind === 'spark' ? fireT() : puff(),
            color: BURST_COLOR[b.kind],
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: b.kind === 'fire' || b.kind === 'spark' ? THREE.AdditiveBlending : THREE.NormalBlending,
            toneMapped: false,
          }),
        ),
      ),
    [list],
  );
  useFrame(({ clock }) => {
    if (clock0.current === null) return;
    const t = clock.elapsedTime - clock0.current;
    list.forEach((b, bi) => {
      const life = b.kind === 'smoke' ? 1.6 : b.kind === 'dust' ? 1.2 : b.kind === 'spark' ? 0.35 : 0.9;
      for (let q = 0; q < PER; q++) {
        const sp = sprites.current[bi * PER + q];
        if (!sp) continue;
        const m = sp.material as THREE.SpriteMaterial;
        const tb = t - b.t - q * 0.03;
        if (tb < 0 || tb > life) {
          m.opacity = 0;
          continue;
        }
        const k = tb / life;
        const ang = (q / PER) * Math.PI * 2 + bi;
        const spread = (b.kind === 'spark' ? 0.25 : 0.18) * (b.size ?? 1);
        const rise = b.kind === 'smoke' ? 0.7 : b.kind === 'fire' ? 0.45 : b.kind === 'dust' ? 0.15 : 0.05;
        sp.position.set(b.x + Math.cos(ang) * k * spread, y + 0.08 + k * rise, b.z + Math.sin(ang) * k * spread);
        const sc = (b.kind === 'spark' ? 0.08 + k * 0.1 : 0.16 + k * 0.32) * (b.size ?? 1);
        sp.scale.set(sc, sc, sc);
        m.opacity = (1 - k) * (b.kind === 'smoke' ? 0.85 : b.kind === 'dust' ? 0.7 : 1);
        if (b.kind === 'fire') m.color.setRGB(1, Math.max(0.4, 1 - k), Math.max(0.25, 1 - k * 1.5));
      }
    });
  });
  return (
    <>
      {mats.map((m, i) => (
        <sprite key={i} ref={(el) => (sprites.current[i] = el)} material={m} renderOrder={12} />
      ))}
    </>
  );
}

/** Поворот к направлению движения (модели смотрят вдоль +X). */
function face(o: THREE.Object3D, dx: number, dz: number) {
  if (Math.abs(dx) + Math.abs(dz) > 1e-5) o.rotation.y = Math.atan2(-dz, dx);
}

/** Направление «с острова к цели» (карта центрирована в начале координат). */
function inwardDir(x: number, z: number) {
  const v = new V(x, 0, z);
  return v.lengthSq() < 0.5 ? new V(1, 0, -0.55).normalize() : v.normalize();
}

// =====================================================================
// Конница Чингисхана
// =====================================================================

function Riders({ ev, charge }: { ev: Attack3DEvent; charge: boolean }) {
  const [x, y, z] = ev.at;
  const N = charge ? 4 : 5;
  const T = charge ? 5.2 : 6.5;
  const t0 = useRef<number | null>(null);
  const units = useRef<(THREE.Group | null)[]>([]);
  const legs = useRef<(THREE.Object3D | null)[]>([]);
  const arrows = useRef<(THREE.Object3D | null)[]>([]);
  const dir = useMemo(() => inwardDir(x, z), [x, z]);
  const side = useMemo(() => new V(-dir.z, 0, dir.x), [dir]);
  // Стрелы: каждый лучник даёт два залпа во время кружения
  const shots = useMemo(
    () =>
      charge
        ? []
        : Array.from({ length: N * 2 }, (_, j) => ({ rider: j % N, t: 2.6 + (j % N) * 0.18 + Math.floor(j / N) * 0.9, dx: (Math.sin(j * 7.1) * 0.35), dz: Math.cos(j * 3.7) * 0.35 })),
    [charge, N],
  );
  const bursts = useMemo<Burst[]>(() => {
    if (charge) {
      return [
        { t: 2.35, x, z, kind: 'dust', size: 2.2 },
        { t: 2.4, x: x + 0.15, z: z - 0.1, kind: 'spark', size: 1.6 },
        { t: 2.5, x: x - 0.12, z: z + 0.12, kind: 'dust', size: 1.8 },
        { t: 2.6, x, z, kind: 'smoke', size: 1.4 },
      ];
    }
    return shots.flatMap((s) => [
      { t: s.t + 0.55, x: x + s.dx, z: z + s.dz, kind: 'fire' as const },
      { t: s.t + 0.75, x: x + s.dx, z: z + s.dz, kind: 'smoke' as const, size: 0.8 },
    ]);
  }, [charge, shots, x, z]);
  const prev = useRef<THREE.Vector3[]>(Array.from({ length: N }, () => new V()));

  const posAt = (i: number, t: number, out: THREE.Vector3) => {
    if (charge) {
      // клин: заходят изнутри острова, таранят лагерь в 2.4 с и проносятся насквозь
      const lane = (i - (N - 1) / 2) * 0.32;
      const back = Math.abs(lane) * 0.6;
      const s = -4 + (t / 2.4) * 4 - back; // 0 — точка удара
      const ss = t < 2.4 ? s : -back + (t - 2.4) * 2.2;
      out.set(x + dir.x * ss + side.x * lane, y, z + dir.z * ss + side.z * lane);
      return;
    }
    const R = 1.15;
    const th0 = Math.atan2(-dir.z, -dir.x) + (i - (N - 1) / 2) * 0.45; // вход со стороны острова
    if (t < 2.2) {
      const u = ease(t / 2.2);
      const sx = x - dir.x * 4.4 + side.x * (i - 2) * 0.4;
      const sz = z - dir.z * 4.4 + side.z * (i - 2) * 0.4;
      const ex = x + Math.cos(th0) * R;
      const ez = z + Math.sin(th0) * R;
      out.set(sx + (ex - sx) * u, y, sz + (ez - sz) * u);
    } else if (t < 4.8) {
      const th = th0 + (t - 2.2) * 1.5;
      out.set(x + Math.cos(th) * R, y, z + Math.sin(th) * R);
    } else {
      const th = th0 + 2.6 * 1.5;
      const r = R + (t - 4.8) * 2.6;
      out.set(x + Math.cos(th) * r, y, z + Math.sin(th) * r);
    }
  };

  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = clock.elapsedTime - t0.current;
    const p = new V();
    for (let i = 0; i < N; i++) {
      const g = units.current[i];
      if (!g) continue;
      posAt(i, t, p);
      const pv = prev.current[i];
      face(g, p.x - pv.x, p.z - pv.z);
      pv.copy(p);
      const gal = t * 13 + i * 1.3;
      g.position.set(p.x, p.y + Math.abs(Math.sin(gal)) * 0.035, p.z);
      g.rotation.z = Math.sin(gal) * 0.06;
      const fade = clamp01((T - t) / 0.5) * clamp01(t / 0.3);
      g.scale.setScalar(Math.max(0.001, fade) * KR);
      for (let l = 0; l < 4; l++) {
        const leg = legs.current[i * 4 + l];
        if (leg) leg.rotation.z = Math.sin(gal + (l < 2 ? 0 : Math.PI) + (l % 2) * 0.5) * 0.7;
      }
    }
    shots.forEach((s, j) => {
      const a = arrows.current[j];
      if (!a) return;
      const ts = t - s.t;
      a.visible = ts > 0 && ts < 0.55;
      if (!a.visible) return;
      const k = ts / 0.55;
      posAt(s.rider, s.t, p);
      const tx = x + s.dx;
      const tz = z + s.dz;
      const ax = p.x + (tx - p.x) * k;
      const az = p.z + (tz - p.z) * k;
      const ay = y + 0.55 + Math.sin(k * Math.PI) * 0.5 - k * 0.5;
      a.position.set(ax, ay, az);
      a.rotation.set(0, Math.atan2(-(tz - p.z), tx - p.x), (k < 0.5 ? 0.6 : -0.8) * (1 - Math.abs(k - 0.5)));
    });
  });

  return (
    <group>
      {Array.from({ length: N }, (_, i) => (
        <group key={i} ref={(el) => (units.current[i] = el)} scale={0.001}>
          <mesh geometry={horseBodies[i % horseBodies.length]} material={mat} castShadow />
          {LEGS.map((lp, l) => (
            <mesh key={l} ref={(el) => (legs.current[i * 4 + l] = el)} geometry={legGeo} material={mat} position={lp} />
          ))}
          <mesh geometry={charge ? lancerGeo : archerGeo} material={mat} castShadow />
        </group>
      ))}
      {shots.map((_, j) => (
        <group key={j} ref={(el) => (arrows.current[j] = el)} visible={false} scale={1.4}>
          <mesh geometry={arrowGeo} material={mat} />
          <sprite position={[0.1, 0, 0]} scale={[0.09, 0.09, 0.09]}>
            <spriteMaterial map={fireT()} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
        </group>
      ))}
      <Bursts list={bursts} y={y} clock0={t0} />
    </group>
  );
}

// =====================================================================
// Ниндзя
// =====================================================================

function Ninjas({ ev }: { ev: Attack3DEvent }) {
  const [x, y, z] = ev.at;
  const N = 4;
  const t0 = useRef<number | null>(null);
  const units = useRef<(THREE.Group | null)[]>([]);
  const legs = useRef<(THREE.Object3D | null)[]>([]);
  const stars = useRef<(THREE.Object3D | null)[]>([]);
  const base = useMemo(() => Math.atan2(-z, -x), [x, z]);
  const spot = (i: number, r: number) => {
    const a = base + (i - (N - 1) / 2) * 0.85;
    return [x + Math.cos(a) * r, z + Math.sin(a) * r] as const;
  };
  const appear = (i: number) => 0.2 + i * 0.22;
  const land = (i: number) => appear(i) + 1.1;
  const throws = useMemo(() => Array.from({ length: N * 2 }, (_, j) => ({ n: j % N, t: 2.0 + (j % N) * 0.2 + Math.floor(j / N) * 0.7, dx: Math.sin(j * 5.3) * 0.3, dz: Math.cos(j * 2.9) * 0.3 })), []);
  const bursts = useMemo<Burst[]>(
    () => [
      ...Array.from({ length: N }, (_, i) => ({ t: appear(i), x: spot(i, 2.4)[0], z: spot(i, 2.4)[1], kind: 'smoke' as const, size: 1.3 })),
      ...throws.map((s) => ({ t: s.t + 0.4, x: x + s.dx, z: z + s.dz, kind: 'spark' as const })),
      ...Array.from({ length: N }, (_, i) => ({ t: 4.3 + i * 0.12, x: spot(i, 1.05)[0], z: spot(i, 1.05)[1], kind: 'smoke' as const, size: 1.6 })),
    ],
    [x, z, throws], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = clock.elapsedTime - t0.current;
    for (let i = 0; i < N; i++) {
      const g = units.current[i];
      if (!g) continue;
      const [sx, sz] = spot(i, 2.4);
      const [ex, ez] = spot(i, 1.05);
      const a0 = appear(i);
      const k = clamp01((t - a0 - 0.2) / 0.9);
      const jump = Math.sin(k * Math.PI) * 0.9; // прыжок
      g.position.set(sx + (ex - sx) * ease(k), y + jump, sz + (ez - sz) * ease(k));
      face(g, x - g.position.x, z - g.position.z);
      g.rotation.z = k > 0 && k < 1 ? -0.5 * Math.sin(k * Math.PI) : 0; // наклон в прыжке
      const vis = t > a0 && t < 4.35 + i * 0.12;
      g.scale.setScalar((vis ? Math.min(1, (t - a0) / 0.15) : 0.001) * K);
      const crouch = t > land(i) && t < 4.3 ? 0.85 : 1;
      g.scale.y *= crouch;
      const run = k > 0 && k < 1 ? 0 : Math.sin(t * 9 + i) * 0.15;
      const l0 = legs.current[i * 2];
      const l1 = legs.current[i * 2 + 1];
      if (l0) l0.rotation.z = k > 0 && k < 1 ? 0.9 : run;
      if (l1) l1.rotation.z = k > 0 && k < 1 ? -0.6 : -run;
    }
    throws.forEach((s, j) => {
      const o = stars.current[j];
      if (!o) return;
      const ts = t - s.t;
      o.visible = ts > 0 && ts < 0.4;
      if (!o.visible) return;
      const k = ts / 0.4;
      const [px, pz] = spot(s.n, 1.05);
      o.position.set(px + (x + s.dx - px) * k, y + 0.42 - k * 0.3, pz + (z + s.dz - pz) * k);
      o.rotation.y = ts * 40;
    });
  });
  return (
    <group>
      {Array.from({ length: N }, (_, i) => (
        <group key={i} ref={(el) => (units.current[i] = el)} scale={0.001}>
          <mesh geometry={ninjaBody} material={mat} castShadow />
          <mesh ref={(el) => (legs.current[i * 2] = el)} geometry={ninjaLeg} material={mat} position={[0, 0.16, 0.03]} />
          <mesh ref={(el) => (legs.current[i * 2 + 1] = el)} geometry={ninjaLeg} material={mat} position={[0, 0.16, -0.03]} />
        </group>
      ))}
      {throws.map((_, j) => (
        <mesh key={j} ref={(el) => (stars.current[j] = el)} geometry={shurikenGeo} material={mat} visible={false} scale={K} />
      ))}
      <Bursts list={bursts} y={y} clock0={t0} />
    </group>
  );
}

// =====================================================================
// Самураи
// =====================================================================

function Samurai({ ev }: { ev: Attack3DEvent }) {
  const [x, y, z] = ev.at;
  const N = 3;
  const t0 = useRef<number | null>(null);
  const units = useRef<(THREE.Group | null)[]>([]);
  const legs = useRef<(THREE.Object3D | null)[]>([]);
  const blades = useRef<(THREE.Object3D | null)[]>([]);
  const slashes = useRef<(THREE.Mesh | null)[]>([]);
  const dir = useMemo(() => inwardDir(x, z), [x, z]);
  const side = useMemo(() => new V(-dir.z, 0, dir.x), [dir]);
  const CUT = [2.2, 2.6, 3.0, 3.5];
  const slashMats = useMemo(() => CUT.map(() => new THREE.MeshBasicMaterial({ color: '#f4f8ff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })), []); // eslint-disable-line react-hooks/exhaustive-deps
  const bursts = useMemo<Burst[]>(
    () => [...CUT.map((c, i): Burst => ({ t: c + 0.05, x: x + Math.sin(i * 2) * 0.2, z: z + Math.cos(i * 2) * 0.2, kind: 'spark', size: 1.4 })), { t: 3.6, x, z, kind: 'dust', size: 2 }],
    [x, z], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const stop = (i: number) => {
    const lane = (i - 1) * 0.45;
    return [x - dir.x * (0.7 + Math.abs(lane) * 0.2) + side.x * lane, z - dir.z * (0.7 + Math.abs(lane) * 0.2) + side.z * lane] as const;
  };
  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = clock.elapsedTime - t0.current;
    for (let i = 0; i < N; i++) {
      const g = units.current[i];
      if (!g) continue;
      const [ex, ez] = stop(i);
      const k = ease(clamp01((t - i * 0.15) / 1.9));
      const sx = ex - dir.x * 3.4;
      const sz = ez - dir.z * 3.4;
      const away = clamp01((t - 4.1) / 1);
      g.position.set(sx + (ex - sx) * k - dir.x * away * 2.5, y, sz + (ez - sz) * k - dir.z * away * 2.5);
      if (away > 0) face(g, -dir.x, -dir.z);
      else face(g, x - g.position.x, z - g.position.z);
      g.scale.setScalar(Math.max(0.001, clamp01(t / 0.3) * (1 - away)) * K);
      const running = (k > 0 && k < 1) || away > 0;
      const sw = running ? Math.sin(t * 14 + i) * 0.7 : 0;
      const l0 = legs.current[i * 2];
      const l1 = legs.current[i * 2 + 1];
      if (l0) l0.rotation.z = sw;
      if (l1) l1.rotation.z = -sw;
      const b = blades.current[i];
      if (b) {
        // замах над головой и удар вниз в такт порезам
        const c = CUT.find((ct) => t > ct - 0.35 && t < ct + 0.2);
        const ph = c === undefined ? -1 : (t - (c - 0.35)) / 0.55;
        b.rotation.z = ph < 0 ? -0.6 : ph < 0.6 ? 0.8 + ph * 1.2 : 1.5 - (ph - 0.6) * 6;
      }
    }
    CUT.forEach((c, j) => {
      const s = slashes.current[j];
      if (!s) return;
      const ts = t - c;
      const m = slashMats[j];
      m.opacity = ts > 0 && ts < 0.3 ? 1 - ts / 0.3 : 0;
      s.visible = m.opacity > 0;
      s.position.set(x + Math.sin(j * 2) * 0.15, y + 0.38, z + Math.cos(j * 2) * 0.15);
      s.rotation.set(-Math.PI / 2 + 0.6 * (j % 2 ? 1 : -1), 0, j * 1.3 + ts * 4);
      s.scale.setScalar(1 + ts * 1.5);
    });
  });
  return (
    <group>
      {Array.from({ length: N }, (_, i) => (
        <group key={i} ref={(el) => (units.current[i] = el)} scale={0.001}>
          <mesh geometry={samuraiBody} material={mat} castShadow />
          <mesh ref={(el) => (legs.current[i * 2] = el)} geometry={samuraiLeg} material={mat} position={[0, 0.16, 0.035]} />
          <mesh ref={(el) => (legs.current[i * 2 + 1] = el)} geometry={samuraiLeg} material={mat} position={[0, 0.16, -0.035]} />
          <group ref={(el) => (blades.current[i] = el)} position={[0.04, 0.27, 0.07]}>
            <mesh geometry={katanaGeo} material={mat} />
          </group>
        </group>
      ))}
      {CUT.map((_, j) => (
        <mesh key={j} ref={(el) => (slashes.current[j] = el)} geometry={slashGeo} material={slashMats[j]} visible={false} renderOrder={13} />
      ))}
      <Bursts list={bursts} y={y} clock0={t0} />
    </group>
  );
}

/** Отряд эпохи для атаки на гекс (genghis / japan); ВОВ рисуют Raid3D и Tanks3D. */
export function Warriors3D({ ev }: { ev: Attack3DEvent }) {
  if (ev.era === 'japan') return ev.kind === 'robber' ? <Ninjas ev={ev} /> : <Samurai ev={ev} />;
  return <Riders ev={ev} charge={ev.kind === 'knight'} />;
}
