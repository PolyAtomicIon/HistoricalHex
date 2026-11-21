import { describe, expect, it } from 'vitest';
import { settlementRoutes } from '../src/app/planner';
import { topologyFor } from '../src/engine';
import { coastChain, mainPhase, newGame, sharedVertex } from './helpers';

const clean = () => {
  const s = mainPhase(newGame(3));
  for (const k of Object.keys(s.buildings)) delete s.buildings[k];
  for (const k of Object.keys(s.roads)) delete s.roads[k];
  return s;
};

describe('план: куда поставить поселение и какие дороги нужны', () => {
  it('от своего поселения: места через 2 и 3 дороги, рядом — нельзя', () => {
    const s = clean();
    const t = topologyFor(s.board.layout);
    const home = [...t.vertices.keys()][10];
    s.buildings[home] = { owner: 'a', kind: 'settlement' };
    const r = settlementRoutes(s, 'a');
    expect(r.size).toBeGreaterThan(0);
    for (const [v, path] of r) {
      expect(path.length).toBeGreaterThanOrEqual(2); // соседние перекрёстки запрещены правилом расстояния
      expect(path.length).toBeLessThanOrEqual(3);
      expect(t.vertices.get(home)!.neighbors).not.toContain(v);
      // цепочка непрерывна: каждая дорога касается предыдущей
      const vs = path.map((e) => t.edges.get(e)!.vertices);
      expect(vs[0]).toContain(home);
      for (let i = 1; i < vs.length; i++) expect(vs[i].some((x) => vs[i - 1].includes(x))).toBe(true);
      expect(vs[vs.length - 1]).toContain(v);
    }
  });

  it('если дорога уже подведена — место без новых дорог', () => {
    const s = clean();
    const chain = coastChain(s, 2);
    const t = topologyFor(s.board.layout);
    const a = t.edges.get(chain[0])!.vertices.find((v) => !t.edges.get(chain[1])!.vertices.includes(v))!;
    s.buildings[a] = { owner: 'a', kind: 'settlement' };
    for (const e of chain) s.roads[e] = 'a';
    const end = t.edges.get(chain[1])!.vertices.find((v) => v !== sharedVertex(s, chain[0], chain[1]))!;
    const r = settlementRoutes(s, 'a');
    expect(r.get(end)).toEqual([]);
  });

  it('чужое поселение перекрывает путь, чужие дороги не используются', () => {
    const s = clean();
    const chain = coastChain(s, 3);
    const t = topologyFor(s.board.layout);
    const start = t.edges.get(chain[0])!.vertices.find((v) => !t.edges.get(chain[1])!.vertices.includes(v))!;
    s.buildings[start] = { owner: 'a', kind: 'settlement' };
    s.roads[chain[1]] = 'b';
    const r = settlementRoutes(s, 'a');
    for (const path of r.values()) expect(path).not.toContain(chain[1]);
    s.buildings[sharedVertex(s, chain[0], chain[1])] = { owner: 'b', kind: 'settlement' };
    for (const path of settlementRoutes(s, 'a').values()) expect(path).not.toContain(chain[0]);
  });

  it('без своей сети — пусто', () => {
    expect(settlementRoutes(clean(), 'a').size).toBe(0);
  });
});

import { doneSteps } from '../src/app/planner';
describe('план: выполненные шаги убираются сами', () => {
  it('своя дорога/поселение/город — выполнено; чужое — нет', () => {
    const plan = [
      { id: 'r1', kind: 'road' as const, at: 'e1' },
      { id: 'r2', kind: 'road' as const, at: 'e2' },
      { id: 's1', kind: 'settlement' as const, at: 'v1' },
      { id: 's2', kind: 'settlement' as const, at: 'v2' },
      { id: 'c1', kind: 'city' as const, at: 'v3' },
      { id: 'c2', kind: 'city' as const, at: 'v4' },
      { id: 'd', kind: 'devCard' as const },
    ];
    const pub = {
      roads: { e1: 'a', e2: 'b' },
      buildings: {
        v1: { owner: 'a', kind: 'settlement' as const },
        v2: { owner: 'b', kind: 'settlement' as const },
        v3: { owner: 'a', kind: 'city' as const },
        v4: { owner: 'a', kind: 'settlement' as const },
      },
    };
    expect([...doneSteps(plan, pub, 'a')].sort()).toEqual(['c1', 'r1', 's1']);
  });
});

import { tradeVerdict } from '../src/app/planner';
import { emptyResources, resourceMap } from '../src/engine';
describe('оценка входящего обмена', () => {
  it('нечем ответить', () => {
    const v = tradeVerdict(resourceMap({ ore: 1 }), resourceMap({ wood: 1 }), emptyResources());
    expect(v.canAccept).toBe(false);
    expect(v.text).toContain('Нечем ответить');
  });
  it('открывает поселение — выгодно', () => {
    const hand = resourceMap({ brick: 2, wood: 1, wheat: 1 });
    const v = tradeVerdict(resourceMap({ brick: 1 }), resourceMap({ sheep: 1 }), hand);
    expect(v.unlocks).toContain('поселение');
    expect(v.fair).toBeGreaterThan(0);
    expect(v.text).toContain('поселение');
  });
  it('2 за 1 — дорого, 1 за 2 — выгодно', () => {
    const hand = resourceMap({ ore: 3 });
    expect(tradeVerdict(resourceMap({ ore: 2 }), resourceMap({ wood: 1 }), hand).fair).toBeLessThan(0);
    expect(tradeVerdict(resourceMap({ ore: 1 }), resourceMap({ wood: 2 }), hand).fair).toBeGreaterThan(0);
  });
});
