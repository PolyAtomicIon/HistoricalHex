/** Название разбойника текущей эпохи (подменяется в applyEra). */
export const ROBBER = { name: 'Разбойник' };

// Все тексты интерфейса на русском.

import type { BotLevel, DevCardType, GameEvent, PlayerColor, PlayerId, PublicState, Resource, ResourceMap, Terrain } from '../engine';
import { RESOURCES } from '../engine';
import { L, pick } from './l';

export const GAME_TITLE = 'Хексленд';

const botLevelText = (l: BotLevel): string =>
  l === 'easy' ? L('лёгкий', 'жеңіл', 'easy') : l === 'medium' ? L('средний', 'орташа', 'medium') : L('сложный', 'қиын', 'hard');

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

/** Названия цветов игроков — геттеры, чтобы читался текущий язык. */
export const COLOR_NAME: Record<PlayerColor, string> = {
  get red() { return L('красный', 'қызыл', 'red'); },
  get blue() { return L('синий', 'көк', 'blue'); },
  get white() { return L('белый', 'ақ', 'white'); },
  get orange() { return L('оранжевый', 'қызғылт сары', 'orange'); },
  get green() { return L('зелёный', 'жасыл', 'green'); },
  get purple() { return L('фиолетовый', 'күлгін', 'purple'); },
};

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const cards = (n: number) =>
  pick(`${n} ${plural(n, 'карта', 'карты', 'карт')}`, `${n} карта`, `${n} ${n === 1 ? 'card' : 'cards'}`);
export const points = (n: number) =>
  pick(`${n} ${plural(n, 'очко', 'очка', 'очков')}`, `${n} ұпай`, `${n} ${n === 1 ? 'point' : 'points'}`);

/** «🧱×2 🌾×1» — для логов и обменов. */
export function resourcesText(m: Partial<ResourceMap> | undefined): string {
  const parts = RESOURCES.filter((r) => (m?.[r] ?? 0) > 0).map((r) => `${RESOURCE_NAME[r]} ×${m![r]}`);
  return parts.length ? parts.join(' ') : '—';
}

type Names = (id: PlayerId | undefined) => string;

export function namesFrom(pub: Pick<PublicState, 'players'> | undefined): Names {
  return (id) => (id && pub?.players?.[id]?.name) || L('кто-то', 'біреу', 'someone');
}

/** Чей ход и что сейчас происходит — для заголовка на экране хоста. */
export function phaseText(pub: PublicState): string {
  const name = namesFrom(pub);
  const current = name(pub.order[pub.current]);
  switch (pub.phase) {
    case 'setup':
      return pub.setup?.step === 'road'
        ? L('{current} ставит дорогу', '{current} жол салады', '{current} places a road', { current })
        : L('{current} ставит поселение', '{current} қоныс салады', '{current} places a settlement', { current });
    case 'roll':
      return L('{current} бросает кубики', '{current} сүйек лақтырады', '{current} rolls the dice', { current });
    case 'discard': {
      const who = Object.keys(pub.pendingDiscards ?? {}).map(name).join(', ');
      return L('Сбрасывают карты: {who}', 'Карта тастайды: {who}', 'Discarding cards: {who}', { who });
    }
    case 'moveRobber':
      return L('{current} выбирает цель: {robber}', '{current} мақсат таңдайды: {robber}', '{current} picks a target: {robber}', { current, robber: ROBBER.name });
    case 'main':
      return L('{current}: торговля и стройка', '{current}: сауда және құрылыс', '{current}: trade and build', { current });
    case 'roadBuilding':
      return L('{current} строит бесплатные дороги', '{current} тегін жол салады', '{current} builds free roads', { current });
    case 'finished':
      return L('Победа: {name}!', 'Жеңіс: {name}!', 'Victory: {name}!', { name: name(pub.winner) });
  }
}

/** Подсказка «что делать» для игрока, чей сейчас ход. */
export function myPhaseText(pub: PublicState): string {
  switch (pub.phase) {
    case 'setup':
      return pub.setup?.step === 'road' ? L('Поставь дорогу', 'Жол сал', 'Place a road') : L('Поставь поселение', 'Қоныс сал', 'Place a settlement');
    case 'roll':
      return L('Брось кубики', 'Сүйек лақтыр', 'Roll the dice');
    case 'discard':
      return L('Ждём сброса карт', 'Карта тастауды күтеміз', 'Waiting for discards');
    case 'moveRobber':
      return L('Выбери цель: {robber}', 'Мақсатты таңда: {robber}', 'Pick a target: {robber}', { robber: ROBBER.name });
    case 'main':
      return L('Торгуй и строй', 'Сауда жаса, құрылыс сал', 'Trade and build');
    case 'roadBuilding':
      return L('Ставь бесплатные дороги', 'Тегін жол сал', 'Place free roads');
    case 'finished':
      return L('Игра окончена', 'Ойын аяқталды', 'Game over');
  }
}

