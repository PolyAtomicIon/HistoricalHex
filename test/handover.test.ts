// Выход из партии: место игрока занимает бот, игрок может вернуться.
import { describe, expect, it } from 'vitest';
import type { GameState, PlayerId } from '../src/engine';
import { applyAction, applyHostAction, seededRng, toPrivateView, toPublicView } from '../src/engine';
import type { BotMemory } from '../src/bots';
import { botsToAct, decide } from '../src/bots';
import { act, actFail, mainPhase, newGame, setHand } from './helpers';

describe('выход из игры с ботом вместо себя', () => {
  it('игрок отдаёт место боту и возвращается', () => {
    let s = mainPhase(newGame(3));
    setHand(s, 'b', { wood: 2, ore: 1 });
    s = act(s, 'b', { type: 'handToBot', level: 'hard' });
    expect(s.players.b.bot).toBe('hard');
    expect(s.players.b.away).toBe(true);
    expect(s.players.b.resources.wood).toBe(2); // карты на месте
    expect(s.log.at(-1)).toMatchObject({ type: 'playerLeft', player: 'b', level: 'hard' });

    const pub = toPublicView(s);
    expect(pub.players.b).toMatchObject({ bot: 'hard', away: true });
    expect(pub.players.a.away).toBeUndefined();

    expect(actFail(s, 'b', { type: 'handToBot', level: 'easy' })).toMatch(/уже играет бот/);

    s = act(s, 'b', { type: 'returnFromBot' });
    expect(s.players.b.bot).toBeUndefined();
    expect(s.players.b.away).toBeUndefined();
    expect(s.log.at(-1)).toMatchObject({ type: 'playerReturned', player: 'b' });
    expect(actFail(s, 'b', { type: 'returnFromBot' })).toMatch(/не играет бот/);
  });

  it('бота из лобби нельзя «вернуть», неизвестный уровень не принимается', () => {
    const s = mainPhase(newGame(3));
    s.players.c.bot = 'easy';
    expect(actFail(s, 'c', { type: 'returnFromBot' })).toMatch(/не играет бот/);
    expect(actFail(s, 'c', { type: 'handToBot', level: 'hard' })).toMatch(/и так бот/);
    expect(actFail(s, 'a', { type: 'handToBot', level: 'genius' as never })).toMatch(/уровень/);
  });

  it('активный игрок выходит — его предложение обмена снимается', () => {
    let s = mainPhase(newGame(3));
    setHand(s, 'a', { wood: 1 });
    s = act(s, 'a', { type: 'offerTrade', give: { wood: 1, brick: 0, sheep: 0, wheat: 0, ore: 0 }, want: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 1 } });
    expect(s.trade).toBeDefined();
    s = act(s, 'a', { type: 'handToBot', level: 'medium' });
    expect(s.trade).toBeUndefined();
    expect(s.log.some((e) => e.type === 'tradeCancelled')).toBe(true);
  });

  it('хост отдаёт отвалившегося игрока боту (auto)', () => {
    const s = mainPhase(newGame(3));
    const res = applyHostAction(s, { type: 'handToBot', player: 'a', level: 'medium', auto: true }, seededRng(1));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.players.a).toMatchObject({ bot: 'medium', away: true });
    expect(res.state.log.at(-1)).toMatchObject({ type: 'playerLeft', auto: true });
    const again = applyHostAction(res.state, { type: 'handToBot', player: 'a', level: 'easy' }, seededRng(1));
    expect(again.ok).toBe(false);
  });

  it('люди уходят посреди партии, один возвращается — боты доигрывают до победы', () => {
    const rng = seededRng(77);
    let s: GameState = newGame(4, 5);
    const memory: Record<PlayerId, BotMemory> = {};
    // Пока игрок «человек», за него ходит лёгкий бот-заглушка
    const plan: Record<number, [PlayerId, 'leave' | 'back']> = {
      10: ['a', 'leave'], // ещё на расстановке
      50: ['b', 'leave'],
      80: ['a', 'back'],
      110: ['c', 'leave'],
      140: ['a', 'leave'],
      170: ['d', 'leave'],
    };
    let done = 0;
    let now = 0;
    for (let step = 0; step < 4000 && s.phase !== 'finished'; step++) {
      now += 1000;
      const todo = plan[step];
      if (todo) {
        const [pid, kind] = todo;
        s = act(s, pid, kind === 'leave' ? { type: 'handToBot', level: 'hard' } : { type: 'returnFromBot' }, rng);
        delete memory[pid];
        done += 1;
        continue;
      }
      const pub = toPublicView(s);
      for (const id of botsToAct(pub, () => true)) {
        const action = decide({
          level: s.players[id].bot ?? 'easy',
          pub,
          priv: toPrivateView(s, id),
          me: id,
          rng,
          memory: (memory[id] ??= {}),
          now,
        });
        if (!action) continue;
        let res = applyAction(s, id, action, rng);
        if (!res.ok) {
          const fallback = decide({ level: 'easy', pub, priv: toPrivateView(s, id), me: id, rng, memory: {}, now });
          if (fallback) res = applyAction(s, id, fallback, rng);
        }
        if (!res.ok) throw new Error(`${id} застрял: ${JSON.stringify(action)} → ${res.error}`);
        s = res.state;
        break;
      }
    }
    expect(s.phase).toBe('finished');
    expect(done).toBe(6);
    expect(Object.values(s.players).every((p) => p.away && p.bot === 'hard')).toBe(true);
  }, 60_000);
});

describe('ведущий выгоняет игрока посреди партии', () => {
  it('живого игрока: бот выбранного уровня, вернуться нельзя', () => {
    let s = mainPhase(newGame(3));
    setHand(s, 'b', { wood: 2 });
    const res = applyHostAction(s, { type: 'kick', player: 'b', level: 'easy' }, seededRng(1));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    s = res.state;
    expect(s.players.b).toMatchObject({ bot: 'easy', away: true, kicked: true });
    expect(s.players.b.resources.wood).toBe(2);
    expect(s.log.at(-1)).toMatchObject({ type: 'playerKicked', player: 'b', level: 'easy' });
    expect(toPublicView(s).players.b.kicked).toBe(true);
    expect(actFail(s, 'b', { type: 'returnFromBot' })).toMatch(/убрал/);
    const again = applyHostAction(s, { type: 'kick', player: 'b', level: 'hard' }, seededRng(1));
    expect(again.ok).toBe(false);
  });

  it('того, кто уже вышел с ботом: бот остаётся тот же', () => {
    let s = mainPhase(newGame(3));
    s = act(s, 'c', { type: 'handToBot', level: 'hard' });
    const res = applyHostAction(s, { type: 'kick', player: 'c', level: 'easy' }, seededRng(1));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.players.c).toMatchObject({ bot: 'hard', kicked: true });
    expect(res.state.log.at(-1)).toMatchObject({ type: 'playerKicked', level: 'hard' });
  });

  it('бота из лобби выгнать нельзя, активный игрок теряет предложение обмена', () => {
    let s = mainPhase(newGame(3));
    s.players.c.bot = 'easy';
    const bot = applyHostAction(s, { type: 'kick', player: 'c', level: 'easy' }, seededRng(1));
    expect(bot.ok).toBe(false);
    setHand(s, 'a', { wood: 1 });
    s = act(s, 'a', { type: 'offerTrade', give: { wood: 1, brick: 0, sheep: 0, wheat: 0, ore: 0 }, want: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 1 } });
    const res = applyHostAction(s, { type: 'kick', player: 'a', level: 'medium' }, seededRng(1));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.trade).toBeUndefined();
  });
});
