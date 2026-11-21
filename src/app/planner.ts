// Планировщик хода: пока ходят другие, игрок собирает план (стройка, обмены).
// После каждого чужого хода план перепроверяется на свежей карте; в свой ход — «Выполнить план».

import type { Action, EdgeId, PlayerId, PrivateView, PublicState, Resource, ResourceMap, VertexId } from '../engine';
import {
  COSTS,
  RESOURCES,
  addResources,
  canBuildCity,
  canBuildRoad,
  canBuildSettlement,
  emptyResources,
  hasResources,
  resourceMap,
  topologyFor,
  tradeRatios,
} from '../engine';
import { RESOURCE_NAME, resourcesText } from '../i18n/ru';

export type PlanStep =
  | { id: string; kind: 'road'; at: EdgeId }
  | { id: string; kind: 'settlement'; at: VertexId }
  | { id: string; kind: 'city'; at: VertexId }
  | { id: string; kind: 'devCard' }
  | { id: string; kind: 'bank'; give: Resource; receive: Resource }
  | { id: string; kind: 'offer'; give: ResourceMap; want: ResourceMap };

export type StepStatus = 'ready' | 'short' | 'broken';

export interface CheckedStep {
  step: PlanStep;
  status: StepStatus;
  /** Чего не хватает (для short). */
  missing?: Partial<ResourceMap>;
  reason?: string;
}

export const STEP_LABEL: Record<PlanStep['kind'], string> = {
  road: 'Дорога',
  settlement: 'Поселение',
  city: 'Город',
  devCard: 'Карта развития',
  bank: 'Обмен с банком',
  offer: 'Предложить обмен',
};

/** Короткие подписи — для одной строки подсказки. */
export const STEP_SHORT: Record<PlanStep['kind'], string> = {
  road: 'Дорога',
  settlement: 'Дом',
  city: 'Город',
  devCard: 'Карта',
  bank: 'Банк',
  offer: 'Обмен',
};

export const STEP_ICON = {
  road: 'road',
  settlement: 'house',
  city: 'castle',
  devCard: 'cards',
  bank: 'bank',
  offer: 'trade',
} as const;

const costOf = (s: PlanStep): ResourceMap | null =>
  s.kind === 'road'
    ? COSTS.road
    : s.kind === 'settlement'
      ? COSTS.settlement
      : s.kind === 'city'
        ? COSTS.city
        : s.kind === 'devCard'
          ? COSTS.devCard
          : null;

function missingOf(have: ResourceMap, need: ResourceMap): Partial<ResourceMap> {
  const out: Partial<ResourceMap> = {};
  for (const r of RESOURCES) if ((need[r] ?? 0) > (have[r] ?? 0)) out[r] = need[r] - have[r];
  return out;
}

/**
 * Проверить план на текущем состоянии. Шаги проверяются по порядку,
 * как будто предыдущие уже выполнены (рука и постройки меняются).
 */
export function checkPlan(plan: PlanStep[], pub: PublicState, priv: PrivateView, me: PlayerId): CheckedStep[] {
  const hand = { ...priv.resources };
  const view = { board: pub.board, buildings: { ...pub.buildings }, roads: { ...pub.roads } };
  const ratios = tradeRatios(pub, me);
  const meP = pub.players[me];
  const pieces = { ...meP.pieces };
  const out: CheckedStep[] = [];

  for (const step of plan) {
    let placeOk = true;
    let reason: string | undefined;
    if (step.kind === 'road') {
      if (view.roads[step.at]) (placeOk = false), (reason = 'Здесь уже чужая дорога');
      else if (!canBuildRoad(view, me, step.at)) (placeOk = false), (reason = 'Сюда больше нельзя: нет связи с твоими дорогами');
      else if (pieces.roads <= 0) (placeOk = false), (reason = 'Дороги закончились');
    } else if (step.kind === 'settlement') {
      const b = view.buildings[step.at];
      if (b && b.owner !== me) (placeOk = false), (reason = `Место занято`);
      else if (!canBuildSettlement(view, me, step.at)) (placeOk = false), (reason = 'Нельзя: рядом чужая постройка или нет дороги');
      else if (pieces.settlements <= 0) (placeOk = false), (reason = 'Поселения закончились');
    } else if (step.kind === 'city') {
      if (!canBuildCity(view, me, step.at)) (placeOk = false), (reason = 'Здесь нет твоего поселения');
      else if (pieces.cities <= 0) (placeOk = false), (reason = 'Города закончились');
    } else if (step.kind === 'devCard') {
      if (pub.devDeckCount <= 0) (placeOk = false), (reason = 'Колода пуста');
    }

    if (!placeOk) {
      out.push({ step, status: 'broken', reason });
      continue;
    }

    // Ресурсы
    let need: ResourceMap | null = costOf(step);
    if (step.kind === 'bank') need = resourceMap({ [step.give]: ratios[step.give] });
    if (step.kind === 'offer') need = step.give;
    const enough = need ? hasResources(hand, need) : true;
    if (!enough) {
      out.push({ step, status: 'short', missing: missingOf(hand, need!) });
    } else {
      out.push({ step, status: 'ready' });
    }
    // Применяем шаг к симуляции (даже если не хватает — дальше считаем «как будто добыл»)
    if (need) addResources(hand, need, -1);
    for (const r of RESOURCES) if (hand[r] < 0) hand[r] = 0;
    if (step.kind === 'bank') hand[step.receive] += 1;
    if (step.kind === 'road') (view.roads[step.at] = me), pieces.roads--;
    if (step.kind === 'settlement') (view.buildings[step.at] = { owner: me, kind: 'settlement' }), pieces.settlements--;
    if (step.kind === 'city') (view.buildings[step.at] = { owner: me, kind: 'city' }), pieces.cities--, pieces.settlements++;
  }
  return out;
}

