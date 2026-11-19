import { describe, expect, it } from 'vitest';
import type { DevCardType, GameState } from '../src/engine';
import { topologyFor, totalResources, victoryPoints } from '../src/engine';
import { act, actFail, mainPhase, newGame, setHand, skipSetup } from './helpers';

function giveCard(s: GameState, pid: string, type: DevCardType, boughtTurn = 0) {
  s.players[pid].devCards.push({ type, boughtTurn });
}

describe('покупка карт развития', () => {
  it('стоит руду + овцу + пшеницу, карта берётся из колоды', () => {
    let s = mainPhase(newGame(3));
    setHand(s, 'a', { ore: 1, sheep: 1, wheat: 1 });
    const top = s.devDeck[s.devDeck.length - 1];
    const deckSize = s.devDeck.length;
    s = act(s, 'a', { type: 'buyDevCard' });
    expect(s.devDeck.length).toBe(deckSize - 1);
    expect(s.players.a.devCards).toEqual([{ type: top, boughtTurn: 1 }]);
    expect(totalResources(s.players.a.resources)).toBe(0);
  });

  it('колода: 25 карт на 3–4 игроков, 34 на 5–6', () => {
    expect(newGame(4).devDeck).toHaveLength(25);
    expect(newGame(5).devDeck).toHaveLength(34);
  });

  it('купленную в этот ход карту сыграть нельзя', () => {
    const s = mainPhase(newGame(3));
    giveCard(s, 'a', 'monopoly', 1);
    expect(actFail(s, 'a', { type: 'playMonopoly', resource: 'ore' })).toBe(
      'Эту карту купили в этот ход — сыграть её можно со следующего',
    );
  });

  it('за ход — только одна карта развития', () => {
    let s = mainPhase(newGame(3));
    giveCard(s, 'a', 'monopoly');
    giveCard(s, 'a', 'yearOfPlenty');
    s = act(s, 'a', { type: 'playMonopoly', resource: 'ore' });
    expect(actFail(s, 'a', { type: 'playYearOfPlenty', resources: ['ore', 'wheat'] })).toBe(
      'За ход можно сыграть только одну карту развития',
    );
  });

  it('нельзя сыграть карту, которой нет', () => {
    const s = mainPhase(newGame(3));
    expect(actFail(s, 'a', { type: 'playKnight' })).toBe('У тебя нет такой карты');
  });
});

describe('рыцарь и армия', () => {
  it('до броска: разбойник → снова фаза броска', () => {
    let s = skipSetup(newGame(3));
    giveCard(s, 'a', 'knight');
    s = act(s, 'a', { type: 'playKnight' });
    expect(s.phase).toBe('moveRobber');
    const hex = s.board.hexes.find((h) => h.id !== s.robberHex)!.id;
    s = act(s, 'a', { type: 'moveRobber', hex });
    expect(s.phase).toBe('roll');
    expect(s.players.a.knightsPlayed).toBe(1);
  });

  it('«Самая большая армия» с 3 рыцарей и переходит только при большем числе', () => {
    let s = mainPhase(newGame(3));
    s.players.a.knightsPlayed = 2;
    giveCard(s, 'a', 'knight');
    s = act(s, 'a', { type: 'playKnight' });
    expect(s.largestArmy).toBe('a');
    expect(victoryPoints(s, 'a')).toBe(2);

    // b догоняет до 3 — карта остаётся у a
    s.phase = 'main';
    s.current = 1;
    s.devCardPlayed = false;
    s.players.b.knightsPlayed = 2;
    giveCard(s, 'b', 'knight');
    s = act(s, 'b', { type: 'playKnight' });
    expect(s.largestArmy).toBe('a');

    // b обгоняет — карта переходит
    s.phase = 'main';
    s.devCardPlayed = false;
    giveCard(s, 'b', 'knight');
    s = act(s, 'b', { type: 'playKnight' });
    expect(s.largestArmy).toBe('b');
  });
});

describe('карты прогресса', () => {
  it('изобилие: 2 карты из банка', () => {
    let s = mainPhase(newGame(3));
    giveCard(s, 'a', 'yearOfPlenty');
    s = act(s, 'a', { type: 'playYearOfPlenty', resources: ['ore', 'ore'] });
    expect(s.players.a.resources.ore).toBe(2);
    expect(s.bank.ore).toBe(17);
  });

  it('изобилие: если в банке нет — нельзя', () => {
    const s = mainPhase(newGame(3));
    giveCard(s, 'a', 'yearOfPlenty');
    s.bank.ore = 1;
    expect(actFail(s, 'a', { type: 'playYearOfPlenty', resources: ['ore', 'ore'] })).toBe('В банке нет столько таких карт');
  });

  it('монополия: все отдают выбранный ресурс', () => {
    let s = mainPhase(newGame(3));
    giveCard(s, 'a', 'monopoly');
    setHand(s, 'b', { wheat: 3, ore: 1 });
    setHand(s, 'c', { wheat: 2 });
    s = act(s, 'a', { type: 'playMonopoly', resource: 'wheat' });
    expect(s.players.a.resources.wheat).toBe(5);
    expect(s.players.b.resources).toMatchObject({ wheat: 0, ore: 1 });
    expect(s.players.c.resources.wheat).toBe(0);
  });

  it('строительство дорог: 2 бесплатные дороги, потом обратно', () => {
    let s = mainPhase(newGame(3));
    const t = topologyFor(s.board.layout);
    const v = [...t.vertices.values()].find((x) => x.neighbors.length === 3)!;
    s.buildings[v.id] = { owner: 'a', kind: 'settlement' };
    giveCard(s, 'a', 'roadBuilding');
    s = act(s, 'a', { type: 'playRoadBuilding' });
    expect(s.phase).toBe('roadBuilding');
    s = act(s, 'a', { type: 'buildRoad', edge: v.edges[0] });
    expect(s.phase).toBe('roadBuilding');
    s = act(s, 'a', { type: 'buildRoad', edge: v.edges[1] });
    expect(s.phase).toBe('main');
    expect(totalResources(s.players.a.resources)).toBe(0);
    expect(s.players.a.pieces.roads).toBe(13);
  });

  it('карта «Победное очко» засчитывается сразу и приносит победу', () => {
    let s = mainPhase(newGame(3, 2));
    s.settings.vpToWin = 3;
    const t = topologyFor(s.board.layout);
    const v = [...t.vertices.values()].find((x) => x.neighbors.length === 3)!;
    s.buildings[v.id] = { owner: 'a', kind: 'city' };
    giveCard(s, 'a', 'victoryPoint', 1);
    // Любое действие игрока проверяет победу
    setHand(s, 'a', { brick: 1, wood: 1 });
    s = act(s, 'a', { type: 'buildRoad', edge: v.edges[0] });
    expect(s.phase).toBe('finished');
    expect(s.winner).toBe('a');
  });
});
