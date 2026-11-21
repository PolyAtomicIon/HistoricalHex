// «Мозг» ботов. Бот видит только то, что видит обычный игрок:
// публичное состояние (PublicState) и свою руку (PrivateView). Чужие карты и колоду он не знает.
//
// easy   — почти случайные допустимые ходы;
// medium — оценивает места по числам и ресурсам, строит по приоритету, меняется под цель;
// hard   — как medium, плюс гавани, длинная дорога и армия, бережётся от семёрки, давит лидера.

import type {
  Action,
  BotLevel,
  EdgeId,
  HexId,
  PlayerId,
  PrivateView,
  PublicState,
  Resource,
  ResourceMap,
  Rng,
  VertexId,
} from '../engine';
import {
  COSTS,
  RESOURCES,
  TERRAIN_RESOURCE,
  emptyResources,
  hasResources,
  legalCityVertices,
  legalRoadEdges,
  legalSettlementVertices,
  pick,
  playersAtHex,
  resourceMap,
  satisfiesDistance,
  shuffle,
  topologyFor,
  totalResources,
} from '../engine';

/** Что бот помнит между ходами (живёт только в памяти хоста). */
export interface BotMemory {
  /** Ход, в который бот уже предлагал обмен людям. */
  offeredTurn?: number;
  /** Когда предложил (мс) — чтобы не ждать ответа вечно. */
  offeredAt?: number;
}

export interface BotContext {
  level: BotLevel;
  pub: PublicState;
  priv: PrivateView;
  me: PlayerId;
  rng: Rng;
  memory: BotMemory;
  /** Текущее время, мс. */
  now: number;
}

/** Сколько ждать ответа людей на предложение обмена. */
export const TRADE_WAIT_MS = 9000;

type Goal = 'city' | 'settlement' | 'devCard' | 'road';
const GOAL_COST: Record<Goal, ResourceMap> = {
  city: COSTS.city,
  settlement: COSTS.settlement,
  devCard: COSTS.devCard,
  road: COSTS.road,
};

const pips = (n?: number) => (n ? 6 - Math.abs(7 - n) : 0);

/**
 * Решение бота: какое действие отправить. null — сейчас ничего делать не нужно
 * (например, ждёт ответов на своё предложение обмена).
 */
export function decide(ctx: BotContext): Action | null {
  return ctx.level === 'easy' ? decideEasy(ctx) : decideSmart(ctx);
}

// ───────────────────────── общее ─────────────────────────

function isMyTurn(ctx: BotContext): boolean {
  return ctx.pub.order[ctx.pub.current] === ctx.me && ctx.pub.phase !== 'finished';
}

function randomDiscard(hand: ResourceMap, n: number, rng: Rng): ResourceMap {
  const cards: Resource[] = [];
  for (const r of RESOURCES) for (let i = 0; i < hand[r]; i++) cards.push(r);
  const out = emptyResources();
  for (const r of shuffle(rng, cards).slice(0, n)) out[r] += 1;
  return out;
}

/** Ответ на чужое предложение обмена, если он нужен. */
function pendingTradeResponse(ctx: BotContext): Action | null {
  const { pub, me } = ctx;
  const trade = pub.trade;
  if (pub.phase !== 'main' || !trade || isMyTurn(ctx) || trade.responses?.[me]) return null;
  const accept = ctx.level === 'easy' ? easyAccepts(ctx) : smartAccepts(ctx);
  return { type: 'respondTrade', tradeId: trade.id, kind: accept ? 'accept' : 'decline' };
}

// ───────────────────────── лёгкий ─────────────────────────

function easyAccepts(ctx: BotContext): boolean {
  return hasResources(ctx.priv.resources, ctx.pub.trade!.want) && ctx.rng() < 0.5;
}

