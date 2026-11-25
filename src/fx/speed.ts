// Скорость анимаций партии: темп комнаты (ведущий выбирает) сжимает кубики, заставки и паузы.
// «Турбо» — для тех, кто знает игру: всё короче, сцены налёта пропускаются, заставки — мини-плашки.

let k = 1;
let turbo = false;

export function setFxPace(pace: string | undefined): void {
  turbo = pace === 'turbo';
  k = pace === 'turbo' ? 0.3 : pace === 'fast' ? 0.75 : 1;
}
/** Длительность с учётом темпа. */
export const fxMs = (ms: number) => Math.round(ms * k);
export const isTurbo = () => turbo;
