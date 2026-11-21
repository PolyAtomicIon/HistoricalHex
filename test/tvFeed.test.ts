import { describe, expect, it } from 'vitest';
import { feedItem, tvFeed } from '../src/app/tvFeed';
import { LORE_PACKS } from '../src/lore';
import type { PublicState } from '../src/engine';

const pack = LORE_PACKS.find((p) => p.id === 'genghis')!;
const names: Record<string, string> = { a: 'Арман', b: 'Мадина' };
const name = (id?: string) => (id && names[id]) || 'Кто-то';

describe('лента ТВ', () => {
  it('доход — ресурсы по игрокам, без текста', () => {
    const it = feedItem({ type: 'produced', total: 8, gains: { a: { wheat: 1 }, b: { ore: 2 } }, shortages: [] }, 1, pack, name)!;
    expect(it.gains).toEqual([
      { who: 'a', res: [{ r: 'wheat', n: 1 }] },
      { who: 'b', res: [{ r: 'ore', n: 2 }] },
    ]);
  });
  it('обмен с банком — что отдал и что получил', () => {
    const it = feedItem({ type: 'bankTrade', player: 'a', give: 'wood', giveCount: 4, receive: 'ore', receiveCount: 1 }, 1, pack, name)!;
    expect(it).toMatchObject({ who: 'a', icon: 'bank', res: [{ r: 'wood', n: 4 }], get: [{ r: 'ore', n: 1 }] });
  });
  it('шум не попадает: предложения, отмены, броски, начало хода', () => {
    const log = [
      { seq: 1, type: 'built', player: 'a', kind: 'road', at: 'e1' },
      { seq: 2, type: 'turnStarted', player: 'b', turn: 3 },
      { seq: 3, type: 'diceRolled', player: 'b', dice: [2, 3], total: 5 },
      { seq: 4, type: 'tradeOffered', player: 'b', tradeId: 1, give: { wood: 1 }, want: { brick: 1 } },
      { seq: 5, type: 'tradeCancelled', player: 'b' },
      { seq: 6, type: 'built', player: 'b', kind: 'city', at: 'v1' },
    ];
    const feed = tvFeed({ log } as unknown as PublicState, pack, name);
    expect(feed.map((f) => f.text)).toEqual(['город', 'дорога']);
    expect(feed[0].key).toBe(6);
  });
});