function decideEasy(ctx: BotContext): Action | null {
  const { pub, priv, me, rng } = ctx;
  if (pub.phase === 'discard') {
    return priv.mustDiscard ? { type: 'discard', resources: randomDiscard(priv.resources, priv.mustDiscard, rng) } : null;
  }
  const response = pendingTradeResponse(ctx);
  if (response) return response;
  if (!isMyTurn(ctx)) return null;
  const meP = pub.players[me];

  switch (pub.phase) {
    case 'setup':
      return pub.setup?.step === 'road'
        ? { type: 'buildRoad', edge: pick(rng, legalRoadEdges(pub, me, pub.setup.lastVertex)) }
        : { type: 'buildSettlement', vertex: pick(rng, legalSettlementVertices(pub, me, true)) };
    case 'roll': {
      const knight = priv.devCards.find((c) => c.type === 'knight' && c.playable);
      return knight && rng() < 0.3 ? { type: 'playKnight' } : { type: 'rollDice' };
    }
    case 'moveRobber': {
      const hex = pick(rng, pub.board.hexes.filter((h) => h.id !== pub.robberHex)).id;
      const victims = playersAtHex(pub, hex, me).filter((p) => pub.players[p].resourceCount > 0);
      return { type: 'moveRobber', hex, ...(victims.length ? { victim: pick(rng, victims) } : {}) };
    }
    case 'roadBuilding':
      return { type: 'buildRoad', edge: pick(rng, legalRoadEdges(pub, me)) };
    case 'main': {
      const res = priv.resources;
      if (pub.trade) return { type: 'cancelTrade' };
      const cities = legalCityVertices(pub, me);
      if (meP.pieces.cities > 0 && cities.length && hasResources(res, COSTS.city)) return { type: 'buildCity', vertex: pick(rng, cities) };
      const spots = legalSettlementVertices(pub, me);
      if (meP.pieces.settlements > 0 && spots.length && hasResources(res, COSTS.settlement)) {
        return { type: 'buildSettlement', vertex: pick(rng, spots) };
      }
      const roads = legalRoadEdges(pub, me);
      if (meP.pieces.roads > 0 && roads.length && hasResources(res, COSTS.road) && rng() < 0.6) {
        return { type: 'buildRoad', edge: pick(rng, roads) };
      }
      if (pub.devDeckCount > 0 && hasResources(res, COSTS.devCard) && rng() < 0.5) return { type: 'buyDevCard' };
      const playable = priv.devCards.find((c) => c.playable && c.type !== 'knight');
      if (playable && rng() < 0.5) {
        if (playable.type === 'monopoly') return { type: 'playMonopoly', resource: pick(rng, RESOURCES) };
        if (playable.type === 'yearOfPlenty') {
          const avail = RESOURCES.filter((x) => pub.bank[x] >= 2);
          if (avail.length) {
            const r = pick(rng, avail);
            return { type: 'playYearOfPlenty', resources: [r, r] };
          }
        }
        if (playable.type === 'roadBuilding' && roads.length && meP.pieces.roads > 0) return { type: 'playRoadBuilding' };
      }
      for (const give of RESOURCES) {
        if (res[give] >= priv.tradeRatios[give] + 1 && rng() < 0.5) {
          const receive = RESOURCES.filter((r) => r !== give && pub.bank[r] > 0);
          if (receive.length) return { type: 'bankTrade', give, receive: pick(rng, receive) };
        }
      }
      return { type: 'endTurn' };
    }
    default:
      return null;
  }
}

// ───────────────────────── средний и сложный ─────────────────────────

/** Сколько «точек» на кубиках даёт каждый ресурс игроку (город — вдвое). */
function production(pub: PublicState, pid: PlayerId): ResourceMap {
  const topo = topologyFor(pub.board.layout);
  const hexById = new Map(pub.board.hexes.map((h) => [h.id, h]));
  const out = emptyResources();
  for (const [v, b] of Object.entries(pub.buildings)) {
    if (b.owner !== pid) continue;
    for (const hid of topo.vertices.get(v)!.hexes) {
      const h = hexById.get(hid)!;
      if (h.terrain === 'desert' || hid === pub.robberHex) continue;
      out[TERRAIN_RESOURCE[h.terrain]] += pips(h.number) * (b.kind === 'city' ? 2 : 1);
    }
  }
  return out;
}

function harborAt(pub: PublicState, v: VertexId) {
  const topo = topologyFor(pub.board.layout);
  return pub.board.harbors.find((h) => topo.edges.get(h.edge)?.vertices.includes(v))?.type;
}

