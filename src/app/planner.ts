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
import { L } from '../i18n/l';

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

/** Подписи шагов плана — геттеры: читается текущий язык. */
export const STEP_LABEL: Record<PlanStep['kind'], string> = {
  get road() { return L('Дорога', 'Жол', 'Road'); },
  get settlement() { return L('Поселение', 'Қоныс', 'Settlement'); },
  get city() { return L('Город', 'Қала', 'City'); },
  get devCard() { return L('Карта развития', 'Даму картасы', 'Development card'); },
  get bank() { return L('Обмен с банком', 'Банкпен айырбас', 'Bank trade'); },
  get offer() { return L('Предложить обмен', 'Айырбас ұсыну', 'Offer a trade'); },
};

/** Короткие подписи — для одной строки подсказки. */
export const STEP_SHORT: Record<PlanStep['kind'], string> = {
  get road() { return L('Дорога', 'Жол', 'Road'); },
  get settlement() { return L('Дом', 'Үй', 'House'); },
  get city() { return L('Город', 'Қала', 'City'); },
  get devCard() { return L('Карта', 'Карта', 'Card'); },
  get bank() { return L('Банк', 'Банк', 'Bank'); },
  get offer() { return L('Обмен', 'Айырбас', 'Trade'); },
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
      if (view.roads[step.at]) (placeOk = false), (reason = L('Здесь уже чужая дорога', 'Мұнда бөтеннің жолы бар', 'Another road is already here'));
      else if (!canBuildRoad(view, me, step.at)) (placeOk = false), (reason = L('Сюда больше нельзя: нет связи с твоими дорогами', 'Бұған енді болмайды: жолдарыңмен байланыс жоқ', 'Not allowed here anymore: no link to your roads'));
      else if (pieces.roads <= 0) (placeOk = false), (reason = L('Дороги закончились', 'Жолдар таусылды', 'No roads left'));
    } else if (step.kind === 'settlement') {
      const b = view.buildings[step.at];
      if (b && b.owner !== me) (placeOk = false), (reason = L('Место занято', 'Орын бос емес', 'Spot taken'));
      else if (!canBuildSettlement(view, me, step.at)) (placeOk = false), (reason = L('Нельзя: рядом чужая постройка или нет дороги', 'Болмайды: жанында бөтеннің құрылысы бар немесе жол жоқ', 'Not allowed: a building is adjacent or there is no road'));
      else if (pieces.settlements <= 0) (placeOk = false), (reason = L('Поселения закончились', 'Қоныстар таусылды', 'No settlements left'));
    } else if (step.kind === 'city') {
      if (!canBuildCity(view, me, step.at)) (placeOk = false), (reason = L('Здесь нет твоего поселения', 'Мұнда сенің қонысың жоқ', 'You have no settlement here'));
      else if (pieces.cities <= 0) (placeOk = false), (reason = L('Города закончились', 'Қалалар таусылды', 'No cities left'));
    } else if (step.kind === 'devCard') {
      if (pub.devDeckCount <= 0) (placeOk = false), (reason = L('Колода пуста', 'Колода бос', 'The deck is empty'));
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
  if (c.status === 'broken') return c.reason ?? L('План сломался', 'Жоспар бұзылды', 'The plan is broken');
  if (c.status === 'short') return `${base ? base + ' · ' : ''}${L('не хватает {x}', 'жетпейді: {x}', 'missing {x}', { x: resourcesText(c.missing) })}`;
  return base || L('Готово к ходу', 'Жүріске дайын', 'Ready to go');
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
  const goals: [ResourceMap, () => string, (r: string) => string][] = [
    [COSTS.city, () => L('Хватает на город', 'Қалаға жетеді', 'Enough for a city'), (r) => L('До города не хватает: {r}', 'Қалаға жетпейді: {r}', 'One short of a city: {r}', { r })],
    [COSTS.settlement, () => L('Хватает на поселение', 'Қонысқа жетеді', 'Enough for a settlement'), (r) => L('До поселения не хватает: {r}', 'Қонысқа жетпейді: {r}', 'One short of a settlement: {r}', { r })],
    [COSTS.devCard, () => L('Хватает на карту развития', 'Даму картасына жетеді', 'Enough for a development card'), (r) => L('До карты развития не хватает: {r}', 'Даму картасына жетпейді: {r}', 'One short of a development card: {r}', { r })],
  ];
  for (const [cost, enough, short] of goals) {
    const miss = missingOf(hand, cost);
    const n = Object.values(miss).reduce((a, b) => a + (b ?? 0), 0);
    if (n === 0) out.push(enough());
    else if (n === 1) {
      const r = Object.keys(miss)[0] as Resource;
      out.push(short(RESOURCE_NAME[r]));
    }
  }
  const ratios = tradeRatios(pub, me);
  for (const r of RESOURCES) {
    if (ratios[r] === 2 && hand[r] >= 2) out.push(L('Гавань 2:1: выгодно сменять {r}', 'Айлақ 2:1: {r} айырбастаған тиімді', 'Harbor 2:1: worth trading {r}', { r: RESOURCE_NAME[r] }));
  }
  const total = RESOURCES.reduce((a, r) => a + hand[r], 0);
  if (total > 7) out.push(L('У тебя {n} карт — на семёрке потеряешь половину. Потрать!', 'Сенде {n} карта — жетіде жартысын жоғалтасың. Жұмса!', 'You have {n} cards — a seven will cost you half. Spend them!', { n: total }));
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
    return { canAccept: true, text: L('Тебе по силам. Получишь {gain}', 'Қолыңнан келеді. Аласың: {gain}', "You can afford it. You'll get {gain}", { gain }) };
  }
  const names = missing.map((r) => RESOURCE_NAME[r]).join(', ');
  return {
    canAccept: false,
    text: L('Бро, у тебя нет: {names} — это предложение не к тебе. Но можешь предложить встречное.', 'Бро, сенде жоқ: {names} — бұл ұсыныс саған емес. Бірақ қарсы ұсыныс жасай аласың.', "Bro, you don't have: {names} — this offer isn't for you. But you can counter.", { names }),
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
  // названия — на текущем языке (их показывают в подсказке и сверяют тесты)
  const goals: [string, ResourceMap][] = [
    [L('город', 'қала', 'a city'), COSTS.city],
    [L('поселение', 'қоныс', 'a settlement'), COSTS.settlement],
    [L('карту развития', 'даму картасы', 'a development card'), COSTS.devCard],
    [L('дорогу', 'жол', 'a road'), COSTS.road],
  ];
  const unlocks = canAccept ? goals.filter(([, c]) => !hasResources(hand, c) && hasResources(after, c)).map(([n]) => n) : [];
  const loses = canAccept ? goals.filter(([, c]) => hasResources(hand, c) && !hasResources(after, c)).map(([n]) => n) : [];
  let fair = (inn - out) / Math.max(1, inn + out);
  if (unlocks.length) fair += 0.35;
  if (loses.length) fair -= 0.35;
  fair = Math.max(-1, Math.min(1, fair));
  const ratio = `${out}:${inn}`;
  const text = !canAccept
    ? L(
        'Нечем ответить — не хватает: {x}',
        'Жауап беруге ештеңе жоқ — жетпейді: {x}',
        "Can't accept — missing: {x}",
        { x: RESOURCES.filter((r) => (want[r] ?? 0) > hand[r]).map((r) => RESOURCE_NAME[r]).join(', ') },
      )
    : unlocks.length
      ? L('Выгодно: после обмена хватит на {x}', 'Тиімді: айырбастан кейін жетеді ({x})', 'Good deal: after the trade you can afford {x}', { x: unlocks[0] })
      : loses.length
        ? L('Осторожно: перестанет хватать на {x}', 'Абайла: енді жетпейді ({x})', "Careful: you'll no longer afford {x}", { x: loses[0] })
        : inn > out
          ? L('Выгодно {r}: получаешь больше, чем отдаёшь', 'Тиімді {r}: бергеніңнен көп аласың', 'Good deal {r}: you get more than you give', { r: ratio })
          : inn < out
            ? L('Дорого {r}: отдаёшь больше, чем получаешь', 'Қымбат {r}: алғаныңнан көп бересің', 'Expensive {r}: you give more than you get', { r: ratio })
            : L('Честно {r}', 'Әділ {r}', 'Fair {r}', { r: ratio });
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
    push({ give: { ...have }, get, label: n < giveTotal ? L('Сколько есть — и меньше взамен', 'Барын беремін — орнына азырақ сұраймын', 'What I have — for less in return') : L('Сколько есть', 'Барын беремін', 'What I have') });
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
    push({ give: g, get: { ...give }, label: L('Вместо — {r}', 'Орнына — {r}', 'Instead — {r}', { r: RESOURCE_NAME[r] }) });
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
