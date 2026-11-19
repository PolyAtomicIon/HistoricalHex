// Случайные партии ботов: проверяем, что движок не ломается и сохраняет инварианты.
import { describe, expect, it } from 'vitest';
import type { Action, GameState, PlayerId, Resource, Rng } from '../src/engine';
import {
  COSTS,
  LAYOUTS,
  PIECES,
  RESOURCES,
  applyAction,
  applyHostAction,
  hasResources,
  legalCityVertices,
  legalRoadEdges,
  legalSettlementVertices,
  normalizeState,
  pick,
  resourceMap,
  seededRng,
  shuffle,
  stealCandidates,
  totalResources,
  tradeRatios,
  victoryPoints,
} from '../src/engine';
import { PLAYERS, firebaseRoundtrip } from './helpers';
import { createGame } from '../src/engine';

function randomDiscard(s: GameState, pid: PlayerId, n: number, rng: Rng) {
  const cards: Resource[] = [];
  for (const r of RESOURCES) for (let i = 0; i < s.players[pid].resources[r]; i++) cards.push(r);
  const out = resourceMap();
  for (const r of shuffle(rng, cards).slice(0, n)) out[r] += 1;
  return out;
}

/** Выбирает действие, которое по правилам должно быть допустимым. */
function chooseAction(s: GameState, rng: Rng): { actor: PlayerId; action: Action } | { host: true } {
  const pid = s.order[s.current];
  const me = s.players[pid];
  switch (s.phase) {
    case 'setup':
      if (s.setup!.step === 'settlement') {
        return { actor: pid, action: { type: 'buildSettlement', vertex: pick(rng, legalSettlementVertices(s, pid, true)) } };
      }
      return { actor: pid, action: { type: 'buildRoad', edge: pick(rng, legalRoadEdges(s, pid, s.setup!.lastVertex)) } };
    case 'discard': {
      const [who, n] = Object.entries(s.pendingDiscards!)[0];
      if (rng() < 0.1) return { host: true }; // иногда хост сбрасывает за игрока
      return { actor: who, action: { type: 'discard', resources: randomDiscard(s, who, n, rng) } };
    }
    case 'moveRobber': {
      const hex = pick(rng, s.board.hexes.filter((h) => h.id !== s.robberHex)).id;
      const cands = stealCandidates(s, hex, pid);
      return { actor: pid, action: { type: 'moveRobber', hex, victim: cands.length ? pick(rng, cands) : undefined } };
    }
    case 'roadBuilding':
      return { actor: pid, action: { type: 'buildRoad', edge: pick(rng, legalRoadEdges(s, pid)) } };
    case 'roll': {
      const knight = me.devCards.find((c) => c.type === 'knight' && c.boughtTurn < s.turn);
      if (knight && !s.devCardPlayed && rng() < 0.3) return { actor: pid, action: { type: 'playKnight' } };
      return { actor: pid, action: { type: 'rollDice' } };
    }
    case 'main': {
      const options: Action[] = [];
      const res = me.resources;
      if (me.pieces.cities > 0 && hasResources(res, COSTS.city)) {
        for (const v of legalCityVertices(s, pid)) options.push({ type: 'buildCity', vertex: v });
      }
      if (me.pieces.settlements > 0 && hasResources(res, COSTS.settlement)) {
        for (const v of legalSettlementVertices(s, pid)) options.push({ type: 'buildSettlement', vertex: v });
      }
      if (me.pieces.roads > 0 && hasResources(res, COSTS.road)) {
        const edges = legalRoadEdges(s, pid);
        if (edges.length) options.push({ type: 'buildRoad', edge: pick(rng, edges) });
      }
      if (s.devDeck.length > 0 && hasResources(res, COSTS.devCard)) options.push({ type: 'buyDevCard' });
      if (!s.devCardPlayed) {
        const playable = me.devCards.filter((c) => c.boughtTurn < s.turn).map((c) => c.type);
        if (playable.includes('knight')) options.push({ type: 'playKnight' });
        if (playable.includes('monopoly')) options.push({ type: 'playMonopoly', resource: pick(rng, RESOURCES) });
        if (playable.includes('roadBuilding') && me.pieces.roads > 0 && legalRoadEdges(s, pid).length > 0) {
          options.push({ type: 'playRoadBuilding' });
        }
        if (playable.includes('yearOfPlenty')) {
          const avail = RESOURCES.filter((r) => s.bank[r] >= 2);
          if (avail.length) {
            const r = pick(rng, avail);
            options.push({ type: 'playYearOfPlenty', resources: [r, r] });
          }
        }
      }
      const ratios = tradeRatios(s, pid);
      for (const give of RESOURCES) {
        if (res[give] >= ratios[give]) {
          const receive = pick(rng, RESOURCES.filter((r) => r !== give && s.bank[r] > 0));
          if (receive) options.push({ type: 'bankTrade', give, receive });
        }
      }
      // Обмен между игроками: предложить 1 на 1
      const mine = RESOURCES.filter((r) => res[r] > 0);
      if (!s.trade && mine.length && rng() < 0.3) {
        const give = pick(rng, mine);
        const want = pick(rng, RESOURCES.filter((r) => r !== give));
        options.push({ type: 'offerTrade', give: resourceMap({ [give]: 1 }), want: resourceMap({ [want]: 1 }) });
      }
      if (s.trade) {
        const trade = s.trade;
        // Подтверждаем только если карты всё ещё есть у обоих (бот мог их потратить)
        const accepted = Object.entries(trade.responses).find(([who, r]) => {
          if (r.kind === 'decline') return false;
          const terms = r.kind === 'counter' ? r : trade;
          return hasResources(res, terms.give) && hasResources(s.players[who].resources, terms.want);
        });
        if (accepted) options.push({ type: 'confirmTrade', tradeId: trade.id, with: accepted[0] });
        else options.push({ type: 'cancelTrade' });
      }
      // Чем больше вариантов, тем реже заканчиваем ход
      if (options.length === 0 || rng() < 0.25) return { actor: pid, action: { type: 'endTurn' } };
      return { actor: pid, action: pick(rng, options) };
    }
    default:
      throw new Error('неожиданная фаза ' + s.phase);
  }
}

