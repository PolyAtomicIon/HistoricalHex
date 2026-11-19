import { expect } from 'vitest';
import type { Action, GameState, NewPlayer, PlayerId, ResourceMap, Rng } from '../src/engine';
import {
  RESOURCES,
  applyAction,
  createGame,
  legalRoadEdges,
  legalSettlementVertices,
  pick,
  rollDie,
  seededRng,
  topologyFor,
} from '../src/engine';

export const PLAYERS: NewPlayer[] = [
  { id: 'a', name: 'Аня', color: 'red' },
  { id: 'b', name: 'Борис', color: 'blue' },
  { id: 'c', name: 'Вика', color: 'white' },
  { id: 'd', name: 'Гена', color: 'orange' },
  { id: 'e', name: 'Даша', color: 'green' },
  { id: 'f', name: 'Ербол', color: 'purple' },
];

/** Новая игра с фиксированным порядком ходов a, b, c… */
export function newGame(n = 3, seed = 1): GameState {
  const s = createGame(PLAYERS.slice(0, n), seededRng(seed));
  s.order = PLAYERS.slice(0, n).map((p) => p.id);
  return s;
}

/** Пропустить расстановку: сразу начало первого хода игрока a. */
export function skipSetup(s: GameState): GameState {
  delete s.setup;
  s.phase = 'roll';
  s.turn = 1;
  s.current = 0;
  return s;
}

/** Сразу фаза торговли/стройки первого хода. */
export function mainPhase(s: GameState): GameState {
  skipSetup(s);
  s.phase = 'main';
  return s;
}

export function act(s: GameState, actor: PlayerId, action: Action, rng: Rng = seededRng(42)): GameState {
  const res = applyAction(s, actor, action, rng);
  if (!res.ok) throw new Error(`Действие ${action.type} отклонено: ${res.error}`);
  return res.state;
}

export function actFail(s: GameState, actor: PlayerId, action: Action, rng: Rng = seededRng(42)): string {
  const res = applyAction(s, actor, action, rng);
  expect(res.ok).toBe(false);
  return res.ok ? '' : res.error;
}

export function setHand(s: GameState, pid: PlayerId, hand: Partial<ResourceMap>): void {
  for (const r of RESOURCES) s.players[pid].resources[r] = hand[r] ?? 0;
}

/** Генератор, у которого первые два броска кубика дают нужную сумму. */
export function rngForTotal(total: number): Rng {
  for (let seed = 1; seed < 100000; seed++) {
    const probe = seededRng(seed);
    if (rollDie(probe) + rollDie(probe) === total) return seededRng(seed);
  }
  throw new Error('не нашёл зерно');
}

/** Один шаг расстановки (поселение или дорога) случайным допустимым ходом. */
export function setupStep(s: GameState, rng: Rng): GameState {
  const pid = s.order[s.current];
  if (s.setup!.step === 'settlement') {
    return act(s, pid, { type: 'buildSettlement', vertex: pick(rng, legalSettlementVertices(s, pid, true)) });
  }
  return act(s, pid, { type: 'buildRoad', edge: pick(rng, legalRoadEdges(s, pid, s.setup!.lastVertex)) });
}

/** Пройти расстановку случайными допустимыми ходами. */
export function playSetup(s: GameState, rng: Rng): GameState {
  while (s.phase === 'setup') s = setupStep(s, rng);
  return s;
}

/** Цепочка из n соседних прибрежных рёбер (удобно для дорог). */
export function coastChain(s: GameState, n: number, from = 0): string[] {
  return topologyFor(s.board.layout).coast.slice(from, from + n);
}

/** Общая вершина двух соседних рёбер. */
export function sharedVertex(s: GameState, e1: string, e2: string): string {
  const t = topologyFor(s.board.layout);
  const [a, b] = t.edges.get(e1)!.vertices;
  const v2 = t.edges.get(e2)!.vertices;
  return v2.includes(a) ? a : b;
}

/** Имитация записи в Firebase и чтения обратно: пропадают null, пустые объекты и массивы. */
export function firebaseRoundtrip<T>(value: T): T {
  const strip = (v: unknown): unknown => {
    if (v === null || v === undefined) return undefined;
    if (Array.isArray(v)) {
      const arr = v.map(strip);
      return arr.length === 0 ? undefined : arr;
    }
    if (typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) {
        const y = strip(x);
        if (y !== undefined) out[k] = y;
      }
      return Object.keys(out).length === 0 ? undefined : out;
    }
    return v;
  };
  return strip(JSON.parse(JSON.stringify(value))) as T;
}
