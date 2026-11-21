// 3D-налёт (ВОВ): звено низкополигональных бомбардировщиков пролетает над картой, сбрасывает бомбы на гекс-цель,
// взрыв — вспышка света, огненный шар, ударная волна, обломки, дым. ~3.4 с, всё в одном useFrame.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { box, merge, part } from './Terrain';

export interface Raid3DEvent {
  key: number;
  /** Мировая позиция цели (x, y верха плитки, z). */
  at: [number, number, number];
}

// ---------- геометрия бомбардировщика (вдоль +X) ----------
const cyl = (rt: number, rb: number, h: number, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const planeGeo = (() => {
  const g = merge([
    part(cyl(0.075, 0.06, 1.15, 8), '#5b6b3a', [0, 0, 0], [0, 0, Math.PI / 2]), // фюзеляж
    part(new THREE.ConeGeometry(0.075, 0.22, 8), '#4b5a2f', [0.68, 0, 0], [0, 0, -Math.PI / 2]), // нос
    part(new THREE.SphereGeometry(0.06, 8, 6), '#9fc7d8', [0.55, 0.05, 0]), // остекление
    part(box(0.2, 0.025, 1.25), '#61723f', [0.08, 0, 0]), // крыло
    part(cyl(0.05, 0.05, 0.22, 8), '#3d4826', [0.2, -0.02, 0.32], [0, 0, Math.PI / 2]), // моторы
    part(cyl(0.05, 0.05, 0.22, 8), '#3d4826', [0.2, -0.02, -0.32], [0, 0, Math.PI / 2]),
    part(box(0.02, 0.16, 0.02), '#2b2b2b', [0.32, -0.02, 0.32]), // винты
    part(box(0.02, 0.16, 0.02), '#2b2b2b', [0.32, -0.02, -0.32]),
    part(box(0.12, 0.018, 0.42), '#56663a', [-0.52, 0.02, 0]), // стабилизатор
    part(box(0.14, 0.16, 0.02), '#56663a', [-0.52, 0.1, 0]), // киль
  ]);
  return g;
})();
const planeMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7, metalness: 0.1 });
const shadowGeo = new THREE.CircleGeometry(0.75, 16);
shadowGeo.rotateX(-Math.PI / 2);
shadowGeo.scale(1.3, 1, 0.7);
const shadowMat = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false });
const bombGeo = merge([part(new THREE.CapsuleGeometry(0.035, 0.09, 4, 8), '#2a2a2a', [0, 0, 0], [0, 0, Math.PI / 2])]);
const bombMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
const fireGeo = new THREE.IcosahedronGeometry(1, 2);
const ringGeo = new THREE.RingGeometry(0.85, 1, 40);
ringGeo.rotateX(-Math.PI / 2);
const debrisGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
const debrisMat = new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: 1 });

const FORMATION: [number, number][] = [
  [0, 0],
  [-0.75, 0.75],
  [-0.75, -0.75],
];
const T = 3.4; // длительность
const PASS = 0.42; // доля пути, когда звено над целью
const DROP = 0.55; // время падения бомб, с

let smokeTex: THREE.Texture | undefined;
function smoke(): THREE.Texture {
  if (smokeTex) return smokeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  smokeTex = new THREE.CanvasTexture(c);
  return smokeTex;
}