/** Насколько хорошо поставить поселение на перекрёсток v. */
function vertexScore(ctx: BotContext, v: VertexId, mine: ResourceMap): number {
  const { pub, level } = ctx;
  const topo = topologyFor(pub.board.layout);
  const hexById = new Map(pub.board.hexes.map((h) => [h.id, h]));
  const gained = emptyResources();
  let total = 0;
  for (const hid of topo.vertices.get(v)!.hexes) {
    const h = hexById.get(hid)!;
    if (h.terrain === 'desert') continue;
    let p = pips(h.number);
    if (hid === pub.robberHex) p *= 0.5;
    total += p;
    gained[TERRAIN_RESOURCE[h.terrain]] += p;
  }
  const kinds = RESOURCES.filter((r) => gained[r] > 0);
  let score = total + kinds.length * 1.2;
  for (const r of kinds) if (mine[r] === 0) score += level === 'hard' ? 1.8 : 1;
  if (level === 'hard') {
    // Пшеница и руда нужны для городов и карт
    score += 0.2 * (gained.wheat + gained.ore);
    const harbor = harborAt(pub, v);
    if (harbor === 'any') score += 1;
    else if (harbor && mine[harbor] + gained[harbor] >= 5) score += 2.5;
  } else if (harborAt(pub, v)) {
    score += 0.5;
  }
  return score;
}

/** Чем полезна дорога: ведёт ли к хорошему свободному месту под поселение. */
function edgeScore(ctx: BotContext, e: EdgeId, mine: ResourceMap): number {
  const { pub, me } = ctx;
  const topo = topologyFor(pub.board.layout);
  let best = 0;
  for (const u of topo.edges.get(e)!.vertices) {
    const b = pub.buildings[u];
    if (b && b.owner !== me) continue;
    if (!b && satisfiesDistance(pub, u)) best = Math.max(best, vertexScore(ctx, u, mine) + 2);
    for (const w of topo.vertices.get(u)!.neighbors) {
      if (!pub.buildings[w] && satisfiesDistance(pub, w)) best = Math.max(best, vertexScore(ctx, w, mine) * 0.7);
    }
  }
  return best;
}

function bestBy<T>(items: readonly T[], score: (x: T) => number): T | undefined {
  let best: T | undefined;
  let bestScore = -Infinity;
  for (const x of items) {
    const s = score(x);
    if (s > bestScore) {
      bestScore = s;
      best = x;
    }
  }
  return best;
}

const deficit = (hand: ResourceMap, cost: ResourceMap) => RESOURCES.reduce((d, r) => d + Math.max(0, cost[r] - hand[r]), 0);

/** Очки лидера среди соперников и сам лидер. */
function leader(pub: PublicState, me: PlayerId): { id?: PlayerId; points: number } {
  let id: PlayerId | undefined;
  let points = -1;
  for (const p of pub.order) {
    if (p !== me && pub.players[p].points > points) {
      points = pub.players[p].points;
      id = p;
    }
  }
  return { id, points };
}

/** К чему бот сейчас копит. */
function chooseGoal(ctx: BotContext): Goal | null {
  const { pub, priv, me } = ctx;
  const meP = pub.players[me];
  const options: Goal[] = [];
  if (meP.pieces.cities > 0 && legalCityVertices(pub, me).length) options.push('city');
  if (meP.pieces.settlements > 0 && legalSettlementVertices(pub, me).length) options.push('settlement');
  if (meP.pieces.roads > 0 && legalRoadEdges(pub, me).length && !options.includes('settlement')) options.push('road');
  if (pub.devDeckCount > 0) options.push('devCard');
  if (!options.length) return null;
  // Небольшой штраф за менее приоритетные цели
  return bestBy(options, (g) => -(deficit(priv.resources, GOAL_COST[g]) + options.indexOf(g) * 0.6)) ?? null;
}

function smartAccepts(ctx: BotContext): boolean {
  const { pub, priv, me, level } = ctx;
  const trade = pub.trade!;
  if (!hasResources(priv.resources, trade.want)) return false;
  const offerer = pub.order[pub.current];
  // лидеру у самой победы не помогаем
  const danger = pub.settings.vpToWin - (level === 'hard' ? 3 : 2);
  if (pub.players[offerer].points >= danger) return false;
  // 1 к 1 или в нашу пользу; сложный бот не отдаёт больше, чем получает
  const fair = totalResources(trade.want) <= totalResources(trade.give) + (level === 'hard' ? 0 : 1);
  if (!fair) return false;
  return tradeGain(ctx, trade.give, trade.want) > 0.05;
}