export function stepAction(step: PlanStep): Action {
  switch (step.kind) {
    case 'road':
      return { type: 'buildRoad', edge: step.at };
    case 'settlement':
      return { type: 'buildSettlement', vertex: step.at };
    case 'city':
      return { type: 'buildCity', vertex: step.at };
    case 'devCard':
      return { type: 'buyDevCard' };
    case 'bank':
      return { type: 'bankTrade', give: step.give, receive: step.receive };
    case 'offer':
      return { type: 'offerTrade', give: step.give, want: step.want };
  }
}

export function stepText(c: CheckedStep): string {
  const s = c.step;
  const base =
    s.kind === 'bank'
      ? `${RESOURCE_NAME[s.give]} → ${RESOURCE_NAME[s.receive]}`
      : s.kind === 'offer'
        ? `${resourcesText(s.give)} → ${resourcesText(s.want)}`
        : '';
  if (c.status === 'broken') return c.reason ?? 'План сломался';
  if (c.status === 'short') return `${base ? base + ' · ' : ''}не хватает ${resourcesText(c.missing)}`;
  return base || 'Готово к ходу';
}

// ─── хранение плана (у каждого игрока свой, в localStorage) ───

const key = (pin: string, me: string) => `hh.plan.${pin}.${me}`;

export function loadPlan(pin: string, me: string): PlanStep[] {
  try {
    const v = JSON.parse(localStorage.getItem(key(pin, me)) ?? '[]') as unknown;
    return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object' && typeof x.kind === 'string') as PlanStep[]) : [];
  } catch {
    return [];
  }
}

export function savePlan(pin: string, me: string, plan: PlanStep[]): void {
  try {
    localStorage.setItem(key(pin, me), JSON.stringify(plan));
  } catch {
    // без памяти — план живёт до перезагрузки
  }
}

export const newStepId = () => Math.random().toString(36).slice(2, 9);

// ─── подсказки ───

/** Чего не хватает до ближайших целей — короткие подсказки. */
export function goalHints(pub: PublicState, priv: PrivateView, me: PlayerId): string[] {
  const out: string[] = [];
  const hand = priv.resources;
  const goals: [string, ResourceMap, string][] = [
    ['город', COSTS.city, 'города'],
    ['поселение', COSTS.settlement, 'поселения'],
    ['карту развития', COSTS.devCard, 'карты развития'],
  ];
  for (const [name, cost, gen] of goals) {
    const miss = missingOf(hand, cost);
    const n = Object.values(miss).reduce((a, b) => a + (b ?? 0), 0);
    if (n === 0) out.push(`Хватает на ${name}`);
    else if (n === 1) {
      const r = Object.keys(miss)[0] as Resource;
      out.push(`До ${gen} не хватает: ${RESOURCE_NAME[r]}`);
    }
  }
  const ratios = tradeRatios(pub, me);
  for (const r of RESOURCES) {
    if (ratios[r] === 2 && hand[r] >= 2) out.push(`Гавань 2:1: выгодно сменять ${RESOURCE_NAME[r]}`);
  }
  const total = RESOURCES.reduce((a, r) => a + hand[r], 0);
  if (total > 7) out.push(`У тебя ${total} карт — на семёрке потеряешь половину. Потрать!`);
  return out.slice(0, 3);
}

/** Подсказка к чужому предложению обмена. */
export function incomingTradeHint(
  want: ResourceMap,
  give: ResourceMap,
  hand: ResourceMap,
): { canAccept: boolean; text: string } {
  const miss = missingOf(hand, want);
  const missing = RESOURCES.filter((r) => (miss[r] ?? 0) > 0);
  if (missing.length === 0) {
    const gain = RESOURCES.filter((r) => (give[r] ?? 0) > 0)
      .map((r) => RESOURCE_NAME[r])
      .join(', ');
    return { canAccept: true, text: `Тебе по силам. Получишь ${gain}` };
  }
  const names = missing.map((r) => RESOURCE_NAME[r]).join(', ');
  return {
    canAccept: false,
    text: `Бро, у тебя нет: ${names} — это предложение не к тебе. Но можешь предложить встречное.`,
  };
}

export { emptyResources };

/**
 * Куда можно спланировать поселение и какие дороги к нему нужно проложить.
 * Ключ — свободный перекрёсток (правило расстояния соблюдено), значение — кратчайшая цепочка
 * новых дорог от своей сети (пусто — дорога уже подведена). Чужие постройки путь перекрывают,
 * чужие дороги заняты. Не дальше maxRoads дорог.
 */
