// Атмосфера большого экрана (ноутбук → телевизор): облака плывут над островом,
// стаи птиц кружат, по морю бегут блики. Теней от облаков нет — на воде они читались как грязные пятна. На телефоне не рисуется (только hifi).

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { part } from './Terrain';
import { puff } from './units';
import { useEnv } from './rig';

const CLOUDS = 9;
const FLOCKS = 3;
const BIRDS = 6;
const GLINTS = 24;

// Птица — силуэт чайки: тонкое тельце и два узких серповидных крыла (крылья машут отдельно)
const birdBody = part(new THREE.CapsuleGeometry(0.008, 0.045, 3, 6).rotateZ(Math.PI / 2), '#e9edf0');
const wingGeo = (() => {
  const sh = new THREE.Shape();
  sh.moveTo(0.012, 0);
  sh.quadraticCurveTo(0.02, 0.06, -0.02, 0.11); // передний край — дугой к кончику
  sh.quadraticCurveTo(-0.012, 0.05, -0.018, 0);
  sh.closePath();
  const g = new THREE.ShapeGeometry(sh);
  g.rotateX(-Math.PI / 2); // плоскость крыла — горизонтально, кончик в сторону +Z
  return g;
})();
const birdMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
const wingMat = new THREE.MeshStandardMaterial({ color: '#e4e8ec', roughness: 0.8, side: THREE.DoubleSide });

export function Atmosphere({ radius }: { radius: number }) {
  const { reduced } = useEnv();
  const clouds = useRef<(THREE.Sprite | null)[]>([]);
  const birds = useRef<(THREE.Group | null)[]>([]);
  const wingsL = useRef<(THREE.Mesh | null)[]>([]);
  const wingsR = useRef<(THREE.Mesh | null)[]>([]);
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
        const back = row * 0.18;
        const off = b === 0 ? 0 : side * row * 0.14;
        const hx = Math.cos(heading);
        const hz = -Math.sin(heading);
        m.position.set(cx - hx * back - hz * off, 3.2 + f * 0.5 + Math.sin(t * 2 + b) * 0.05, cz - hz * back + hx * off);
        m.rotation.set(0, heading, 0);
        // взмахи с паузами-планированием
        const flap = Math.sin(t * 7 + b * 0.9) * (0.25 + 0.35 * Math.max(0, Math.sin(t * 0.8 + b)));
        const l = wingsL.current[f * BIRDS + b];
        const r = wingsR.current[f * BIRDS + b];
        if (l) l.rotation.x = -flap;
        if (r) r.rotation.x = flap;
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
        <sprite key={i} ref={(el) => (clouds.current[i] = el)} material={cloudMats[i]} renderOrder={20} />
      ))}
      {Array.from({ length: FLOCKS * BIRDS }, (_, i) => (
        <group key={i} ref={(el) => (birds.current[i] = el)}>
          <mesh geometry={birdBody} material={birdMat} />
          <mesh ref={(el) => (wingsL.current[i] = el)} geometry={wingGeo} material={wingMat} />
          <mesh ref={(el) => (wingsR.current[i] = el)} geometry={wingGeo} material={wingMat} scale={[1, 1, -1]} />
        </group>
      ))}
      {glintPos.map((g, i) => (
        <sprite key={i} ref={(el) => (glints.current[i] = el)} material={glintMats[i]} position={[g.x, 0.08, g.z]} />
      ))}
    </group>
  );
}