/**
 * Насколько обмен полезен боту: ближе ли он ко всем своим целям (главная цель весит больше всех),
 * плюс ценность карт — то, что бот сам почти не добывает, ценнее того, чего у него в избытке.
 * > 0 — выгодно или хотя бы не вредно и даёт редкий ресурс.
 */
export function tradeGain(ctx: BotContext, getMap: ResourceMap, giveMap: ResourceMap): number {
  const { pub, priv, me } = ctx;
  const meP = pub.players[me];
  const goals: Goal[] = [];
  if (meP.pieces.cities > 0 && legalCityVertices(pub, me).length) goals.push('city');
  if (meP.pieces.settlements > 0 && legalSettlementVertices(pub, me).length) goals.push('settlement');
  if (meP.pieces.roads > 0 && legalRoadEdges(pub, me).length) goals.push('road');
  if (pub.devDeckCount > 0) goals.push('devCard');
  if (!goals.length) return -1;
  const main = chooseGoal(ctx);
  const need = (hand: ResourceMap) => goals.reduce((s, g) => s + (g === main ? 1 : 0.4) * deficit(hand, GOAL_COST[g]), 0);
  const after = { ...priv.resources };
  for (const r of RESOURCES) after[r] += getMap[r] - giveMap[r];
  const prod = production(pub, me);
  const rare = (r: Resource) => 1 / (1 + prod[r] / 4);
  const cards = (m: ResourceMap) => RESOURCES.reduce((s, r) => s + m[r] * rare(r), 0);
  return need(priv.resources) - need(after) + 0.25 * (cards(getMap) - cards(giveMap));
}

/** Какие карты сбросить на семёрке: оставляем то, что нужно для цели. */
function smartDiscard(ctx: BotContext): ResourceMap {
  const hand = { ...ctx.priv.resources };
  const goal = chooseGoal(ctx);
  const keep = goal ? GOAL_COST[goal] : emptyResources();
  const out = emptyResources();
  for (let i = 0; i < ctx.priv.mustDiscard; i++) {
    const r = bestBy(
      RESOURCES.filter((x) => hand[x] > 0),
      (x) => hand[x] - keep[x] + ctx.rng() * 0.1,
    )!;
    hand[r] -= 1;
    out[r] += 1;
  }
  return out;
}

/** Куда поставить разбойника и кого ограбить. */
function smartRobber(ctx: BotContext): Action {
  const { pub, me, level } = ctx;
  const topo = topologyFor(pub.board.layout);
  const lead = leader(pub, me);
  const hex = bestBy(
    pub.board.hexes.filter((h) => h.id !== pub.robberHex),
    (h) => {
      let s = 0;
      for (const v of topo.hexes.get(h.id)!.vertices) {
        const b = pub.buildings[v];
        if (!b) continue;
        const weight = b.kind === 'city' ? 2 : 1;
        if (b.owner === me) s -= 20 * weight;
        else {
          const pts = pub.players[b.owner].points;
          const leaderBonus = level === 'hard' && b.owner === lead.id ? 1.6 : 1;
          s += pips(h.number) * weight * (1 + pts * 0.15) * leaderBonus;
          if (pub.players[b.owner].resourceCount > 0) s += 1;
        }
      }
      return s + ctx.rng() * 0.01;
    },
  )!.id as HexId;
  const victims = playersAtHex(pub, hex, me).filter((p) => pub.players[p].resourceCount > 0);
  const victim = bestBy(victims, (p) =>
    level === 'hard'
      ? pub.players[p].points * 10 + pub.players[p].resourceCount
      : pub.players[p].resourceCount + pub.players[p].points * 0.5,
  );
  return { type: 'moveRobber', hex, ...(victim ? { victim } : {}) };
}

/** Разбойник стоит на гексе, который приносит доход боту. */
function robberHurtsMe(pub: PublicState, me: PlayerId): boolean {
  return playersAtHex(pub, pub.robberHex).includes(me) && !!pub.board.hexes.find((h) => h.id === pub.robberHex)?.number;
}

