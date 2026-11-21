// Налёт над 3D-картой (ВОВ): звено из пяти низкополигональных бомбардировщиков заходит на гекс-цель,
// сбрасывает серию бомб, на гексе — огненные облака, вспышки света, обломки и столб дыма. ~5 с.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { box, merge, part } from './Terrain';
import { FLAMES, fireT, puff } from './units';

export interface Raid3DEvent {
  key: number;
  /** Мировая позиция цели (x, y верха плитки, z). */
  at: [number, number, number];
}

// ---------- бомбардировщик (вдоль +X) ----------
const cyl = (rt: number, rb: number, h: number, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
export const planeGeo = merge([
  part(cyl(0.075, 0.06, 1.15, 8), '#5b6b3a', [0, 0, 0], [0, 0, Math.PI / 2]),
  part(new THREE.ConeGeometry(0.075, 0.22, 8), '#4b5a2f', [0.68, 0, 0], [0, 0, -Math.PI / 2]),
  part(new THREE.SphereGeometry(0.06, 8, 6), '#9fc7d8', [0.55, 0.05, 0]),
  part(box(0.2, 0.025, 1.25), '#61723f', [0.08, 0, 0]),
  part(cyl(0.05, 0.05, 0.22, 8), '#3d4826', [0.2, -0.02, 0.32], [0, 0, Math.PI / 2]),
  part(cyl(0.05, 0.05, 0.22, 8), '#3d4826', [0.2, -0.02, -0.32], [0, 0, Math.PI / 2]),
  part(box(0.02, 0.16, 0.02), '#2b2b2b', [0.32, -0.02, 0.32]),
  part(box(0.02, 0.16, 0.02), '#2b2b2b', [0.32, -0.02, -0.32]),
  part(box(0.12, 0.018, 0.42), '#56663a', [-0.52, 0.02, 0]),
  part(box(0.14, 0.16, 0.02), '#56663a', [-0.52, 0.1, 0]),
]);
export const planeMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7, metalness: 0.1 });
const shadowGeo = new THREE.CircleGeometry(0.75, 16);
shadowGeo.rotateX(-Math.PI / 2);
shadowGeo.scale(1.4, 1, 0.8);
const shadowMat = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false });
const bombGeo = new THREE.CapsuleGeometry(0.04, 0.1, 4, 8);
bombGeo.rotateZ(Math.PI / 2);
const bombMat = new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.4 });
const debrisGeo = new THREE.BoxGeometry(0.05, 0.04, 0.06);
const debrisMat = new THREE.MeshStandardMaterial({ color: '#1c1612', roughness: 1 });

const FORMATION: [number, number][] = [
  [0, 0],
  [-1.3, 1.45],
  [-1.3, -1.45],
  [-2.6, 2.9],
  [-2.6, -2.9],
];
const T = 4.8;
const PASS = 0.42;
const DROP = 0.6;
/** Точки попаданий относительно центра гекса (dx, dz, задержка). */
const HITS: [number, number, number][] = [
  [-0.25, 0.15, 0],
  [0.2, -0.2, 0.18],
  [0.05, 0.3, 0.36],
  [-0.1, -0.05, 0.54],
];

