// Живой тест: игрок выходит — за него играет бот; отвалившегося хост сам заменяет ботом.
import { afterAll, describe, expect, it } from 'vitest';
import type { Connection, HostSnapshot, PlayerSnapshot } from '../../src/net';
import { HostRoom, PlayerRoom, connect } from '../../src/net';

type Subscribable<S> = { subscribe(l: (s: S) => void): () => void };

function waitFor<S>(room: Subscribable<S>, pred: (s: S) => boolean, what: string, ms = 30_000): Promise<S> {
  return new Promise((resolve, reject) => {
    let unsub: () => void = () => undefined;
    const timer = setTimeout(() => {
      unsub();
      reject(new Error('Не дождались: ' + what));
    }, ms);
    unsub = room.subscribe((s) => {
      if (pred(s)) {
        clearTimeout(timer);
        queueMicrotask(() => unsub());
        resolve(s);
      }
    });
  });
}

describe('выход с ботом вместо себя (живой тест)', () => {
  const conns: Connection[] = [];
  let host: HostRoom | undefined;

  afterAll(async () => {
    await host?.close().catch(() => undefined);
    await Promise.all(conns.map((c) => c.close().catch(() => undefined)));
  });

  it('выход, возврат, автозамена отвалившегося', async () => {
    const tag = Date.now();
    const hc = await connect({ name: `host-h-${tag}`, persistence: 'memory' });
    const ca = await connect({ name: `a-h-${tag}`, persistence: 'memory' });
    const cb = await connect({ name: `b-h-${tag}`, persistence: 'memory' });
    conns.push(hc, ca, cb);

    host = await HostRoom.create(hc, { reconnectSeconds: 3, offlineBot: true });
    const a = await PlayerRoom.join(ca, host.pin, 'Аня');
    const b = await PlayerRoom.join(cb, host.pin, 'Борис');
    await waitFor(a, (s: PlayerSnapshot) => s.lobby.length === 2, 'оба в лобби');
    await a.chooseColor('red');
    await waitFor(b, (s: PlayerSnapshot) => s.colors.red === ca.uid, 'красный занят');
    await b.chooseColor('blue');
    await host.addBot('easy');
    await waitFor(host, (s: HostSnapshot) => s.lobby.length === 3 && s.lobby.every((p) => p.color), 'все с цветами');
    await host.start();
    await waitFor(a, (s: PlayerSnapshot) => !!s.public && !!s.private, 'игра у Ани');

    // ── Аня выходит, за неё играет сложный бот ──
    const send = async (room: PlayerRoom, action: Parameters<PlayerRoom['send']>[0]) => {
      const id = await room.send(action);
      return (await waitFor(room, (s: PlayerSnapshot) => s.lastResult?.actionId === id, 'ответ ' + action.type)).lastResult!;
    };
    const left = await send(a, { type: 'handToBot', level: 'hard' });
    expect(left.ok).toBe(true);
    await waitFor(a, (s: PlayerSnapshot) => s.public?.players[ca.uid]?.away === true, 'Аня — бот');
    const hs = await waitFor(host, (s: HostSnapshot) => !!s.state?.players[ca.uid]?.away, 'хост видит выход');
    expect(hs.state!.players[ca.uid]).toMatchObject({ bot: 'hard', away: true });

    // Пока за неё играет бот — сама ходить не может
    const blocked = await send(a, { type: 'endTurn' });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/играет бот/);

    // Возвращается
    const back = await send(a, { type: 'returnFromBot' });
    expect(back.ok).toBe(true);
    await waitFor(a, (s: PlayerSnapshot) => !s.public?.players[ca.uid]?.away, 'Аня вернулась');
    await waitFor(host, (s: HostSnapshot) => !s.state?.players[ca.uid]?.bot, 'хост видит возврат');

    // И снова уходит — теперь до конца
    expect((await send(a, { type: 'handToBot', level: 'medium' })).ok).toBe(true);

    // ── Борис отваливается: как только игра его ждёт дольше 3 с — вместо него бот ──
    b.dispose();
    await cb.close();
    const after = await waitFor(
      host,
      (s: HostSnapshot) => s.state?.players[cb.uid]?.bot === 'medium',
      'автозамена Бориса ботом',
      90_000,
    );
    expect(after.state!.players[cb.uid].away).toBe(true);
    expect(after.state!.log.some((e) => e.type === 'playerLeft' && e.player === cb.uid && e.auto)).toBe(true);

    // Все люди ушли — боты продолжают партию сами
    const turn = after.state!.log.length;
    await waitFor(host, (s: HostSnapshot) => (s.state?.log.length ?? 0) > turn + 3, 'боты играют дальше');
    a.dispose();
  }, 150_000);
});
