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
  /** Секунд на ход (0 — без таймера). По истечении сервер сам заканчивает ход за игрока. */
  turnSeconds: number;
  /** Кубики бросает сервер для всех (через пару секунд после начала хода). */
  autoRoll: boolean;
  /** Темп: сколько боты и автоход ждут, пока люди досмотрят события. */
  pace?: Pace;
}

export type Pace = 'calm' | 'normal' | 'fast';
/** Множитель пауз для каждого темпа. */
export const PACE_K: Record<Pace, number> = { calm: 1.6, normal: 1, fast: 0.7 };

export const DEFAULT_SETTINGS: RoomSettings = {
  reconnectSeconds: 90,
  vpToWin: 10,
  offlineBot: true,
  dice: 'randomOrg',
  lore: 'genghis',
  turnSeconds: 180,
  autoRoll: true,
  pace: 'calm',
};

export const OFFLINE_BOT_LEVEL: BotLevel = 'medium';

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface Seat {
  id: PlayerId;
  name: string;
  color?: PlayerColor;
  bot?: BotLevel;
  /** ИИ-персонаж (server/personas.ts) — у него свой профиль и рейтинг. */
  persona?: string;
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
  /** Мою последнюю постройку можно отменить — что это было. */
  canUndo?: 'road' | 'settlement' | 'city';
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
  /** Отменить свою последнюю постройку (пока после неё никто ничего не сделал). */
  | { t: 'undo' }
  | { t: 'close' }
  /** Профиль и рейтинг. */
  | { t: 'profile' }
  /** Вход через Telegram: initData из Mini App или данные Login Widget. */
  | { t: 'tgAuth'; initData?: string; widget?: Record<string, string | number> }
  /** Вход через AQL Portal: подписанный порталом билет из ссылки ?aql=… */
  | { t: 'portalAuth'; ticket: string }
  | { t: 'rename'; name: string }
  /** Ссылка на бота для входа из обычного браузера. */
  | { t: 'tgLink' }
  /** Подписка на уведомления «Твой ход» (Web Push). */
  | { t: 'pushSub'; sub: unknown }
  | { t: 'pushOff' }
  /** Вкладка свёрнута/развёрнута — чтобы слать пуш, когда игру не видно. */
  | { t: 'vis'; hidden: boolean }
  /** Сесть на место бота посреди партии. */
  | { t: 'takeSeat'; pid: string; name: string }
  /** Профиль игрока за столом (человек или ИИ). */
  | { t: 'playerProfile'; pid: string }
  | { t: 'ping' };

export interface ProfileView {
  id: string;
  name: string;
  username?: string;
  photo?: string;
  telegram: boolean;
  /** Вошёл через AQL Portal. */
  portal?: boolean;
  rating: number;
  games: number;
  wins: number;
  /** Дней подряд с партией (по Алматы). */
  streak: number;
  streakBest: number;
  playedToday: boolean;
  eras: Record<string, { games: number; wins: number }>;
  /** ИИ-персонаж: стиль, описание, уровень. */
  ai?: { style: string; bio: string; level: 'easy' | 'medium' | 'hard' };
}

export interface LeaderRow {
  place: number;
  id: string;
  name: string;
  rating: number;
  games: number;
  wins: number;
  photo?: string;
  ai?: boolean;
}

export type ServerMsg =
  | { t: 'welcome'; me: PlayerId; vapid?: string; push?: boolean }
  | { t: 'created'; pin: string }
  | { t: 'room'; room: RoomView }
  | { t: 'events'; events: GameEvent[]; diceSource?: DiceSource }
  | { t: 'result'; id: string; ok: boolean; error?: string }
  | { t: 'react'; from: PlayerId; emoji: string; at: number }
  | { t: 'error'; message: string; fatal?: boolean }
  | { t: 'pong'; now: number }
  | { t: 'profile'; profile: ProfileView; leaders: LeaderRow[]; tgBot?: string; /** Адрес AQL Portal: есть — показываем вход через портал. */ portal?: string }
  | { t: 'tgLink'; url: string }
  | { t: 'playerProfile'; pid: string; profile: ProfileView | null };

export const REACTIONS = ['👍', '😂', '😱', '🔥', '😤', '🤝', '👀', '🙏', '💀', '🎉'] as const;
