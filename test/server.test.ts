// Сервер целиком: комната, лобби, боты, выход человека с ботом вместо себя, партия до победы.

import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { ClientMsg, RoomView, ServerMsg } from '../src/proto';

const PORT = 18790;
let server: ChildProcess;

beforeAll(async () => {
  execSync('npm run -s build:server', { stdio: 'ignore' });
  server = spawn('node', ['dist-server/server.mjs'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: mkdtempSync(join(tmpdir(), 'hh-')), BOT_DELAY_MS: '1', BOT_REPLY_MS: '1' },
    stdio: 'pipe',
  });
  await new Promise<void>((ok) => server.stdout!.on('data', (d) => String(d).includes('server on') && ok()));
}, 30_000);

afterAll(() => server?.kill());

class TestClient {
  ws: WebSocket;
  room?: RoomView;
  msgs: ServerMsg[] = [];
  constructor() {
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    this.ws.on('message', (d) => {
      const m = JSON.parse(String(d)) as ServerMsg;
      this.msgs.push(m);
      if (m.t === 'room') this.room = m.room;
    });
  }
  ready = () => new Promise<void>((ok) => this.ws.on('open', () => ok()));
  send = (m: ClientMsg) => this.ws.send(JSON.stringify(m));
  async until(pred: () => boolean, ms = 20_000) {
    const end = Date.now() + ms;
    while (!pred()) {
      if (Date.now() > end) throw new Error('timeout');
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}

describe('server', () => {
  it('runs a full game with bots after the human leaves', async () => {
    const host = new TestClient();
    await host.ready();
    host.send({ t: 'hello', secret: 'host-secret-0123456789' });
    host.send({ t: 'create', settings: { dice: 'random', vpToWin: 8 } });
    await host.until(() => !!host.room);
    const pin = host.room!.pin;
    host.send({ t: 'join', pin, name: 'Бекзат' });
    for (let i = 0; i < 3; i++) host.send({ t: 'addBot', level: 'medium' });
    await host.until(() => host.room!.lobby.length === 4);

    // Второй телефон: зритель (телевизор) видит комнату, но без руки
    const tv = new TestClient();
    await tv.ready();
    tv.send({ t: 'hello', secret: 'tv-secret-01234567890' });
    tv.send({ t: 'open', pin });
    await tv.until(() => !!tv.room);
    expect(tv.room!.seated).toBe(false);

    host.send({ t: 'start' });
    await host.until(() => host.room?.status === 'playing');
    expect(host.room!.private).toBeTruthy();
    expect(tv.room!.private).toBeUndefined();

    host.send({ t: 'act', id: 'a1', action: { type: 'handToBot', level: 'easy' } });
    await host.until(() => host.msgs.some((m) => m.t === 'result' && m.id === 'a1'));
    const res = host.msgs.find((m) => m.t === 'result' && m.id === 'a1');
    expect(res).toMatchObject({ ok: true });

    await tv.until(() => tv.room?.status === 'finished', 60_000);
    expect(tv.room!.public!.winner).toBeTruthy();
    expect(tv.msgs.some((m) => m.t === 'events' && m.events.some((e) => e.type === 'diceRolled'))).toBe(true);
    host.ws.close();
    tv.ws.close();
  }, 90_000);

  it('accepts physical dice only with valid values', async () => {
    const c = new TestClient();
    await c.ready();
    c.send({ t: 'hello', secret: 'phys-secret-0123456789' });
    c.send({ t: 'create', settings: { dice: 'physical' } });
    await c.until(() => !!c.room);
    c.send({ t: 'join', pin: c.room!.pin, name: 'A' });
    c.send({ t: 'addBot', level: 'easy' });
    c.send({ t: 'addBot', level: 'easy' });
    await c.until(() => c.room!.lobby.length === 3);
    c.send({ t: 'start' });
    await c.until(() => c.room?.status === 'playing');
    // Отдаём расстановку боту и возвращаемся, когда дойдёт до броска
    c.send({ t: 'act', id: 'h', action: { type: 'handToBot', level: 'easy' } });
    await c.until(() => c.room!.public!.phase !== 'setup');
    c.send({ t: 'act', id: 'r', action: { type: 'returnFromBot' } });
    await c.until(() => c.msgs.some((m) => m.t === 'result' && m.id === 'r'));
    // Вернулись посреди своего хода — заканчиваем его и ждём следующий с фазой броска
    let ended = 0;
    await c.until(() => {
      const p = c.room!.public!;
      const mine = p.order[p.current] === c.room!.me;
      if (mine && p.phase === 'main' && ended < p.turn) {
        ended = p.turn;
        c.send({ t: 'act', id: `end${p.turn}`, action: { type: 'endTurn' } });
      }
      return mine && p.phase === 'roll';
    }, 30_000);
    c.send({ t: 'act', id: 'bad', action: { type: 'rollDice' }, dice: [7, 1] });
    c.send({ t: 'act', id: 'good', action: { type: 'rollDice' }, dice: [4, 3] });
    await c.until(() => c.msgs.some((m) => m.t === 'result' && m.id === 'good'));
    expect(c.msgs.find((m) => m.t === 'result' && m.id === 'bad')).toMatchObject({ ok: false });
    const good = c.msgs.find((m) => m.t === 'result' && m.id === 'good');
    expect(good, JSON.stringify(good)).toMatchObject({ ok: true });
    expect(c.room!.public!.dice).toEqual([4, 3]);
    c.ws.close();
  }, 60_000);

  it('lets a player reclaim their seat from a new device by name', async () => {
    const a = new TestClient();
    await a.ready();
    a.send({ t: 'hello', secret: 'old-phone-0123456789' });
    a.send({ t: 'create', settings: { dice: 'random' } });
    await a.until(() => !!a.room);
    const pin = a.room!.pin;
    a.send({ t: 'join', pin, name: 'Айгерим' });
    a.send({ t: 'addBot', level: 'easy' });
    a.send({ t: 'addBot', level: 'easy' });
    await a.until(() => a.room!.lobby.length === 3);
    a.send({ t: 'start' });
    await a.until(() => a.room?.status === 'playing');
    const oldId = a.room!.me;
    a.ws.close();
    await new Promise((r) => setTimeout(r, 200));

    const b = new TestClient();
    await b.ready();
    b.send({ t: 'hello', secret: 'new-phone-0123456789' });
    b.send({ t: 'join', pin, name: 'айгерим' });
    await b.until(() => !!b.room?.private);
    expect(b.room!.seated).toBe(true);
    expect(b.room!.isHost).toBe(true);
    expect(b.room!.public!.order).toContain(b.room!.me);
    expect(b.room!.public!.order).not.toContain(oldId);

    // Чужое имя не подходит
    const c = new TestClient();
    await c.ready();
    c.send({ t: 'hello', secret: 'stranger-0123456789' });
    c.send({ t: 'join', pin, name: 'Незнакомец' });
    await c.until(() => c.msgs.some((m) => m.t === 'error'));
    expect(c.room).toBeUndefined();
    b.ws.close();
    c.ws.close();
  }, 30_000);
});
