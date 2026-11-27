// Журнал партии: каждое событие — короткая понятная строка («кто что сделал»), и важные события —
// закреплённое уведомление с объяснением (награды, монополия), которое висит, пока его не прочитали.

import type { GameEvent, PlayerId, Resource } from '../engine';
import { TERRAIN_RESOURCE } from '../engine';
import type { LorePack } from '../lore';
import { RESOURCE_NAME } from '../i18n/ru';
import { L } from '../i18n/l';

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
  /** Иконка карточки (по умолчанию корона — для наград). */
  icon?: 'crown' | 'road';
}

export interface LogCtx {
  pack: LorePack;
  name: (id?: PlayerId) => string;
  me?: PlayerId;
  /** Ресурс и число гекса — для «налёт на руду 9». */
  hexInfo?: (hex: string) => { res?: Resource; number?: number } | undefined;
  /** Сколько дорог каждого игрока сходится в перекрёстке — чтобы заметить разрезанную дорогу. */
  roadsAt?: (vertex: string) => Partial<Record<PlayerId, number>>;
}

const res = (r?: Resource) => (r ? RESOURCE_NAME[r] : '');
const piece = (k: 'road' | 'settlement' | 'city'): string =>
  k === 'road' ? L('дорогу', 'жол', 'a road') : k === 'settlement' ? L('поселение', 'қоныс', 'a settlement') : L('город', 'қала', 'a city');
