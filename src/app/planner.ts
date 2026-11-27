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
  /** for — id поселения, к которому ведёт эта дорога: в списке плана она свёрнута под ним. */
  | { id: string; kind: 'road'; at: EdgeId; for?: string }
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

/** Встречное предложение: что я отдаю (give) и что прошу (get). */
export interface CounterIdea {
  give: ResourceMap;
  get: ResourceMap;
  /** Коротко, чем отличается от исходного. */
  label: string;
}

const total = (m: Partial<ResourceMap>) => RESOURCES.reduce((a, r) => a + (m[r] ?? 0), 0);

/**
 * Готовые встречные, когда на чужое предложение нечем ответить.
 * want — что просит предлагающий (отдаю я), give — что он даёт (получаю я).
 *  1) «сколько есть»: отдаю, что есть из просимого, прошу пропорционально меньше;
 *  2) «вместо …»: недостающее заменяю тем, чего у меня больше всего.
 */
export function counterIdeas(want: ResourceMap, give: ResourceMap, hand: ResourceMap): CounterIdea[] {
  if (hasResources(hand, want)) return [];
  const out: CounterIdea[] = [];
  const key = (c: CounterIdea) => RESOURCES.map((r) => `${c.give[r] ?? 0}${c.get[r] ?? 0}`).join('');
  const push = (c: CounterIdea) => {
    if (total(c.give) <= 0 || total(c.get) <= 0 || !hasResources(hand, c.give)) return;
    if (out.some((o) => key(o) === key(c))) return;
    out.push(c);
  };
  const have = emptyResources();
  for (const r of RESOURCES) have[r] = Math.min(want[r] ?? 0, hand[r]);
  const missing = total(want) - total(have);
  const giveTotal = total(give);

  // 1) сколько есть — и прошу меньше
  if (total(have) > 0) {
    const n = Math.max(1, Math.round((giveTotal * total(have)) / Math.max(1, total(want))));
    const get = emptyResources();
    let left = n;
    // забираем по очереди из того, что он даёт, — чтобы набор остался похожим
    while (left > 0) {
      let moved = false;
      for (const r of RESOURCES) {
        if (left > 0 && get[r] < (give[r] ?? 0)) {
          get[r]++;
          left--;
          moved = true;
        }
      }
      if (!moved) break;
    }
    push({ give: { ...have }, get, label: n < giveTotal ? 'Сколько есть — и меньше взамен' : 'Сколько есть' });
  }

  // 2) недостающее — другим ресурсом (тем, чего больше всего и что он сам не даёт)
  const spare = RESOURCES.filter((r) => !(give[r] ?? 0))
    .map((r) => ({ r, n: hand[r] - have[r] }))
    .filter((x) => x.n >= missing)
    .sort((a, b) => b.n - a.n)
    .slice(0, 2);
  for (const { r } of spare) {
    const g = { ...have };
    g[r] += missing;
    push({ give: g, get: { ...give }, label: `Вместо — ${RESOURCE_NAME[r]}` });
  }
  return out.slice(0, 3);
}


// ─── группы шагов: поселение вместе с дорогами к нему ───

/** Пункт списка плана: главный шаг и дороги, которые к нему ведут (в плане они стоят перед ним). */
export interface PlanUnit {
  main: CheckedStep;
  roads: CheckedStep[];
  status: StepStatus;
  missing: Partial<ResourceMap>;
  reason?: string;
}

const rank: Record<StepStatus, number> = { ready: 0, short: 1, broken: 2 };

/** Собрать проверенный план в пункты: дорога с for прячется под своё поселение. */
export function planUnits(checked: CheckedStep[]): PlanUnit[] {
  const ids = new Set(checked.map((c) => c.step.id));
  const under = new Map<string, CheckedStep[]>();
  for (const c of checked) {
    if (c.step.kind === 'road' && c.step.for && ids.has(c.step.for)) {
      const list = under.get(c.step.for) ?? [];
      list.push(c);
      under.set(c.step.for, list);
    }
  }
  const out: PlanUnit[] = [];
  for (const c of checked) {
    if (c.step.kind === 'road' && c.step.for && ids.has(c.step.for)) continue;
    const roads = under.get(c.step.id) ?? [];
    const all = [...roads, c];
    const worst = all.reduce((w, x) => (rank[x.status] > rank[w.status] ? x : w), c);
    const missing: Partial<ResourceMap> = {};
    for (const x of all) for (const r of RESOURCES) if (x.missing?.[r]) missing[r] = (missing[r] ?? 0) + x.missing[r]!;
    out.push({ main: c, roads, status: worst.status, missing, reason: worst.reason });
  }
  return out;
}

/** Шаги пункта в порядке выполнения: сначала дороги, потом само поселение. */
const unitSteps = (u: PlanUnit): PlanStep[] => [...u.roads.map((r) => r.step), u.main.step];

/** Переставить пункт (вместе с его дорогами) на место другого. */
export function moveUnit(units: PlanUnit[], from: number, to: number): PlanStep[] {
  const a = [...units];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a.flatMap(unitSteps);
}

/** Убрать пункт целиком: поселение уходит вместе с дорогами к нему. */
export function removeUnit(plan: PlanStep[], u: PlanUnit): PlanStep[] {
  const drop = new Set(unitSteps(u).map((s) => s.id));
  return plan.filter((s) => !drop.has(s.id));
}

/**
 * Упорядочить план: сначала то, что можно сделать прямо сейчас (обмены с банком — раньше стройки,
 * которой они дают ресурс), потом остальное в прежнем порядке. Пункт берётся, только если после
 * уже выбранных он целиком «готов» — так дорога не встанет раньше той, от которой она идёт.
 * Возвращает null, если порядок и так лучший.
 */
export function smartOrder(plan: PlanStep[], pub: PublicState, priv: PrivateView, me: PlayerId): PlanStep[] | null {
  const units = planUnits(checkPlan(plan, pub, priv, me));
  if (units.length < 2) return null;
  const left = [...units];
  const picked: PlanStep[] = [];
  const readyAfter = (u: PlanUnit) => {
    const steps = unitSteps(u);
    const c = checkPlan([...picked, ...steps], pub, priv, me);
    return c.slice(picked.length).every((x) => x.status === 'ready');
  };
  for (;;) {
    // банк — первым, если он сам по силам и после него что-то из оставшегося становится готовым
    let i = left.findIndex((u) => u.main.step.kind === 'bank' && readyAfter(u));
    if (i < 0) i = left.findIndex((u) => u.main.step.kind !== 'offer' && readyAfter(u));
    if (i < 0) break;
    picked.push(...unitSteps(left[i]));
    left.splice(i, 1);
  }
  const next = [...picked, ...left.flatMap(unitSteps)];
  const score = (p: PlanStep[]) => {
    const c = checkPlan(p, pub, priv, me);
    let n = 0;
    while (n < c.length && c[n].status === 'ready') n++;
    return { lead: n, broken: c.filter((x) => x.status === 'broken').length };
  };
  const a = score(plan);
  const b = score(next);
  if (b.broken > a.broken || b.lead <= a.lead) return null;
  return next;
}
