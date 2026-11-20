// Главная точка входа движка: applyAction / applyHostAction.
//
// Каждый вызов работает с копией состояния. Если правило нарушено, обработчик
// бросает RuleError, копия выбрасывается — состояние не меняется частично.

import type { Action, HostAction } from './actions';
import type { GameEvent } from './events';
import type { GameState, Phase, TradeResponse } from './state';
import { currentPlayerId } from './state';
import type { HexId, PlayerId, Resource, ResourceMap } from './types';
import type { BotLevel } from './types';
import {
  BOT_LEVELS,
  RESOURCES,
  addResources,
  emptyResources,
  hasResources,
  isResource,
  isValidResourceMap,
  resourceMap,
  totalResources,
} from './types';
import { COSTS, DICE_DECK_RESHUFFLE_AT, DISCARD_LIMIT, LOG_LIMIT } from './constants';
import type { Rng } from './rng';
import { newDiceDeck, pick, rollDie } from './rng';
import {
  canBuildCity,
  canBuildRoad,
  canBuildSettlement,
  legalRoadEdges,
  legalSettlementVertices,
  playersAtHex,
  tradeRatios,
} from './rules/placement';
import { checkWinner, updateLargestArmy, updateLongestRoad } from './rules/scoring';
import { giveSetupResources, produce } from './rules/production';

export class RuleError extends Error {}

function fail(message: string): never {
  throw new RuleError(message);
}

export type ActionResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string };

type Ctx = { s: GameState; actor: PlayerId; rng: Rng; events: GameEvent[] };

// ───────────────────────── вход ─────────────────────────

export function applyAction(state: GameState, actor: PlayerId, action: Action, rng: Rng): ActionResult {
  return run(state, (s, events) => {
    if (s.phase === 'finished') fail('Игра уже закончилась');
    if (!Object.hasOwn(s.players, actor)) fail('Ты не участник этой игры');
    const type = action?.type as Action['type'];
    const handler = typeof type === 'string' && Object.hasOwn(HANDLERS, type) ? HANDLERS[type] : undefined;
    if (!handler) fail('Неизвестное действие');
    handler({ s, actor, rng, events }, action as never);
  });
}

export function applyHostAction(state: GameState, action: HostAction, rng: Rng): ActionResult {
  return run(state, (s, events) => {
    if (s.phase === 'finished') fail('Игра уже закончилась');
    switch (action.type) {
      case 'skipTurn':
        return skipTurn(s, rng, events);
      case 'forceDiscard':
        return forceDiscard(s, action.player, rng, events);
      case 'handToBot':
        return handToBot(s, action.player, action.level, !!action.auto, events);
      case 'kick':
        return kick(s, action.player, action.level, events);
      default:
        fail('Неизвестное действие хоста');
    }
  });
}

function run(state: GameState, body: (s: GameState, events: GameEvent[]) => void): ActionResult {
  const s = structuredClone(state);
  const events: GameEvent[] = [];
  try {
    body(s, events);
    checkWinner(s, events);
    appendLog(s, events);
    return { ok: true, state: s, events };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message };
    throw e;
  }
}

function appendLog(s: GameState, events: GameEvent[]): void {
  for (const e of events) {
    s.logSeq += 1;
    s.log.push({ ...e, seq: s.logSeq });
  }
  if (s.log.length > LOG_LIMIT) s.log = s.log.slice(-LOG_LIMIT);
}

// ───────────────────────── проверки ─────────────────────────

function requireTurn(c: Ctx): void {
  if (currentPlayerId(c.s) !== c.actor) fail('Сейчас не твой ход');
}

const PHASE_HINT: Record<Phase, string> = {
  setup: 'Сейчас идёт расстановка',
  roll: 'Сначала брось кубики',
  discard: 'Ждём, пока игроки сбросят карты',
  moveRobber: 'Сначала переставь разбойника',
  main: 'Сейчас этого сделать нельзя',
  roadBuilding: 'Сначала поставь бесплатные дороги',
  finished: 'Игра уже закончилась',
};

function requirePhase(c: Ctx, ...phases: Phase[]): void {
  if (!phases.includes(c.s.phase)) fail(PHASE_HINT[c.s.phase]);
}

function pay(c: Ctx, cost: ResourceMap): void {
  const p = c.s.players[c.actor];
  if (!hasResources(p.resources, cost)) fail('Не хватает ресурсов');
  addResources(p.resources, cost, -1);
  addResources(c.s.bank, cost, 1);
}

