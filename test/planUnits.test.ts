import { describe, expect, it } from 'vitest';
import { checkPlan, moveUnit, planUnits, removeUnit, settlementRoutes, smartOrder } from '../src/app/planner';
import type { PlanStep } from '../src/app/planner';
import { emptyResources, toPrivateView, toPublicView, topologyFor } from '../src/engine';
import { mainPhase, newGame } from './helpers';

const setup = () => {
  const s = mainPhase(newGame(3));
  const me = s.order[0];
  for (const k of Object.keys(s.buildings)) delete s.buildings[k];
  for (const k of Object.keys(s.roads)) delete s.roads[k];
  const home = [...topologyFor(s.board.layout).vertices.keys()][10];
  s.buildings[home] = { owner: me, kind: 'settlement' };
  // поселение в 2–3 дорогах от сети
  const routes = settlementRoutes(s, me);
  const [far, path] = [...routes].find(([, p]) => p.length >= 2)!;
  return { s, me, far, path };
};

describe('план: поселение с дорогами — один пункт', () => {
  it('дороги с for прячутся под своё поселение, удаляются и двигаются вместе', () => {
    const { s, me, far, path } = setup();
    const plan: PlanStep[] = [
      { id: 'card', kind: 'devCard' },
      ...path.map((e, i) => ({ id: `r${i}`, kind: 'road' as const, at: e, for: 'home' })),
      { id: 'home', kind: 'settlement', at: far },
    ];
    const units = planUnits(checkPlan(plan, toPublicView(s), toPrivateView(s, me), me));
    expect(units.map((u) => u.main.step.id)).toEqual(['card', 'home']);
    expect(units[1].roads.length).toBe(path.length);
    // переставить дом наверх — дороги едут с ним и остаются перед ним
    const moved = moveUnit(units, 1, 0);
    expect(moved.map((x) => x.id)).toEqual([...path.map((_, i) => `r${i}`), 'home', 'card']);
    // убрать дом — уходят и дороги
    expect(removeUnit(plan, units[1]).map((x) => x.id)).toEqual(['card']);
  });

  it('старые планы без for — дороги остаются отдельными пунктами', () => {
    const { s, me, path } = setup();
    const plan: PlanStep[] = path.map((e, i) => ({ id: `r${i}`, kind: 'road' as const, at: e }));
    const units = planUnits(checkPlan(plan, toPublicView(s), toPrivateView(s, me), me));
    expect(units.length).toBe(path.length);
  });

  it('упорядочить: то, на что хватает, — наверх; дороги не обгоняют свою цепочку', () => {
    const { s, me, far, path } = setup();
    const hand = emptyResources();
    hand.sheep = 1;
    hand.wheat = 1;
    hand.ore = 1; // хватает только на карту развития
    s.players[me].resources = hand;
    const plan: PlanStep[] = [
      ...path.map((e, i) => ({ id: `r${i}`, kind: 'road' as const, at: e, for: 'home' })),
      { id: 'home', kind: 'settlement', at: far },
      { id: 'card', kind: 'devCard' },
    ];
    const next = smartOrder(plan, toPublicView(s), toPrivateView(s, me), me);
    expect(next?.map((x) => x.id)).toEqual(['card', ...path.map((_, i) => `r${i}`), 'home']);
    // уже лучший порядок — кнопку не показываем
    expect(smartOrder(next!, toPublicView(s), toPrivateView(s, me), me)).toBeNull();
    expect(topologyFor(s.board.layout).edges.has(path[0])).toBe(true);
  });
});
