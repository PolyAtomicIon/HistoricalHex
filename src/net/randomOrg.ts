// Кубики с random.org: настоящий случай из атмосферного шума.
// Ведущий заранее берёт запас бросков и подкачивает его, чтобы бросок не ждал сеть.
// Если сайт недоступен или кончился лимит — бросок берётся из генератора системы (cryptoRng), игра не встаёт.

import type { Rng } from '../engine';
import { cryptoRng } from '../engine';

/** Сколько значений кубика брать за один запрос. */
const BATCH = 100;
/** Подкачиваем, когда в запасе осталось меньше. */
const REFILL_BELOW = 40;
/** Пауза после ошибки (random.org просит не долбить его повторными запросами). */
const BACKOFF_MS = 60_000;
const TIMEOUT_MS = 8_000;

export const RANDOM_ORG_URL = `https://www.random.org/integers/?num=${BATCH}&min=1&max=6&col=1&base=10&format=plain&rnd=new`;

export type DiceSource = 'randomOrg' | 'fallback';

type Fetcher = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Разобрать ответ random.org: по одному числу 1–6 в строке. Любая ерунда — ошибка. */
export function parseDice(text: string): number[] {
  const lines = text.trim().split(/\s+/);
  const dice = lines.map(Number);
  if (dice.length === 0 || dice.some((d) => !Number.isInteger(d) || d < 1 || d > 6)) {
    throw new Error('random.org прислал непонятный ответ');
  }
  return dice;
}

export class RandomOrgDice {
  private pool: number[] = [];
  private loading?: Promise<void>;
  private retryAt = 0;
  /** Сколько бросков пришло с random.org и сколько — из запасного генератора (для /health). */
  stats = { randomOrg: 0, fallback: 0 };
  failures = 0;

  constructor(
    private readonly fetcher: Fetcher = (url, init) => fetch(url, { ...init, cache: 'no-store' }),
    private readonly now: () => number = Date.now,
  ) {}

  /** Сколько бросков кубика в запасе. */
  get size(): number {
    return this.pool.length;
  }

  /** Подкачать запас, если он подходит к концу (без ожидания — в фоне). */
  refill(): Promise<void> {
    if (this.loading || this.pool.length >= REFILL_BELOW || this.now() < this.retryAt) return this.loading ?? Promise.resolve();
    this.loading = this.load().finally(() => (this.loading = undefined));
    return this.loading;
  }

  private async load(): Promise<void> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await this.fetcher(RANDOM_ORG_URL, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`random.org ответил ${res.status}`);
      this.pool.push(...parseDice(await res.text()));
    } catch (e) {
      this.retryAt = this.now() + BACKOFF_MS;
      this.failures++;
      console.warn(`random.org недоступен (${e instanceof Error ? e.message : e}) — броски из системного генератора, повтор через ${BACKOFF_MS / 1000} с`);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Генератор для одного броска: первые два обращения (два кубика) берутся из запаса random.org,
   * дальше — системный. Если в запасе меньше двух значений — весь бросок из системного генератора.
   * Значение кубика d превращается в середину его отрезка (d − 0,5)/6, так что движок
   * (`rollDie` = ⌊x·6⌋+1) получает ровно этот кубик (середина — без риска ошибки округления на краю).
   */
  rollRng(): { rng: Rng; source: DiceSource } {
    const take = this.pool.length >= 2 ? this.pool.splice(0, 2) : [];
    void this.refill();
    if (take.length < 2) {
      this.stats.fallback++;
      return { rng: cryptoRng, source: 'fallback' };
    }
    this.stats.randomOrg++;
    let i = 0;
    const rng: Rng = () => (i < take.length ? (take[i++] - 0.5) / 6 : cryptoRng());
    return { rng, source: 'randomOrg' };
  }
}
