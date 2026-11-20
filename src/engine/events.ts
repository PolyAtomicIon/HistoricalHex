// События игры: для лога на экране хоста и для анимаций.

import type { BotLevel, DevCardType, EdgeId, HexId, PlayerId, Resource, ResourceMap, VertexId } from './types';

export type GameEvent =
  | { type: 'gameStarted'; order: PlayerId[] }
  | { type: 'built'; player: PlayerId; kind: 'road' | 'settlement' | 'city'; at: VertexId | EdgeId; free?: boolean }
  | { type: 'setupResources'; player: PlayerId; gains: Partial<ResourceMap> }
  | { type: 'diceRolled'; player: PlayerId; dice: [number, number]; total: number }
  | { type: 'produced'; total: number; gains: Record<PlayerId, Partial<ResourceMap>>; shortages: Resource[] }
  | { type: 'mustDiscard'; players: Record<PlayerId, number> }
  | { type: 'discarded'; player: PlayerId; count: number; forced?: boolean }
  | { type: 'robberMoved'; player: PlayerId; hex: HexId }
  /** resource виден только вору и жертве (вырезается из публичного лога). */
  | { type: 'stole'; thief: PlayerId; victim: PlayerId; resource?: Resource }
  | { type: 'devCardBought'; player: PlayerId }
  | { type: 'devCardPlayed'; player: PlayerId; card: Exclude<DevCardType, 'victoryPoint'> }
  | { type: 'yearOfPlenty'; player: PlayerId; resources: Resource[] }
  | { type: 'monopoly'; player: PlayerId; resource: Resource; total: number }
  | { type: 'bankTrade'; player: PlayerId; give: Resource; giveCount: number; receive: Resource; receiveCount: number }
  | { type: 'tradeOffered'; player: PlayerId; tradeId: number; give: ResourceMap; want: ResourceMap }
  | { type: 'tradeResponded'; player: PlayerId; tradeId: number; kind: 'accept' | 'decline' | 'counter' }
  | { type: 'tradeCompleted'; from: PlayerId; to: PlayerId; give: ResourceMap; want: ResourceMap }
  | { type: 'tradeCancelled'; player: PlayerId }
  | { type: 'longestRoad'; player?: PlayerId; length: number }
  | { type: 'largestArmy'; player: PlayerId; knights: number }
  | { type: 'turnStarted'; player: PlayerId; turn: number }
  | { type: 'turnSkipped'; player: PlayerId }
  /** Игрок вышел (auto — не вернулся вовремя), за него играет бот. */
  | { type: 'playerLeft'; player: PlayerId; level: BotLevel; auto?: boolean }
  | { type: 'playerReturned'; player: PlayerId }
  | { type: 'gameWon'; player: PlayerId; points: number };

export type LogEntry = GameEvent & { seq: number };
