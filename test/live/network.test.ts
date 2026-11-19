// Живой тест сетевого слоя на настоящей базе Firebase:
// хост + 3 игрока + посторонний, каждый со своим анонимным входом.
// Запуск: npm run test:live (нужны интернет и выложенные правила: npm run deploy:rules).

import { afterAll, describe, expect, it } from 'vitest';
import { get, push, ref, serverTimestamp, set, update } from 'firebase/database';
import type { Action, BoardView } from '../../src/engine';
import { legalRoadEdges, legalSettlementVertices, pick, seededRng } from '../../src/engine';
import type { Connection, HostSnapshot, PlayerSnapshot } from '../../src/net';
import { HostRoom, PlayerRoom, connect } from '../../src/net';

type Subscribable<S> = { subscribe(l: (s: S) => void): () => void };

function waitFor<S>(room: Subscribable<S>, pred: (s: S) => boolean, what: string, ms = 20_000): Promise<S> {
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

async function denied(p: PromiseLike<unknown>): Promise<boolean> {
  try {
    await p;
    return false;
  } catch (e) {
    return /permission/i.test(String(e));
  }
}

describe('сеть на Firebase (живой тест)', () => {
  const conns: Connection[] = [];
  let host: HostRoom | undefined;

  afterAll(async () => {
    await host?.close().catch(() => undefined);
    await Promise.all(conns.map((c) => c.close().catch(() => undefined)));
  });

  it('лобби, старт, действия через очередь, безопасность, возврат хоста', async () => {
    const tag = Date.now();
    for (const name of ['host', 'p1', 'p2', 'p3', 'outsider']) {
      conns.push(await connect({ name: `${name}-${tag}`, persistence: 'memory' }));
    }
    const [hc, c1, c2, c3, outsider] = conns;

    // ── лобби ──
    host = await HostRoom.create(hc);
    const pin = host.pin;
    expect(pin).toMatch(/^\d{6}$/);
    expect(host.joinUrl('https://hexland-540c6.web.app/host.html')).toBe(`https://hexland-540c6.web.app/?pin=${pin}`);

    await expect(PlayerRoom.join(c1, '000000', 'Бот')).rejects.toThrow('Игра с таким PIN не найдена');
    const players = [
      await PlayerRoom.join(c1, pin, 'Аня'),
      await PlayerRoom.join(c2, pin, 'Борис'),
      await PlayerRoom.join(c3, pin, 'Вика'),
    ];
    await waitFor(host, (s: HostSnapshot) => s.lobby.length === 3, 'трое в лобби');

    await players[0].chooseColor('red');
    await waitFor(players[1], (s: PlayerSnapshot) => s.colors.red === c1.uid, 'цвет red занят');
    await expect(players[1].chooseColor('red')).rejects.toThrow('Этот цвет уже занят');
    // Даже в обход проверки на клиенте правила не дадут занять чужой цвет
    expect(await denied(set(ref(c2.db, `rooms/${pin}/colors/red`), c2.uid))).toBe(true);
    await players[1].chooseColor('blue');
    await players[1].chooseColor('orange'); // смена цвета освобождает старый
    await waitFor(players[2], (s: PlayerSnapshot) => !s.colors.blue && s.colors.orange === c2.uid, 'синий освободился');
    await players[2].chooseColor('blue');
    const lobby = await waitFor(host, (s: HostSnapshot) => s.lobby.every((p) => p.color), 'все выбрали цвет');
    expect(lobby.lobby.map((p) => p.color).sort()).toEqual(['blue', 'orange', 'red']);

    // Посторонний не может писать в чужое лобби и менять meta
    expect(await denied(set(ref(outsider.db, `rooms/${pin}/lobby/${c1.uid}`), { name: 'x', joinedAt: 1 }))).toBe(true);
    expect(await denied(update(ref(outsider.db, `rooms/${pin}/meta`), { status: 'playing' }))).toBe(true);

    // Выгнать и не пустить обратно
    const extra = await PlayerRoom.join(outsider, pin, 'Лишний');
    await waitFor(host, (s: HostSnapshot) => s.lobby.length === 4, 'лишний зашёл');
    await host.kick(outsider.uid);
    await waitFor(extra, (s: PlayerSnapshot) => s.kicked, 'лишний видит, что его выгнали');
    await expect(PlayerRoom.join(outsider, pin, 'Лишний')).rejects.toThrow('Ведущий удалил тебя из этой игры');
    extra.dispose();

    // ── старт ──
    await host.start();
    const started = await waitFor(
      players[0],
      (s: PlayerSnapshot) => s.public?.phase === 'setup' && !!s.private,
      'игрок видит начало игры',
    );
    expect(Object.keys(started.public!.players)).toHaveLength(3);
    expect(started.private!.resources).toEqual({ brick: 0, wood: 0, sheep: 0, wheat: 0, ore: 0 });

    // ── безопасность ──
    expect(await denied(get(ref(c1.db, `rooms/${pin}/private/${c2.uid}`)))).toBe(true);
    expect(await denied(get(ref(c1.db, `rooms/${pin}/hostOnly`)))).toBe(true);
    expect(await denied(set(ref(c1.db, `rooms/${pin}/public/phase`), 'finished'))).toBe(true);
    expect(await denied(set(ref(c1.db, `rooms/${pin}/private/${c1.uid}/resources/ore`), 99))).toBe(true);
    expect(
      await denied(push(ref(outsider.db, `rooms/${pin}/actions`), { uid: outsider.uid, action: { type: 'endTurn' }, at: serverTimestamp() })),
    ).toBe(true);
    // Нельзя отправить действие от чужого имени
    expect(
      await denied(push(ref(c1.db, `rooms/${pin}/actions`), { uid: c2.uid, action: { type: 'endTurn' }, at: serverTimestamp() })),
    ).toBe(true);

    // ── расстановка через сеть ──
    const byUid = new Map(players.map((p, i) => [[c1, c2, c3][i].uid, p]));
    const rng = seededRng(5);
    const sendAndWait = async (room: PlayerRoom, action: Action) => {
      const id = await room.send(action);
      const s = await waitFor(room, (x: PlayerSnapshot) => x.lastResult?.actionId === id, `ответ на ${action.type}`);
      return s.lastResult!;
    };

    // Ход не в свою очередь → понятная ошибка
    const pub0 = players[0].snapshot.public!;
    const notCurrent = players.find((_, i) => [c1, c2, c3][i].uid !== pub0.order[pub0.current])!;
    const wrong = await sendAndWait(notCurrent, { type: 'rollDice' });
    expect(wrong).toMatchObject({ ok: false, error: 'Сейчас не твой ход' });

    for (let step = 0; step < 12; step++) {
      const pub = players[0].snapshot.public!;
      expect(pub.phase).toBe('setup');
      const uid = pub.order[pub.current];
      const room = byUid.get(uid)!;
      const view = room.snapshot.public! as unknown as BoardView;
      const action: Action =
        pub.setup!.step === 'settlement'
          ? { type: 'buildSettlement', vertex: pick(rng, legalSettlementVertices(view, uid, true)) }
          : { type: 'buildRoad', edge: pick(rng, legalRoadEdges(view, uid, pub.setup!.lastVertex)) };
      const res = await sendAndWait(room, action);
      expect(res.ok, res.error).toBe(true);
      await waitFor(players[0], (s: PlayerSnapshot) => (s.public?.log.length ?? 0) > pub.log.length, 'обновление после хода');
    }
    const afterSetup = await waitFor(players[0], (s: PlayerSnapshot) => s.public?.phase === 'roll', 'конец расстановки');
    expect(Object.keys(afterSetup.public!.buildings)).toHaveLength(6);

    // Первый ход: бросок кубиков
    const first = byUid.get(afterSetup.public!.order[afterSetup.public!.current])!;
    expect((await sendAndWait(first, { type: 'rollDice' })).ok).toBe(true);
    const rolled = await waitFor(first, (s: PlayerSnapshot) => !!s.public?.dice, 'кубики брошены');
    expect(rolled.public!.dice).toHaveLength(2);

    // ── хост перезагрузил страницу ──
    // Игроки видят изменения чуть раньше, чем у хоста завершается запись, — дождёмся хоста.
    const hostState = await waitFor(host, (s: HostSnapshot) => !!s.state?.dice, 'хост обработал бросок');
    const seqBefore = hostState.state!.logSeq;
    host.dispose();
    host = (await HostRoom.resume(hc, pin))!;
    expect(host).not.toBeNull();
    expect(host.snapshot.state!.logSeq).toBe(seqBefore);
    expect(host.snapshot.state!.dice).toEqual(hostState.state!.dice);
    expect(await HostRoom.resume(c1, pin)).toBeNull(); // чужую комнату «вернуть» нельзя

    // ── отключение игрока видно хосту ──
    await waitFor(host, (s: HostSnapshot) => s.presence[c3.uid]?.online === true, 'игрок 3 в сети');
    await c3.close();
    await waitFor(host, (s: HostSnapshot) => s.presence[c3.uid]?.online === false, 'игрок 3 не в сети', 30_000);

    players.forEach((p) => p.dispose());
  });
});
