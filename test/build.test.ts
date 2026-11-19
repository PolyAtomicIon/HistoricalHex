import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/engine';
import { COSTS, topologyFor } from '../src/engine';
import { act, actFail, mainPhase, newGame, setHand } from './helpers';

/** Внутренний перекрёсток (3 соседа) с поселением игрока a. */
function withSettlement(s: GameState) {
  const t = topologyFor(s.board.layout);
  const v = [...t.vertices.values()].find((x) => x.neighbors.length === 3 && x.hexes.length === 3)!;
  s.buildings[v.id] = { owner: 'a', kind: 'settlement' };
  return { t, v };
}

const RICH = { brick: 10, wood: 10, sheep: 10, wheat: 10, ore: 10 };

describe('дороги', () => {
  it('строится рядом со своим поселением и стоит кирпич + дерево', () => {
    let s = mainPhase(newGame(3));
    const { v } = withSettlement(s);
    setHand(s, 'a', { brick: 1, wood: 1 });
    s = act(s, 'a', { type: 'buildRoad', edge: v.edges[0] });
    expect(s.roads[v.edges[0]]).toBe('a');
    expect(s.players.a.resources).toEqual({ brick: 0, wood: 0, sheep: 0, wheat: 0, ore: 0 });
    expect(s.players.a.pieces.roads).toBe(14);
  });

  it('нельзя строить оторванно от своей сети', () => {
    const s = mainPhase(newGame(3));
    const { t, v } = withSettlement(s);
    setHand(s, 'a', RICH);
    const far = [...t.edges.values()].find((e) => e.vertices.every((x) => x !== v.id && !v.neighbors.includes(x)))!;
    expect(actFail(s, 'a', { type: 'buildRoad', edge: far.id })).toBe('Сюда нельзя поставить дорогу');
  });

  it('нельзя продолжить дорогу через чужое поселение', () => {
    let s = mainPhase(newGame(3));
    const { t, v } = withSettlement(s);
    setHand(s, 'a', RICH);
    s = act(s, 'a', { type: 'buildRoad', edge: v.edges[0] });
    const edge = t.edges.get(v.edges[0])!;
    const end = edge.vertices[0] === v.id ? edge.vertices[1] : edge.vertices[0];
    s.buildings[end] = { owner: 'b', kind: 'settlement' };
    const beyond = t.vertices.get(end)!.edges.find((e) => e !== v.edges[0])!;
    expect(actFail(s, 'a', { type: 'buildRoad', edge: beyond })).toBe('Сюда нельзя поставить дорогу');
  });

  it('не хватает ресурсов', () => {
    const s = mainPhase(newGame(3));
    const { v } = withSettlement(s);
    setHand(s, 'a', { brick: 1 });
    expect(actFail(s, 'a', { type: 'buildRoad', edge: v.edges[0] })).toBe('Не хватает ресурсов');
  });

  it('дороги заканчиваются после 15', () => {
    const s = mainPhase(newGame(3));
    const { v } = withSettlement(s);
    setHand(s, 'a', RICH);
    s.players.a.pieces.roads = 0;
    expect(actFail(s, 'a', { type: 'buildRoad', edge: v.edges[0] })).toBe('Дороги закончились');
  });

  it('нельзя строить до броска кубиков', () => {
    const s = mainPhase(newGame(3));
    s.phase = 'roll';
    const { v } = withSettlement(s);
    setHand(s, 'a', RICH);
    expect(actFail(s, 'a', { type: 'buildRoad', edge: v.edges[0] })).toBe('Сначала брось кубики');
  });
});

describe('поселения', () => {
  it('нужно примыкать к своей дороге и соблюдать расстояние', () => {
    let s = mainPhase(newGame(3));
    const { t, v } = withSettlement(s);
    setHand(s, 'a', RICH);
    // дорога от поселения в сторону соседа
    s = act(s, 'a', { type: 'buildRoad', edge: v.edges[0] });
    const e0 = t.edges.get(v.edges[0])!;
    const n1 = e0.vertices[0] === v.id ? e0.vertices[1] : e0.vertices[0];
    // Сосед поселения — нарушает правило расстояния
    expect(actFail(s, 'a', { type: 'buildSettlement', vertex: n1 })).toBe('Сюда нельзя поставить поселение');
    // Продлеваем дорогу и строим через одну вершину
    const e1 = t.vertices.get(n1)!.edges.find((e) => e !== e0.id)!;
    s = act(s, 'a', { type: 'buildRoad', edge: e1 });
    const n2 = t.edges.get(e1)!.vertices.find((x) => x !== n1)!;
    const before = { ...s.players.a.resources };
    s = act(s, 'a', { type: 'buildSettlement', vertex: n2 });
    expect(s.buildings[n2]).toEqual({ owner: 'a', kind: 'settlement' });
    expect(s.players.a.resources.sheep).toBe(before.sheep - COSTS.settlement.sheep);
    expect(s.players.a.pieces.settlements).toBe(4);
  });

  it('без своей дороги рядом строить нельзя', () => {
    const s = mainPhase(newGame(3));
    const { t, v } = withSettlement(s);
    setHand(s, 'a', RICH);
    const far = [...t.vertices.values()].find((x) => x.id !== v.id && !v.neighbors.includes(x.id))!;
    expect(actFail(s, 'a', { type: 'buildSettlement', vertex: far.id })).toBe('Сюда нельзя поставить поселение');
  });
});

describe('города', () => {
  it('ставится на своё поселение, поселение возвращается в запас', () => {
    let s = mainPhase(newGame(3));
    const { v } = withSettlement(s);
    s.players.a.pieces.settlements = 4;
    setHand(s, 'a', { ore: 3, wheat: 2 });
    s = act(s, 'a', { type: 'buildCity', vertex: v.id });
    expect(s.buildings[v.id].kind).toBe('city');
    expect(s.players.a.pieces).toMatchObject({ settlements: 5, cities: 3 });
    expect(s.players.a.resources.ore).toBe(0);
  });

  it('нельзя на чужое поселение или пустое место', () => {
    const s = mainPhase(newGame(3));
    const { v } = withSettlement(s);
    setHand(s, 'b', RICH);
    s.current = 1;
    expect(actFail(s, 'b', { type: 'buildCity', vertex: v.id })).toBe('Город можно построить только на месте своего поселения');
  });
});
