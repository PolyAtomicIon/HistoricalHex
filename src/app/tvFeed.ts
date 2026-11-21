// Лента событий для ТВ: коротко и картинками. Вместо «Сакура предлагает обмен: дерево ×1 → саман ×1»
// — строка «аватар · иконка действия · ресурсы иконками». Шумные события (предложения обмена,
// отмены, начало хода, бросок — он и так в карточке хода) в ленту не попадают.

import type { GameEvent, PlayerId, Resource } from '../engine';
import type { PublicState } from '../engine';
import type { LorePack } from '../lore';
import type { IconName } from './icons';

export interface FeedRes {
  r: Resource;
  n: number;
}

export interface FeedItem {
  key: number;
  who?: PlayerId;
  icon: IconName;
  text: string;
  /** Ресурсы (что отдал / что получил). */
  res?: FeedRes[];
  /** После стрелки — что получил взамен. */
  get?: FeedRes[];
  /** Доход по игрокам. */
  gains?: { who: PlayerId; res: FeedRes[] }[];
  /** Важное (бонусы, победа) — подсветить акцентом. */
  gold?: boolean;
}

const list = (m: Partial<Record<Resource, number>> | undefined): FeedRes[] =>
  Object.entries(m ?? {})
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([r, n]) => ({ r: r as Resource, n: n as number }));

const count = (rs: Resource[]): FeedRes[] => {
  const m: Partial<Record<Resource, number>> = {};
  for (const r of rs) m[r] = (m[r] ?? 0) + 1;
  return list(m);
};

const PIECE = { road: 'дорога', settlement: 'поселение', city: 'город' } as const;
const PIECE_ICON = { road: 'road', settlement: 'house', city: 'castle' } as const;

export function feedItem(e: GameEvent, key: number, pack: LorePack, name: (id?: PlayerId) => string): FeedItem | null {
  switch (e.type) {
    case 'produced': {
      const gains = Object.entries(e.gains ?? {})
        .map(([who, g]) => ({ who, res: list(g) }))
        .filter((g) => g.res.length);
      if (!gains.length) return null;
      return { key, icon: 'dice', text: `Доход · ${e.total}`, gains };
    }
    case 'built':
      return { key, who: e.player, icon: PIECE_ICON[e.kind], text: PIECE[e.kind] };
    case 'robberMoved':
      return { key, who: e.player, icon: 'army', text: pack.robber.name };
    case 'stole':
      return { key, who: e.thief, icon: 'hand', text: `крадёт у ${name(e.victim)}` };
    case 'discarded':
      return { key, who: e.player, icon: 'hand', text: `сброс ${e.count}` };
    case 'devCardBought':
      return { key, who: e.player, icon: 'cards', text: 'карта развития' };
    case 'devCardPlayed':
      return { key, who: e.player, icon: 'cards', text: `«${pack.devCards[e.card].name}»` };
    case 'yearOfPlenty':
      return { key, who: e.player, icon: 'bank', text: 'из банка', res: count(e.resources) };
    case 'monopoly':
      return { key, who: e.player, icon: 'crown', text: 'монополия', res: [{ r: e.resource, n: e.total }] };
    case 'bankTrade':
      return { key, who: e.player, icon: 'bank', text: 'банк', res: [{ r: e.give, n: e.giveCount }], get: [{ r: e.receive, n: e.receiveCount }] };
    case 'tradeCompleted':
      return { key, who: e.from, icon: 'trade', text: name(e.to), res: list(e.give), get: list(e.want) };
    case 'longestRoad':
      return e.player
        ? { key, who: e.player, icon: 'road', text: pack.bonuses.longestRoad, gold: true }
        : { key, icon: 'road', text: `${pack.bonuses.longestRoad} — ничья` };
    case 'largestArmy':
      return { key, who: e.player, icon: 'army', text: pack.bonuses.largestArmy, gold: true };
    case 'playerLeft':
      return { key, who: e.player, icon: 'bot', text: 'играет бот' };
    case 'playerReturned':
      return { key, who: e.player, icon: 'door', text: 'вернулся' };
    case 'gameWon':
      return { key, who: e.player, icon: 'crown', text: `победа · ${e.points}`, gold: true };
    default:
      return null;
  }
}

/** Последние события партии для ленты, новые сверху. */
export function tvFeed(pub: PublicState, pack: LorePack, name: (id?: PlayerId) => string, max = 4): FeedItem[] {
  const out: FeedItem[] = [];
  for (let i = pub.log.length - 1; i >= 0 && out.length < max; i--) {
    const e = pub.log[i];
    const it = feedItem(e, e.seq, pack, name);
    if (it) out.push(it);
  }
  return out;
}

/** Короткая фаза хода для карточки «Ходит …». */
export function tvPhase(pub: PublicState, name: (id?: PlayerId) => string): { icon: IconName; text: string } {
  switch (pub.phase) {
    case 'setup':
      return pub.setup?.step === 'road' ? { icon: 'road', text: 'ставит дорогу' } : { icon: 'house', text: 'ставит поселение' };
    case 'roll':
      return { icon: 'dice', text: 'бросает кубики' };
    case 'discard':
      return { icon: 'hand', text: `сбрасывают: ${Object.keys(pub.pendingDiscards ?? {}).map(name).join(', ')}` };
    case 'moveRobber':
      return { icon: 'army', text: 'выбирает цель' };
    case 'main':
      return { icon: 'trade', text: 'торговля и стройка' };
    case 'roadBuilding':
      return { icon: 'road', text: 'строит дороги' };
    case 'finished':
      return { icon: 'crown', text: 'победа!' };
  }
}