export function Raid3D({ ev }: { ev: Raid3DEvent }) {
  const t0 = useRef<number | null>(null);
  const planes = useRef<(THREE.Object3D | null)[]>([]);
  const shadows = useRef<(THREE.Object3D | null)[]>([]);
  const bombs = useRef<(THREE.Object3D | null)[]>([]);
  const flames = useRef<(THREE.Sprite | null)[]>([]);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const debris = useRef<(THREE.Object3D | null)[]>([]);
  const puffs = useRef<(THREE.Sprite | null)[]>([]);
  const [x, y, z] = ev.at;
  const dir = useMemo(() => new THREE.Vector3(1, 0, -0.4).normalize(), []);
  const side = useMemo(() => new THREE.Vector3(-dir.z, 0, dir.x), [dir]);
  const ALT = 3;
  const SPAN = 12;
  const flameMats = useMemo(
    () => Array.from({ length: HITS.length * FLAMES }, () => new THREE.SpriteMaterial({ map: fireT(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })),
    [ev.key],
  );
  const smokeMats = useMemo(
    () => Array.from({ length: 14 }, () => new THREE.SpriteMaterial({ map: puff(), color: '#1c1918', transparent: true, depthWrite: false, opacity: 0 })),
    [ev.key],
  );
  const debrisDirs = useMemo(
    () => Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * Math.PI * 2 + Math.random() * 0.4;
      return { h: i % HITS.length, vx: Math.cos(a) * (0.8 + Math.random()), vz: Math.sin(a) * (0.8 + Math.random()), vy: 1.6 + Math.random() * 1.8, r: Math.random() * 6 };
    }),
    [ev.key],
  );

  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = clock.elapsedTime - t0.current;
    const u = Math.min(1, t / T);
    // заход со снижением, над целью ниже всего, уход с набором высоты
    const along = (u - PASS) * SPAN * 2;
    const dive = Math.abs(u - PASS) * 2.2;
    FORMATION.forEach(([b, s], i) => {
      const p = planes.current[i];
      const sh = shadows.current[i];
      const px = x + dir.x * (along + b) + side.x * s;
      const pz = z + dir.z * (along + b) + side.z * s;
      const py = y + ALT + dive + Math.sin(t * 2 + i) * 0.05;
      if (p) {
        p.position.set(px, py, pz);
        p.rotation.set(Math.sin(t * 1.5 + i) * 0.06, Math.atan2(-dir.z, dir.x), (u < PASS ? -0.12 : 0.1) * Math.min(1, Math.abs(u - PASS) * 4));
        p.visible = u < 1;
      }
      if (sh) {
        sh.position.set(px, y + 0.03, pz);
        sh.visible = u < 1;
      }
    });
    // серия бомб от ведущих
    const tRelease = PASS * T - 0.35;
    bombs.current.forEach((b, i) => {
      if (!b) return;
      const hit = HITS[i % HITS.length];
      const tb = t - tRelease - hit[2];
      if (tb < 0 || tb > DROP) {
        b.visible = false;
        return;
      }
      b.visible = true;
      const k = tb / DROP;
      b.position.set(x + hit[0] - dir.x * (1 - k) * 0.9, y + (ALT + 0.2) * (1 - k * k), z + hit[1] - dir.z * (1 - k) * 0.9);
      b.rotation.set(0, Math.atan2(-dir.z, dir.x), -k * 1.3);
    });
    // взрывы: огненные облака
    HITS.forEach((hit, hi) => {
      const te = t - (tRelease + hit[2] + DROP);
      for (let j = 0; j < FLAMES; j++) {
        const f = flames.current[hi * FLAMES + j];
        if (!f) continue;
        const tf = te - j * 0.03;
        const m = f.material as THREE.SpriteMaterial;
        if (tf < 0 || tf > 1.3) {
          m.opacity = 0;
          continue;
        }
        const k = Math.min(1, tf / 1.3);
        const ang = (j / FLAMES) * Math.PI * 2;
        f.position.set(x + hit[0] + Math.cos(ang) * k * 0.35, y + 0.15 + k * 0.9, z + hit[1] + Math.sin(ang) * k * 0.35);
        const sc = (0.45 + Math.min(1, tf / 0.15) * 0.95 + k * 0.7) * (j === 0 ? 1.4 : 1);
        f.scale.set(sc, sc, sc);
        m.opacity = Math.max(0, 1 - k * 1.05);
        m.color.setRGB(1, Math.max(0.35, 1 - k * 0.9), Math.max(0.25, 1 - k * 1.4));
      }
      const l = lights.current[hi];
      if (l) {
        l.position.set(x + hit[0], y + 0.6, z + hit[1]);
        l.intensity = te > 0 ? Math.max(0, 14 * (1 - te / 0.6)) : 0;
      }
    });
    debris.current.forEach((d, i) => {
      if (!d) return;
      const v = debrisDirs[i];
      const hit = HITS[v.h];
      const te = t - (tRelease + hit[2] + DROP);
      d.visible = te > 0 && te < 1.3;
      if (!d.visible) return;
      d.position.set(x + hit[0] + v.vx * te * 0.6, Math.max(y + 0.02, y + 0.15 + v.vy * te * 0.7 - 3.5 * te * te), z + hit[1] + v.vz * te * 0.6);
      d.rotation.set(v.r + te * 8, v.r * 2 + te * 6, 0);
    });
    puffs.current.forEach((p, i) => {
      if (!p) return;
      const hit = HITS[i % HITS.length];
      const tp = t - (tRelease + hit[2] + DROP) - 0.2 - Math.floor(i / HITS.length) * 0.2;
      const m = p.material as THREE.SpriteMaterial;
      if (tp < 0) {
        m.opacity = 0;
        return;
      }
      const k = Math.min(1, tp / 2.4);
      p.position.set(x + hit[0] + Math.sin(i * 2.3) * 0.2, y + 0.4 + k * 2.4, z + hit[1] + Math.cos(i * 1.7) * 0.2);
      const s = 0.5 + k * 1.9;
      p.scale.set(s, s, s);
      m.opacity = Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.85;
    });
  });

  return (
    <group>
      {FORMATION.map((_, i) => (
        <group key={`p${i}`}>
          <mesh ref={(el) => (planes.current[i] = el)} geometry={planeGeo} material={planeMat} castShadow scale={1.85} />
          <mesh ref={(el) => (shadows.current[i] = el)} geometry={shadowGeo} material={shadowMat} renderOrder={4} />
        </group>
      ))}
      {Array.from({ length: HITS.length * 2 }, (_, i) => (
        <mesh key={`b${i}`} ref={(el) => (bombs.current[i] = el)} geometry={bombGeo} material={bombMat} visible={false} />
      ))}
      {flameMats.map((m, i) => (
        <sprite key={`f${i}`} ref={(el) => (flames.current[i] = el)} material={m} renderOrder={12} />
      ))}
      {HITS.map((_, i) => (
        <pointLight key={`l${i}`} ref={(el) => (lights.current[i] = el)} color="#ff8a2a" distance={5} intensity={0} />
      ))}
      {debrisDirs.map((_, i) => (
        <mesh key={`d${i}`} ref={(el) => (debris.current[i] = el)} geometry={debrisGeo} material={debrisMat} visible={false} />
      ))}
      {smokeMats.map((m, i) => (
        <sprite key={`s${i}`} ref={(el) => (puffs.current[i] = el)} material={m} />
      ))}
    </group>
  );
}
