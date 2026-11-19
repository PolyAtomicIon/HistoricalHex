// Случайность передаётся в движок снаружи: в тестах — с фиксированным зерном,
// у хоста — криптографическая.

/** Возвращает число в диапазоне [0, 1). */
export type Rng = () => number;

/** Детерминированный генератор (для тестов и воспроизводимых партий). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Криптографически стойкая случайность (браузер / Node 20+). */
export const cryptoRng: Rng = () => {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
};

export function randomInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick из пустого списка');
  return items[randomInt(rng, items.length)];
}

/** Новый перемешанный массив (Фишер — Йетс). */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function rollDie(rng: Rng): number {
  return randomInt(rng, 6) + 1;
}
