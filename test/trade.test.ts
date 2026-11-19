import { describe, expect, it } from 'vitest';
import { resourceMap, topologyFor, tradeRatios } from '../src/engine';
import { act, actFail, mainPhase, newGame, setHand } from './helpers';

const R = resourceMap;

describe('обмен с банком', () => {
  it('4:1 без гаваней', () => {
    let s = mainPhase(newGame(3));
    setHand(s, 'a', { brick: 4 });
    s = act(s, 'a', { type: 'bankTrade', give: 'brick', receive: 'ore' });
    expect(s.players.a.resources).toMatchObject({ brick: 0, ore: 1 });
    expect(s.bank).toMatchObject({ brick: 23, ore: 18 });
  });

  it('не хватает карт', () => {
    const s = mainPhase(newGame(3));
    setHand(s, 'a', { brick: 3 });
    expect(actFail(s, 'a', { type: 'bankTrade', give: 'brick', receive: 'ore' })).toBe('Нужно 4 карты этого ресурса');
  });

  it('гавани: 3:1 у общей, 2:1 у своего ресурса', () => {
    const s = mainPhase(newGame(3));
    const t = topologyFor(s.board.layout);
    const any = s.board.harbors.find((h) => h.type === 'any')!;
    const special = s.board.harbors.find((h) => h.type === 'wheat')!;
    s.buildings[t.edges.get(any.edge)!.vertices[0]] = { owner: 'a', kind: 'settlement' };
    expect(tradeRatios(s, 'a')).toEqual({ brick: 3, wood: 3, sheep: 3, wheat: 3, ore: 3 });
    s.buildings[t.edges.get(special.edge)!.vertices[1]] = { owner: 'a', kind: 'city' };
    expect(tradeRatios(s, 'a')).toEqual({ brick: 3, wood: 3, sheep: 3, wheat: 2, ore: 3 });

    setHand(s, 'a', { wheat: 4 });
    const s2 = act(s, 'a', { type: 'bankTrade', give: 'wheat', receive: 'ore', times: 2 });
    expect(s2.players.a.resources).toMatchObject({ wheat: 0, ore: 2 });
  });
});

describe('обмен между игроками', () => {
  it('предложение → согласие → подтверждение', () => {
    let s = mainPhase(newGame(3));
    setHand(s, 'a', { brick: 2 });
    setHand(s, 'b', { ore: 1 });
    s = act(s, 'a', { type: 'offerTrade', give: R({ brick: 2 }), want: R({ ore: 1 }) });
    const id = s.trade!.id;
    expect(actFail(s, 'c', { type: 'respondTrade', tradeId: id, kind: 'accept' })).toBe('У тебя нет нужных карт');
    s = act(s, 'b', { type: 'respondTrade', tradeId: id, kind: 'accept' });
    s = act(s, 'c', { type: 'respondTrade', tradeId: id, kind: 'decline' });
    expect(actFail(s, 'a', { type: 'confirmTrade', tradeId: id, with: 'c' })).toBe('Этот игрок не согласился на обмен');
    s = act(s, 'a', { type: 'confirmTrade', tradeId: id, with: 'b' });
    expect(s.players.a.resources).toMatchObject({ brick: 0, ore: 1 });
    expect(s.players.b.resources).toMatchObject({ brick: 2, ore: 0 });
    expect(s.trade).toBeUndefined();
  });

  it('встречное предложение', () => {
    let s = mainPhase(newGame(3));
    setHand(s, 'a', { brick: 2, wood: 1 });
    setHand(s, 'b', { ore: 2 });
    s = act(s, 'a', { type: 'offerTrade', give: R({ brick: 1 }), want: R({ ore: 1 }) });
    const id = s.trade!.id;
    // b хочет 2 кирпича + дерево за 2 руды
    s = act(s, 'b', { type: 'respondTrade', tradeId: id, kind: 'counter', give: R({ brick: 2, wood: 1 }), want: R({ ore: 2 }) });
    s = act(s, 'a', { type: 'confirmTrade', tradeId: id, with: 'b' });
    expect(s.players.a.resources).toMatchObject({ brick: 0, wood: 0, ore: 2 });
    expect(s.players.b.resources).toMatchObject({ brick: 2, wood: 1, ore: 0 });
  });

  it('нельзя дарить и нельзя один ресурс с обеих сторон', () => {
    const s = mainPhase(newGame(3));
    setHand(s, 'a', { brick: 2 });
    expect(actFail(s, 'a', { type: 'offerTrade', give: R({ brick: 1 }), want: R() })).toBe(
      'Нужно и отдать, и получить хотя бы по одной карте',
    );
    expect(actFail(s, 'a', { type: 'offerTrade', give: R({ brick: 1 }), want: R({ brick: 1 }) })).toBe(
      'Один и тот же ресурс не может быть с обеих сторон',
    );
  });

  it('новое предложение сбрасывает старые ответы; конец хода убирает предложение', () => {
    let s = mainPhase(newGame(3));
    setHand(s, 'a', { brick: 2 });
    setHand(s, 'b', { ore: 2 });
    s = act(s, 'a', { type: 'offerTrade', give: R({ brick: 1 }), want: R({ ore: 1 }) });
    const oldId = s.trade!.id;
    s = act(s, 'b', { type: 'respondTrade', tradeId: oldId, kind: 'accept' });
    s = act(s, 'a', { type: 'offerTrade', give: R({ brick: 2 }), want: R({ ore: 1 }) });
    expect(s.trade!.responses).toEqual({});
    expect(actFail(s, 'b', { type: 'respondTrade', tradeId: oldId, kind: 'accept' })).toBe('Это предложение уже неактуально');
    s = act(s, 'a', { type: 'endTurn' });
    expect(s.trade).toBeUndefined();
  });

  it('если у партнёра карт уже нет — обмен не проходит', () => {
    let s = mainPhase(newGame(3));
    setHand(s, 'a', { brick: 1 });
    setHand(s, 'b', { ore: 1 });
    s = act(s, 'a', { type: 'offerTrade', give: R({ brick: 1 }), want: R({ ore: 1 }) });
    s = act(s, 'b', { type: 'respondTrade', tradeId: s.trade!.id, kind: 'accept' });
    s.players.b.resources.ore = 0;
    expect(actFail(s, 'a', { type: 'confirmTrade', tradeId: s.trade!.id, with: 'b' })).toBe('У игрока уже нет нужных карт');
  });
});
