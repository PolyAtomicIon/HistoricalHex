// Лагерь захватчиков на захваченном гексе (низкополигональный, по эпохам) и купол блокады над гексом.
//   genghis — тёмная юрта налётчиков с бунчуком;  japan — пирамидальный шатёр ниндзя с фонарём;
//   ww2     — армейская палатка в кольце мешков с песком и вымпелом.  У всех — костёр с живым пламенем.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { box, merge, part } from './Terrain';
import { useEnv } from './rig';

const cyl = (rt: number, rb: number, h: number, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r: number, h: number, s = 8) => new THREE.ConeGeometry(r, h, s);
const ico = (r: number) => new THREE.IcosahedronGeometry(r, 0);

const fireBase = () => [
  part(box(0.2, 0.03, 0.04), '#5a3a1e', [0, 0.02, 0], [0, 0.5, 0]),
  part(box(0.2, 0.03, 0.04), '#4d3219', [0, 0.04, 0], [0, -0.6, 0]),
  part(ico(0.035), '#6f6a66', [0.11, 0.02, 0.05]),
  part(ico(0.03), '#6f6a66', [-0.1, 0.02, -0.06]),
  part(ico(0.03), '#6f6a66', [0.02, 0.02, 0.12]),
];

const CAMP: Record<string, () => THREE.BufferGeometry> = {
  genghis: () =>
    merge([
      part(cyl(0.27, 0.28, 0.2, 12), '#4b3d34', [0, 0.1, 0]), // войлочные стены
      part(cone(0.31, 0.18, 12), '#3a2f29', [0, 0.29, 0]), // купол
      part(cyl(0.05, 0.05, 0.02, 8), '#8b6a3a', [0, 0.39, 0]), // шанырак
      part(box(0.1, 0.13, 0.02), '#8c2a1d', [0, 0.07, 0.275]), // дверь
      part(cyl(0.012, 0.012, 0.8, 5), '#3b2a1c', [0.32, 0.4, -0.18]), // древко бунчука
      part(cone(0.05, 0.22, 6), '#151515', [0.32, 0.72, -0.18], [Math.PI, 0, 0]), // конский хвост
      part(ico(0.03), '#c9a14a', [0.32, 0.82, -0.18]), // навершие
      ...fireBase().map((g) => g.translate(-0.33, 0, 0.18)),
    ]),
  japan: () =>
    merge([
      part(cone(0.3, 0.4, 4), '#262a52', [0, 0.2, 0], [0, Math.PI / 4, 0]), // шатёр
      part(box(0.11, 0.16, 0.02), '#11132a', [0, 0.08, 0.2]), // вход
      part(ico(0.1), '#7c7a78', [-0.32, 0.06, -0.1]), // камни
      part(ico(0.07), '#6d6b69', [-0.26, 0.05, 0.12]),
      part(ico(0.08), '#8a8886', [0.3, 0.06, -0.2]),
      part(cyl(0.01, 0.01, 0.5, 5), '#2c2018', [0.28, 0.25, 0.15]), // шест фонаря
      part(box(0.07, 0.03, 0.01), '#2c2018', [0.25, 0.48, 0.15]),
      ...fireBase().map((g) => g.translate(0.05, 0, 0.32)),
    ]),
  ww2: () => {
    const parts = [
      part(cyl(0.25, 0.25, 0.5, 3), '#5b6234', [0, 0.13, 0], [0, 0, Math.PI / 2]), // палатка-«домик»
      part(box(0.02, 0.2, 0.36), '#3f4524', [0.25, 0.1, 0]), // торец
      part(cyl(0.012, 0.012, 0.75, 5), '#3a2b1e', [-0.3, 0.37, -0.22]), // флагшток
      part(box(0.16, 0.08, 0.01), '#2b2b2b', [-0.22, 0.68, -0.22]), // вымпел без символов
      part(box(0.07, 0.09, 0.07), '#4a4d33', [0.3, 0.05, 0.2]), // ящики
      part(box(0.07, 0.06, 0.07), '#55583a', [0.3, 0.12, 0.2]),
      ...fireBase().map((g) => g.translate(-0.05, 0, 0.36)),
    ];
    // кольцо мешков с песком
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (Math.abs(a - Math.PI / 2) < 0.4) continue; // проход к костру
      parts.push(part(box(0.11, 0.06, 0.07), i % 2 ? '#bfa878' : '#ad966a', [Math.cos(a) * 0.43, 0.03, Math.sin(a) * 0.43], [0, -a, 0]));
    }
    return merge(parts);
  },
};

const campMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
const flameGeo = cone(0.06, 0.16, 6);
const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb23a', toneMapped: false });
const lanternGeo = box(0.05, 0.07, 0.05);
const lanternMat = new THREE.MeshBasicMaterial({ color: '#ffc46b', toneMapped: false });

