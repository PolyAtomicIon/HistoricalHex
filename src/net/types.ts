// Что лежит в базе: rooms/<pin>/… (см. PLAN.md, раздел 5).

import type { Action, BotLevel, PlayerColor, PlayerId } from '../engine';

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface RoomSettings {
  /** Сколько секунд ждать отвалившегося игрока, прежде чем хост решает. */
  reconnectSeconds: number;
  vpToWin: number;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = { reconnectSeconds: 120, vpToWin: 10 };

export interface RoomMeta {
  hostUid: string;
  created: number;
  status: RoomStatus;
  settings: RoomSettings;
}

export interface LobbyEntry {
  name: string;
  color?: PlayerColor;
  joinedAt: number;
  /** Есть у ботов, которых добавил хост. */
  bot?: BotLevel;
}

export interface Presence {
  online: boolean;
  changedAt: number;
}

export interface QueuedAction {
  uid: PlayerId;
  action: Action;
  at: number;
}

export interface ActionResultRecord {
  actionId: string;
  ok: boolean;
  error?: string;
  at: number;
}

export interface LobbyPlayer extends LobbyEntry {
  uid: PlayerId;
  online: boolean;
}

export const roomPath = (pin: string) => `rooms/${pin}`;

/** Список игроков лобби по времени входа. */
export function lobbyList(
  lobby: Record<PlayerId, LobbyEntry> | null | undefined,
  presence: Record<PlayerId, Presence> | null | undefined,
): LobbyPlayer[] {
  return Object.entries(lobby ?? {})
    .map(([uid, e]) => ({ uid, ...e, online: e.bot ? true : (presence?.[uid]?.online ?? false) }))
    .sort((a, b) => a.joinedAt - b.joinedAt);
}
