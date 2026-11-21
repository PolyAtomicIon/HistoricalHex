// Общие низкополигональные юниты и текстуры эффектов для 3D-карты (налёт, танки).

import * as THREE from 'three';
import { box, merge, part } from './Terrain';

let puffTex: THREE.Texture | undefined;
/** Мягкий круг для дыма. */
export function puff(): THREE.Texture {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  puffTex = new THREE.CanvasTexture(c);
  return puffTex;
}

let fireTex: THREE.Texture | undefined;
/** Клуб огня: белое ядро → оранжевый → красный → прозрачный. */
export function fireT(): THREE.Texture {
  if (fireTex) return fireTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,235,1)');
  g.addColorStop(0.25, 'rgba(255,214,120,0.95)');
  g.addColorStop(0.55, 'rgba(255,120,30,0.75)');
  g.addColorStop(0.8, 'rgba(170,40,10,0.35)');
  g.addColorStop(1, 'rgba(60,10,5,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  fireTex = new THREE.CanvasTexture(c);
  return fireTex;
}
/** Клубов огня на один взрыв. */
export const FLAMES = 7;

// ---------- танк (вдоль +X), силуэт среднего танка: наклонная броня, пять катков, длинная пушка ----------
const V2 = THREE.Vector2;
const cylX = (r: number, l: number, seg = 10) => new THREE.CylinderGeometry(r, r, l, seg).rotateZ(Math.PI / 2);
const cylZ = (r: number, l: number, seg = 12) => new THREE.CylinderGeometry(r, r, l, seg).rotateX(Math.PI / 2);
/** Профиль сбоку (X×Y), выдавленный поперёк корпуса на ширину w. */
const profile = (pts: [number, number][], w: number) => {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new V2(x, y))), { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  return g;
};
const HULL = '#566438';
const HULL_D = '#465230';
const TRACK = '#2b2a25';
const WHEEL = '#3d4034';
const HUB = '#676b5c';
const TURRET = '#5d6c3c';
const STEEL = '#3a4226';
const WHEELS_X = [-0.58, -0.29, 0, 0.29, 0.58];
export const tankHullGeo = merge([
  // корпус: наклонный лоб и корма
  part(profile([[-0.8, 0.2], [0.58, 0.2], [0.84, 0.38], [0.5, 0.62], [-0.7, 0.62], [-0.84, 0.46]], 0.74), HULL),
  // гусеничные ленты со скруглёнными концами
  ...[0.46, -0.46].flatMap((z) => [
    part(box(1.5, 0.3, 0.2), TRACK, [0, 0.21, z]),
    part(cylZ(0.15, 0.2), TRACK, [0.75, 0.21, z]),
    part(cylZ(0.15, 0.2), TRACK, [-0.75, 0.21, z]),
    // крылья над гусеницами
    part(box(1.66, 0.025, 0.24), HULL_D, [0, 0.5, z]),
    // катки, ступицы, ленивец/ведущее колесо
    ...WHEELS_X.flatMap((x) => [
      part(cylZ(0.12, 0.05), WHEEL, [x, 0.2, z + Math.sign(z) * 0.09]),
      part(cylZ(0.045, 0.06), HUB, [x, 0.2, z + Math.sign(z) * 0.1]),
    ]),
    part(cylZ(0.09, 0.05, 8), HUB, [0.78, 0.24, z + Math.sign(z) * 0.08]),
    part(cylZ(0.1, 0.05, 8), STEEL, [-0.78, 0.24, z + Math.sign(z) * 0.08]),
    // топливные баки на бортах у кормы
    part(cylX(0.06, 0.34), HULL_D, [-0.5, 0.58, z * 0.88]),
  ]),
  // люк механика, фара, пулемёт в лобовом листе
  part(box(0.16, 0.03, 0.2), HULL_D, [0.56, 0.53, 0.14], [0, 0, -0.6]),
  part(cylX(0.03, 0.05, 8), '#d9d3a0', [0.8, 0.42, -0.24]),
  part(new THREE.SphereGeometry(0.04, 8, 6), STEEL, [0.66, 0.5, -0.18]),
  // выхлопные трубы и решётка моторного отсека
  part(cylX(0.03, 0.08, 8), '#222', [-0.86, 0.4, 0.16]),
  part(cylX(0.03, 0.08, 8), '#222', [-0.86, 0.4, -0.16]),
  part(box(0.36, 0.015, 0.4), HULL_D, [-0.48, 0.63, 0]),
]);
/** Башня с маской и пушкой (крутится целиком). Ось вращения — начало координат. */
export const turretGeo = merge([
  part(new THREE.CylinderGeometry(0.29, 0.35, 0.24, 6), TURRET, [0, 0, 0], [0, Math.PI / 6, 0], [1.2, 1, 1]),
  part(box(0.22, 0.2, 0.46), TURRET, [-0.32, -0.01, 0]), // кормовая ниша
  part(new THREE.CylinderGeometry(0.075, 0.085, 0.1, 10), TURRET, [-0.08, 0.17, 0.12]), // командирская башенка
  part(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 10), HULL_D, [-0.08, 0.225, 0.12]),
  part(box(0.12, 0.012, 0.14), HULL_D, [-0.1, 0.125, -0.12]), // люк
  part(box(0.12, 0.17, 0.24), STEEL, [0.4, 0, 0]), // маска пушки
  part(cylX(0.034, 0.95), STEEL, [0.92, 0.01, 0]), // ствол
  part(cylX(0.048, 0.1), STEEL, [1.39, 0.01, 0]), // дульный тормоз
]);
/** Срез ствола в координатах башни. */
export const MUZZLE: [number, number, number] = [1.46, 0.01, 0];
export const tankMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.75, metalness: 0.15 });
