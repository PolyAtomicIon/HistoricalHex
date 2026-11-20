// Кубики: обычные (честный случай) и сбалансированные (колода из 36 бросков).
import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/engine';
import { DICE_DECK_RESHUFFLE_AT, applyAction, createGame, newDiceDeck, seededRng, toPublicView } from '../src/engine';
import { newGame, skipSetup } from './helpers';

/** Сколько способов выкинуть сумму на двух кубиках. */
const ways = (sum: number) => 6 - Math.abs(7 - sum);

/** Бросить кубики n раз подряд (после броска возвращаем фазу «бросок»). */
function rollMany(s: GameState, n: number, seed = 5): { sums: number[]; s: GameState } {
  const rng = seededRng(seed);
  const sums: number[] = [];
  for (let i = 0; i < n; i++) {
    s.phase = 'roll';
    delete s.pendingDiscards;
    delete s.resumePhase;
    const res = applyAction(s, s.order[s.current], { type: 'rollDice' }, rng);
    if (!res.ok) throw new Error(res.error);
    s = res.state;
    sums.push(s.dice![0] + s.dice![1]);
  }
  return { sums, s };
}

describe('кубики', () => {
  it('колода — все 36 бросков ровно по разу', () => {
    const deck = newDiceDeck(seededRng(3));
    expect(deck).toHaveLength(36);
    expect(new Set(deck.map(([a, b]) => `${a}${b}`)).size).toBe(36);
    for (let sum = 2; sum <= 12; sum++) expect(deck.filter(([a, b]) => a + b === sum)).toHaveLength(ways(sum));
  });

  it('сбалансированные: в каждой колоде ни одно число не выпадает чаще, чем есть способов его выкинуть', () => {
    const s = skipSetup(newGame(3));
    s.settings.balancedDice = true;
    const perDeck = 36 - DICE_DECK_RESHUFFLE_AT;
    const { sums } = rollMany(s, perDeck * 20);
    for (let d = 0; d < 20; d++) {
      const chunk = sums.slice(d * perDeck, (d + 1) * perDeck);
      for (let sum = 2; sum <= 12; sum++) {
        expect(chunk.filter((x) => x === sum).length).toBeLessThanOrEqual(ways(sum));
      }
      // Семёрок за колоду: из 6 в колоде вытянуто хотя бы 6 − (сколько осталось)
      expect(chunk.filter((x) => x === 7).length).toBeGreaterThanOrEqual(6 - DICE_DECK_RESHUFFLE_AT);
    }
  });

  it('колода кубиков не уходит игрокам', () => {
    const s = skipSetup(newGame(3));
    s.settings.balancedDice = true;
    const after = rollMany(s, 3).s;
    expect(after.diceDeck!.length).toBe(33);
    expect('diceDeck' in toPublicView(after)).toBe(false);
  });

  it('обычные кубики колоду не заводят; настройка задаётся при создании игры', () => {
    const { s } = rollMany(skipSetup(newGame(3)), 20);
    expect(s.diceDeck).toBeUndefined();
    const players = [
      { id: 'a', name: 'А', color: 'red' as const },
      { id: 'b', name: 'Б', color: 'blue' as const },
      { id: 'c', name: 'В', color: 'white' as const },
    ];
    expect(createGame(players, seededRng(1), { balancedDice: true }).settings.balancedDice).toBe(true);
    expect(createGame(players, seededRng(1)).settings.balancedDice).toBeUndefined();
  });
});
