// Журнал партии: каждое событие — короткая понятная строка («кто что сделал»), и важные события —
// закреплённое уведомление с объяснением (награды, монополия), которое висит, пока его не прочитали.

import type { GameEvent, PlayerId, Resource } from '../engine';
import { TERRAIN_RESOURCE } from '../engine';
import type { LorePack } from '../lore';
import { RESOURCE_NAME } from '../i18n/ru';

export interface LogEntry {
  key: number;
  text: string;
  who?: PlayerId;
  /** Начало хода — разделитель в журнале. */
  turn?: boolean;
}

export interface Notice {
  key: number;
  title: string;
  text: string;
  who?: PlayerId;
  img?: string;
}

export interface LogCtx {
  pack: LorePack;
  name: (id?: PlayerId) => string;
  me?: PlayerId;
  /** Ресурс и число гекса — для «налёт на руду 9». */
  hexInfo?: (hex: string) => { res?: Resource; number?: number } | undefined;
}

const res = (r?: Resource) => (r ? RESOURCE_NAME[r] : '');
const PIECE: Record<'road' | 'settlement' | 'city', string> = { road: 'дорогу', settlement: 'поселение', city: 'город' };

/** Строка журнала для события; null — событие в журнал не идёт (служебное). */
export function logText(e: GameEvent, c: LogCtx): Omit<LogEntry, 'key'> | null {
  const n = c.name;
  switch (e.type) {
    case 'gameStarted':
      return { text: 'Партия началась' };
    case 'turnStarted':
      return { text: `Ход ${e.turn}: ${n(e.player)}`, who: e.player, turn: true };
    case 'diceRolled':
      return { text: `${n(e.player)} бросает: ${e.dice[0]} + ${e.dice[1]} = ${e.total}${e.total === 7 ? ' — семь!' : ''}`, who: e.player };
    case 'built':
      return { text: `${n(e.player)} строит ${PIECE[e.kind]}${e.free ? ' (бесплатно)' : ''}`, who: e.player };
    case 'discarded':
      return { text: `${n(e.player)} сбрасывает ${e.count} карт${e.forced ? ' (время вышло)' : ''}`, who: e.player };
    case 'robberMoved': {
      const h = c.hexInfo?.(e.hex);
      const where = h?.res ? ` на ${res(h.res)}${h.number ? ` ${h.number}` : ''}` : '';
      return { text: `${n(e.player)}: ${c.pack.robber.name}${where} — гекс без дохода`, who: e.player };
    }
    case 'stole': {
      const mine = c.me && (c.me === e.thief || c.me === e.victim);
      return { text: `${n(e.thief)} отнимает карту у ${n(e.victim)}${mine && e.resource ? ` (${res(e.resource)})` : ''}`, who: e.thief };
    }
    case 'devCardBought':
      return { text: `${n(e.player)} покупает карту развития`, who: e.player };
    case 'devCardPlayed':
      return { text: `${n(e.player)} играет «${c.pack.devCards[e.card].name}»`, who: e.player };
    case 'yearOfPlenty':
      return { text: `${n(e.player)} берёт из банка: ${e.resources.map(res).join(', ')}`, who: e.player };
    case 'monopoly':
      return { text: `${n(e.player)} забирает весь ${res(e.resource)} у всех (${e.total})`, who: e.player };
    case 'bankTrade':
      return { text: `${n(e.player)} меняет с банком ${e.giveCount} ${res(e.give)} → ${e.receiveCount} ${res(e.receive)}`, who: e.player };
    case 'tradeCompleted':
      return { text: `${n(e.from)} и ${n(e.to)} меняются картами`, who: e.from };
    case 'longestRoad':
      return e.player
        ? { text: `${c.pack.bonuses.longestRoad} (дорога ${e.length}) — у ${n(e.player)}, +2 очка`, who: e.player }
        : { text: `${c.pack.bonuses.longestRoad}: дорогу разорвали — карта пока ничья` };
    case 'largestArmy':
      return { text: `${c.pack.bonuses.largestArmy} (${e.knights} воинов) — у ${n(e.player)}, +2 очка`, who: e.player };
    case 'turnSkipped':
      return { text: `${n(e.player)} пропускает ход`, who: e.player };
    case 'playerLeft':
      return { text: `${n(e.player)} вышел — играет бот`, who: e.player };
    case 'playerReturned':
      return { text: `${n(e.player)} вернулся`, who: e.player };
    case 'gameWon':
      return { text: `${n(e.player)} побеждает: ${e.points} очков`, who: e.player };
    default:
      return null;
  }
}

/** Важное — закрепить карточкой с объяснением, пока игрок не нажмёт «Понятно». */
export function noticeFor(e: GameEvent, c: LogCtx): Omit<Notice, 'key'> | null {
  const n = c.name;
  switch (e.type) {
    case 'longestRoad':
      if (!e.player) return { title: c.pack.bonuses.longestRoad, text: 'Самую длинную дорогу разорвали — бонус +2 очка пока ни у кого.' };
      return {
        title: c.pack.bonuses.longestRoad,
        text: `Самая длинная непрерывная дорога (${e.length}) — у ${e.player === c.me ? 'тебя' : n(e.player)}. Это +2 очка, пока кто-то не построит длиннее.`,
        who: e.player,
      };
    case 'largestArmy':
      return {
        title: c.pack.bonuses.largestArmy,
        text: `Больше всех сыгранных воинов (${e.knights}) — у ${e.player === c.me ? 'тебя' : n(e.player)}. Это +2 очка, пока кто-то не сыграет больше.`,
        who: e.player,
      };
    case 'monopoly':
      if (e.player === c.me) return null;
      return { title: c.pack.devCards.monopoly.name, text: `${n(e.player)} забрал у всех весь ${res(e.resource)} — ${e.total} шт.`, who: e.player };
    default:
      return null;
  }
}

/** Ресурс гекса по местности. */
export function hexResource(terrain: string): Resource | undefined {
  return (TERRAIN_RESOURCE as Record<string, Resource | undefined>)[terrain];
}
