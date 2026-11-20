// Консольный игрок HistoricalHex — для end-to-end тестов (в том числе агентами).
//
//   node dist-server/cli.mjs --as Аскар join 123456
//   node dist-server/cli.mjs --as Аскар state
//   node dist-server/cli.mjs --as Аскар act '{"type":"rollDice"}'
//   node dist-server/cli.mjs --as Аскар act '{"type":"rollDice"}' --dice 3,4
//   node dist-server/cli.mjs --as Аскар react 🔥
//   node dist-server/cli.mjs --as Хост create [--lore ww2] [--dice physical]
//   node dist-server/cli.mjs --as Хост bots 2 ; start
// Адрес: --url (по умолчанию wss://bekzaty.abmco.kz/catan/ws) или HH_URL.

import WebSocket from 'ws';
import type { Action } from '../src/engine';
import {
  COSTS,
  RESOURCES,
  hasResources,
  legalCityVertices,
  legalRoadEdges,
  legalSettlementVertices,
  playersAtHex,
} from '../src/engine';
import type { ClientMsg, RoomView, ServerMsg } from '../src/proto';
import { getLorePack, narrate } from '../src/lore';

const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const url = opt('url') ?? process.env.HH_URL ?? 'wss://bekzaty.abmco.kz/catan/ws';
const as = opt('as') ?? 'cli';
const pinOpt = opt('pin');
const diceOpt = opt('dice');
const loreOpt = opt('lore');
const diceMode = opt('dicemode');
const [cmd, ...rest] = argv;
const secret = `cli-${Buffer.from(as).toString('hex')}-0123456789abcdef`.slice(0, 120);

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const memDir = join(homedir(), '.historicalhex-cli');
const memFile = join(memDir, `${Buffer.from(as).toString('hex')}.json`);
const mem = (() => {
  try {
    return JSON.parse(readFileSync(memFile, 'utf8')) as { pin?: string };
  } catch {
    return {};
  }
})();
const remember = (pin: string) => {
  mkdirSync(memDir, { recursive: true });
  writeFileSync(memFile, JSON.stringify({ pin }));
};

const ws = new WebSocket(url);
const send = (m: ClientMsg) => ws.send(JSON.stringify(m));
let room: RoomView | undefined;
const errors: string[] = [];
const events: string[] = [];
let done = false;

function finish(out: unknown, code = 0): void {
  if (done) return;
  done = true;
  console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
  ws.close();
  setTimeout(() => process.exit(code), 50);
}

function summary(r: RoomView) {
  const pack = getLorePack(r.settings.lore);
  const base = { pin: r.pin, status: r.status, era: pack.title, you: r.me };
  if (r.status === 'lobby') {
    return { ...base, lobby: r.lobby.map((s) => `${s.name}${s.bot ? ' (bot)' : ''} ${s.color ?? '-'}`), isHost: r.isHost };
  }
  const pub = r.public!;
  const priv = r.private;
  const me = r.me;
  const current = pub.order[pub.current];
  const myTurn = current === me && pub.phase !== 'finished';
  const legal: Record<string, unknown> = {};
  if (myTurn && priv) {
    if (pub.phase === 'setup') {
      if (pub.setup?.step === 'road') legal.roads = legalRoadEdges(pub, me, pub.setup.lastVertex).slice(0, 12);
      else legal.settlements = legalSettlementVertices(pub, me, true).slice(0, 12);
    }
    if (pub.phase === 'roadBuilding') legal.roads = legalRoadEdges(pub, me).slice(0, 12);
    if (pub.phase === 'moveRobber') {
      legal.robberHexes = pub.board.hexes
        .filter((h) => h.id !== pub.robberHex)
        .map((h) => ({ hex: h.id, number: h.number, victims: playersAtHex(pub, h.id, me).map((p) => pub.players[p].name) }))
        .filter((h) => h.victims.length)
        .slice(0, 8);
    }
    if (pub.phase === 'main') {
      if (hasResources(priv.resources, COSTS.road)) legal.roads = legalRoadEdges(pub, me).slice(0, 8);
      if (hasResources(priv.resources, COSTS.settlement)) legal.settlements = legalSettlementVertices(pub, me).slice(0, 8);
      if (hasResources(priv.resources, COSTS.city)) legal.cities = legalCityVertices(pub, me);
      legal.canBuyDevCard = hasResources(priv.resources, COSTS.devCard) && pub.devDeckCount > 0;
      legal.bankRatios = priv.tradeRatios;
    }
  }
  return {
    ...base,
    phase: pub.phase,
    turn: pub.turn,
    current: pub.players[current]?.name,
    myTurn,
    dice: pub.dice,
    winner: pub.winner ? pub.players[pub.winner].name : undefined,
    me: priv
      ? {
          name: pub.players[me].name,
          away: pub.players[me].away,
          hand: priv.resources,
          names: Object.fromEntries(RESOURCES.map((x) => [x, pack.resources[x].name])),
          devCards: priv.devCards.map((c) => `${c.type}${c.playable ? '' : ' (next turn)'}`),
          points: priv.points,
          mustDiscard: priv.mustDiscard || undefined,
        }
      : undefined,
    players: pub.order.map((id) => {
      const p = pub.players[id];
      return `${p.name}: ${p.points}VP, ${p.resourceCount} cards${p.bot ? ', bot' : ''}${r.online[id] ? '' : ', offline'}`;
    }),
    trade: pub.trade
      ? { id: pub.trade.id, from: pub.players[current].name, give: pub.trade.give, want: pub.trade.want, responses: pub.trade.responses }
      : undefined,
    legal,
    recentEvents: events.slice(-8),
    hint: myTurn ? `Your turn: ${pub.phase}` : `Waiting for ${pub.players[current]?.name}`,
    lorePreview: narrate(pack, 'gameStarted', {}),
  };
}