function wantsKnight(ctx: BotContext): boolean {
  const { pub, priv, me, level } = ctx;
  if (!priv.devCards.some((c) => c.type === 'knight' && c.playable)) return false;
  if (robberHurtsMe(pub, me)) return true;
  if (level !== 'hard') return false;
  const mine = pub.players[me].knightsPlayed + 1;
  const holder = pub.largestArmy;
  const holderKnights = holder ? pub.players[holder].knightsPlayed : 2;
  return holder !== me && mine >= 3 && mine > holderKnights;
}

function decideSmart(ctx: BotContext): Action | null {
  const { pub, priv, me, level, rng } = ctx;
  if (pub.phase === 'discard') return priv.mustDiscard ? { type: 'discard', resources: smartDiscard(ctx) } : null;
  const response = pendingTradeResponse(ctx);
  if (response) return response;
  if (!isMyTurn(ctx)) return null;

  const mine = production(pub, me);
  const meP = pub.players[me];

  switch (pub.phase) {
    case 'setup': {
      if (pub.setup?.step === 'road') {
        const edges = legalRoadEdges(pub, me, pub.setup.lastVertex);
        return { type: 'buildRoad', edge: bestBy(edges, (e) => edgeScore(ctx, e, mine) + rng() * 0.01)! };
      }
      const spots = legalSettlementVertices(pub, me, true);
      return { type: 'buildSettlement', vertex: bestBy(spots, (v) => vertexScore(ctx, v, mine) + rng() * 0.3)! };
    }
    case 'roll':
      return wantsKnight(ctx) ? { type: 'playKnight' } : { type: 'rollDice' };
    case 'moveRobber':
      return smartRobber(ctx);
    case 'roadBuilding': {
      const edges = legalRoadEdges(pub, me);
      return { type: 'buildRoad', edge: bestBy(edges, (e) => edgeScore(ctx, e, mine) + rng() * 0.01)! };
    }
    case 'main':
      return smartMain(ctx, mine, meP.pieces);
    default:
      return null;
  }
}