// Купол блокады — геодезический щит: полусфера из треугольников (икосаэдр, вершиной вверх),
// лёгкая заливка + светящиеся рёбра. Меньше гекса: углы с постройками игроков остаются снаружи.
const domeGeo = (() => {
  const ico = new THREE.IcosahedronGeometry(1, 1);
  ico.rotateX(-Math.atan((1 + Math.sqrt(5)) / 2)); // вершина икосаэдра → вверх, рёбра середин ложатся на экватор
  const src = ico.attributes.position;
  const keep: number[] = [];
  for (let i = 0; i < src.count; i += 3) {
    if (src.getY(i) < -1e-3 || src.getY(i + 1) < -1e-3 || src.getY(i + 2) < -1e-3) continue;
    for (let k = 0; k < 3; k++) keep.push(src.getX(i + k), src.getY(i + k), src.getZ(i + k));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
  g.scale(0.74, 0.95, 0.74);
  g.computeVertexNormals();
  return g;
})();
const domeEdges = new THREE.EdgesGeometry(domeGeo, 1);
const rimGeo = new THREE.TorusGeometry(0.74, 0.012, 6, 48);
const spireGeo = new THREE.CylinderGeometry(0.008, 0.012, 0.34, 6);
spireGeo.translate(0, 0.17, 0);
const spireMat = new THREE.MeshStandardMaterial({ color: '#2a2422', roughness: 0.6 });
// Знамя: полотнище с вырезом-«ласточкиным хвостом», крепится к шпилю левым краем
const flagGeo = (() => {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0.05);
  sh.lineTo(0.22, 0.05);
  sh.lineTo(0.17, 0);
  sh.lineTo(0.22, -0.05);
  sh.lineTo(0, -0.05);
  sh.closePath();
  return new THREE.ShapeGeometry(sh);
})();
const flagMat = new THREE.MeshStandardMaterial({ color: '#7d1a12', roughness: 0.8, side: THREE.DoubleSide });
rimGeo.rotateX(Math.PI / 2);

const FIRE_AT: Record<string, [number, number, number]> = {
  genghis: [-0.33, 0.1, 0.18],
  japan: [0.05, 0.1, 0.32],
  ww2: [-0.05, 0.1, 0.36],
};

export function Camp({ era }: { era: string }) {
  const geo = useMemo(() => (CAMP[era] ?? CAMP.genghis)(), [era]);
  const flame = useRef<THREE.Mesh>(null);
  const dome = useRef<THREE.MeshBasicMaterial>(null);
  const edges = useRef<THREE.LineBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const flag = useRef<THREE.Mesh>(null);
  const { reduced, lowPower } = useEnv();
  const fire = FIRE_AT[era] ?? FIRE_AT.genghis;
  useFrame(({ clock }) => {
    const t = reduced ? 0 : clock.elapsedTime;
    if (flame.current) {
      const k = 1 + Math.sin(t * 17) * 0.12 + Math.sin(t * 7.1) * 0.1;
      flame.current.scale.set(1, k, 1);
    }
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    if (dome.current) dome.current.opacity = 0.06 + pulse * 0.05;
    if (edges.current) edges.current.opacity = 0.45 + pulse * 0.4;
    if (light.current) light.current.intensity = 0.8 + Math.sin(t * 13) * 0.25;
    if (flag.current) flag.current.rotation.y = Math.sin(t * 1.3) * 0.5 + t * 0.15;
  });
  return (
    <group>
      <group scale={1.2}>
        <mesh geometry={geo} material={campMat} castShadow receiveShadow />
        <mesh ref={flame} geometry={flameGeo} material={flameMat} position={fire} />
        {era === 'japan' && <mesh geometry={lanternGeo} material={lanternMat} position={[0.28, 0.45, 0.15]} />}
        {!lowPower && <pointLight ref={light} color="#ff8a2a" distance={1.6} intensity={0.8} position={[fire[0], 0.3, fire[2]]} />}
      </group>
      {/* купол блокады */}
      <mesh geometry={domeGeo} renderOrder={9}>
        <meshBasicMaterial ref={dome} color="#ff3b2f" transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <lineSegments geometry={domeEdges} renderOrder={10}>
        <lineBasicMaterial ref={edges} color="#ff8a7a" transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </lineSegments>
      <mesh geometry={rimGeo} renderOrder={10}>
        <meshBasicMaterial color="#ff5a48" toneMapped={false} />
      </mesh>
      {/* шпиль на вершине купола с тёмным знаменем захватчика */}
      <mesh geometry={spireGeo} material={spireMat} position={[0, 0.95, 0]} />
      <mesh ref={flag} geometry={flagGeo} material={flagMat} position={[0, 1.24, 0]} />
    </group>
  );
}
