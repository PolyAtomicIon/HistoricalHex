/** Название разбойника текущей эпохи (подменяется в applyEra). */
export const ROBBER = { name: 'Разбойник' };

// Все тексты интерфейса на русском.

import type { BotLevel, DevCardType, GameEvent, PlayerColor, PlayerId, PublicState, Resource, ResourceMap, Terrain } from '../engine';
import { RESOURCES } from '../engine';

export const GAME_TITLE = 'Хексленд';

const BOT_LEVEL_TEXT: Record<BotLevel, string> = { easy: 'лёгкий', medium: 'средний', hard: 'сложный' };

export const RESOURCE_NAME: Record<Resource, string> = {
  brick: 'кирпич',
  wood: 'дерево',
  sheep: 'овцы',
  wheat: 'пшеница',
  ore: 'руда',
};

export const TERRAIN_NAME: Record<Terrain, string> = {
  forest: 'лес',
  hills: 'холмы',
  pasture: 'пастбище',
  fields: 'поле',
  mountains: 'горы',
  desert: 'пустыня',
};

export const DEV_CARD_NAME: Record<DevCardType, string> = {
  knight: 'Рыцарь',
  victoryPoint: 'Победное очко',
  roadBuilding: 'Строительство дорог',
  yearOfPlenty: 'Изобилие',
  monopoly: 'Монополия',
};

export const COLOR_NAME: Record<PlayerColor, string> = {
  red: 'красный',
  blue: 'синий',
  white: 'белый',
  orange: 'оранжевый',
  green: 'зелёный',
  purple: 'фиолетовый',
};

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const cards = (n: number) => `${n} ${plural(n, 'карта', 'карты', 'карт')}`;
export const points = (n: number) => `${n} ${plural(n, 'очко', 'очка', 'очков')}`;

/** «🧱×2 🌾×1» — для логов и обменов. */
export function resourcesText(m: Partial<ResourceMap> | undefined): string {
  const parts = RESOURCES.filter((r) => (m?.[r] ?? 0) > 0).map((r) => `${RESOURCE_NAME[r]} ×${m![r]}`);
  return parts.length ? parts.join(' ') : '—';
}

type Names = (id: PlayerId | undefined) => string;

export function namesFrom(pub: Pick<PublicState, 'players'> | undefined): Names {
  return (id) => (id && pub?.players?.[id]?.name) || 'кто-то';
}

/** Чей ход и что сейчас происходит — для заголовка на экране хоста. */
export function phaseText(pub: PublicState): string {
  const name = namesFrom(pub);
  const current = name(pub.order[pub.current]);
  switch (pub.phase) {
    case 'setup':
      return pub.setup?.step === 'road' ? `${current} ставит дорогу` : `${current} ставит поселение`;
    case 'roll':
      return `${current} бросает кубики`;
    case 'discard': {
      const who = Object.keys(pub.pendingDiscards ?? {}).map(name);
      return `Сбрасывают карты: ${who.join(', ')}`;
    }
    case 'moveRobber':
      return `${current} выбирает цель: ${ROBBER.name}`;
    case 'main':
      return `${current}: торговля и стройка`;
    case 'roadBuilding':
      return `${current} строит бесплатные дороги`;
    case 'finished':
      return `Победа: ${name(pub.winner)}!`;
  }
}

/** Подсказка «что делать» для игрока, чей сейчас ход. */
export function myPhaseText(pub: PublicState): string {
  switch (pub.phase) {
    case 'setup':
      return pub.setup?.step === 'road' ? 'Поставь дорогу' : 'Поставь поселение';
    case 'roll':
      return 'Брось кубики';
    case 'discard':
      return 'Ждём сброса карт';
    case 'moveRobber':
      return `Выбери цель: ${ROBBER.name}`;
    case 'main':
      return 'Торгуй и строй';
    case 'roadBuilding':
      return 'Ставь бесплатные дороги';
    case 'finished':
      return 'Игра окончена';
  }
}