function requireResourceMap(m: unknown): ResourceMap {
  if (!isValidResourceMap(m)) fail('Неверный набор карт');
  return resourceMap(m);
}

// ───────────────────────── обработчики ─────────────────────────

type Handlers = { [K in Action['type']]: (c: Ctx, a: Extract<Action, { type: K }>) => void };

const HANDLERS: Handlers = {
  buildSettlement(c, a) {
    requireTurn(c);
    const { s, actor } = c;
    const p = s.players[actor];
    if (s.phase === 'setup') {
      if (s.setup!.step !== 'settlement') fail('Сначала поставь дорогу к своему поселению');
      if (!canBuildSettlement(s, actor, a.vertex, true)) fail('Сюда нельзя поставить поселение');
      s.buildings[a.vertex] = { owner: actor, kind: 'settlement' };
      p.pieces.settlements -= 1;
      c.events.push({ type: 'built', player: actor, kind: 'settlement', at: a.vertex, free: true });
      if (s.setup!.round === 2) giveSetupResources(s, actor, a.vertex, c.events);
      s.setup = { ...s.setup!, step: 'road', lastVertex: a.vertex };
      return;
    }
    requirePhase(c, 'main');
    if (p.pieces.settlements <= 0) fail('Поселения закончились — улучши какое-нибудь до города');
    if (!canBuildSettlement(s, actor, a.vertex)) fail('Сюда нельзя поставить поселение');
    pay(c, COSTS.settlement);
    s.buildings[a.vertex] = { owner: actor, kind: 'settlement' };
    p.pieces.settlements -= 1;
    c.events.push({ type: 'built', player: actor, kind: 'settlement', at: a.vertex });
    updateLongestRoad(s, c.events);
  },

  buildRoad(c, a) {
    requireTurn(c);
    const { s, actor } = c;
    const p = s.players[actor];
    if (s.phase === 'setup') {
      if (s.setup!.step !== 'road') fail('Сначала поставь поселение');
      if (!canBuildRoad(s, actor, a.edge, s.setup!.lastVertex)) fail('Дорога должна примыкать к только что поставленному поселению');
      s.roads[a.edge] = actor;
      p.pieces.roads -= 1;
      c.events.push({ type: 'built', player: actor, kind: 'road', at: a.edge, free: true });
      advanceSetup(c);
      return;
    }
    requirePhase(c, 'main', 'roadBuilding');
    if (p.pieces.roads <= 0) fail('Дороги закончились');
    if (!canBuildRoad(s, actor, a.edge)) fail('Сюда нельзя поставить дорогу');
    const free = s.phase === 'roadBuilding';
    if (!free) pay(c, COSTS.road);
    s.roads[a.edge] = actor;
    p.pieces.roads -= 1;
    c.events.push({ type: 'built', player: actor, kind: 'road', at: a.edge, ...(free ? { free } : {}) });
    updateLongestRoad(s, c.events);
    if (free) {
      s.roadBuildingLeft = (s.roadBuildingLeft ?? 1) - 1;
      if (s.roadBuildingLeft <= 0 || p.pieces.roads <= 0 || legalRoadEdges(s, actor).length === 0) {
        finishRoadBuilding(s);
      }
    }
  },

  buildCity(c, a) {
    requireTurn(c);
    requirePhase(c, 'main');
    const { s, actor } = c;
    const p = s.players[actor];
    if (p.pieces.cities <= 0) fail('Города закончились');
    if (!canBuildCity(s, actor, a.vertex)) fail('Город можно построить только на месте своего поселения');
    pay(c, COSTS.city);
    s.buildings[a.vertex] = { owner: actor, kind: 'city' };
    p.pieces.cities -= 1;
    p.pieces.settlements += 1;
    c.events.push({ type: 'built', player: actor, kind: 'city', at: a.vertex });
  },

  buyDevCard(c) {
    requireTurn(c);
    requirePhase(c, 'main');
    const { s, actor } = c;
    if (s.devDeck.length === 0) fail('Карты развития закончились');
    pay(c, COSTS.devCard);
    const card = s.devDeck.pop()!;
    s.players[actor].devCards.push({ type: card, boughtTurn: s.turn });
    c.events.push({ type: 'devCardBought', player: actor });
  },

  rollDice(c) {
    requireTurn(c);
    requirePhase(c, 'roll');
    const { s, actor } = c;
    const dice = throwDice(s, c.rng);
    const total = dice[0] + dice[1];
    s.dice = dice;
    c.events.push({ type: 'diceRolled', player: actor, dice, total });
    if (total !== 7) {
      produce(s, total, c.events);
      s.phase = 'main';
      return;
    }
    const pending: Record<PlayerId, number> = {};
    for (const pid of s.order) {
      const n = totalResources(s.players[pid].resources);
      if (n > DISCARD_LIMIT) pending[pid] = Math.floor(n / 2);
    }
    s.resumePhase = 'main';
    if (Object.keys(pending).length > 0) {
      s.pendingDiscards = pending;
      s.phase = 'discard';
      c.events.push({ type: 'mustDiscard', players: pending });
    } else {
      s.phase = 'moveRobber';
    }
  },

  discard(c, a) {
    requirePhase(c, 'discard');
    const { s, actor } = c;
    const need = s.pendingDiscards?.[actor];
    if (!need) fail('Тебе не нужно сбрасывать карты');
    const cards = requireResourceMap(a.resources);
    if (totalResources(cards) !== need) fail(`Нужно сбросить ровно ${need} ${plural(need, 'карту', 'карты', 'карт')}`);
    const p = s.players[actor];
    if (!hasResources(p.resources, cards)) fail('У тебя нет таких карт');
    addResources(p.resources, cards, -1);
    addResources(s.bank, cards, 1);
    c.events.push({ type: 'discarded', player: actor, count: need });
    finishDiscard(s, actor);
  },

  moveRobber(c, a) {
    requireTurn(c);
    requirePhase(c, 'moveRobber');
    moveRobberAndSteal(c.s, c.actor, a.hex, a.victim, c.rng, c.events);
  },

  playKnight(c) {
    const { s, actor } = c;
    takeDevCard(c, 'knight');
    s.players[actor].knightsPlayed += 1;
    c.events.push({ type: 'devCardPlayed', player: actor, card: 'knight' });
    updateLargestArmy(s, actor, c.events);
    s.resumePhase = s.phase as 'roll' | 'main';
    s.phase = 'moveRobber';
  },

  playRoadBuilding(c) {
    const { s, actor } = c;
    takeDevCard(c, 'roadBuilding');
    const p = s.players[actor];
    if (p.pieces.roads <= 0 || legalRoadEdges(s, actor).length === 0) fail('Сейчас некуда поставить дороги');
    c.events.push({ type: 'devCardPlayed', player: actor, card: 'roadBuilding' });
    s.resumePhase = s.phase as 'roll' | 'main';
    s.roadBuildingLeft = Math.min(2, p.pieces.roads);
    s.phase = 'roadBuilding';
  },

  playYearOfPlenty(c, a) {
    const { s, actor } = c;
    takeDevCard(c, 'yearOfPlenty');
    const list = a.resources;
    if (!Array.isArray(list) || list.length !== 2 || !list.every(isResource)) fail('Выбери два ресурса');
    const want = emptyResources();
    for (const r of list) want[r] += 1;
    if (!hasResources(s.bank, want)) fail('В банке нет столько таких карт');
    addResources(s.bank, want, -1);
    addResources(s.players[actor].resources, want, 1);
    c.events.push({ type: 'devCardPlayed', player: actor, card: 'yearOfPlenty' });
    c.events.push({ type: 'yearOfPlenty', player: actor, resources: [...list] });
  },

  playMonopoly(c, a) {
    const { s, actor } = c;
    takeDevCard(c, 'monopoly');
    if (!isResource(a.resource)) fail('Выбери ресурс');
    let total = 0;
    for (const pid of s.order) {
      if (pid === actor) continue;
      const n = s.players[pid].resources[a.resource];
      s.players[pid].resources[a.resource] = 0;
      total += n;
    }
    s.players[actor].resources[a.resource] += total;
    c.events.push({ type: 'devCardPlayed', player: actor, card: 'monopoly' });
    c.events.push({ type: 'monopoly', player: actor, resource: a.resource, total });
  },

  bankTrade(c, a) {
    requireTurn(c);
    requirePhase(c, 'main');
    const { s, actor } = c;
    if (!isResource(a.give) || !isResource(a.receive)) fail('Выбери ресурсы для обмена');
    if (a.give === a.receive) fail('Нельзя менять ресурс на такой же');
    const times = a.times ?? 1;
    if (!Number.isInteger(times) || times < 1) fail('Неверное количество');
    const ratio = tradeRatios(s, actor)[a.give];
    const giveCount = ratio * times;
    const p = s.players[actor];
    if (p.resources[a.give] < giveCount) fail(`Нужно ${giveCount} ${plural(giveCount, 'карта', 'карты', 'карт')} этого ресурса`);
    if (s.bank[a.receive] < times) fail('В банке не осталось столько карт этого ресурса');
    p.resources[a.give] -= giveCount;
    s.bank[a.give] += giveCount;
    s.bank[a.receive] -= times;
    p.resources[a.receive] += times;
    c.events.push({ type: 'bankTrade', player: actor, give: a.give, giveCount, receive: a.receive, receiveCount: times });
  },

  offerTrade(c, a) {
    requireTurn(c);
    requirePhase(c, 'main');
    const { s, actor } = c;
    const { give, want } = validateTradeTerms(a.give, a.want);
    if (!hasResources(s.players[actor].resources, give)) fail('У тебя нет этих карт');
    s.tradeSeq += 1;
    s.trade = { id: s.tradeSeq, give, want, responses: {} };
    c.events.push({ type: 'tradeOffered', player: actor, tradeId: s.trade.id, give, want });
  },

  respondTrade(c, a) {
    requirePhase(c, 'main');
    const { s, actor } = c;
    const trade = s.trade;
    if (!trade || trade.id !== a.tradeId) fail('Это предложение уже неактуально');
    if (actor === currentPlayerId(s)) fail('Нельзя отвечать на своё предложение');
    const mine = s.players[actor].resources;
    let response: TradeResponse;
    if (a.kind === 'accept') {
      if (!hasResources(mine, trade.want)) fail('У тебя нет нужных карт');
      response = { kind: 'accept' };
    } else if (a.kind === 'decline') {
      response = { kind: 'decline' };
    } else if (a.kind === 'counter') {
      const { give, want } = validateTradeTerms(a.give, a.want);
      if (!hasResources(mine, want)) fail('У тебя нет карт для такого предложения');
      response = { kind: 'counter', give, want };
    } else {
      fail('Неверный ответ');
    }
    trade.responses[actor] = response;
    c.events.push({ type: 'tradeResponded', player: actor, tradeId: trade.id, kind: response.kind });
  },

  confirmTrade(c, a) {
    requireTurn(c);
    requirePhase(c, 'main');
    const { s, actor } = c;
    const trade = s.trade;
    if (!trade || trade.id !== a.tradeId) fail('Это предложение уже неактуально');
    const response = trade.responses[a.with];
    if (!response || response.kind === 'decline') fail('Этот игрок не согласился на обмен');
    const terms = response.kind === 'counter' ? response : trade;
    const me = s.players[actor];
    const partner = s.players[a.with];
    if (!hasResources(me.resources, terms.give)) fail('У тебя уже нет нужных карт');
    if (!hasResources(partner.resources, terms.want)) fail('У игрока уже нет нужных карт');
    addResources(me.resources, terms.give, -1);
    addResources(partner.resources, terms.give, 1);
    addResources(partner.resources, terms.want, -1);
    addResources(me.resources, terms.want, 1);
    c.events.push({ type: 'tradeCompleted', from: actor, to: a.with, give: terms.give, want: terms.want });
    delete s.trade;
  },

  handToBot(c, a) {
    handToBot(c.s, c.actor, a.level, false, c.events);
  },

  returnFromBot(c) {
    const p = c.s.players[c.actor];
    if (p.kicked) fail('Ведущий убрал тебя из игры');
    if (!p.away) fail('За тебя сейчас не играет бот');
    delete p.bot;
    delete p.away;
    c.events.push({ type: 'playerReturned', player: c.actor });
  },

  cancelTrade(c) {
    requireTurn(c);
    if (!c.s.trade) fail('Нет активного предложения');
    delete c.s.trade;
    c.events.push({ type: 'tradeCancelled', player: c.actor });
  },

  endTurn(c) {
    requireTurn(c);
    requirePhase(c, 'main');
    // Незакрытое предложение обмена сгорает с концом хода — сообщаем всем
    if (c.s.trade) c.events.push({ type: 'tradeCancelled', player: c.actor });
    passTurn(c.s, c.events);
  },
};

