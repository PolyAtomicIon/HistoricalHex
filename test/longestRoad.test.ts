import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState } from '../src/engine';
import { longestRoadLength, topologyFor } from '../src/engine';
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