/** Иногда другие игроки отвечают на предложение обмена. */
function maybeRespond(s: GameState, rng: Rng): { actor: PlayerId; action: Action } | undefined {
  if (s.phase !== 'main' || !s.trade) return;
  const others = s.order.filter((p) => p !== s.order[s.current] && !s.trade!.responses[p]);
  if (!others.length || rng() < 0.5) return;
  const who = pick(rng, others);
  const canAccept = hasResources(s.players[who].resources, s.trade.want);
  return {
    actor: who,
    action: { type: 'respondTrade', tradeId: s.trade.id, kind: canAccept && rng() < 0.7 ? 'accept' : 'decline' },
  };
}

function checkInvariants(s: GameState) {
  const spec = LAYOUTS[s.board.layout];
  for (const r of RESOURCES) {
    const inHands = s.order.reduce((sum, p) => sum + s.players[p].resources[r], 0);
    expect(s.bank[r] + inHands).toBe(spec.bankPerResource);
    expect(s.bank[r]).toBeGreaterThanOrEqual(0);
    for (const p of s.order) expect(s.players[p].resources[r]).toBeGreaterThanOrEqual(0);
  }
  const deckTotal = s.devDeck.length + s.order.reduce((sum, p) => sum + s.players[p].devCards.length, 0);
  const played = s.order.reduce((sum, p) => sum + s.players[p].knightsPlayed, 0);
  expect(deckTotal + played).toBeLessThanOrEqual(Object.values(spec.devCards).reduce((a, b) => a + b, 0));
  for (const p of s.order) {
    const roads = Object.values(s.roads).filter((o) => o === p).length;
    const settl = Object.values(s.buildings).filter((b) => b.owner === p && b.kind === 'settlement').length;
    const cities = Object.values(s.buildings).filter((b) => b.owner === p && b.kind === 'city').length;
    expect(roads + s.players[p].pieces.roads).toBe(PIECES.roads);
    expect(settl + s.players[p].pieces.settlements).toBe(PIECES.settlements);
    expect(cities + s.players[p].pieces.cities).toBe(PIECES.cities);
  }
}

function playGame(players: number, seed: number) {
  const rng = seededRng(seed);
  let s = createGame(PLAYERS.slice(0, players), rng);
  let steps = 0;
  for (; steps < 6000 && s.phase !== 'finished'; steps++) {
    const reply = maybeRespond(s, rng);
    const choice = reply ?? chooseAction(s, rng);
    const result =
      'host' in choice
        ? applyHostAction(s, { type: 'forceDiscard', player: Object.keys(s.pendingDiscards!)[0] }, rng)
        : applyAction(s, choice.actor, choice.action, rng);
    if (!result.ok) {
      throw new Error(`seed ${seed}, шаг ${steps}: ${JSON.stringify(choice)} → ${result.error}`);
    }
    s = result.state;
    checkInvariants(s);
    // Время от времени — «перезагрузка хоста» через Firebase
    if (steps % 97 === 0) s = normalizeState(firebaseRoundtrip(s));
  }
  return { s, steps };
}

describe('случайные партии ботов', () => {
  for (const players of [3, 4, 5, 6]) {
    it(`${players} игрока: 6 партий без ошибок, инварианты соблюдены`, () => {
      let finished = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const { s } = playGame(players, seed * 1000 + players);
        if (s.phase === 'finished') {
          finished += 1;
          expect(victoryPoints(s, s.winner!)).toBeGreaterThanOrEqual(10);
          expect(totalResources(s.players[s.winner!].resources)).toBeGreaterThanOrEqual(0);
        }
      }
      expect(finished).toBeGreaterThanOrEqual(4);
    }, 120_000);
  }

  it('пропуск хода хостом в любой фазе не ломает игру', () => {
    const rng = seededRng(77);
    let s = createGame(PLAYERS.slice(0, 4), rng);
    for (let i = 0; i < 400 && s.phase !== 'finished'; i++) {
      let result;
      if (s.phase !== 'discard' && rng() < 0.15) {
        result = applyHostAction(s, { type: 'skipTurn' }, rng);
      } else {
        const choice = chooseAction(s, rng);
        result =
          'host' in choice
            ? applyHostAction(s, { type: 'forceDiscard', player: Object.keys(s.pendingDiscards!)[0] }, rng)
            : applyAction(s, choice.actor, choice.action, rng);
      }
      if (!result.ok) throw new Error(`шаг ${i}: ${result.error}`);
      s = result.state;
      checkInvariants(s);
    }
  }, 60_000);
});
