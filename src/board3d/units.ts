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

export const tankHullGeo = merge([
  part(box(1.5, 0.32, 0.9), '#4f5a2c', [0, 0.42, 0]),
  part(box(1.1, 0.16, 0.86), '#58652f', [-0.05, 0.64, 0]),
  part(box(0.5, 0.22, 0.86), '#47512a', [0.72, 0.5, 0], [0, 0, -0.5]),
  part(box(1.6, 0.26, 0.24), '#2b2b25', [0, 0.22, 0.42]), // гусеницы
  part(box(1.6, 0.26, 0.24), '#2b2b25', [0, 0.22, -0.42]),
  ...[-0.55, -0.2, 0.15, 0.5].flatMap((x) => [
    part(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 10), '#3a3a33', [x, 0.2, 0.42], [Math.PI / 2, 0, 0]),
    part(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 10), '#3a3a33', [x, 0.2, -0.42], [Math.PI / 2, 0, 0]),
  ]),
]);
export const turretGeo = merge([
  part(new THREE.CylinderGeometry(0.34, 0.4, 0.26, 8), '#55622e', [0, 0, 0]),
  part(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 8), '#4a5528', [-0.1, 0.17, 0.12]),
]);
export const barrelGeo = merge([part(new THREE.CylinderGeometry(0.05, 0.06, 1.1, 8), '#3f4824', [0.55, 0, 0], [0, 0, Math.PI / 2])]);
export const tankMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });

