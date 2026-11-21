import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { DEV_CARD_TYPES, RESOURCES } from '../src/engine';
import { LORE_PACKS } from '../src/lore';
import type { NarrationKey } from '../src/lore';

const KEYS: NarrationKey[] = [
  'gameStarted', 'settlement', 'city', 'road', 'seven', 'robberMoved', 'stole', 'knight',
  'monopoly', 'yearOfPlenty', 'roadBuilding', 'longestRoad', 'largestArmy', 'tradeCompleted', 'bigHarvest', 'gameWon',
];
const ART = [
  'emblem', 'robber', 'camp', 'attack', 'robber-unit',
  ...RESOURCES.map((r) => `res-${r}`),
  ...DEV_CARD_TYPES.map((d) => `dev-${d}`),
  ...['hills', 'forest', 'pasture', 'fields', 'mountains', 'desert'].map((t) => `tile-${t}`),
];

describe('lore packs', () => {
  it('ids are unique', () => {
    expect(new Set(LORE_PACKS.map((p) => p.id)).size).toBe(LORE_PACKS.length);
  });

  for (const p of LORE_PACKS) {
    describe(p.id, () => {
      it('has every resource, card and narration line', () => {
        for (const r of RESOURCES) expect(p.resources[r]?.name).toBeTruthy();
        for (const d of DEV_CARD_TYPES) expect(p.devCards[d]?.name).toBeTruthy();
        for (const k of KEYS) expect(p.narration[k]?.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(p.intro.length).toBeGreaterThanOrEqual(3);
      });

      it('has at least 20 sourced facts, 8 of them about Kazakhstan', () => {
        expect(p.facts.length).toBeGreaterThanOrEqual(20);
        expect(p.facts.filter((f) => f.kz).length).toBeGreaterThanOrEqual(8);
        for (const f of p.facts) expect(f.source).toBeTruthy();
      });

      it('has cover and all era art', () => {
        expect(existsSync(`public/eras/${p.id}.webp`)).toBe(true);
        for (const a of ART) expect(existsSync(`public/eras/${p.id}/${a}.webp`), a).toBe(true);
      });
    });
  }
});
