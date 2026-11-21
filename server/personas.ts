// ИИ-игроки: 20 персонажей с характером и уровнем. Их статистика — настоящая:
// на старте сервер прогоняет «ИИ-лигу» (боты играют друг с другом на движке), рейтинг и победы — по итогам.

import type { BotLevel, PlayerColor } from '../src/engine';
import { PLAYER_COLORS, applyAction, createGame, cryptoRng, toPrivateView, toPublicView, victoryPoints } from '../src/engine';
import { botsToAct, decide } from '../src/bots';
import type { BotMemory } from '../src/bots';

import { PERSONAS, type Persona } from '../src/bots/personas';
export { PERSONAS, type Persona };

export const personaById = (id: string) => PERSONAS.find((p) => p.id === id);

/** Персонаж для нового бота нужного уровня (из тех, кого ещё нет за столом). */
export function pickPersona(level: BotLevel, taken: Set<string>): Persona | undefined {
  const free = PERSONAS.filter((p) => !taken.has(p.id) && !taken.has(p.name));
  const same = free.filter((p) => p.level === level);
  const pool = same.length ? same : free;
  return pool[Math.floor(cryptoRng() * pool.length)];
}

export interface SimResult {
  era: string;
  players: { pid: string; name: string; persona: string; bot: BotLevel; vp: number; winner: boolean }[];
}

/** Одна партия ботов-персонажей на движке. Возвращает итог или null, если партия не закончилась. */
export function simulateGame(personas: Persona[], era: string): SimResult | null {
  const colors = PLAYER_COLORS.slice(0, personas.length) as PlayerColor[];
  let state = createGame(
    personas.map((p, i) => ({ id: `ai-${p.id}`, name: p.name, color: colors[i], bot: p.level })),
    cryptoRng,
    { vpToWin: 10, balancedDice: false },
  );
  const memory: Record<string, BotMemory> = {};
  for (let step = 0; step < 6000 && state.phase !== 'finished'; step++) {
    const pub = toPublicView(state);
    const actors = botsToAct(pub, () => true);
    if (!actors.length) return null;
    let moved = false;
    for (const id of actors) {
      const level = state.players[id].bot ?? 'medium';
      const ctx = { level, pub, priv: toPrivateView(state, id), me: id, rng: cryptoRng, memory: (memory[id] ??= {}), now: step * 1000 };
      let action = decide(ctx);
      let res = action ? applyAction(state, id, action, cryptoRng) : null;
      if (!res?.ok) {
        action = decide({ ...ctx, level: 'easy', memory: {} });
        res = action ? applyAction(state, id, action, cryptoRng) : null;
      }
      if (!res?.ok && pub.order[pub.current] === id && pub.phase === 'main') res = applyAction(state, id, { type: 'endTurn' }, cryptoRng);
      if (res?.ok) {
        state = res.state;
        moved = true;
        break;
      }
    }
    if (!moved) return null;
  }
  if (state.phase !== 'finished') return null;
  const s = state;
  return {
    era,
    players: personas.map((p) => {
      const pid = `ai-${p.id}`;
      return { pid, name: p.name, persona: p.id, bot: p.level, vp: victoryPoints(s, pid), winner: s.winner === pid };
    }),
  };
}
