// Живой тест: ведущий выгоняет игрока посреди партии — за него играет бот, вернуться нельзя.
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

describe('выгнать игрока посреди партии (живой тест)', () => {
  const conns: Connection[] = [];
  let host: HostRoom | undefined;

  afterAll(async () => {
    await host?.close().catch(() => undefined);
    await Promise.all(conns.map((c) => c.close().catch(() => undefined)));
  });

  it('выгнанного заменяет бот, телефон видит kicked, вернуться нельзя', async () => {
    const tag = Date.now();
    const hc = await connect({ name: `host-k-${tag}`, persistence: 'memory' });
    const ca = await connect({ name: `a-k-${tag}`, persistence: 'memory' });
    const cb = await connect({ name: `b-k-${tag}`, persistence: 'memory' });
    conns.push(hc, ca, cb);

    host = await HostRoom.create(hc, {});
    const a = await PlayerRoom.join(ca, host.pin, 'Аня');
    const b = await PlayerRoom.join(cb, host.pin, 'Борис');
    await waitFor(a, (s: PlayerSnapshot) => s.lobby.length === 2, 'оба в лобби');
    await a.chooseColor('red');
    await waitFor(b, (s: PlayerSnapshot) => s.colors.red === ca.uid, 'красный занят');
    await b.chooseColor('blue');
    await host.addBot('easy');
    await waitFor(host, (s: HostSnapshot) => s.lobby.length === 3 && s.lobby.every((p) => p.color), 'все с цветами');
    await host.start();
    await waitFor(b, (s: PlayerSnapshot) => !!s.public && !!s.private, 'игра у Бориса');

    const res = await host.kickFromGame(cb.uid, 'medium');
    expect(res.ok).toBe(true);
    const hs = await waitFor(host, (s: HostSnapshot) => !!s.state?.players[cb.uid]?.kicked, 'хост видит выгнанного');
    expect(hs.state!.players[cb.uid]).toMatchObject({ bot: 'medium', away: true, kicked: true });
    expect(hs.state!.log.some((e) => e.type === 'playerKicked' && e.player === cb.uid)).toBe(true);

    // Телефон Бориса узнаёт, что его выгнали; Аня видит его выгнанным
    await waitFor(b, (s: PlayerSnapshot) => s.kicked, 'Борис видит, что выгнан');
    await waitFor(a, (s: PlayerSnapshot) => s.public?.players[cb.uid]?.kicked === true, 'Аня видит выгнанного');

    // Выгнать второй раз нельзя
    expect((await host.kickFromGame(cb.uid, 'easy')).ok).toBe(false);

    // Вернуться нельзя: правила базы не примут действие (или хост откажет, если правила ещё старые)
    const back = await b
      .send({ type: 'returnFromBot' })
      .then((id) => waitFor(b, (s: PlayerSnapshot) => s.lastResult?.actionId === id, 'ответ на возврат', 10_000))
      .then((s) => s.lastResult!.ok, () => false);
    expect(back).toBe(false);
    const after = await waitFor(host, (s: HostSnapshot) => !!s.state, 'состояние');
    expect(after.state!.players[cb.uid].kicked).toBe(true);
    a.dispose();
    b.dispose();
  }, 120_000);
});
