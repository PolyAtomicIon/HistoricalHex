import { describe, expect, it } from 'vitest';
import { RULE_SECTIONS } from '../src/app/learn/rulesContent';
import { queryTerms, searchRules } from '../src/app/learn/rulesSearch';
import type { Lang } from '../src/app/learn/lang';

const first = (q: string, lang: Lang = 'ru') => searchRules(RULE_SECTIONS, queryTerms(q), lang)[0]?.id;

describe('поиск по правилам', () => {
  it('частые вопросы находят нужный раздел первым', () => {
    expect(first('7')).toBe('robber');
    expect(first('как выиграть')).toBe('goal');
    expect(first('сбросить карты')).toBe('robber');
    expect(first('порт')).toBe('trade');
    expect(first('отменить')).toBe('undo');
    expect(first('сколько стоит город')).toBe('costs');
  });
  it('вопросы ведущего посреди партии', () => {
    expect(first('сколько карт сбрасывать у меня 9')).toBe('robber');
    expect(first('что такое 3:1 на берегу')).toBe('trade');
    expect(first('можно меняться не в свой ход')).toBe('trade');
    expect(['production', 'robber']).toContain(first('почему мне ничего не дали'));
    expect(['turn', 'devcards']).toContain(first('рыцаря до броска'));
    expect(first('дорогу разрезали')).toBe('placement');
    expect(first('сколько очков чтобы выиграть')).toBe('goal');
  });
  it('с начала слова: «қала» не находит «қалай» первым', () => {
    expect(first('қала', 'kz')).not.toBe('turn');
  });
  it('на казахском и английском тоже', () => {
    expect(first('7', 'kz')).toBe('robber');
    expect(first('harbor', 'en')).toBe('trade');
    expect(first('how to win', 'en')).toBe('goal');
    expect(first('undo', 'en')).toBe('undo');
  });
  it('служебные слова и окончания не мешают', () => {
    expect(queryTerms('Как выиграть?')).toEqual(['выигр']);
    expect(queryTerms('how to win')).toEqual(['win']);
  });
  it('у каждого раздела есть текст на трёх языках', () => {
    for (const s of RULE_SECTIONS) {
      for (const l of ['ru', 'kz', 'en'] as const) {
        expect(s.title[l].length, `${s.id} ${l}`).toBeGreaterThan(2);
        for (const b of s.body) expect(b[l].length, `${s.id} ${l}`).toBeGreaterThan(0);
      }
    }
  });
});