/** «Сколько карт» для английского: 1 card / 3 cards. */
const enCards = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`;

/** Строка журнала для события; null — событие в журнал не идёт (служебное). */
export function logText(e: GameEvent, c: LogCtx): Omit<LogEntry, 'key'> | null {
  const n = c.name;
  switch (e.type) {
    case 'gameStarted':
      return { text: L('Партия началась', 'Партия басталды', 'The game has started') };
    case 'turnStarted':
      return { text: L('Ход {t}: {p}', '{t}-жүріс: {p}', 'Turn {t}: {p}', { t: e.turn, p: n(e.player) }), who: e.player, turn: true };
    case 'diceRolled': {
      const sum = `${e.dice[0]} + ${e.dice[1]} = ${e.total}`;
      const seven = e.total === 7 ? L(' — семь!', ' — жеті!', ' — seven!') : '';
      return { text: L('{p} бросает: {sum}', '{p} лақтырады: {sum}', '{p} rolls: {sum}', { p: n(e.player), sum }) + seven, who: e.player };
    }
    case 'built': {
      const p = n(e.player);
      const k = piece(e.kind);
      return {
        text: e.free
          ? L('{p} строит {k} (бесплатно)', '{p} {k} салады (тегін)', '{p} builds {k} (free)', { p, k })
          : L('{p} строит {k}', '{p} {k} салады', '{p} builds {k}', { p, k }),
        who: e.player,
      };
    }
    case 'discarded': {
      const p = n(e.player);
      const cnt = e.count ?? 0;
      const en = enCards(cnt);
      return {
        text: e.forced
          ? L('{p} сбрасывает {n} карт (время вышло)', '{p} {n} карта тастайды (уақыт бітті)', '{p} discards {en} (time ran out)', { p, n: cnt, en })
          : L('{p} сбрасывает {n} карт', '{p} {n} карта тастайды', '{p} discards {en}', { p, n: cnt, en }),
        who: e.player,
      };
    }
    case 'robberMoved': {
      const h = c.hexInfo?.(e.hex);
      const rn = h?.res ? res(h.res) : '';
      const num = h?.number ? ` ${h.number}` : '';
      const where = h?.res ? L(` на ${rn}${num}`, ` ${rn}${num} гексіне`, ` on ${rn}${num}`) : '';
      return { text: L('{p}: {robber}{where} — гекс без дохода', '{p}: {robber}{where} — табыссыз гекс', '{p}: {robber}{where} — hex produces nothing', { p: n(e.player), robber: c.pack.robber.name, where }), who: e.player };
    }
    case 'stole': {
      const mine = c.me && (c.me === e.thief || c.me === e.victim);
      const r = mine && e.resource ? ` (${res(e.resource)})` : '';
      return { text: L('{a} отнимает карту у {b}', '{a} картаны {b} ойыншысынан тартып алады', '{a} takes a card from {b}', { a: n(e.thief), b: n(e.victim) }) + r, who: e.thief };
    }
    case 'devCardBought':
      return { text: L('{p} покупает карту развития', '{p} даму картасын сатып алады', '{p} buys a development card', { p: n(e.player) }), who: e.player };
    case 'devCardPlayed':
      return { text: L('{p} играет «{c}»', '{p} «{c}» ойнайды', '{p} plays “{c}”', { p: n(e.player), c: c.pack.devCards[e.card].name }), who: e.player };
    case 'yearOfPlenty':
      return { text: L('{p} берёт из банка: {x}', '{p} банктен алады: {x}', '{p} takes from the bank: {x}', { p: n(e.player), x: e.resources.map(res).join(', ') }), who: e.player };
    case 'monopoly':
      return { text: L('{p} забирает весь {r} у всех ({n})', '{p} бәрінен барлық {r} жинайды ({n})', '{p} takes all {r} from everyone ({n})', { p: n(e.player), r: res(e.resource), n: e.total }), who: e.player };
    case 'bankTrade':
      return {
        text: L(
          '{p} меняет с банком {gc} {g} → {rc} {r}',
          '{p} банкпен айырбастайды: {gc} {g} → {rc} {r}',
          '{p} trades with the bank: {gc} {g} → {rc} {r}',
          { p: n(e.player), gc: e.giveCount, g: res(e.give), rc: e.receiveCount, r: res(e.receive) },
        ),
        who: e.player,
      };
    case 'tradeCompleted': {
      // Кто что отдал: «Аскар ↔ Тимур: 2 кирпич за 1 руда»
      const list = (m: Partial<Record<Resource, number>>) =>
        (Object.entries(m) as [Resource, number][])
          .filter(([, k]) => k > 0)
          .map(([r, k]) => `${k} ${res(r)}`)
          .join(' + ');
      return { text: L('{a} ↔ {b}: {x} за {y}', '{a} ↔ {b}: {x} орнына {y}', '{a} ↔ {b}: {x} for {y}', { a: n(e.from), b: n(e.to), x: list(e.give), y: list(e.want) }), who: e.from };
    }
    case 'longestRoad':
      return e.player
        ? {
            text: L('{b} (дорога {l}) — у {p}, +2 очка', '{b} (жол {l}) — {p} ойыншысында, +2 ұпай', '{b} (road {l}) — held by {p}, +2 points', { b: c.pack.bonuses.longestRoad, l: e.length, p: n(e.player) }),
            who: e.player,
          }
        : { text: L('{b}: дорогу разорвали — карта пока ничья', '{b}: жол үзілді — карта әзірге ешкімде жоқ', '{b}: the road was broken — the card is unclaimed', { b: c.pack.bonuses.longestRoad }) };
    case 'largestArmy':
      return {
        text: L('{b} ({k} воинов) — у {p}, +2 очка', '{b} ({k} жауынгер) — {p} ойыншысында, +2 ұпай', '{b} ({k} warriors) — held by {p}, +2 points', { b: c.pack.bonuses.largestArmy, k: e.knights, p: n(e.player) }),
        who: e.player,
      };
    case 'turnSkipped':
      return { text: L('{p} пропускает ход', '{p} жүрісін өткізеді', '{p} skips the turn', { p: n(e.player) }), who: e.player };
    case 'playerLeft':
      return { text: L('{p} вышел — играет бот', '{p} шықты — бот ойнайды', '{p} left — a bot plays', { p: n(e.player) }), who: e.player };
    case 'playerReturned':
      return { text: L('{p} вернулся', '{p} оралды', '{p} is back', { p: n(e.player) }), who: e.player };
    case 'gameWon':
      return { text: L('{p} побеждает: {n} очков', '{p} жеңді: {n} ұпай', '{p} wins: {n} points', { p: n(e.player), n: e.points }), who: e.player };
    default:
      return null;
  }
}

/** Важное — закрепить карточкой с объяснением, пока игрок не нажмёт «Понятно». */
export function noticeFor(e: GameEvent, c: LogCtx): Omit<Notice, 'key'> | null {
  const n = c.name;
  switch (e.type) {
    case 'built': {
      // Поселение на перекрёстке, через который шла чужая дорога (2+ её участка), — дорогу разрезали.
      if (e.kind !== 'settlement' || !c.roadsAt) return null;
      const counts = c.roadsAt(e.at);
      const victim = (Object.keys(counts) as PlayerId[]).find((p) => p !== e.player && (counts[p] ?? 0) >= 2);
      if (!victim) return null;
      const bonus = `«${c.pack.bonuses.longestRoad}»`;
      if (victim === c.me)
        return {
          title: L('Твою дорогу разрезали', 'Жолыңды кесіп тастады', 'Your road was cut'),
          text: L(
            '{p} ставит поселение посреди твоей дороги. Для {bonus} теперь считается только самый длинный кусок. Но оба куска твои: на их концах можно строить дома и вести дороги дальше — только не через чужой дом.',
            '{p} жолыңның ортасына қоныс салды. {bonus} үшін енді тек ең ұзын бөлігі саналады. Бірақ екі бөлік те сенікі: олардың ұштарына үй салып, жолды әрі қарай жалғастыра аласың — тек бөтеннің үйі арқылы емес.',
            '{p} places a settlement in the middle of your road. For {bonus} only the longest piece counts now. But both pieces are yours: you can build houses at their ends and extend the roads — just not through another player’s house.',
            { p: n(e.player), bonus },
          ),
          who: e.player,
          icon: 'road',
        };
      if (e.player === c.me)
        return {
          title: L('Ты разрезал дорогу', 'Сен жолды кесіп тастадың', 'You cut a road'),
          text: L(
            'Твоё поселение разрезало дорогу игрока {v}. Для {bonus} теперь считается только самый длинный кусок, но строить на концах обоих кусков этот игрок по-прежнему может.',
            'Сенің қонысың {v} ойыншысының жолын кесті. {bonus} үшін енді тек ең ұзын бөлігі саналады, бірақ бұл ойыншы екі бөліктің де ұштарына құрылыс сала береді.',
            "Your settlement cut {v}'s road. For {bonus} only the longest piece counts now, but this player can still build at the ends of both pieces.",
            { v: n(victim), bonus },
          ),
          who: victim,
          icon: 'road',
        };
      return {
        title: L('Дорогу разрезали', 'Жолды кесіп тастады', 'A road was cut'),
        text: L(
          '{p} ставит поселение посреди дороги игрока {v}. Для {bonus} считается только самый длинный кусок, но на концах обоих кусков {v} может строить дальше.',
          '{p} {v} ойыншысының жолының ортасына қоныс салды. {bonus} үшін тек ең ұзын бөлігі саналады, бірақ екі бөліктің ұштарында {v} құрылысты жалғастыра алады.',
          "{p} places a settlement in the middle of {v}'s road. For {bonus} only the longest piece counts, but {v} can keep building at the ends of both pieces.",
          { p: n(e.player), v: n(victim), bonus },
        ),
        who: victim,
        icon: 'road',
      };
    }
    case 'longestRoad':
      if (!e.player)
        return {
          title: c.pack.bonuses.longestRoad,
          text: L('Самую длинную дорогу разорвали — бонус +2 очка пока ни у кого.', 'Ең ұзын жол үзілді — +2 ұпай бонусы әзірге ешкімде жоқ.', 'The longest road was broken — the +2 points bonus is unclaimed for now.'),
        };
      return {
        title: c.pack.bonuses.longestRoad,
        text:
          e.player === c.me
            ? L('Самая длинная непрерывная дорога ({l}) — у тебя. Это +2 очка, пока кто-то не построит длиннее.', 'Ең ұзын үзіліссіз жол ({l}) — сенде. Бұл +2 ұпай, біреу ұзынырақ салғанша.', 'The longest continuous road ({l}) is yours. That is +2 points until someone builds a longer one.', { l: e.length })
            : L('Самая длинная непрерывная дорога ({l}) — у {p}. Это +2 очка, пока кто-то не построит длиннее.', 'Ең ұзын үзіліссіз жол ({l}) — {p} ойыншысында. Бұл +2 ұпай, біреу ұзынырақ салғанша.', 'The longest continuous road ({l}) belongs to {p}. That is +2 points until someone builds a longer one.', { l: e.length, p: n(e.player) }),
        who: e.player,
      };
    case 'largestArmy':
      return {
        title: c.pack.bonuses.largestArmy,
        text:
          e.player === c.me
            ? L('Больше всех сыгранных воинов ({k}) — у тебя. Это +2 очка, пока кто-то не сыграет больше.', 'Ең көп ойналған жауынгерлер ({k}) — сенде. Бұл +2 ұпай, біреу көбірек ойнағанша.', 'You have played the most warriors ({k}). That is +2 points until someone plays more.', { k: e.knights })
            : L('Больше всех сыгранных воинов ({k}) — у {p}. Это +2 очка, пока кто-то не сыграет больше.', 'Ең көп ойналған жауынгерлер ({k}) — {p} ойыншысында. Бұл +2 ұпай, біреу көбірек ойнағанша.', '{p} has played the most warriors ({k}). That is +2 points until someone plays more.', { k: e.knights, p: n(e.player) }),
        who: e.player,
      };
    case 'monopoly':
      if (e.player === c.me) return null;
      return {
        title: c.pack.devCards.monopoly.name,
        text: L('{p} забрал у всех весь {r} — {n} шт.', '{p} бәрінен барлық {r} жинады — {n} дана.', '{p} took all {r} from everyone — {n} total.', { p: n(e.player), r: res(e.resource), n: e.total }),
        who: e.player,
      };
    default:
      return null;
  }
}

/** Ресурс гекса по местности. */
export function hexResource(terrain: string): Resource | undefined {
  return (TERRAIN_RESOURCE as Record<string, Resource | undefined>)[terrain];
}
