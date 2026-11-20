// Что видят все (public) и что видит только сам игрок (private).
// Хост пишет public в rooms/<pin>/public, а private — в rooms/<pin>/private/<uid>.

import type { BotLevel, DevCardType, PlayerColor, PlayerId, Resource, ResourceMap } from './types';
import { emptyResources, totalResources } from './types';
import type { GameState } from './state';
import { currentPlayerId } from './state';
import type { LogEntry } from './events';
import { hiddenVictoryPoints, longestRoadLength, publicVictoryPoints, victoryPoints } from './rules/scoring';
import { tradeRatios } from './rules/placement';

export interface PublicPlayer {
  id: PlayerId;
  name: string;
  color: PlayerColor;
  resourceCount: number;
  devCardCount: number;
  knightsPlayed: number;
  pieces: { roads: number; settlements: number; cities: number };
  /** Очки, видимые всем (в конце игры — вместе со скрытыми). */
  points: number;
  roadLength: number;
  bot?: BotLevel;
  /** Живой игрок вышел — за него играет бот. */
  away?: boolean;
  /** Ведущий выгнал игрока — за него до конца играет бот. */
  kicked?: boolean;
}

export type PublicState = Omit<GameState, 'players' | 'devDeck' | 'diceDeck' | 'log'> & {
  players: Record<PlayerId, PublicPlayer>;
  devDeckCount: number;
  log: LogEntry[];
};

export interface PrivateDevCard {
  type: DevCardType;
  /** Можно сыграть прямо сейчас. */
  playable: boolean;
  /** Куплена в этот ход. */
  isNew: boolean;
}

export interface PrivateView {
  resources: ResourceMap;
  devCards: PrivateDevCard[];
  /** Все очки игрока, включая скрытые карты «Победное очко». */
  points: number;
  hiddenPoints: number;
  /** Сколько карт надо сбросить (0 — не надо). */
  mustDiscard: number;
  tradeRatios: Record<Resource, number>;
  /** Последние кражи с участием игрока — с указанием ресурса. */
  steals: LogEntry[];
}

export function toPublicView(s: GameState): PublicState {
  const { players, devDeck, diceDeck: _diceDeck, log, ...rest } = s;
  const finished = s.phase === 'finished';
  const publicPlayers: Record<PlayerId, PublicPlayer> = {};
  for (const pid of s.order) {
    const p = players[pid];
    publicPlayers[pid] = {
      id: p.id,
      name: p.name,
      color: p.color,
      resourceCount: totalResources(p.resources),
      devCardCount: p.devCards.length,
      knightsPlayed: p.knightsPlayed,
      pieces: { ...p.pieces },
      points: finished ? victoryPoints(s, pid) : publicVictoryPoints(s, pid),
      roadLength: longestRoadLength(s, pid),
      ...(p.bot ? { bot: p.bot } : {}),
      ...(p.away ? { away: true } : {}),
      ...(p.kicked ? { kicked: true } : {}),
    };
  }
  return {
    ...structuredClone(rest),
    players: publicPlayers,
    devDeckCount: devDeck.length,
    log: log.map((e) => {
      if (e.type !== 'stole') return { ...e };
      const { resource: _hidden, ...pub } = e;
      return pub;
    }),
  };
}

/** Восстанавливает поля публичного состояния, которые Firebase выбрасывает (пустые объекты/массивы). */
export function normalizePublicView(raw: PublicState): PublicState {
  const s = raw;
  s.buildings ??= {};
  s.roads ??= {};
  s.log ??= [];
  s.order ??= [];
  s.players ??= {};
  s.devCardPlayed ??= false;
  s.bank = { ...emptyResources(), ...(s.bank ?? {}) };
  s.board.harbors ??= [];
  if (s.trade) {
    s.trade.responses ??= {};
    s.trade.give = { ...emptyResources(), ...(s.trade.give ?? {}) };
    s.trade.want = { ...emptyResources(), ...(s.trade.want ?? {}) };
  }
  return s;
}

export function normalizePrivateView(raw: PrivateView): PrivateView {
  const p = raw;
  p.resources = { ...emptyResources(), ...(p.resources ?? {}) };
  p.devCards ??= [];
  p.steals ??= [];
  p.mustDiscard ??= 0;
  p.points ??= 0;
  p.hiddenPoints ??= 0;
  return p;
}

export function toPrivateView(s: GameState, pid: PlayerId): PrivateView {
  const p = s.players[pid];
  const canPlayNow =
    currentPlayerId(s) === pid && (s.phase === 'roll' || s.phase === 'main') && !s.devCardPlayed;
  return {
    resources: { ...p.resources },
    devCards: p.devCards.map((c) => ({
      type: c.type,
      isNew: c.boughtTurn === s.turn,
      playable: c.type !== 'victoryPoint' && canPlayNow && c.boughtTurn < s.turn,
    })),
    points: victoryPoints(s, pid),
    hiddenPoints: hiddenVictoryPoints(s, pid),
    mustDiscard: s.pendingDiscards?.[pid] ?? 0,
    tradeRatios: tradeRatios(s, pid),
    steals: s.log.filter((e) => e.type === 'stole' && (e.thief === pid || e.victim === pid)).slice(-5),
  };
}
