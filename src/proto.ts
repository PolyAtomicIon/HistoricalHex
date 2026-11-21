// Протокол между клиентом (телефон / телевизор) и сервером HistoricalHex. JSON по WebSocket.

import type { Action, BotLevel, GameEvent, HostAction, PlayerColor, PlayerId, PrivateView, PublicState } from './engine';

/**
 * randomOrg — настоящий случай с random.org (если сайт недоступен — генератор системы);
 * balanced  — колода из всех 36 бросков (меньше серий);
 * random    — генератор системы;
 * physical  — настоящие кубики на столе: бросивший вводит выпавшие числа.
 */
export type DiceMode = 'randomOrg' | 'balanced' | 'random' | 'physical';
export type DiceSource = 'randomOrg' | 'fallback' | 'physical' | 'balanced' | 'random';

export interface RoomSettings {
  /** Сколько секунд ждать отвалившегося игрока, прежде чем за него сыграет бот. */
  reconnectSeconds: number;
  vpToWin: number;
  offlineBot: boolean;
  dice: DiceMode;
  /** id пакета эпохи (src/lore). */
  lore: string;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  reconnectSeconds: 90,
  vpToWin: 10,
  offlineBot: true,
  dice: 'randomOrg',
  lore: 'genghis',
};

export const OFFLINE_BOT_LEVEL: BotLevel = 'medium';

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface Seat {
  id: PlayerId;
  name: string;
  color?: PlayerColor;
  bot?: BotLevel;
  online: boolean;
  joinedAt: number;
}

export interface RoomView {
  pin: string;
  status: RoomStatus;
  settings: RoomSettings;
  lobby: Seat[];
  /** Id создателя комнаты (ведущий). */
  hostId: PlayerId;
  /** Мой id в этой комнате. */
  me: PlayerId;
  /** Сижу ли я за столом (в лобби или в партии). */
  seated: boolean;
  isHost: boolean;
  /** Меня выгнали. */
  kicked?: boolean;
  public?: PublicState;
  private?: PrivateView;
  /** Кто когда заменится ботом, если не вернётся (мс по часам сервера). */
  deadlines: Record<PlayerId, number>;
  online: Record<PlayerId, boolean>;
  diceSource?: DiceSource;
  serverNow: number;
}

export type ClientMsg =
  /** secret — случайная строка из localStorage. Публичный id игрока выводится из неё на сервере. */
  | { t: 'hello'; secret: string }
  | { t: 'create'; settings?: Partial<RoomSettings> }
  /** Подписаться на комнату (телефон игрока или экран-телевизор). */
  | { t: 'open'; pin: string }
  | { t: 'join'; pin: string; name: string }
  | { t: 'color'; color: PlayerColor }
  | { t: 'leaveLobby' }
  | { t: 'settings'; settings: Partial<RoomSettings> }
  | { t: 'addBot'; level: BotLevel }
  /** В лобби — убрать; в партии — заменить ботом навсегда. */
  | { t: 'kick'; player: PlayerId; level?: BotLevel }
  | { t: 'start' }
  /** Ход игрока. dice — только для rollDice в режиме physical. */
  | { t: 'act'; id: string; action: Action; dice?: [number, number] }
  | { t: 'host'; id: string; action: HostAction }
  | { t: 'react'; emoji: string }
  | { t: 'close' }
  /** Профиль и рейтинг. */
  | { t: 'profile' }
  /** Вход через Telegram: initData из Mini App или данные Login Widget. */
  | { t: 'tgAuth'; initData?: string; widget?: Record<string, string | number> }
  | { t: 'rename'; name: string }
  /** Ссылка на бота для входа из обычного браузера. */
  | { t: 'tgLink' }
  | { t: 'ping' };

export interface ProfileView {
  id: string;
  name: string;
  username?: string;
  photo?: string;
  telegram: boolean;
  rating: number;
  games: number;
  wins: number;
  /** Дней подряд с партией (по Алматы). */
  streak: number;
  streakBest: number;
  playedToday: boolean;
  eras: Record<string, { games: number; wins: number }>;
}

export interface LeaderRow {
  place: number;
  id: string;
  name: string;
  rating: number;
  games: number;
  wins: number;
  photo?: string;
}

export type ServerMsg =
  | { t: 'welcome'; me: PlayerId }
  | { t: 'created'; pin: string }
  | { t: 'room'; room: RoomView }
  | { t: 'events'; events: GameEvent[]; diceSource?: DiceSource }
  | { t: 'result'; id: string; ok: boolean; error?: string }
  | { t: 'react'; from: PlayerId; emoji: string; at: number }
  | { t: 'error'; message: string; fatal?: boolean }
  | { t: 'pong'; now: number }
  | { t: 'profile'; profile: ProfileView; leaders: LeaderRow[]; tgBot?: string }
  | { t: 'tgLink'; url: string };

export const REACTIONS = ['👍', '😂', '😱', '🔥', '😤', '🤝', '👀', '🙏', '💀', '🎉'] as const;
