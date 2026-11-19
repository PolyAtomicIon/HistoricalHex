import { describe, expect, it } from 'vitest';
import { normalizeState, seededRng, toPrivateView, toPublicView, topologyFor } from '../src/engine';
import { act, firebaseRoundtrip, mainPhase, newGame, playSetup, setHand } from './helpers';

describe('представления', () => {
  it('в public нет чужих карт, колоды и украденного ресурса', () => {
    let s = mainPhase(newGame(3));
    setHand(s, 'b', { ore: 2 });
    s.players.a.devCards.push({ type: 'victoryPoint', boughtTurn: 0 });
    s.phase = 'moveRobber';
    const t = topologyFor(s.board.layout);
    const hex = s.board.hexes.find((h) => h.id !== s.robberHex)!;
    s.buildings[t.hexes.get(hex.id)!.vertices[0]] = { owner: 'b', kind: 'settlement' };
    s = act(s, 'a', { type: 'moveRobber', hex: hex.id });

    const pub = toPublicView(s);
    const json = JSON.stringify(pub);
    expect(json).not.toContain('"resources"');
    expect(json).not.toContain('devDeck"');
    expect(json).not.toContain('victoryPoint');
    expect(pub.players.b.resourceCount).toBe(1);
    expect(pub.players.a.devCardCount).toBe(1);
    expect(pub.players.a.points).toBe(0); // скрытое очко не видно
    const steal = pub.log.find((e) => e.type === 'stole')!;
    expect(steal).not.toHaveProperty('resource');

    const priv = toPrivateView(s, 'a');
    expect(priv.resources.ore).toBe(1);
    expect(priv.points).toBe(1);
    expect(priv.steals[0]).toMatchObject({ type: 'stole', resource: 'ore' });
  });

  it('в конце игры скрытые очки раскрываются', () => {
    const s = mainPhase(newGame(3));
    s.players.a.devCards.push({ type: 'victoryPoint', boughtTurn: 0 });
    s.phase = 'finished';
    expect(toPublicView(s).players.a.points).toBe(1);
  });

  it('карты, которые можно сыграть, отмечены', () => {
    const s = mainPhase(newGame(3));
    s.players.a.devCards.push({ type: 'knight', boughtTurn: 0 }, { type: 'monopoly', boughtTurn: 1 });
    const priv = toPrivateView(s, 'a');
    expect(priv.devCards).toEqual([
      { type: 'knight', playable: true, isNew: false },
      { type: 'monopoly', playable: false, isNew: true },
    ]);
  });
});

describe('Firebase', () => {
  it('после записи и чтения (без пустых полей) игра продолжается', () => {
    let s = playSetup(newGame(4), seededRng(3));
    s = act(s, s.order[0], { type: 'rollDice' });
    const restored = normalizeState(firebaseRoundtrip(s));
    // В событиях лога пустые поля (например gains: {}) пропадают — экран лога должен это учитывать.
    expect({ ...restored, log: [] }).toEqual({ ...normalizeState(structuredClone(s)), log: [] });
    expect(restored.log).toHaveLength(s.log.length);
    const pid = restored.order[restored.current];
    if (restored.phase === 'main') act(restored, pid, { type: 'endTurn' });
  });

  it('пустая игра тоже восстанавливается', () => {
    const s = newGame(3);
    const restored = normalizeState(firebaseRoundtrip(s));
    expect(restored.buildings).toEqual({});
    expect(restored.roads).toEqual({});
    expect(restored.players.a.devCards).toEqual([]);
    expect(restored.players.a.resources).toEqual({ brick: 0, wood: 0, sheep: 0, wheat: 0, ore: 0 });
  });
});
