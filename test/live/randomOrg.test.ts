// Живой тест: random.org отвечает, запас набирается, значения — кубики.
import { expect, it } from 'vitest';
import { rollDie } from '../../src/engine';
import { RandomOrgDice } from '../../src/net/randomOrg';

it('random.org даёт броски кубиков', async () => {
  const dice = new RandomOrgDice();
  await dice.refill();
  expect(dice.size).toBe(100);
  const { rng, source } = dice.rollRng();
  expect(source).toBe('randomOrg');
  const d = rollDie(rng);
  expect(d).toBeGreaterThanOrEqual(1);
  expect(d).toBeLessThanOrEqual(6);
}, 30_000);
