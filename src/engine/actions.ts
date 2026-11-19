// Действия, которые игроки присылают хосту, и действия самого хоста.

import type { EdgeId, HexId, PlayerId, Resource, ResourceMap, VertexId } from './types';

export type Action =
  | { type: 'buildSettlement'; vertex: VertexId }
  | { type: 'buildRoad'; edge: EdgeId }
  | { type: 'buildCity'; vertex: VertexId }
  | { type: 'buyDevCard' }
  | { type: 'rollDice' }
  | { type: 'discard'; resources: ResourceMap }
  /** victim обязателен, только если рядом с гексом несколько игроков с картами. */
  | { type: 'moveRobber'; hex: HexId; victim?: PlayerId }
  | { type: 'playKnight' }
  | { type: 'playRoadBuilding' }
  | { type: 'playYearOfPlenty'; resources: [Resource, Resource] }
  | { type: 'playMonopoly'; resource: Resource }
  | { type: 'bankTrade'; give: Resource; receive: Resource; times?: number }
  /** give / want — с точки зрения активного игрока. */
  | { type: 'offerTrade'; give: ResourceMap; want: ResourceMap }
  /** Для counter: give / want тоже с точки зрения активного игрока (что он отдаёт / получает). */
  | { type: 'respondTrade'; tradeId: number; kind: 'accept' | 'decline' }
  | { type: 'respondTrade'; tradeId: number; kind: 'counter'; give: ResourceMap; want: ResourceMap }
  | { type: 'confirmTrade'; tradeId: number; with: PlayerId }
  | { type: 'cancelTrade' }
  | { type: 'endTurn' };

export type ActionType = Action['type'];

/** Кнопки на экране хоста (например, для отвалившегося игрока). */
export type HostAction =
  /** Пропустить ход текущего игрока (на расстановке — поставить за него случайно). */
  | { type: 'skipTurn' }
  /** Сбросить за игрока случайные карты при семёрке. */
  | { type: 'forceDiscard'; player: PlayerId };