// ───────────────────────── общие шаги ─────────────────────────

function advanceSetup(c: Ctx): void {
  const s = c.s;
  const setup = s.setup!;
  const n = s.order.length;
  if (setup.round === 1) {
    if (s.current < n - 1) s.current += 1;
    else setup.round = 2; // последний игрок ставит второе поселение сразу же
  } else if (s.current > 0) {
    s.current -= 1;
  } else {
    delete s.setup;
    s.phase = 'roll';
    s.turn = 1;
    s.current = 0;
    c.events.push({ type: 'turnStarted', player: currentPlayerId(s), turn: s.turn });
    return;
  }
  s.setup = { round: setup.round, step: 'settlement' };
}

function passTurn(s: GameState, events: GameEvent[]): void {
  delete s.trade;
  delete s.resumePhase;
  delete s.roadBuildingLeft;
  delete s.pendingDiscards;
  s.devCardPlayed = false;
  s.current = (s.current + 1) % s.order.length;
  s.turn += 1;
  s.phase = 'roll';
  events.push({ type: 'turnStarted', player: currentPlayerId(s), turn: s.turn });
}

function finishRoadBuilding(s: GameState): void {
  s.phase = s.resumePhase ?? 'main';
  delete s.resumePhase;
  delete s.roadBuildingLeft;
}

