// Во время атаки всё, кроме атакуемого гекса, уходит в серое — сразу видно, куда бьют.
// Общие uniform-ы: центр цели (x, z) и сила (0 — обычные цвета, 1 — серое вокруг цели).
// dimmable(material) патчит шейдер материала: цвет фрагмента смешивается с серым по расстоянию
// от центра цели (внутри гекса и на его углах, где стоят постройки, — цветное).

import * as THREE from 'three';

export const DIM = {
  uFocus: { value: new THREE.Vector2(0, 0) },
  uAmt: { value: 0 },
};

export function dimmable<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDimFocus = DIM.uFocus;
    sh.uniforms.uDimAmt = DIM.uAmt;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDimW;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
  vec4 dimP = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    dimP = instanceMatrix * dimP;
  #endif
  vDimW = (modelMatrix * dimP).xyz;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDimW;\nuniform vec2 uDimFocus;\nuniform float uDimAmt;')
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
  if (uDimAmt > 0.0) {
    float dimK = uDimAmt * smoothstep(1.05, 1.4, distance(vDimW.xz, uDimFocus));
    float dimG = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(dimG) * 0.72, dimK);
  }`,
      );
  };
  m.customProgramCacheKey = () => 'dim1';
  return m;
}
