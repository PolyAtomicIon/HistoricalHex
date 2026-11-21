// «Танковая колонна» на 3D-карте (ВОВ): три танка выезжают к захваченному гексу, наводят башни,
// дают залп — дульные вспышки, трассеры, разрывы и дым на лагере. ~6.8 с.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { FLAMES, barrelGeo, fireT, puff, tankHullGeo, tankMat, turretGeo } from './units';

export interface Tanks3DEvent {
  key: number;
  at: [number, number, number];
}

const T = 6.8;
const TANKS = [
  { side: -0.9, back: 0, delay: 0 },
  { side: 0, back: 1.1, delay: 0.2 },
  { side: 0.9, back: 0.2, delay: 0.4 },
];
const SHOTS = [
  { tank: 0, t: 3.2 },
  { tank: 1, t: 3.6 },
  { tank: 2, t: 4.0 },
  { tank: 1, t: 4.7 },
  { tank: 0, t: 5.2 },
];

export function Tanks3D({ ev }: { ev: Tanks3DEvent }) {
  const t0 = useRef<number | null>(null);
  const hulls = useRef<(THREE.Object3D | null)[]>([]);
  const turrets = useRef<(THREE.Object3D | null)[]>([]);
  const muzzles = useRef<(THREE.Sprite | null)[]>([]);
  const tracers = useRef<(THREE.Mesh | null)[]>([]);
  const flames = useRef<(THREE.Sprite | null)[]>([]);
  const smokes = useRef<(THREE.Sprite | null)[]>([]);
  const [x, y, z] = ev.at;
  // заезжают со стороны центра острова (карта центрирована в начале координат), чтобы не ехать по морю
  const dir = useMemo(() => {
    const v = new THREE.Vector3(x, 0, z);
    return v.lengthSq() < 0.5 ? new THREE.Vector3(1, 0, -0.55).normalize() : v.normalize();
  }, [x, z]);
  const side = useMemo(() => new THREE.Vector3(-dir.z, 0, dir.x), [dir]);
  const yaw = Math.atan2(-dir.z, dir.x);
  const mk = (n: number, add = true) =>
    Array.from({ length: n }, () => new THREE.SpriteMaterial({ map: fireT(), transparent: true, opacity: 0, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false }));
  const muzzleMats = useMemo(() => mk(SHOTS.length), [ev.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const flameMats = useMemo(() => mk(SHOTS.length * FLAMES), [ev.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const smokeMats = useMemo(() => Array.from({ length: 10 }, () => new THREE.SpriteMaterial({ map: puff(), color: '#221e1c', transparent: true, depthWrite: false, opacity: 0 })), [ev.key]);
  const tracerMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffe08a', toneMapped: false }), []);

  const stopAt = (i: number) => {
    const k = TANKS[i];
    const dist = 2.1 + k.back;
    return [x - dir.x * dist + side.x * k.side, z - dir.z * dist + side.z * k.side] as const;
  };
  const muzzleOf = (i: number) => {
    const h = hulls.current[i];
    if (!h) return null;
    return new THREE.Vector3(h.position.x + dir.x * 0.75, h.position.y + 0.42, h.position.z + dir.z * 0.75);
  };

  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = clock.elapsedTime - t0.current;
    TANKS.forEach((k, i) => {
      const h = hulls.current[i];
      const tu = turrets.current[i];
      if (!h || !tu) return;
      const [sx, sz] = stopAt(i);
      const u = Math.min(1, Math.max(0, (t - k.delay) / 2.8));
      const e = 1 - Math.pow(1 - u, 3);
      const from = 4.2;
      const recoil = SHOTS.filter((s) => s.tank === i).reduce((a, s) => a + (t > s.t && t < s.t + 0.25 ? (1 - (t - s.t) / 0.25) * 0.12 : 0), 0);
      const back = (1 - e) * from + recoil;
      h.position.set(sx - dir.x * back, y + 0.02 + (u < 1 ? Math.sin(t * 20 + i) * 0.01 : 0), sz - dir.z * back);
      h.rotation.y = yaw;
      // башня доворачивает на цель
      const dx = x - h.position.x;
      const dz = z - h.position.z;
      const aim = Math.atan2(-dz, dx) - yaw;
      const ka = Math.min(1, Math.max(0, (t - 2.5 - i * 0.12) / 0.5));
      tu.rotation.y = aim * ka;
      h.visible = t < T;
    });
    SHOTS.forEach((s, j) => {
      const ts = t - s.t;
      const mz = muzzles.current[j];
      const m0 = muzzleOf(s.tank);
      if (mz && m0) {
        mz.position.copy(m0);
        const m = mz.material as THREE.SpriteMaterial;
        m.opacity = ts > 0 && ts < 0.15 ? 1 - ts / 0.15 : 0;
        mz.scale.setScalar(0.35 + Math.max(0, ts) * 2);
      }
      const tr = tracers.current[j];
      if (tr && m0) {
        const k = ts / 0.25;
        tr.visible = k > 0 && k < 1;
        if (tr.visible) tr.position.set(m0.x + (x - m0.x) * k, m0.y + (y + 0.25 - m0.y) * k + Math.sin(k * Math.PI) * 0.25, m0.z + (z - m0.z) * k);
      }
      for (let q = 0; q < FLAMES; q++) {
        const f = flames.current[j * FLAMES + q];
        if (!f) continue;
        const tf = ts - 0.25 - q * 0.03;
        const m = f.material as THREE.SpriteMaterial;
        if (tf < 0 || tf > 1.1) {
          m.opacity = 0;
          continue;
        }
        const k = Math.min(1, tf / 1.1);
        const ang = (q / FLAMES) * Math.PI * 2;
        f.position.set(x + Math.cos(ang + j) * k * 0.3, y + 0.2 + k * 0.8, z + Math.sin(ang + j) * k * 0.3);
        const sc = 0.3 + Math.min(1, tf / 0.12) * 0.55 + k * 0.4;
        f.scale.set(sc, sc, sc);
        m.opacity = Math.max(0, 1 - k * 1.05);
        m.color.setRGB(1, Math.max(0.35, 1 - k * 0.9), Math.max(0.25, 1 - k * 1.4));
      }
    });
    smokes.current.forEach((p, i) => {
      if (!p) return;
      const s = SHOTS[i % SHOTS.length];
      const tp = t - s.t - 0.4 - Math.floor(i / SHOTS.length) * 0.2;
      const m = p.material as THREE.SpriteMaterial;
      if (tp < 0) {
        m.opacity = 0;
        return;
      }
      const k = Math.min(1, tp / 2);
      p.position.set(x + Math.sin(i * 1.9) * 0.25, y + 0.4 + k * 1.9, z + Math.cos(i * 1.3) * 0.25);
      const sc = 0.5 + k * 1.6;
      p.scale.set(sc, sc, sc);
      m.opacity = Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.8;
    });
  });

  return (
    <group>
      {TANKS.map((_, i) => (
        <group key={i} ref={(el) => (hulls.current[i] = el)} scale={0.5}>
          <mesh geometry={tankHullGeo} material={tankMat} castShadow />
          <group ref={(el) => (turrets.current[i] = el)} position={[0.05, 0.86, 0]}>
            <mesh geometry={turretGeo} material={tankMat} castShadow />
            <mesh geometry={barrelGeo} material={tankMat} position={[0.25, 0.02, 0]} />
          </group>
        </group>
      ))}
      {SHOTS.map((_, j) => (
        <group key={j}>
          <sprite ref={(el) => (muzzles.current[j] = el)} material={muzzleMats[j]} renderOrder={12} />
          <mesh ref={(el) => (tracers.current[j] = el)} material={tracerMat} visible={false}>
            <sphereGeometry args={[0.035, 6, 6]} />
          </mesh>
          {Array.from({ length: FLAMES }, (_, q) => (
            <sprite key={q} ref={(el) => (flames.current[j * FLAMES + q] = el)} material={flameMats[j * FLAMES + q]} renderOrder={12} />
          ))}
        </group>
      ))}
      {smokeMats.map((m, i) => (
        <sprite key={i} ref={(el) => (smokes.current[i] = el)} material={m} />
      ))}
    </group>
  );
}