function finishDiscard(s: GameState, pid: PlayerId): void {
  delete s.pendingDiscards![pid];
  if (Object.keys(s.pendingDiscards!).length === 0) {
    delete s.pendingDiscards;
    s.phase = 'moveRobber';
  }
}

/** Проверяет и забирает из руки карту развития (кроме «Победного очка»). */
function takeDevCard(c: Ctx, type: Exclude<GameState['devDeck'][number], 'victoryPoint'>): void {
  requireTurn(c);
  requirePhase(c, 'roll', 'main');
  const { s, actor } = c;
  if (s.devCardPlayed) fail('За ход можно сыграть только одну карту развития');
  const cards = s.players[actor].devCards;
  const idx = cards.findIndex((card) => card.type === type && card.boughtTurn < s.turn);
  if (idx < 0) {
    if (cards.some((card) => card.type === type)) fail('Эту карту купили в этот ход — сыграть её можно со следующего');
    fail('У тебя нет такой карты');
  }
  cards.splice(idx, 1);
  s.devCardPlayed = true;
}

/** Игроки у гекса, у которых есть хотя бы одна карта (кого можно ограбить). */
export function stealCandidates(s: GameState, hex: HexId, thief: PlayerId): PlayerId[] {
  return playersAtHex(s, hex, thief).filter((pid) => totalResources(s.players[pid].resources) > 0);
}

