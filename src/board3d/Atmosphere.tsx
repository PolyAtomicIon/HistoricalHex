// Атмосфера большого экрана (ноутбук → телевизор): облака плывут над островом и бросают
// мягкие тени, стаи птиц кружат, по морю бегут блики. На телефоне не рисуется (только hifi).

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { box, merge, part } from './Terrain';
import { puff } from './units';
import { useEnv } from './rig';

const CLOUDS = 9;
const FLOCKS = 3;
const BIRDS = 6;
const GLINTS = 24;

const birdGeo = merge([
  part(box(0.05, 0.012, 0.16), '#2a2a2e', [0, 0, 0.07], [0.25, 0, 0]),
  part(box(0.05, 0.012, 0.16), '#2a2a2e', [0, 0, -0.07], [-0.25, 0, 0]),
  part(box(0.08, 0.02, 0.03), '#2a2a2e', [0.01, -0.005, 0]),
]);
const birdMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
const shadowGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);

export function Atmosphere({ radius }: { radius: number }) {
  const { reduced } = useEnv();
  const clouds = useRef<(THREE.Sprite | null)[]>([]);
  const shadows = useRef<(THREE.Mesh | null)[]>([]);
  const birds = useRef<(THREE.Mesh | null)[]>([]);
  const glints = useRef<(THREE.Sprite | null)[]>([]);
  const R = radius + 3;
  const seeds = useMemo(
    () =>
      Array.from({ length: CLOUDS }, (_, i) => ({
        x: (Math.sin(i * 12.9) * 0.5 + 0.5) * R * 2 - R,
        z: (Math.cos(i * 7.3) * 0.5 + 0.5) * R * 2 - R,
        y: 6.5 + (i % 3) * 0.9,
        s: 3.2 + (i % 4) * 0.9,
        v: 0.18 + (i % 3) * 0.06,
      })),
    [R],
  );
  const cloudMats = useMemo(() => seeds.map(() => new THREE.SpriteMaterial({ map: puff(), color: '#ffffff', transparent: true, opacity: 0.32, depthWrite: false, fog: false })), [seeds]);
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.09, depthWrite: false, depthTest: false }), []);
  const glintMats = useMemo(() => Array.from({ length: GLINTS }, () => new THREE.SpriteMaterial({ map: puff(), color: '#e8f6ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })), []);
  const glintPos = useMemo(
    () =>
      Array.from({ length: GLINTS }, (_, i) => {
        const a = (i / GLINTS) * Math.PI * 2 + Math.sin(i * 3.1);
        const r = radius + 0.8 + (Math.sin(i * 5.7) * 0.5 + 0.5) * 3.5;
        return { x: Math.cos(a) * r, z: Math.sin(a) * r, ph: i * 1.7 };
      }),
    [radius],
  );

  useFrame(({ clock }) => {
    const t = reduced ? 0 : clock.elapsedTime;
    seeds.forEach((c, i) => {
      // ветер: облака идут по диагонали и возвращаются с другой стороны
      const span = R * 2 + 8;
      const x = ((c.x + t * c.v + R + 4) % span) - R - 4;
      const z = c.z + Math.sin(t * 0.05 + i) * 0.6;
      const sp = clouds.current[i];
      if (sp) {
        sp.position.set(x, c.y, z);
        sp.scale.set(c.s * 1.6, c.s * 0.8, 1);
      }
      const sh = shadows.current[i];
      if (sh) {
        sh.position.set(x + 1.2, 0.7, z + 0.8);
        sh.scale.set(c.s * 0.55, 1, c.s * 0.35);
      }
    });
    for (let f = 0; f < FLOCKS; f++) {
      const rr = radius * (0.5 + f * 0.22);
      const w = 0.22 + f * 0.05;
      const cx = Math.cos(t * w + f * 2.1) * rr;
      const cz = Math.sin(t * w + f * 2.1) * rr;
      const heading = Math.atan2(-Math.cos(t * w + f * 2.1), -Math.sin(t * w + f * 2.1));
      for (let b = 0; b < BIRDS; b++) {
        const m = birds.current[f * BIRDS + b];
        if (!m) continue;
        const row = Math.ceil(b / 2);
        const side = b % 2 ? 1 : -1;
        const back = row * 0.28;
        const off = b === 0 ? 0 : side * row * 0.22;
        const hx = Math.cos(heading);
        const hz = -Math.sin(heading);
        m.position.set(cx - hx * back - hz * off, 3.2 + f * 0.5 + Math.sin(t * 2 + b) * 0.05, cz - hz * back + hx * off);
        m.rotation.set(Math.sin(t * 9 + b) * 0.5, heading, 0);
      }
    }
    glintPos.forEach((g, i) => {
      const sp = glints.current[i];
      if (!sp) return;
      const k = Math.max(0, Math.sin(t * 1.3 + g.ph));
      (sp.material as THREE.SpriteMaterial).opacity = k * k * 0.7;
      sp.scale.setScalar(0.12 + k * 0.18);
    });
  });

  return (
    <group>
      {seeds.map((_, i) => (
        <group key={i}>
          <sprite ref={(el) => (clouds.current[i] = el)} material={cloudMats[i]} renderOrder={20} />
          <mesh ref={(el) => (shadows.current[i] = el)} geometry={shadowGeo} material={shadowMat} renderOrder={2} />
        </group>
      ))}
      {Array.from({ length: FLOCKS * BIRDS }, (_, i) => (
        <mesh key={i} ref={(el) => (birds.current[i] = el)} geometry={birdGeo} material={birdMat} scale={1.4} />
      ))}
      {glintPos.map((g, i) => (
        <sprite key={i} ref={(el) => (glints.current[i] = el)} material={glintMats[i]} position={[g.x, 0.08, g.z]} />
      ))}
    </group>
  );
}