function smartMain(ctx: BotContext, mine: ResourceMap, pieces: { roads: number; settlements: number; cities: number }): Action | null {
  const { pub, priv, me, level, rng, memory } = ctx;
  const res = priv.resources;

  // Своё предложение обмена: подтверждаем выгодный ответ или отменяем
  if (pub.trade) {
    const trade = pub.trade;
    const others = pub.order.filter((p) => p !== me);
    const yes = others.find((p) => {
      const r = trade.responses?.[p];
      if (r?.kind === 'accept') return hasResources(res, trade.give);
      return false;
    });
    if (yes) return { type: 'confirmTrade', tradeId: trade.id, with: yes };
    const allAnswered = others.every((p) => trade.responses?.[p]);
    const waited = memory.offeredAt !== undefined && ctx.now - memory.offeredAt > TRADE_WAIT_MS;
    return allAnswered || waited ? { type: 'cancelTrade' } : null;
  }

  // 1. Город — лучший по доходу
  const cities = legalCityVertices(pub, me);
  if (pieces.cities > 0 && cities.length && hasResources(res, COSTS.city)) {
    return { type: 'buildCity', vertex: bestBy(cities, (v) => vertexScore(ctx, v, emptyResources()))! };
  }
  // 2. Поселение — лучшее место
  const spots = legalSettlementVertices(pub, me);
  if (pieces.settlements > 0 && spots.length && hasResources(res, COSTS.settlement)) {
    return { type: 'buildSettlement', vertex: bestBy(spots, (v) => vertexScore(ctx, v, mine))! };
  }

  const goal = chooseGoal(ctx);
  const goalCost = goal ? GOAL_COST[goal] : emptyResources();

  // 3. Карты развития
  if (!pub.devCardPlayed) {
    const card = (t: string) => priv.devCards.find((c) => c.type === t && c.playable);
    if (card('knight') && wantsKnight(ctx)) return { type: 'playKnight' };
    if (card('yearOfPlenty') && goal) {
      const need: Resource[] = [];
      for (const r of RESOURCES) for (let i = res[r]; i < goalCost[r]; i++) need.push(r);
      const take = [...need, ...RESOURCES.filter((r) => r === 'ore' || r === 'wheat')]
        .filter((r, i, arr) => pub.bank[r] - arr.slice(0, i).filter((x) => x === r).length > 0)
        .slice(0, 2);
      if (take.length === 2) return { type: 'playYearOfPlenty', resources: [take[0], take[1]] };
    }
    if (card('monopoly')) {
      // Оцениваем, у кого сколько может быть: по доходу соперников (честно — только публичные данные)
      const est = emptyResources();
      for (const p of pub.order) if (p !== me) for (const r of RESOURCES) est[r] += production(pub, p)[r];
      const r = bestBy(RESOURCES, (x) => est[x] + goalCost[x] * 2)!;
      if (est[r] >= (level === 'hard' ? 6 : 8)) return { type: 'playMonopoly', resource: r };
    }
    if (card('roadBuilding') && pieces.roads > 0 && legalRoadEdges(pub, me).length && (!spots.length || level === 'hard')) {
      return { type: 'playRoadBuilding' };
    }
  }

  // 4. Дорога — если некуда ставить поселение или (сложный) гонка за длинную дорогу
  const roads = legalRoadEdges(pub, me);
  if (pieces.roads > 0 && roads.length && hasResources(res, COSTS.road)) {
    const myLen = pub.players[me].roadLength;
    const maxOther = Math.max(0, ...pub.order.filter((p) => p !== me).map((p) => pub.players[p].roadLength));
    const chase = level === 'hard' && pub.longestRoad !== me && myLen >= 3 && myLen >= maxOther - 1;
    if (!spots.length || chase) {
      return { type: 'buildRoad', edge: bestBy(roads, (e) => edgeScore(ctx, e, mine) + rng() * 0.01)! };
    }
  }

  // 5. Карта развития — если не мешает цели или карт слишком много
  if (pub.devDeckCount > 0 && hasResources(res, COSTS.devCard)) {
    const after = { ...res };
    for (const r of RESOURCES) after[r] -= COSTS.devCard[r];
    const hurts = goal && goal !== 'devCard' && deficit(after, goalCost) > deficit(res, goalCost);
    if (!hurts || totalResources(res) > 7) return { type: 'buyDevCard' };
  }

  // 6. Обмен с банком под цель
  if (goal) {
    const need = RESOURCES.filter((r) => res[r] < goalCost[r] && pub.bank[r] > 0);
    const spare = RESOURCES.filter((r) => res[r] - goalCost[r] >= priv.tradeRatios[r]);
    if (need.length && spare.length) {
      const give = bestBy(spare, (r) => res[r] - goalCost[r] - priv.tradeRatios[r])!;
      return { type: 'bankTrade', give, receive: need[0] };
    }
  }

  // 7. Предложить обмен людям/ботам (раз в ход)
  const offerChance = level === 'hard' ? 0.75 : 0.45;
  if (goal && memory.offeredTurn !== pub.turn && rng() < offerChance) {
    const missing = deficit(res, goalCost);
    const need = RESOURCES.find((r) => res[r] < goalCost[r]);
    const spare = bestBy(
      RESOURCES.filter((r) => res[r] - goalCost[r] >= 1 && r !== need),
      (r) => res[r] - goalCost[r],
    );
    if (need && spare && missing <= 2) {
      memory.offeredTurn = pub.turn;
      memory.offeredAt = ctx.now;
      return { type: 'offerTrade', give: resourceMap({ [spare]: 1 }), want: resourceMap({ [need]: 1 }) };
    }
  }

  // 8. Сложный: не держим больше 7 карт перед чужими бросками
  if (level === 'hard' && totalResources(res) > 7) {
    const give = bestBy(
      RESOURCES.filter((r) => res[r] >= priv.tradeRatios[r]),
      (r) => res[r] - goalCost[r],
    );
    const receive = bestBy(
      RESOURCES.filter((r) => r !== give && pub.bank[r] > 0),
      (r) => goalCost[r] - res[r],
    );
    if (give && receive) return { type: 'bankTrade', give, receive };
  }

  return { type: 'endTurn' };
}
