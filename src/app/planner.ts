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
  tradeRatios,
} from '../engine';
import { RESOURCE_ICON } from '../ui/theme';
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

export const STEP_ICON: Record<PlanStep['kind'], string> = {
  road: '🛤️',
  settlement: '🏠',
  city: '🏰',
  devCard: '📜',
  bank: '🏦',
  offer: '🤝',
};

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
      if (view.roads[step.at]) (placeOk = false), (reason = 'Здесь уже стоит дорога');
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
      ? `${RESOURCE_ICON[s.give]} → ${RESOURCE_ICON[s.receive]}`
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
  const goals: [string, ResourceMap][] = [
    ['город', COSTS.city],
    ['поселение', COSTS.settlement],
    ['карту развития', COSTS.devCard],
  ];
  for (const [name, cost] of goals) {
    const miss = missingOf(hand, cost);
    const n = Object.values(miss).reduce((a, b) => a + (b ?? 0), 0);
    if (n === 0) out.push(`Хватает на ${name} ✅`);
    else if (n === 1) {
      const r = Object.keys(miss)[0] as Resource;
      out.push(`До «${name}» не хватает 1 ${RESOURCE_ICON[r]} ${RESOURCE_NAME[r]}`);
    }
  }
  const ratios = tradeRatios(pub, me);
  for (const r of RESOURCES) {
    if (ratios[r] === 2 && hand[r] >= 2) out.push(`Гавань 2:1: можно выгодно сменять ${RESOURCE_ICON[r]}`);
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
      .map((r) => RESOURCE_ICON[r])
      .join(' ');
    return { canAccept: true, text: `Тебе по силам. Получишь ${gain}` };
  }
  const names = missing.map((r) => `${RESOURCE_ICON[r]} ${RESOURCE_NAME[r]}`).join(', ');
  return {
    canAccept: false,
    text: `Бро, у тебя нет ${names} — это предложение не к тебе. Но можешь предложить встречное 👇`,
  };
}

export { emptyResources };