export function Raid3D({ ev }: { ev: Raid3DEvent }) {
  const t0 = useRef<number | null>(null);
  const planes = useRef<(THREE.Object3D | null)[]>([]);
  const shadows = useRef<(THREE.Object3D | null)[]>([]);
  const bombs = useRef<(THREE.Object3D | null)[]>([]);
  const fire = useRef<THREE.Mesh>(null);
  const fireMat = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const debris = useRef<(THREE.Object3D | null)[]>([]);
  const puffs = useRef<(THREE.Sprite | null)[]>([]);
  const [x, y, z] = ev.at;
  // Траектория: слева-сзади → над целью → вправо-вперёд, чуть по диагонали
  const dir = useMemo(() => new THREE.Vector3(1, 0, -0.35).normalize(), []);
  const side = useMemo(() => new THREE.Vector3(-dir.z, 0, dir.x), [dir]);
  const ALT = 2.3;
  const SPAN = 9;
  const debrisDirs = useMemo(
    () => Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
      return { vx: Math.cos(a) * (0.9 + Math.random()), vz: Math.sin(a) * (0.9 + Math.random()), vy: 1.6 + Math.random() * 1.6, r: Math.random() * 6 };
    }),
    [ev.key],
  );
  const smokeMats = useMemo(
    () => Array.from({ length: 8 }, () => new THREE.SpriteMaterial({ map: smoke(), color: '#2e2a28', transparent: true, depthWrite: false, opacity: 0 })),
    [ev.key],
  );

  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = clock.elapsedTime - t0.current;
    const u = Math.min(1, t / T);
    // Самолёты
    const along = (u - PASS) * SPAN * 2;
    FORMATION.forEach(([b, s], i) => {
      const p = planes.current[i];
      const sh = shadows.current[i];
      const px = x + dir.x * (along + b) + side.x * s;
      const pz = z + dir.z * (along + b) + side.z * s;
      const py = y + ALT + Math.sin(t * 2 + i) * 0.04 + (u > PASS ? (u - PASS) * 1.2 : 0);
      if (p) {
        p.position.set(px, py, pz);
        p.rotation.set(Math.sin(t * 1.5 + i) * 0.06, Math.atan2(-dir.z, dir.x), u > PASS ? 0.08 : 0);
        p.visible = u < 1;
      }
      if (sh) {
        sh.position.set(px, y + 0.02, pz);
        sh.visible = u < 1;
      }
    });
    // Бомбы: сброс над целью
    const tRelease = PASS * T - 0.15;
    bombs.current.forEach((b, i) => {
      if (!b) return;
      const tb = t - tRelease - i * 0.07;
      if (tb < 0 || tb > DROP) {
        b.visible = false;
        return;
      }
      b.visible = true;
      const k = tb / DROP;
      const ox = (i % 3 - 1) * 0.22;
      const oz = (Math.floor(i / 3) - 0.5) * 0.25;
      b.position.set(x + ox - dir.x * (1 - k) * 0.6, y + ALT * (1 - k * k), z + oz - dir.z * (1 - k) * 0.6);
      b.rotation.set(0, Math.atan2(-dir.z, dir.x), -k * 1.2);
    });
    // Взрыв
    const te = t - (tRelease + DROP);
    const boom = te > 0 && te < 1.6;
    if (fire.current && fireMat.current) {
      fire.current.visible = boom;
      if (boom) {
        const s = 0.2 + Math.min(1, te / 0.22) * 0.95 + te * 0.25;
        fire.current.scale.setScalar(s);
        fire.current.position.set(x, y + 0.25 + te * 0.3, z);
        fireMat.current.opacity = Math.max(0, 1 - te / 1.1);
        fireMat.current.color.setRGB(1, Math.max(0.25, 0.75 - te * 0.9), Math.max(0.05, 0.25 - te * 0.4));
      }
    }
    if (ring.current && ringMat.current) {
      ring.current.visible = te > 0 && te < 0.8;
      ring.current.scale.setScalar(0.2 + te * 2.2);
      ring.current.position.set(x, y + 0.04, z);
      ringMat.current.opacity = Math.max(0, 0.7 - te);
    }
    if (light.current) {
      light.current.position.set(x, y + 0.8, z);
      light.current.intensity = te > 0 ? Math.max(0, 14 * (1 - te / 0.6)) : 0;
    }
    debris.current.forEach((d, i) => {
      if (!d) return;
      const v = debrisDirs[i];
      d.visible = te > 0 && te < 1.4;
      if (!d.visible) return;
      d.position.set(x + v.vx * te, y + 0.2 + v.vy * te - 4.5 * te * te, z + v.vz * te);
      d.rotation.set(v.r + te * 8, v.r * 2 + te * 6, 0);
      if (d.position.y < y) d.position.y = y + 0.02;
    });
    puffs.current.forEach((p, i) => {
      if (!p) return;
      const tp = te - 0.15 - i * 0.12;
      const m = p.material as THREE.SpriteMaterial;
      if (tp < 0) {
        m.opacity = 0;
        return;
      }
      const k = Math.min(1, tp / 2.2);
      p.position.set(x + Math.sin(i * 2.3) * 0.35, y + 0.4 + k * 2.2, z + Math.cos(i * 1.7) * 0.3);
      const s = 0.6 + k * 1.8;
      p.scale.set(s, s, s);
      m.opacity = Math.sin(k * Math.PI) * 0.8;
    });
  });

  return (
    <group>
      {FORMATION.map((_, i) => (
        <group key={`p${i}`}>
          <mesh ref={(el) => (planes.current[i] = el)} geometry={planeGeo} material={planeMat} castShadow scale={1.6} />
          <mesh ref={(el) => (shadows.current[i] = el)} geometry={shadowGeo} material={shadowMat} renderOrder={4} />
        </group>
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={`b${i}`} ref={(el) => (bombs.current[i] = el)} geometry={bombGeo} material={bombMat} visible={false} />
      ))}
      <mesh ref={fire} geometry={fireGeo} visible={false} renderOrder={12}>
        <meshBasicMaterial ref={fireMat} color="#ff9a2a" transparent opacity={0} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ring} geometry={ringGeo} visible={false} renderOrder={11}>
        <meshBasicMaterial ref={ringMat} color="#fff0c8" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight ref={light} color="#ff9a3a" distance={6} intensity={0} />
      {debrisDirs.map((_, i) => (
        <mesh key={`d${i}`} ref={(el) => (debris.current[i] = el)} geometry={debrisGeo} material={debrisMat} visible={false} />
      ))}
      {smokeMats.map((m, i) => (
        <sprite key={`s${i}`} ref={(el) => (puffs.current[i] = el)} material={m} />
      ))}
    </group>
  );
}
