// Живой тест: хост добавляет ботов, они сами ходят через хост (по сети), человек играет с телефона.
import { afterAll, describe, expect, it } from 'vitest';
import type { Action } from '../../src/engine';
import { legalRoadEdges, legalSettlementVertices, pick, seededRng } from '../../src/engine';
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

describe('боты у хоста (живой тест)', () => {
  const conns: Connection[] = [];
  let host: HostRoom | undefined;

  afterAll(async () => {
    await host?.close().catch(() => undefined);
    await Promise.all(conns.map((c) => c.close().catch(() => undefined)));
  });

  it('хост добавляет ботов, они проходят расстановку сами', async () => {
    const tag = Date.now();
    const hc = await connect({ name: `host-b-${tag}`, persistence: 'memory' });
    const pc = await connect({ name: `human-b-${tag}`, persistence: 'memory' });
    conns.push(hc, pc);

    host = await HostRoom.create(hc);
    await host.addBot('medium');
    await host.addBot('hard');
    await waitFor(host, (s: HostSnapshot) => s.lobby.length === 2 && s.lobby.every((p) => p.color && p.bot), 'два бота в лобби');

    // Только боты — начать нельзя
    await expect(host.start()).rejects.toThrow();

    const human = await PlayerRoom.join(pc, host.pin, 'Человек');
    const lobby = await waitFor(
      human,
      (s: PlayerSnapshot) => s.lobby.length === 3 && Object.keys(s.colors).length === 2,
      'человек видит ботов и их цвета',
    );
    expect(lobby.lobby.filter((p) => p.bot).map((p) => p.bot).sort()).toEqual(['hard', 'medium']);
    const free = (['red', 'blue', 'white', 'orange', 'green', 'purple'] as const).find((c) => !lobby.colors[c])!;
    await human.chooseColor(free);
    await waitFor(host, (s: HostSnapshot) => s.lobby.every((p) => p.color), 'все с цветами');

    // Убрать бота и добавить снова
    const botId = host.snapshot.lobby.find((p) => p.bot === 'medium')!.uid;
    await host.kick(botId);
    await waitFor(host, (s: HostSnapshot) => s.lobby.length === 2, 'бот убран');
    await host.addBot('easy');
    await waitFor(host, (s: HostSnapshot) => s.lobby.length === 3 && s.lobby.every((p) => p.color), 'бот добавлен снова');

    await host.start();
    await waitFor(human, (s: PlayerSnapshot) => s.public?.phase === 'setup', 'игра началась');

    // Человек ходит, когда его очередь; боты — сами
    const rng = seededRng(3);
    const until = Date.now() + 90_000;
    while (Date.now() < until) {
      const s = human.snapshot;
      const pub = s.public!;
      if (pub.phase !== 'setup') break;
      if (pub.order[pub.current] === pc.uid) {
        const action: Action =
          pub.setup!.step === 'road'
            ? { type: 'buildRoad', edge: pick(rng, legalRoadEdges(pub, pc.uid, pub.setup!.lastVertex)) }
            : { type: 'buildSettlement', vertex: pick(rng, legalSettlementVertices(pub, pc.uid, true)) };
        const id = await human.send(action);
        await waitFor(human, (x: PlayerSnapshot) => x.lastResult?.actionId === id, 'ответ хоста');
        await waitFor(human, (x: PlayerSnapshot) => (x.public?.log.length ?? 0) > pub.log.length, 'обновление');
      } else {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    const after = await waitFor(human, (s: PlayerSnapshot) => s.public?.phase !== 'setup', 'конец расстановки', 60_000);
    expect(Object.keys(after.public!.buildings)).toHaveLength(6);
    const botPlayers = Object.values(after.public!.players).filter((p) => p.bot);
    expect(botPlayers).toHaveLength(2);
    human.dispose();
  });
});