export function settlementRoutes(
  view: { board: PublicState['board']; buildings: PublicState['buildings']; roads: PublicState['roads'] },
  me: PlayerId,
  maxRoads = 3,
): Map<VertexId, EdgeId[]> {
  const topo = topologyFor(view.board.layout);
  const out = new Map<VertexId, EdgeId[]>();
  // старт: перекрёстки своей сети (свои постройки и концы своих дорог)
  const dist = new Map<VertexId, EdgeId[]>();
  const queue: VertexId[] = [];
  const start = (v: VertexId) => {
    if (dist.has(v)) return;
    const b = view.buildings[v];
    if (b && b.owner !== me) return;
    dist.set(v, []);
    queue.push(v);
  };
  for (const [v, b] of Object.entries(view.buildings)) if (b.owner === me) start(v);
  for (const [e, owner] of Object.entries(view.roads)) if (owner === me) for (const v of topo.edges.get(e)!.vertices) start(v);
  while (queue.length) {
    const v = queue.shift()!;
    const path = dist.get(v)!;
    if (path.length >= maxRoads) continue;
    for (const e of topo.vertices.get(v)!.edges) {
      if (view.roads[e]) continue; // занято (свои уже учтены как сеть)
      const [a, b] = topo.edges.get(e)!.vertices;
      const w = a === v ? b : a;
      if (dist.has(w)) continue;
      const occ = view.buildings[w];
      if (occ && occ.owner !== me) continue; // через чужое не пройти
      dist.set(w, [...path, e]);
      queue.push(w);
    }
  }
  for (const [v, path] of dist) {
    if (view.buildings[v]) continue;
    if (!topo.vertices.get(v)!.neighbors.every((n) => !view.buildings[n])) continue;
    // без дорог — только если к перекрёстку уже подходит своя дорога
    if (path.length === 0 && !topo.vertices.get(v)!.edges.some((e) => view.roads[e] === me)) continue;
    out.set(v, path);
  }
  return out;
}

/**
 * Шаги, которые игрок уже сделал сам (своя дорога / своё поселение / свой город на этом месте) —
 * их план убирает автоматически. Чужая постройка на месте шага — не «выполнено», шаг остаётся (сломан).
 */
export function doneSteps(plan: PlanStep[], pub: Pick<PublicState, 'roads' | 'buildings'>, me: PlayerId): Set<string> {
  const done = new Set<string>();
  for (const s of plan) {
    if (s.kind === 'road' && pub.roads[s.at] === me) done.add(s.id);
    if (s.kind === 'settlement' && pub.buildings[s.at]?.owner === me) done.add(s.id);
    if (s.kind === 'city' && pub.buildings[s.at]?.owner === me && pub.buildings[s.at]?.kind === 'city') done.add(s.id);
  }
  return done;
}

/**
 * Оценка входящего обмена для экрана предложения.
 * want — что просят у тебя, give — что дают тебе (поля TradeOffer с точки зрения предлагающего).
 * fair: −1 (ты отдаёшь сильно больше) … 0 (поровну) … +1 (получаешь сильно больше), с поправкой на пользу.
 */
export function tradeVerdict(want: ResourceMap, give: ResourceMap, hand: ResourceMap) {
  const out = RESOURCES.reduce((a, r) => a + (want[r] ?? 0), 0);
  const inn = RESOURCES.reduce((a, r) => a + (give[r] ?? 0), 0);
  const canAccept = hasResources(hand, want);
  const after = emptyResources();
  for (const r of RESOURCES) after[r] = hand[r] - (want[r] ?? 0) + (give[r] ?? 0);
  const goals: [string, ResourceMap][] = [
    ['город', COSTS.city],
    ['поселение', COSTS.settlement],
    ['карту развития', COSTS.devCard],
    ['дорогу', COSTS.road],
  ];
  const unlocks = canAccept ? goals.filter(([, c]) => !hasResources(hand, c) && hasResources(after, c)).map(([n]) => n) : [];
  const loses = canAccept ? goals.filter(([, c]) => hasResources(hand, c) && !hasResources(after, c)).map(([n]) => n) : [];
  let fair = (inn - out) / Math.max(1, inn + out);
  if (unlocks.length) fair += 0.35;
  if (loses.length) fair -= 0.35;
  fair = Math.max(-1, Math.min(1, fair));
  const ratio = `${out}:${inn}`;
  const text = !canAccept
    ? `Нечем ответить — не хватает: ${RESOURCES.filter((r) => (want[r] ?? 0) > hand[r]).map((r) => RESOURCE_NAME[r]).join(', ')}`
    : unlocks.length
      ? `Выгодно: после обмена хватит на ${unlocks[0]}`
      : loses.length
        ? `Осторожно: перестанет хватать на ${loses[0]}`
        : inn > out
          ? `Выгодно ${ratio}: получаешь больше, чем отдаёшь`
          : inn < out
            ? `Дорого ${ratio}: отдаёшь больше, чем получаешь`
            : `Честно ${ratio}`;
  return { canAccept, out, inn, after, unlocks, loses, fair, text };
}