/** Одна строка лога. Поля могут отсутствовать (Firebase выбрасывает пустые), поэтому везде значения по умолчанию. */
export function eventText(e: GameEvent, name: Names): string | null {
  switch (e.type) {
    case 'gameStarted':
      return L('Игра началась! Расстановка змейкой', 'Ойын басталды! Жыланша орналасу', 'The game has started! Snake-order setup');
    case 'built': {
      const free = !!e.free && e.kind === 'road';
      const p = name(e.player);
      if (e.kind === 'road')
        return free
          ? L('{p} строит дорогу (бесплатно)', '{p} жол салады (тегін)', '{p} builds a road (free)', { p })
          : L('{p} строит дорогу', '{p} жол салады', '{p} builds a road', { p });
      if (e.kind === 'settlement') return L('{p} строит поселение', '{p} қоныс салады', '{p} builds a settlement', { p });
      return L('{p} строит город', '{p} қала салады', '{p} builds a city', { p });
    }
    case 'setupResources':
      return L('{p} получает стартовые ресурсы: {r}', '{p} бастапқы ресурстар алады: {r}', '{p} gets starting resources: {r}', { p: name(e.player), r: resourcesText(e.gains) });
    case 'diceRolled':
      return L('{p} выбрасывает {t}', '{p} {t} түсіреді', '{p} rolls {t}', { p: name(e.player), t: e.total });
    case 'produced': {
      const gains = Object.entries(e.gains ?? {});
      const shortages = e.shortages ?? [];
      const parts = gains.map(([pid, g]) => `${name(pid)} ${resourcesText(g)}`);
      let text = parts.length
        ? L('Доход: {x}', 'Табыс: {x}', 'Income: {x}', { x: parts.join(', ') })
        : L('Никто ничего не получил', 'Ешкім ештеңе алмады', 'Nobody got anything');
      if (shortages.length)
        text += ' ' + L('(в банке не хватило: {x})', '(банкте жетпеді: {x})', '(the bank ran short: {x})', { x: shortages.map((r) => RESOURCE_NAME[r]).join(', ') });
      return text;
    }
    case 'mustDiscard':
      return L('Семёрка! У кого больше 7 карт — сбрасывают половину', 'Жеті! 7-ден көп картасы барлар жартысын тастайды', 'A seven! Anyone with more than 7 cards discards half');
    case 'discarded': {
      const p = name(e.player);
      const c = cards(e.count ?? 0);
      return e.forced
        ? L('{p} сбрасывает {c} (за него сбросил хост)', '{p} {c} тастайды (оның орнына жүргізуші тастады)', '{p} discards {c} (the host discarded for them)', { p, c })
        : L('{p} сбрасывает {c}', '{p} {c} тастайды', '{p} discards {c}', { p, c });
    }
    case 'robberMoved':
      return L('{p}: {robber} — новая цель', '{p}: {robber} — жаңа мақсат', '{p}: {robber} — new target', { p: name(e.player), robber: ROBBER.name });
    case 'stole':
      return L('{a} крадёт карту у {b}', '{a} картаны {b} ойыншысынан ұрлайды', '{a} steals a card from {b}', { a: name(e.thief), b: name(e.victim) });
    case 'devCardBought':
      return L('{p} покупает карту развития', '{p} даму картасын сатып алады', '{p} buys a development card', { p: name(e.player) });
    case 'devCardPlayed':
      return L('{p} играет «{c}»', '{p} «{c}» ойнайды', '{p} plays “{c}”', { p: name(e.player), c: DEV_CARD_NAME[e.card] });
    case 'yearOfPlenty':
      return L('{p} берёт из банка: {x}', '{p} банктен алады: {x}', '{p} takes from the bank: {x}', { p: name(e.player), x: (e.resources ?? []).map((r) => RESOURCE_NAME[r]).join(', ') });
    case 'monopoly':
      return L('{p} забирает у всех {r}: {c}', '{p} бәрінен {r} жинайды: {c}', '{p} takes all {r} from everyone: {c}', { p: name(e.player), r: RESOURCE_NAME[e.resource], c: cards(e.total ?? 0) });
    case 'bankTrade':
      return L(
        '{p} меняет с банком: {a} ×{ac} → {b} ×{bc}',
        '{p} банкпен айырбастайды: {a} ×{ac} → {b} ×{bc}',
        '{p} trades with the bank: {a} ×{ac} → {b} ×{bc}',
        { p: name(e.player), a: RESOURCE_NAME[e.give], ac: e.giveCount, b: RESOURCE_NAME[e.receive], bc: e.receiveCount },
      );
    case 'tradeOffered':
      return L('{p} предлагает обмен: {a} → {b}', '{p} айырбас ұсынады: {a} → {b}', '{p} offers a trade: {a} → {b}', { p: name(e.player), a: resourcesText(e.give), b: resourcesText(e.want) });
    case 'tradeResponded':
      return null; // ответы видны в панели обмена
    case 'tradeCompleted':
      return L('{a} и {b} меняются: {x} ⇄ {y}', '{a} мен {b} айырбастайды: {x} ⇄ {y}', '{a} and {b} trade: {x} ⇄ {y}', { a: name(e.from), b: name(e.to), x: resourcesText(e.give), y: resourcesText(e.want) });
    case 'tradeCancelled':
      return L('{p} отменяет обмен', '{p} айырбасты болдырмайды', '{p} cancels the trade', { p: name(e.player) });
    case 'longestRoad':
      return e.player
        ? L('«Самая длинная дорога» у {p} ({n})', '«Ең ұзын жол» {p} ойыншысында ({n})', '“Longest Road” goes to {p} ({n})', { p: name(e.player), n: e.length })
        : L('«Самая длинная дорога» пока ни у кого', '«Ең ұзын жол» әзірге ешкімде жоқ', '“Longest Road” is not held by anyone yet');
    case 'largestArmy': {
      const k = e.knights ?? 0;
      const kn = pick(`${k} ${plural(k, 'рыцарь', 'рыцаря', 'рыцарей')}`, `${k} рыцарь`, `${k} ${k === 1 ? 'knight' : 'knights'}`);
      return L('«Самая большая армия» у {p} ({kn})', '«Ең үлкен әскер» {p} ойыншысында ({kn})', '“Largest Army” goes to {p} ({kn})', { p: name(e.player), kn });
    }
    case 'turnStarted':
      return L('Ход {t}: ходит {p}', '{t}-жүріс: {p} жүреді', 'Turn {t}: {p} moves', { t: e.turn, p: name(e.player) });
    case 'turnSkipped':
      return L('Ход {p} пропущен', '{p} жүрісі өткізілді', "{p}'s turn was skipped", { p: name(e.player) });
    case 'playerLeft': {
      const p = name(e.player);
      const level = botLevelText(e.level);
      return e.auto
        ? L(
            '{p} не вернулся вовремя — вместо игрока теперь бот ({level})',
            '{p} уақытында оралмады — енді ойыншының орнына бот ({level})',
            "{p} didn't return in time — a bot ({level}) plays instead",
            { p, level },
          )
        : L(
            '{p} выходит из игры — вместо игрока теперь бот ({level})',
            '{p} ойыннан шығады — енді ойыншының орнына бот ({level})',
            '{p} leaves the game — a bot ({level}) plays instead',
            { p, level },
          );
    }
    case 'playerKicked':
      return L(
        '{p} выгнан — вместо игрока теперь бот ({level})',
        '{p} шығарылды — енді ойыншының орнына бот ({level})',
        '{p} was removed — a bot ({level}) plays instead',
        { p: name(e.player), level: botLevelText(e.level) },
      );
    case 'playerReturned':
      return L('{p} возвращается в игру', '{p} ойынға оралады', '{p} returns to the game', { p: name(e.player) });
    case 'gameWon':
      return L('{p} побеждает с {pts}!', '{p} {pts} жинап жеңеді!', '{p} wins with {pts}!', { p: name(e.player), pts: points(e.points ?? 0) });
    default:
      return null;
  }
}

/** Режим кубиков в лобби: «кубики …». */
export const DICE_MODE_TEXT: Record<'randomOrg' | 'balanced' | 'random', string> = {
  get randomOrg() { return L('с random.org', 'random.org арқылы', 'via random.org'); },
  get balanced() { return L('сбалансированные', 'теңгерімді', 'balanced'); },
  get random() { return L('от генератора системы', 'жүйе генераторынан', 'from the system generator'); },
};
