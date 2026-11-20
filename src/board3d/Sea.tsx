// Анимированное море: волны в вершинах (3d/25d), анимация нормалей и цвета (везде),
// пена вдоль берега по запечённому полю расстояний, каустики и блики.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { buildDistField, type DistField } from './world';
import { useEnv } from './rig';

const WAVES = /* glsl */ `
vec3 waves(vec2 p, float t) {
  // x: высота, yz: градиент
  vec3 r = vec3(0.0);
  vec2 d1 = vec2(0.9, 0.4);  float k1 = 1.7; float a1 = 0.5;
  vec2 d2 = vec2(-0.5, 0.8); float k2 = 2.6; float a2 = 0.3;
  vec2 d3 = vec2(0.2, -1.0); float k3 = 4.1; float a3 = 0.2;
  float p1 = dot(p, d1) * k1 + t * 1.1;
  float p2 = dot(p, d2) * k2 + t * 1.5;
  float p3 = dot(p, d3) * k3 + t * 2.1;
  r.x = a1 * sin(p1) + a2 * sin(p2) + a3 * sin(p3);
  r.yz = a1 * k1 * cos(p1) * d1 + a2 * k2 * cos(p2) * d2 + a3 * k3 * cos(p3) * d3;
  return r;
}
`;

const VERT = /* glsl */ `
uniform float uTime;
uniform float uAmp;
varying vec3 vWorld;
${WAVES}
void main() {
  vec3 p = position;
  p.y += waves(p.xz, uTime).x * uAmp;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uDist;
uniform vec2 uMin;
uniform float uSize;
uniform float uTime;
uniform float uNormalK;
uniform float uRadius;
uniform float uQuality;
uniform vec3 uSea;
uniform vec3 uSeaDeep;
uniform vec3 uSun;
uniform vec3 uLight;
varying vec3 vWorld;
${WAVES}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float ridge(float n) { return 1.0 - abs(2.0 * n - 1.0); }

void main() {
  vec2 xz = vWorld.xz;
  float d = texture2D(uDist, (xz - uMin) / uSize).r * 3.3 - 0.3;
  vec3 w = waves(xz, uTime);
  float n1 = noise(xz * 1.4 + vec2(uTime * 0.05, -uTime * 0.04));
  float n2 = noise(xz * 3.3 - vec2(uTime * 0.08, uTime * 0.05));

  vec3 N = normalize(vec3(-w.y * uNormalK * 0.12, 1.0, -w.z * uNormalK * 0.12));
  vec3 V = normalize(cameraPosition - vWorld);

  // глубина: у берега светлее и бирюзовее
  float shallow = 1.0 - smoothstep(0.0, 2.3, d + (n1 - 0.5) * 0.6);
  vec3 col = mix(uSeaDeep, uSea, clamp(shallow * 0.9 + 0.12 * (0.5 + 0.5 * w.x), 0.0, 1.0));
  col += vec3(0.02, 0.09, 0.07) * shallow;

  // мягкая тень от острова на воде
  float shade = (1.0 - smoothstep(0.0, 0.7, d)) * step(0.0, d);
  col *= 1.0 - 0.18 * shade;

  // небесный отсвет по Френелю
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col = mix(col, uSea * 1.3 + vec3(0.12), fr * 0.4);

  // каустики на мелководье
  float ca = ridge(noise(xz * 2.6 + vec2(uTime * 0.25, uTime * 0.18)));
  float cb = ridge(noise(xz * 3.4 - vec2(uTime * 0.2, -uTime * 0.27) + 7.3));
  float cau = pow(ca * cb, 4.0) * (0.5 + 0.5 * uQuality);
  col += uLight * cau * 0.55 * shallow * smoothstep(0.0, 0.1, d + 0.1);

  // блик солнца + искры
  vec3 H = normalize(normalize(uSun) + V);
  float spec = pow(max(dot(N, H), 0.0), 260.0);
  col += uLight * spec * 0.45;
  float g = noise(xz * 11.0 + vec2(uTime * 0.7, -uTime * 0.5));
  float spark = smoothstep(0.88, 1.0, g) * (0.25 + 0.75 * smoothstep(0.0, 0.6, spec * 6.0 + n2 * 0.3));
  col += uLight * spark * 0.22;

  // пена у берега
  float breathe = 0.11 + 0.07 * sin(uTime * 0.9 + n1 * 6.2831);
  float foamA = 1.0 - smoothstep(breathe - 0.07, breathe + 0.04, d + (n2 - 0.5) * 0.16);
  foamA *= smoothstep(-0.02, 0.02, d);
  float wv = fract(d * 1.7 - uTime * 0.11 + n1 * 0.4);
  float foamB = smoothstep(0.84, 0.99, wv) * (1.0 - smoothstep(0.2, 1.0, d)) * smoothstep(0.12, 0.3, d) * (0.4 + 0.6 * n2);
  float foam = clamp(foamA + foamB * 0.65, 0.0, 1.0);
  col = mix(col, vec3(0.97, 0.99, 1.0), foam * 0.92);

  float alpha = 1.0 - smoothstep(0.72, 1.0, length(xz) / uRadius);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

interface SeaProps {
  centers: [number, number][];
  radius: number;
  sunDir: THREE.Vector3;
}

export default function Sea({ centers, radius, sunDir }: SeaProps) {
  const { palette, reduced, lowPower, rig } = useEnv();
  const half = radius + 3.6;
  const field = useMemo<DistField>(() => buildDistField(centers, half, lowPower ? 128 : 192), [centers, half, lowPower]);
  useEffect(() => () => field.tex.dispose(), [field]);

  const size = radius * 7 + 30;
  const geo = useMemo(() => {
    const seg = lowPower ? 70 : 140;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [size, lowPower]);
  useEffect(() => () => geo.dispose(), [geo]);

  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0 },
      uNormalK: { value: 1 },
      uRadius: { value: size / 2 },
      uQuality: { value: lowPower ? 0 : 1 },
      uDist: { value: field.tex },
      uMin: { value: new THREE.Vector2(field.min, field.min) },
      uSize: { value: field.size },
      uSea: { value: new THREE.Color(palette.sea) },
      uSeaDeep: { value: new THREE.Color(palette.seaDeep) },
      uSun: { value: sunDir.clone() },
      uLight: { value: new THREE.Color(palette.light) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [field, size, lowPower],
  );

  useEffect(() => {
    uniforms.uSea.value.set(palette.sea);
    uniforms.uSeaDeep.value.set(palette.seaDeep);
    uniforms.uLight.value.set(palette.light);
  }, [palette, uniforms]);

  useFrame((_, dt) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    u.uTime.value += Math.min(dt, 0.1) * (reduced ? 0.12 : 1);
    u.uAmp.value = rig.amp * (reduced ? 0.25 : 1) * 0.075;
    u.uNormalK.value = 0.9 + 0.5 * (1 - rig.amp);
  });

  return (
    <mesh geometry={geo} position={[0, 0.02, 0]} renderOrder={-1} frustumCulled={false}>
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={VERT} fragmentShader={FRAG} transparent />
    </mesh>
  );
}