function moveRobberAndSteal(
  s: GameState,
  pid: PlayerId,
  hex: HexId,
  victim: PlayerId | undefined,
  rng: Rng,
  events: GameEvent[],
): void {
  if (!s.board.hexes.some((h) => h.id === hex)) fail('Такого гекса нет');
  if (hex === s.robberHex) fail('Разбойника нужно переставить на другой гекс');
  // Если ограбить можно только одного — грабим его автоматически (victim не нужен).
  const candidates = stealCandidates(s, hex, pid);
  if (victim !== undefined && !candidates.includes(victim)) fail('У этого игрока здесь нельзя украсть');
  let target: PlayerId | undefined;
  if (candidates.length === 1) target = candidates[0];
  if (candidates.length > 1) {
    if (!victim) fail('Выбери, у кого украсть карту');
    if (!candidates.includes(victim)) fail('У этого игрока здесь нельзя украсть');
    target = victim;
  }

  s.robberHex = hex;
  events.push({ type: 'robberMoved', player: pid, hex });
  if (target) {
    const resource = randomCard(s.players[target].resources, rng);
    s.players[target].resources[resource] -= 1;
    s.players[pid].resources[resource] += 1;
    events.push({ type: 'stole', thief: pid, victim: target, resource });
  }
  s.phase = s.resumePhase ?? 'main';
  delete s.resumePhase;
}

function randomCard(hand: ResourceMap, rng: Rng): Resource {
  const cards: Resource[] = [];
  for (const r of RESOURCES) for (let i = 0; i < hand[r]; i++) cards.push(r);
  return pick(rng, cards);
}

function validateTradeTerms(giveRaw: unknown, wantRaw: unknown): { give: ResourceMap; want: ResourceMap } {
  const give = requireResourceMap(giveRaw);
  const want = requireResourceMap(wantRaw);
  if (totalResources(give) === 0 || totalResources(want) === 0) fail('Нужно и отдать, и получить хотя бы по одной карте');
  if (RESOURCES.some((r) => give[r] > 0 && want[r] > 0)) fail('Один и тот же ресурс не может быть с обеих сторон');
  return { give, want };
}

