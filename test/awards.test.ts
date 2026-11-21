import { describe, expect, it } from 'vitest';
import { awardsOf } from '../src/app/awards';

describe('значки наград в полосе игроков', () => {
  it('нет наград — пусто', () => {
    expect(awardsOf({}, 'a')).toEqual([]);
  });
  it('только дорога', () => {
    expect(awardsOf({ longestRoad: 'a' }, 'a')).toEqual(['road']);
    expect(awardsOf({ longestRoad: 'a' }, 'b')).toEqual([]);
  });
  it('только армия', () => {
    expect(awardsOf({ largestArmy: 'b' }, 'b')).toEqual(['army']);
  });
  it('обе у одного — два значка, дорога первой', () => {
    expect(awardsOf({ longestRoad: 'a', largestArmy: 'a' }, 'a')).toEqual(['road', 'army']);
  });
  it('у разных игроков — по одному', () => {
    const pub = { longestRoad: 'a', largestArmy: 'b' };
    expect(awardsOf(pub, 'a')).toEqual(['road']);
    expect(awardsOf(pub, 'b')).toEqual(['army']);
    expect(awardsOf(pub, 'c')).toEqual([]);
  });
});
