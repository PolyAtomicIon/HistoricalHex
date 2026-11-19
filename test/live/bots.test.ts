// Боты для проверки экрана хоста: заходят в комнату по PIN и играют по сети как настоящие игроки.
//
// Запуск (Git Bash):
//   BOTS_PIN=123456 BOTS=3 BOTS_DELAY=700 npx vitest run --config vitest.live.config.ts test/live/bots
// BOTS — сколько ботов (по умолчанию 3), BOTS_DELAY — пауза перед каждым действием, мс.
// Без BOTS_PIN тест пропускается.

import { describe, it } from 'vitest';
import type { Action, PlayerColor, PrivateView, PublicState, Resource } from '../../src/engine';
import {
  COSTS,
  PLAYER_COLORS,
  RESOURCES,
  hasResources,
  legalCityVertices,
  legalRoadEdges,
  legalSettlementVertices,
  pick,
  playersAtHex,
  resourceMap,
  shuffle,
} from '../../src/engine';
import type { PlayerSnapshot } from '../../src/net';
import { PlayerRoom, connect } from '../../src/net';

const PIN = process.env.BOTS_PIN;
const COUNT = Number(process.env.BOTS ?? 3);
const DELAY = Number(process.env.BOTS_DELAY ?? 700);
const NAMES = ['Бот Арман', 'Бот Алия', 'Бот Тимур', 'Бот Дана', 'Бот Ерлан', 'Бот Сауле'];

const rng = Math.random;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function decide(uid: string, pub: PublicState, priv: PrivateView): Action | null {
  const me = pub.players[uid];
  const current = pub.order[pub.current] === uid;

  if (pub.phase === 'discard') {
    const n = priv.mustDiscard;
    if (!n) return null;
    const cards: Resource[] = [];
    for (const r of RESOURCES) for (let i = 0; i < priv.resources[r]; i++) cards.push(r);
    const out = resourceMap();
    for (const r of shuffle(rng, cards).slice(0, n)) out[r] += 1;
    return { type: 'discard', resources: out };
  }

  // Ответ на чужое предложение обмена
  if (!current && pub.phase === 'main' && pub.trade && !pub.trade.responses?.[uid]) {
    const can = hasResources(priv.resources, pub.trade.want);
    return { type: 'respondTrade', tradeId: pub.trade.id, kind: can && rng() < 0.5 ? 'accept' : 'decline' };
  }
  if (!current) return null;

  switch (pub.phase) {
    case 'setup':
      return pub.setup?.step === 'road'
        ? { type: 'buildRoad', edge: pick(rng, legalRoadEdges(pub, uid, pub.setup.lastVertex)) }
        : { type: 'buildSettlement', vertex: pick(rng, legalSettlementVertices(pub, uid, true)) };
    case 'roll': {
      const knight = priv.devCards.find((c) => c.type === 'knight' && c.playable);
      return knight && rng() < 0.3 ? { type: 'playKnight' } : { type: 'rollDice' };
    }
    case 'moveRobber': {
      const hex = pick(rng, pub.board.hexes.filter((h) => h.id !== pub.robberHex)).id;
      const victims = playersAtHex(pub, hex, uid).filter((p) => pub.players[p].resourceCount > 0);
      return { type: 'moveRobber', hex, victim: victims.length ? pick(rng, victims) : undefined };
    }
    case 'roadBuilding':
      return { type: 'buildRoad', edge: pick(rng, legalRoadEdges(pub, uid)) };
    case 'main': {
      const res = priv.resources;
      if (pub.trade) {
        const yes = Object.entries(pub.trade.responses ?? {}).find(([, r]) => r.kind === 'accept');
        if (yes && hasResources(res, pub.trade.give)) return { type: 'confirmTrade', tradeId: pub.trade.id, with: yes[0] };
        const answered = Object.keys(pub.trade.responses ?? {}).length >= pub.order.length - 1;
        return answered ? { type: 'cancelTrade' } : null; // ждём ответов
      }
      const cities = legalCityVertices(pub, uid);
      if (me.pieces.cities > 0 && cities.length && hasResources(res, COSTS.city)) return { type: 'buildCity', vertex: pick(rng, cities) };
      const spots = legalSettlementVertices(pub, uid);
      if (me.pieces.settlements > 0 && spots.length && hasResources(res, COSTS.settlement)) {
        return { type: 'buildSettlement', vertex: pick(rng, spots) };
      }
      const roads = legalRoadEdges(pub, uid);
      if (me.pieces.roads > 0 && roads.length && hasResources(res, COSTS.road) && rng() < 0.7) {
        return { type: 'buildRoad', edge: pick(rng, roads) };
      }
      if (pub.devDeckCount > 0 && hasResources(res, COSTS.devCard) && rng() < 0.6) return { type: 'buyDevCard' };
      const playable = priv.devCards.find((c) => c.playable && c.type !== 'knight');
      if (playable && rng() < 0.5) {
        if (playable.type === 'monopoly') return { type: 'playMonopoly', resource: pick(rng, RESOURCES) };
        if (playable.type === 'yearOfPlenty') {
          const r = pick(rng, RESOURCES.filter((x) => pub.bank[x] >= 2));
          if (r) return { type: 'playYearOfPlenty', resources: [r, r] };
        }
        if (playable.type === 'roadBuilding' && roads.length && me.pieces.roads > 0) return { type: 'playRoadBuilding' };
      }
      for (const give of RESOURCES) {
        if (res[give] >= priv.tradeRatios[give] + 1) {
          const receive = RESOURCES.filter((r) => r !== give && pub.bank[r] > 0 && res[r] === 0);
          if (receive.length) return { type: 'bankTrade', give, receive: pick(rng, receive) };
        }
      }
      const mine = RESOURCES.filter((r) => res[r] > 1);
      if (mine.length && rng() < 0.15) {
        const give = pick(rng, mine);
        const want = pick(rng, RESOURCES.filter((r) => r !== give));
        return { type: 'offerTrade', give: resourceMap({ [give]: 1 }), want: resourceMap({ [want]: 1 }) };
      }
      return { type: 'endTurn' };
    }
    default:
      return null;
  }
}