ws.on('open', () => {
  send({ t: 'hello', secret });
  const pin = pinOpt ?? (cmd === 'join' ? rest[0] : mem.pin);
  switch (cmd) {
    case 'create':
      send({ t: 'create', settings: { ...(loreOpt ? { lore: loreOpt } : {}), ...(diceMode ? { dice: diceMode as never } : {}) } });
      break;
    case 'join':
      if (!pin) return finish('usage: join PIN', 2);
      send({ t: 'join', pin, name: rest[1] ?? as });
      remember(pin);
      break;
    default:
      if (!pin) return finish('no room: run join PIN first', 2);
      send({ t: 'open', pin });
  }
});

let acted = false;
ws.on('message', (d) => {
  const m = JSON.parse(String(d)) as ServerMsg;
  if (m.t === 'error') {
    errors.push(m.message);
    if (m.fatal) return finish({ error: m.message }, 1);
  }
  if (m.t === 'created') remember(m.pin);
  if (m.t === 'events') for (const e of m.events) events.push(JSON.stringify(e));
  if (m.t === 'result') return finish({ ok: m.ok, error: m.error, state: room ? summary(room) : undefined }, m.ok ? 0 : 1);
  if (m.t !== 'room') return;
  const first = !room;
  room = m.room;
  if (!first || acted) {
    if (cmd === 'wait' && room.public && room.public.order[room.public.current] === room.me) finish(summary(room));
    return;
  }
  acted = true;
  switch (cmd) {
    case 'create':
      if (room.lobby.every((s) => s.id !== room!.me)) send({ t: 'join', pin: room.pin, name: as });
      return void setTimeout(() => finish(summary(room!)), 300);
    case 'join':
    case 'state':
      return void setTimeout(() => finish(summary(room!)), 200);
    case 'bots':
      for (let i = 0; i < Number(rest[0] ?? 1); i++) send({ t: 'addBot', level: (rest[1] as never) ?? 'medium' });
      return void setTimeout(() => finish(summary(room!)), 500);
    case 'color':
      send({ t: 'color', color: rest[0] as never });
      return void setTimeout(() => finish(summary(room!)), 300);
    case 'settings':
      send({ t: 'settings', settings: JSON.parse(rest[0]) });
      return void setTimeout(() => finish(summary(room!)), 300);
    case 'start':
      send({ t: 'start' });
      return void setTimeout(() => finish(errors.length ? { errors } : summary(room!)), 600);
    case 'act': {
      let action: Action;
      try {
        action = JSON.parse(rest[0]);
      } catch {
        return finish('act needs JSON, e.g. {"type":"rollDice"}', 2);
      }
      const dice = diceOpt ? (diceOpt.split(',').map(Number) as [number, number]) : undefined;
      send({ t: 'act', id: 'cli', action, ...(dice ? { dice } : {}) });
      return;
    }
    case 'react':
      send({ t: 'react', emoji: rest[0] ?? '👍' });
      return void setTimeout(() => finish({ ok: true }), 200);
    case 'kick':
      send({ t: 'kick', player: rest[0], level: 'medium' });
      return void setTimeout(() => finish(errors.length ? { errors } : summary(room!)), 400);
    case 'wait':
      // Ждём своего хода (до 90 с)
      if (room.public && room.public.order[room.public.current] === room.me) return finish(summary(room));
      setTimeout(() => finish(summary(room!)), 90_000);
      return;
    default:
      return finish(`unknown command ${cmd}. Commands: create, join PIN NAME, state, wait, bots N LEVEL, color C, settings JSON, start, act JSON [--dice a,b], react EMOJI, kick ID`, 2);
  }
});

ws.on('error', (e) => finish({ error: String(e) }, 1));
setTimeout(() => finish({ error: 'timeout', errors }, 1), 100_000);
