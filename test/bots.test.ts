// Боты: играют без недопустимых ходов, а уровни действительно отличаются по силе.
import { describe, expect, it } from 'vitest';
import type { BotLevel, GameState, PlayerId } from '../src/engine';
import { applyAction, createGame, seededRng, toPrivateView, toPublicView } from '../src/engine';
import type { BotMemory } from '../src/bots';
import { botsToAct, decide } from '../src/bots';
import { PLAYERS } from './helpers';

interface Result {
  winner?: BotLevel;
  steps: number;
  rejected: number;
}

/** Партия, где все игроки — боты. Время идёт по 1 с на действие (для ожидания ответов на обмен). */
function botGame(levels: BotLevel[], seed: number): Result {
  const rng = seededRng(seed);
  const players = levels.map((bot, i) => ({ ...PLAYERS[i], bot }));
  let s: GameState = createGame(players, rng);
  const memory: Record<PlayerId, BotMemory> = Object.fromEntries(players.map((p) => [p.id, {}]));
  let now = 0;
  let rejected = 0;
  let steps = 0;
  for (; steps < 3000 && s.phase !== 'finished'; steps++) {
    now += 1000;
    const pub = toPublicView(s);
    const actors = botsToAct(pub, () => true);
    let acted = false;
    for (const id of actors) {
      const action = decide({
        level: s.players[id].bot!,
        pub,
        priv: toPrivateView(s, id),
        me: id,
        rng,
        memory: memory[id],
        now,
      });
      if (!action) continue;
      const res = applyAction(s, id, action, rng);
      if (!res.ok) {
        rejected += 1;
        // Подстраховка как у хоста: если бот ошибся — ход за него делает лёгкий бот
        const fallback = decide({ level: 'easy', pub, priv: toPrivateView(s, id), me: id, rng, memory: {}, now });
        const res2 = fallback ? applyAction(s, id, fallback, rng) : res;
        if (res2.ok) s = res2.state;
        else throw new Error(`Бот ${id} застрял: ${JSON.stringify(action)} → ${res.error}`);
      } else {
        s = res.state;
      }
      acted = true;
      break;
    }
    if (!acted && actors.length === 0) throw new Error('Никто не может ходить в фазе ' + s.phase);
  }
  return { winner: s.winner ? s.players[s.winner].bot : undefined, steps, rejected };
}

describe('боты', () => {
  for (const level of ['easy', 'medium', 'hard'] as BotLevel[]) {
    it(`${level}: доигрывают партию 4 игроков без застреваний`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const r = botGame([level, level, level, level], seed * 31);
        expect(r.rejected).toBeLessThanOrEqual(2);
        if (level !== 'easy') expect(r.winner).toBe(level);
      }
    }, 120_000);
  }

  it('турнир: сложный сильнее лёгкого, средний сильнее лёгкого', () => {
    const wins: Record<BotLevel, number> = { easy: 0, medium: 0, hard: 0 };
    const seats: BotLevel[][] = [
      ['hard', 'medium', 'easy'],
      ['easy', 'hard', 'medium'],
      ['medium', 'easy', 'hard'],
    ];
    let unfinished = 0;
    for (let i = 0; i < 24; i++) {
      const r = botGame(seats[i % 3], 1000 + i);
      if (r.winner) wins[r.winner] += 1;
      else unfinished += 1;
    }
    console.log('Турнир (24 партии):', wins, 'не доиграно:', unfinished);
    expect(wins.hard).toBeGreaterThan(wins.easy);
    expect(wins.medium).toBeGreaterThan(wins.easy);
    expect(unfinished).toBeLessThanOrEqual(2);
  }, 300_000);

  it('сложный против среднего (6 игроков, большое поле)', () => {
    const wins: Record<BotLevel, number> = { easy: 0, medium: 0, hard: 0 };
    for (let i = 0; i < 10; i++) {
      const levels: BotLevel[] = i % 2 ? ['hard', 'medium', 'hard', 'medium', 'hard', 'medium'] : ['medium', 'hard', 'medium', 'hard', 'medium', 'hard'];
      const r = botGame(levels, 5000 + i);
      if (r.winner) wins[r.winner] += 1;
    }
    console.log('Сложный vs средний (10 партий):', wins);
    expect(wins.hard).toBeGreaterThanOrEqual(wins.medium);
  }, 300_000);
});
