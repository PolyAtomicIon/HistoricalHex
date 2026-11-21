import { describe, expect, it } from 'vitest';
import { logText, noticeFor } from '../src/app/gameLog';
import { LORE_PACKS } from '../src/lore';

const pack = LORE_PACKS.find((p) => p.id === 'genghis')!;
const names: Record<string, string> = { a: 'Арман', b: 'Мадина' };
const ctx = { pack, name: (id?: string) => (id && names[id]) || 'Кто-то', me: 'a', hexInfo: () => ({ res: 'ore' as const, number: 9 }) };

describe('журнал партии', () => {
  it('бросок, постройка, ход, налёт', () => {
    expect(logText({ type: 'diceRolled', player: 'b', dice: [3, 4], total: 7 }, ctx)!.text).toBe('Мадина бросает: 3 + 4 = 7 — семь!');
    expect(logText({ type: 'built', player: 'a', kind: 'city', at: 'v1' }, ctx)!.text).toBe('Арман строит город');
    expect(logText({ type: 'turnStarted', player: 'b', turn: 5 }, ctx)).toMatchObject({ turn: true, text: 'Ход 5: Мадина' });
    expect(logText({ type: 'robberMoved', player: 'b', hex: 'h1' }, ctx)!.text).toContain('на руда 9');
  });
  it('кражу видно с ресурсом только участникам', () => {
    expect(logText({ type: 'stole', thief: 'b', victim: 'a', resource: 'wood' }, ctx)!.text).toMatch(/\(.+\)$/);
    expect(logText({ type: 'stole', thief: 'b', victim: 'c', resource: 'wood' }, { ...ctx, me: 'z' })!.text).not.toContain('(');
  });
  it('награды объясняются и закрепляются', () => {
    const n = noticeFor({ type: 'longestRoad', player: 'b', length: 6 }, ctx)!;
    expect(n.title).toBe(pack.bonuses.longestRoad);
    expect(n.text).toContain('+2 очка');
    expect(n.text).toContain('Мадина');
    expect(noticeFor({ type: 'largestArmy', player: 'a', knights: 3 }, ctx)!.text).toContain('у тебя');
    expect(noticeFor({ type: 'monopoly', player: 'a', resource: 'ore', total: 4 }, ctx)).toBeNull();
    expect(noticeFor({ type: 'diceRolled', player: 'a', dice: [1, 1], total: 2 }, ctx)).toBeNull();
  });
});