async function runBot(index: number): Promise<void> {
  const conn = await connect({ name: `bot-${index}-${Date.now()}`, persistence: 'memory' });
  const room = await PlayerRoom.join(conn, PIN!, NAMES[index % NAMES.length]);
  let busy = false;
  let lastKey = '';

  const tick = async (s: PlayerSnapshot) => {
    if (busy || s.closed || s.kicked) return;
    // Лобби: выбрать свободный цвет
    if (s.meta?.status === 'lobby') {
      const mine = Object.entries(s.colors).find(([, owner]) => owner === conn.uid);
      if (!mine) {
        const free = PLAYER_COLORS.filter((c) => !s.colors[c as PlayerColor]);
        if (!free.length) return;
        busy = true;
        await sleep(300 + index * 400);
        await room.chooseColor(pick(rng, free)).catch(() => undefined);
        busy = false;
      }
      return;
    }
    if (!s.public || !s.private || s.public.phase === 'finished') return;
    // Не дублируем действие, пока не пришло новое состояние
    const key = `${s.public.log.at(-1)?.seq}:${s.public.phase}:${s.private.mustDiscard}:${JSON.stringify(s.public.trade?.responses ?? {})}`;
    if (key === lastKey) return;
    const action = decide(conn.uid, s.public, s.private);
    if (!action) return;
    busy = true;
    lastKey = key;
    await sleep(DELAY);
    try {
      await room.send(action);
    } finally {
      busy = false;
    }
  };

  await new Promise<void>((resolve) => {
    room.subscribe((s) => {
      if (s.closed || s.kicked || s.public?.phase === 'finished') resolve();
      void tick(s);
    });
    // Пинаем бота раз в 2 секунды на случай, если ответ на ошибку не изменил состояние
    const id = setInterval(() => {
      lastKey = '';
      void tick(room.snapshot);
    }, 2000);
    room.subscribe((s) => {
      if (s.closed || s.kicked || s.public?.phase === 'finished') clearInterval(id);
    });
  });
  room.dispose();
  await conn.close();
}

describe.skipIf(!PIN)('боты', () => {
  it(`${COUNT} бота играют в комнате ${PIN}`, async () => {
    await Promise.all(Array.from({ length: COUNT }, (_, i) => runBot(i)));
  }, 3 * 60 * 60 * 1000);
});
