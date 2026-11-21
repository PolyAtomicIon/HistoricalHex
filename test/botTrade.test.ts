// Боты отвечают на обмен людей: честный и полезный обмен принимают, грабительский — нет.
import { describe, expect, it } from 'vitest';
import type { GameState, PlayerId, Resource } from '../src/engine';
import { RESOURCES, applyAction, createGame, emptyResources, seededRng, toPrivateView, toPublicView } from '../src/engine';
import { decide } from '../src/bots';
import { PLAYERS } from './helpers';

/** Партия после расстановки (её делают боты), ход игрока a, фаза торговли. */
function afterSetup(seed: number): GameState {
  const rng = seededRng(seed);
  const players = PLAYERS.slice(0, 3).map((p) => ({ ...p, bot: 'medium' as const }));
  let s = createGame(players, rng);
  for (let i = 0; i < 200 && s.phase === 'setup'; i++) {
    const pub = toPublicView(s);
    const id = pub.order[pub.current];
    const a = decide({ level: 'medium', pub, priv: toPrivateView(s, id), me: id, rng, memory: {}, now: 0 });
    const res = applyAction(s, id, a!, rng);
    if (res.ok) s = res.state;
  }
  s.phase = 'main';
  s.current = s.order.indexOf('a');
  for (const id of s.order) delete s.players[id].bot;
  return s;
}

function answer(s: GameState, bot: PlayerId, give: Partial<Record<Resource, number>>, want: Partial<Record<Resource, number>>, seed: number) {
  const g = { ...emptyResources(), ...give };
  const w = { ...emptyResources(), ...want };
  s.players.a.resources = { ...emptyResources(), ...give };
  const res = applyAction(s, 'a', { type: 'offerTrade', give: g, want: w }, seededRng(seed));
  if (!res.ok) throw new Error(res.error);
  const t = res.state;
  const pub = toPublicView(t);
  return decide({ level: 'medium', pub, priv: toPrivateView(t, bot), me: bot, rng: seededRng(seed), memory: {}, now: 0 });
}

describe('боты и обмен', () => {
  it('честный обмен 1 к 1 боты часто принимают, но не всегда', () => {
    let asked = 0;
    let accepted = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const base = afterSetup(seed);
      const rng = seededRng(seed * 7);
      for (let k = 0; k < 5; k++) {
        const s = structuredClone(base);
        const hand = emptyResources();
        for (let i = 0; i < 5; i++) hand[RESOURCES[Math.floor(rng() * 5)]] += 1;
        s.players.b.resources = hand;
        const have = RESOURCES.filter((r) => hand[r] > 0);
        const want = have[Math.floor(rng() * have.length)];
        const give = RESOURCES.filter((r) => r !== want)[Math.floor(rng() * 4)];
        const a = answer(s, 'b', { [give]: 1 }, { [want]: 1 }, seed * 10 + k);
        if (a?.type !== 'respondTrade') continue;
        asked++;
        if (a.kind === 'accept') accepted++;
      }
    }
    expect(asked).toBeGreaterThan(100);
    expect(accepted / asked).toBeGreaterThan(0.3);
    expect(accepted / asked).toBeLessThan(0.95);
  });
  it('грабительский обмен (1 за 3) не принимают', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = afterSetup(seed);
      s.players.b.resources = { ...emptyResources(), ore: 3, wheat: 2 };
      const a = answer(s, 'b', { sheep: 1 }, { ore: 3 }, seed);
      expect(a).toMatchObject({ type: 'respondTrade', kind: 'decline' });
    }
  });
});
