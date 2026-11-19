import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState } from '../src/engine';
import { TERRAIN_RESOURCE, seededRng, topologyFor, totalResources } from '../src/engine';
import { produce } from '../src/engine/rules/production';
import { act, actFail, mainPhase, newGame, rngForTotal, setHand, skipSetup } from './helpers';

/** Гекс с числом (не пустыня) и его перекрёстки. */
function numberedHex(s: GameState) {
  const hex = s.board.hexes.find((h) => h.number !== undefined && h.id !== s.robberHex)!;
  const t = topologyFor(s.board.layout);
  return { hex, res: TERRAIN_RESOURCE[hex.terrain as Exclude<typeof hex.terrain, 'desert'>], vertices: t.hexes.get(hex.id)!.vertices };
}

describe('доход с гексов', () => {
  it('поселение даёт 1, город — 2', () => {
    const s = skipSetup(newGame(3));
    const { hex, res, vertices } = numberedHex(s);
    s.buildings[vertices[0]] = { owner: 'a', kind: 'settlement' };
    s.buildings[vertices[2]] = { owner: 'b', kind: 'city' };
    const bankBefore = s.bank[res];
    const events: GameEvent[] = [];
    produce(s, hex.number!, events);
    expect(s.players.a.resources[res]).toBe(1);
    expect(s.players.b.resources[res]).toBe(2);
    expect(s.bank[res]).toBe(bankBefore - 3);
  });

  it('гекс с разбойником ничего не приносит', () => {
    const s = skipSetup(newGame(3));
    const { hex, res, vertices } = numberedHex(s);
    s.buildings[vertices[0]] = { owner: 'a', kind: 'settlement' };
    s.robberHex = hex.id;
    produce(s, hex.number!, []);
    expect(s.players.a.resources[res]).toBe(0);
  });

  it('нехватка в банке: при нескольких получателях никто не получает', () => {
    const s = skipSetup(newGame(3));
    const { hex, res, vertices } = numberedHex(s);
    s.buildings[vertices[0]] = { owner: 'a', kind: 'city' };
    s.buildings[vertices[2]] = { owner: 'b', kind: 'settlement' };
    s.bank[res] = 2;
    const events: GameEvent[] = [];
    produce(s, hex.number!, events);
    expect(s.players.a.resources[res]).toBe(0);
    expect(s.players.b.resources[res]).toBe(0);
    expect(s.bank[res]).toBe(2);
    expect(events[0]).toMatchObject({ type: 'produced', shortages: [res] });
  });

  it('нехватка в банке: единственный получатель берёт остаток', () => {
    const s = skipSetup(newGame(3));
    const { hex, res, vertices } = numberedHex(s);
    s.buildings[vertices[0]] = { owner: 'a', kind: 'city' };
    s.bank[res] = 1;
    produce(s, hex.number!, []);
    expect(s.players.a.resources[res]).toBe(1);
    expect(s.bank[res]).toBe(0);
  });
});

describe('ход', () => {
  it('бросок не 7 → фаза торговли и стройки', () => {
    const s = act(skipSetup(newGame(3)), 'a', { type: 'rollDice' }, rngForTotal(8));
    expect(s.phase).toBe('main');
    expect(s.dice![0] + s.dice![1]).toBe(8);
  });

  it('нельзя закончить ход, не бросив кубики; после конца хода ходит следующий', () => {
    let s = skipSetup(newGame(3));
    expect(actFail(s, 'a', { type: 'endTurn' })).toBe('Сначала брось кубики');
    expect(actFail(s, 'b', { type: 'rollDice' })).toBe('Сейчас не твой ход');
    s = act(s, 'a', { type: 'rollDice' }, rngForTotal(5));
    s = act(s, 'a', { type: 'endTurn' });
    expect(s.order[s.current]).toBe('b');
    expect(s.turn).toBe(2);
    expect(s.phase).toBe('roll');
  });

  it('после последнего игрока снова ходит первый', () => {
    let s = mainPhase(newGame(3));
    s = act(s, 'a', { type: 'endTurn' });
    s.phase = 'main';
    s = act(s, 'b', { type: 'endTurn' });
    s.phase = 'main';
    s = act(s, 'c', { type: 'endTurn' });
    expect(s.order[s.current]).toBe('a');
  });
});

