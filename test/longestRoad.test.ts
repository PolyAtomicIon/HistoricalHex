import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState } from '../src/engine';
import { longestRoadLength, longestRoadPath, topologyFor } from '../src/engine';
import { updateLongestRoad } from '../src/engine/rules/scoring';
import { act, coastChain, mainPhase, newGame, setHand, sharedVertex } from './helpers';

function lay(s: GameState, pid: string, edges: string[]) {
  for (const e of edges) s.roads[e] = pid;
}

describe('длина дороги', () => {
  it('цепочка из 5 дорог — 5, ответвление не считается', () => {
    const s = mainPhase(newGame(3));
    const chain = coastChain(s, 5);
    lay(s, 'a', chain);
    expect(longestRoadLength(s, 'a')).toBe(5);

    // ответвление от середины цепочки внутрь острова
    const t = topologyFor(s.board.layout);
    const mid = sharedVertex(s, chain[1], chain[2]);
    const branch = t.vertices.get(mid)!.edges.find((e) => !chain.includes(e));
    if (branch) {
      s.roads[branch] = 'a';
      expect(longestRoadLength(s, 'a')).toBe(5);
    }
  });

  it('чужое поселение разрывает дорогу', () => {
    const s = mainPhase(newGame(3));
    const chain = coastChain(s, 5);
    lay(s, 'a', chain);
    s.buildings[sharedVertex(s, chain[1], chain[2])] = { owner: 'b', kind: 'settlement' };
    expect(longestRoadLength(s, 'a')).toBe(3);
  });

  it('своё поселение дорогу не разрывает', () => {
    const s = mainPhase(newGame(3));
    const chain = coastChain(s, 5);
    lay(s, 'a', chain);
    s.buildings[sharedVertex(s, chain[1], chain[2])] = { owner: 'a', kind: 'settlement' };
    expect(longestRoadLength(s, 'a')).toBe(5);
  });
});

describe('«Самая длинная дорога»', () => {
  it('даётся за 5+ дорог при постройке', () => {
    let s = mainPhase(newGame(3));
    const chain = coastChain(s, 5);
    lay(s, 'a', chain.slice(0, 4));
    expect(s.longestRoad).toBeUndefined();
    setHand(s, 'a', { brick: 1, wood: 1 });
    s = act(s, 'a', { type: 'buildRoad', edge: chain[4] });
    expect(s.longestRoad).toBe('a');
  });

  it('при ничьей остаётся у владельца, при обгоне переходит', () => {
    const s = mainPhase(newGame(3));
    lay(s, 'a', coastChain(s, 5, 0));
    updateLongestRoad(s, []);
    expect(s.longestRoad).toBe('a');
    lay(s, 'b', coastChain(s, 5, 10));
    updateLongestRoad(s, []);
    expect(s.longestRoad).toBe('a');
    lay(s, 'b', coastChain(s, 6, 10));
    updateLongestRoad(s, []);
    expect(s.longestRoad).toBe('b');
  });

  it('разрыв: карта уходит единственному лидеру', () => {
    const s = mainPhase(newGame(3));
    const chain = coastChain(s, 6, 0);
    lay(s, 'a', chain);
    lay(s, 'b', coastChain(s, 5, 10));
    updateLongestRoad(s, []);
    expect(s.longestRoad).toBe('a');
    s.buildings[sharedVertex(s, chain[2], chain[3])] = { owner: 'c', kind: 'settlement' };
    const events: GameEvent[] = [];
    updateLongestRoad(s, events);
    expect(s.longestRoad).toBe('b');
    expect(events).toEqual([{ type: 'longestRoad', player: 'b', length: 5 }]);
  });

  it('разрыв: при ничьей между другими карта откладывается', () => {
    const s = mainPhase(newGame(3));
    const chain = coastChain(s, 6, 0);
    lay(s, 'a', chain);
    lay(s, 'b', coastChain(s, 5, 10));
    lay(s, 'c', coastChain(s, 5, 20));
    updateLongestRoad(s, []);
    expect(s.longestRoad).toBe('a');
    s.buildings[sharedVertex(s, chain[2], chain[3])] = { owner: 'b', kind: 'settlement' };
    updateLongestRoad(s, []);
    expect(s.longestRoad).toBeUndefined();
  });
});

describe('цепочка самой длинной дороги (подсветка)', () => {
  const contiguous = (s: GameState, path: string[]) => {
    const t = topologyFor(s.board.layout);
    for (let i = 1; i < path.length; i++) {
      const a = t.edges.get(path[i - 1])!.vertices;
      const b = t.edges.get(path[i])!.vertices;
      if (!a.some((v) => b.includes(v))) return false;
    }
    return new Set(path).size === path.length;
  };

  it('длина цепочки равна длине дороги, все рёбра свои и идут подряд', () => {
    const s = mainPhase(newGame(3));
    const chain = coastChain(s, 6);
    lay(s, 'a', chain);
    const path = longestRoadPath(s, 'a');
    expect(path.length).toBe(longestRoadLength(s, 'a'));
    expect(path.every((e) => s.roads[e] === 'a')).toBe(true);
    expect(contiguous(s, path)).toBe(true);
    expect(new Set(path)).toEqual(new Set(chain));
  });

  it('ответвление не попадает в цепочку', () => {
    const s = mainPhase(newGame(3));
    const chain = coastChain(s, 5);
    lay(s, 'a', chain);
    const t = topologyFor(s.board.layout);
    const mid = sharedVertex(s, chain[1], chain[2]);
    const branch = t.vertices.get(mid)!.edges.find((e) => !chain.includes(e));
    if (branch) s.roads[branch] = 'a';
    const path = longestRoadPath(s, 'a');
    expect(path.length).toBe(5);
    if (branch) expect(path).not.toContain(branch);
  });

  it('чужое поселение рвёт цепочку — берётся длинный кусок', () => {
    const s = mainPhase(newGame(3));
    const chain = coastChain(s, 5);
    lay(s, 'a', chain);
    s.buildings[sharedVertex(s, chain[1], chain[2])] = { owner: 'b', kind: 'settlement' };
    const path = longestRoadPath(s, 'a');
    expect(path.length).toBe(3);
    expect(contiguous(s, path)).toBe(true);
    expect(new Set(path)).toEqual(new Set(chain.slice(2)));
  });

  it('нет дорог — пустая цепочка', () => {
    const s = mainPhase(newGame(3));
    for (const e of Object.keys(s.roads)) delete s.roads[e];
    expect(longestRoadPath(s, 'a')).toEqual([]);
  });

  it('на случайных партиях длина цепочки всегда совпадает с длиной дороги', () => {
    for (let seed = 0; seed < 5; seed++) {
      const s = mainPhase(newGame(4));
      const t = topologyFor(s.board.layout);
      const edges = [...t.edges.keys()];
      // псевдослучайно раздаём рёбра игрокам
      let x = seed * 7919 + 13;
      for (let i = 0; i < 40; i++) {
        x = (x * 1103515245 + 12345) % 2147483648;
        s.roads[edges[x % edges.length]] = s.order[x % s.order.length];
      }
      for (const p of s.order) {
        const path = longestRoadPath(s, p);
        expect(path.length).toBe(longestRoadLength(s, p));
        expect(contiguous(s, path)).toBe(true);
      }
    }
  });
});