// ───────────────────────── кубики ─────────────────────────

/** Обычные кубики — честный случай; сбалансированные — следующий бросок из колоды 36 комбинаций. */
function throwDice(s: GameState, rng: Rng): [number, number] {
  if (!s.settings.balancedDice) return [rollDie(rng), rollDie(rng)];
  if (!s.diceDeck || s.diceDeck.length <= DICE_DECK_RESHUFFLE_AT) s.diceDeck = newDiceDeck(rng);
  const [a, b] = s.diceDeck.pop()!;
  return [a, b];
}

// ───────────────────────── выход и возвращение ─────────────────────────

/** Игрок выходит из партии: его карты, постройки и очки остаются, ходит бот. */
function handToBot(s: GameState, pid: PlayerId, level: BotLevel, auto: boolean, events: GameEvent[]): void {
  const p = s.players[pid];
  if (!p) fail('Нет такого игрока');
  if (p.bot) fail(p.away ? 'За этого игрока уже играет бот' : 'Это и так бот');
  if (!BOT_LEVELS.includes(level)) fail('Неизвестный уровень бота');
  p.bot = level;
  p.away = true;
  events.push({ type: 'playerLeft', player: pid, level, ...(auto ? { auto: true } : {}) });
  dropTradeOf(s, pid, events);
}

/** Ведущий выгоняет игрока: бот играет за него до конца, вернуться нельзя. */
function kick(s: GameState, pid: PlayerId, level: BotLevel, events: GameEvent[]): void {
  const p = s.players[pid];
  if (!p) fail('Нет такого игрока');
  if (p.kicked) fail('Этого игрока уже выгнали');
  if (p.bot && !p.away) fail('Это бот — выгонять некого');
  if (!p.away) {
    if (!BOT_LEVELS.includes(level)) fail('Неизвестный уровень бота');
    p.bot = level;
    p.away = true;
  }
  p.kicked = true;
  events.push({ type: 'playerKicked', player: pid, level: p.bot! });
  dropTradeOf(s, pid, events);
}

/** Предложение обмена от ушедшего игрока снимаем — бот начнёт свой ход с чистого листа. */
function dropTradeOf(s: GameState, pid: PlayerId, events: GameEvent[]): void {
  if (s.trade && currentPlayerId(s) === pid) {
    delete s.trade;
    events.push({ type: 'tradeCancelled', player: pid });
  }
}

// ───────────────────────── действия хоста ─────────────────────────

function skipTurn(s: GameState, rng: Rng, events: GameEvent[]): void {
  const pid = currentPlayerId(s);
  if (s.phase === 'discard') fail('Сначала нужно дождаться сброса карт (или сбросить за игроков)');
  events.push({ type: 'turnSkipped', player: pid });

  if (s.phase === 'setup') {
    // На расстановке пропустить нельзя — ставим за игрока случайно.
    const c: Ctx = { s, actor: pid, rng, events };
    if (s.setup!.step === 'settlement') {
      HANDLERS.buildSettlement(c, { type: 'buildSettlement', vertex: pick(rng, legalSettlementVertices(s, pid, true)) });
    }
    HANDLERS.buildRoad(c, { type: 'buildRoad', edge: pick(rng, legalRoadEdges(s, pid, s.setup!.lastVertex)) });
    return;
  }
  if (s.phase === 'moveRobber') {
    // Разбойника обязательно надо переставить: ставим на случайный гекс без кражи.
    const options = s.board.hexes.filter((h) => h.id !== s.robberHex).map((h) => h.id);
    s.robberHex = pick(rng, options);
    events.push({ type: 'robberMoved', player: pid, hex: s.robberHex });
  }
  passTurn(s, events);
}

function forceDiscard(s: GameState, pid: PlayerId, rng: Rng, events: GameEvent[]): void {
  if (s.phase !== 'discard') fail('Сейчас никто не сбрасывает карты');
  const need = s.pendingDiscards?.[pid];
  if (!need) fail('Этому игроку не нужно сбрасывать карты');
  const hand = s.players[pid].resources;
  for (let i = 0; i < need; i++) {
    const r = randomCard(hand, rng);
    hand[r] -= 1;
    s.bank[r] += 1;
  }
  events.push({ type: 'discarded', player: pid, count: need, forced: true });
  finishDiscard(s, pid);
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
