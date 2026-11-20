// Кубики с random.org: запас бросков, подкачка, запасной генератор при сбое.
import { describe, expect, it } from 'vitest';
import { rollDie } from '../src/engine';
import { RandomOrgDice, parseDice } from '../src/net/randomOrg';

type Reply = { ok: boolean; status: number; text(): Promise<string> };
const reply = (body: string, status = 200): Reply => ({ ok: status === 200, status, text: async () => body });

function fakeSite(replies: (Reply | Error)[]) {
  const calls: string[] = [];
  const fetcher = async (url: string) => {
    calls.push(url);
    const r = replies.shift() ?? new Error('нет связи');
    if (r instanceof Error) throw r;
    return r;
  };
  return { fetcher, calls };
}

describe('random.org', () => {
  it('разбирает ответ и отвергает ерунду', () => {
    expect(parseDice('6\n1\n3\n')).toEqual([6, 1, 3]);
    expect(() => parseDice('6\n7\n')).toThrow();
    expect(() => parseDice('<html>Error</html>')).toThrow();
    expect(() => parseDice('')).toThrow();
  });

  it('бросок берёт ровно два кубика из запаса — движок получает именно их', async () => {
    const site = fakeSite([reply('6\n1\n3\n3\n5\n2\n')]);
    const dice = new RandomOrgDice(site.fetcher);
    await dice.refill();
    expect(dice.size).toBe(6);
    const rolls: number[][] = [];
    for (let i = 0; i < 3; i++) {
      const { rng, source } = dice.rollRng();
      expect(source).toBe('randomOrg');
      rolls.push([rollDie(rng), rollDie(rng)]);
    }
    expect(rolls).toEqual([
      [6, 1],
      [3, 3],
      [5, 2],
    ]);
    expect(site.calls[0]).toContain('random.org/integers');
  });

  it('запас пуст или сайт недоступен — запасной генератор, повтор не раньше чем через минуту', async () => {
    let now = 0;
    const site = fakeSite([new Error('offline'), reply('4\n4\n')]);
    const dice = new RandomOrgDice(site.fetcher, () => now);
    await dice.refill();
    const first = dice.rollRng();
    expect(first.source).toBe('fallback');
    const d = rollDie(first.rng);
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThanOrEqual(6);
    await dice.refill();
    expect(site.calls).toHaveLength(1); // ждём паузу после ошибки
    now += 61_000;
    await dice.refill();
    expect(site.calls).toHaveLength(2);
    expect(dice.rollRng().source).toBe('randomOrg');
  });

  it('ответ с ошибкой (кончился лимит) тоже уводит на запасной генератор', async () => {
    const site = fakeSite([reply('Error: You have used your quota', 503)]);
    const dice = new RandomOrgDice(site.fetcher);
    await dice.refill();
    expect(dice.size).toBe(0);
    expect(dice.rollRng().source).toBe('fallback');
  });

  it('пока запаса хватает, лишних запросов нет', async () => {
    const site = fakeSite([reply(Array(100).fill('2').join('\n'))]);
    const dice = new RandomOrgDice(site.fetcher);
    await dice.refill();
    for (let i = 0; i < 25; i++) dice.rollRng(); // 100 → 50
    await Promise.resolve();
    expect(site.calls).toHaveLength(1);
  });
});