describe('семёрка и разбойник', () => {
  it('без лишних карт — сразу перестановка разбойника', () => {
    const s = act(skipSetup(newGame(3)), 'a', { type: 'rollDice' }, rngForTotal(7));
    expect(s.phase).toBe('moveRobber');
  });

  it('у кого больше 7 карт — сбрасывают половину, потом разбойник и кража', () => {
    let s = skipSetup(newGame(3));
    setHand(s, 'b', { brick: 5, wood: 4 }); // 9 → сбросить 4
    setHand(s, 'c', { ore: 7 }); // ровно 7 → не сбрасывает
    s = act(s, 'a', { type: 'rollDice' }, rngForTotal(7));
    expect(s.phase).toBe('discard');
    expect(s.pendingDiscards).toEqual({ b: 4 });

    expect(actFail(s, 'a', { type: 'moveRobber', hex: s.board.hexes[0].id })).toBe('Ждём, пока игроки сбросят карты');
    expect(actFail(s, 'b', { type: 'discard', resources: { brick: 3, wood: 0, sheep: 0, wheat: 0, ore: 0 } })).toBe(
      'Нужно сбросить ровно 4 карты',
    );
    expect(actFail(s, 'c', { type: 'discard', resources: { brick: 0, wood: 0, sheep: 0, wheat: 0, ore: 4 } })).toBe(
      'Тебе не нужно сбрасывать карты',
    );
    s = act(s, 'b', { type: 'discard', resources: { brick: 2, wood: 2, sheep: 0, wheat: 0, ore: 0 } });
    expect(totalResources(s.players.b.resources)).toBe(5);
    expect(s.phase).toBe('moveRobber');

    // Ставим постройку b у гекса и грабим
    const t = topologyFor(s.board.layout);
    const target = s.board.hexes.find((h) => h.id !== s.robberHex)!;
    s.buildings[t.hexes.get(target.id)!.vertices[0]] = { owner: 'b', kind: 'settlement' };
    expect(actFail(s, 'a', { type: 'moveRobber', hex: s.robberHex })).toBe('Разбойника нужно переставить на другой гекс');
    s = act(s, 'a', { type: 'moveRobber', hex: target.id });
    expect(s.robberHex).toBe(target.id);
    expect(totalResources(s.players.b.resources)).toBe(4);
    expect(totalResources(s.players.a.resources)).toBe(1);
    expect(s.phase).toBe('main');
  });

  it('если ограбить можно двоих — нужно выбрать, у кого', () => {
    let s = skipSetup(newGame(3));
    s.phase = 'moveRobber';
    const t = topologyFor(s.board.layout);
    const target = s.board.hexes.find((h) => h.id !== s.robberHex)!;
    const vs = t.hexes.get(target.id)!.vertices;
    s.buildings[vs[0]] = { owner: 'b', kind: 'settlement' };
    s.buildings[vs[3]] = { owner: 'c', kind: 'settlement' };
    setHand(s, 'b', { wood: 1 });
    setHand(s, 'c', { ore: 1 });
    expect(actFail(s, 'a', { type: 'moveRobber', hex: target.id })).toBe('Выбери, у кого украсть карту');
    s = act(s, 'a', { type: 'moveRobber', hex: target.id, victim: 'c' });
    expect(s.players.a.resources.ore).toBe(1);
    expect(s.players.c.resources.ore).toBe(0);
  });

  it('у игрока без карт ничего не крадут', () => {
    let s = skipSetup(newGame(3));
    s.phase = 'moveRobber';
    const t = topologyFor(s.board.layout);
    const target = s.board.hexes.find((h) => h.id !== s.robberHex)!;
    s.buildings[t.hexes.get(target.id)!.vertices[0]] = { owner: 'b', kind: 'settlement' };
    s = act(s, 'a', { type: 'moveRobber', hex: target.id });
    expect(totalResources(s.players.a.resources)).toBe(0);
  });
});

describe('ошибки не меняют состояние', () => {
  it('отклонённое действие возвращает ошибку, исходное состояние не тронуто', () => {
    const s = mainPhase(newGame(3));
    const before = structuredClone(s);
    actFail(s, 'a', { type: 'buyDevCard' });
    expect(s).toEqual(before);
    void seededRng;
  });
});