/** Одна строка лога. Поля могут отсутствовать (Firebase выбрасывает пустые), поэтому везде значения по умолчанию. */
export function eventText(e: GameEvent, name: Names): string | null {
  switch (e.type) {
    case 'gameStarted':
      return 'Игра началась! Расстановка змейкой';
    case 'built': {
      const what = e.kind === 'road' ? 'дорогу' : e.kind === 'settlement' ? 'поселение' : 'город';
      return `${name(e.player)} строит ${what}${e.free && e.kind === 'road' ? ' (бесплатно)' : ''}`;
    }
    case 'setupResources':
      return `${name(e.player)} получает стартовые ресурсы: ${resourcesText(e.gains)}`;
    case 'diceRolled':
      return `${name(e.player)} выбрасывает ${e.total}`;
    case 'produced': {
      const gains = Object.entries(e.gains ?? {});
      const shortages = e.shortages ?? [];
      const parts = gains.map(([pid, g]) => `${name(pid)} ${resourcesText(g)}`);
      let text = parts.length ? `Доход: ${parts.join(', ')}` : 'Никто ничего не получил';
      if (shortages.length) text += ` (в банке не хватило: ${shortages.map((r) => RESOURCE_NAME[r]).join(', ')})`;
      return text;
    }
    case 'mustDiscard':
      return 'Семёрка! У кого больше 7 карт — сбрасывают половину';
    case 'discarded':
      return `${name(e.player)} сбрасывает ${cards(e.count ?? 0)}${e.forced ? ' (за него сбросил хост)' : ''}`;
    case 'robberMoved':
      return `${name(e.player)}: ${ROBBER.name} — новая цель`;
    case 'stole':
      return `${name(e.thief)} крадёт карту у ${name(e.victim)}`;
    case 'devCardBought':
      return `${name(e.player)} покупает карту развития`;
    case 'devCardPlayed':
      return `${name(e.player)} играет «${DEV_CARD_NAME[e.card]}»`;
    case 'yearOfPlenty':
      return `${name(e.player)} берёт из банка: ${(e.resources ?? []).map((r) => RESOURCE_NAME[r]).join(', ')}`;
    case 'monopoly':
      return `${name(e.player)} забирает у всех ${RESOURCE_NAME[e.resource]}: ${cards(e.total ?? 0)}`;
    case 'bankTrade':
      return `${name(e.player)} меняет с банком: ${RESOURCE_NAME[e.give]} ×${e.giveCount} → ${RESOURCE_NAME[e.receive]} ×${e.receiveCount}`;
    case 'tradeOffered':
      return `${name(e.player)} предлагает обмен: ${resourcesText(e.give)} → ${resourcesText(e.want)}`;
    case 'tradeResponded':
      return null; // ответы видны в панели обмена
    case 'tradeCompleted':
      return `${name(e.from)} и ${name(e.to)} меняются: ${resourcesText(e.give)} ⇄ ${resourcesText(e.want)}`;
    case 'tradeCancelled':
      return `${name(e.player)} отменяет обмен`;
    case 'longestRoad':
      return e.player
        ? `«Самая длинная дорога» у ${name(e.player)} (${e.length})`
        : '«Самая длинная дорога» пока ни у кого';
    case 'largestArmy':
      return `«Самая большая армия» у ${name(e.player)} (${e.knights} ${plural(e.knights ?? 0, 'рыцарь', 'рыцаря', 'рыцарей')})`;
    case 'turnStarted':
      return `Ход ${e.turn}: ходит ${name(e.player)}`;
    case 'turnSkipped':
      return `Ход ${name(e.player)} пропущен`;
    case 'playerLeft':
      return e.auto
        ? `${name(e.player)} не вернулся вовремя — вместо игрока теперь бот (${BOT_LEVEL_TEXT[e.level]})`
        : `${name(e.player)} выходит из игры — вместо игрока теперь бот (${BOT_LEVEL_TEXT[e.level]})`;
    case 'playerKicked':
      return `${name(e.player)} выгнан — вместо игрока теперь бот (${BOT_LEVEL_TEXT[e.level]})`;
    case 'playerReturned':
      return `${name(e.player)} возвращается в игру`;
    case 'gameWon':
      return `${name(e.player)} побеждает с ${points(e.points ?? 0)}!`;
    default:
      return null;
  }
}

/** Режим кубиков в лобби: «кубики …». */
export const DICE_MODE_TEXT: Record<'randomOrg' | 'balanced' | 'random', string> = {
  randomOrg: 'с random.org',
  balanced: 'сбалансированные',
  random: 'от генератора системы',
};
