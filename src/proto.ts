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

export type Pace = 'calm' | 'normal' | 'fast' | 'turbo';
/** Множитель пауз для каждого темпа. */
export const PACE_K: Record<Pace, number> = { calm: 1.6, normal: 1, fast: 0.7, turbo: 0.12 };

export const DEFAULT_SETTINGS: RoomSettings = {
  reconnectSeconds: 90,
  vpToWin: 10,
  offlineBot: true,
  dice: 'randomOrg',
  lore: 'genghis',
  turnSeconds: 0,
  autoRoll: true,
  pace: 'turbo',
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
  /** Сколько зрителей смотрят партию (подключены, но не за столом). */
  watchers?: number;
  /** Мою последнюю постройку можно отменить — что это было. */
  canUndo?: 'road' | 'settlement' | 'city';
  /** С кем я не торгую (тайно, видно только мне). */
  bans?: PlayerId[];
  /** Партия на паузе: кто поставил и когда. */
  paused?: { by: PlayerId; name: string; at: number };
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
  /** Пауза партии (любой игрок за столом) — on: false — продолжить. */
  | { t: 'pause'; on: boolean }
  /** Тайный бан в обмене: не торговать с игроком (on: false — снять). */
  | { t: 'ban'; player: PlayerId; on: boolean }
  /** Ошибка в браузере игрока — для журнала сервера. */
  | { t: 'clientError'; msg: string; ua?: string }
  /** Событие интерфейса для статистики (обучение, правила). */
  | { t: 'track'; event: string; data?: unknown }
  | { t: 'close' }
  /** Профиль и рейтинг. */
  | { t: 'profile' }
  /** Вход через Telegram: initData из Mini App или данные Login Widget. */
  | { t: 'tgAuth'; initData?: string; widget?: Record<string, string | number> }
  /** Вход через AQL Portal: подписанный порталом билет из ссылки ?aql=… */
  | { t: 'portalAuth'; ticket: string; /** код ожидающего устройства (?plink=…): войти и в нём */ link?: string }
  /** Начать вход через портал: сервер выдаёт код ожидания для адреса возврата. */
  | { t: 'portalWait' }
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
  /** Лента главной: идущие партии (смотреть) и недавние. */
  | { t: 'feed' }
  /** Друзья: список со статусом, добавить/убрать (id — профиль), позвать в мою комнату. */
  | { t: 'friends' }
  | { t: 'friend'; id: string; on: boolean }
  | { t: 'invite'; id: string }
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
  /** name — у зрителя (его нет за столом, имя берётся из профиля). */
  | { t: 'react'; from: PlayerId; emoji: string; at: number; name?: string; watcher?: boolean }
  | { t: 'error'; message: string; fatal?: boolean }
  | { t: 'pong'; now: number }
  | { t: 'profile'; profile: ProfileView; leaders: LeaderRow[]; tgBot?: string; /** Адрес AQL Portal: есть — показываем вход через портал. */ portal?: string; /** id профилей моих друзей. */ friends?: string[] }
  | { t: 'tgLink'; url: string }
  /** Код ожидания входа через портал. */
  | { t: 'portalWait'; code: string }
  /** Вход через портал завершён на другом устройстве/в другом браузере по коду. */
  | { t: 'portalLinked' }
  | { t: 'playerProfile'; pid: string; profile: ProfileView | null }
  | { t: 'feed'; live: LiveGame[]; recent: RecentGame[] }
  | { t: 'friends'; list: FriendRow[] }
  /** Друг зовёт в партию. */
  | { t: 'invite'; from: string; pin: string; era: string };

/** Идущая партия в ленте главной — её можно открыть зрителем. */
export interface LiveGame {
  pin: string;
  era: string;
  turn: number;
  /** Ход сейчас у этого игрока (индекс в players). */
  current: number;
  watchers: number;
  /** Партия на паузе. */
  paused?: boolean;
  /** Я сижу за этим столом. */
  mine?: boolean;
  /** Имена моих друзей за этим столом. */
  friends?: string[];
  players: { name: string; color: PlayerColor; points: number; bot?: boolean; online: boolean }[];
}

/** Сыгранная партия в ленте главной. */
export interface RecentGame {
  id: string;
  era: string;
  finishedAt: number;
  /** Я играл в этой партии. */
  mine?: boolean;
  /** Места по порядку: победитель первым. profileId — открыть профиль по тапу. */
  players: { name: string; profileId?: string; bot?: boolean; ai?: boolean; vp: number; winner: boolean }[];
}

/** Друг на главной: в сети ли, где сейчас. */
export interface FriendRow {
  id: string;
  name: string;
  photo?: string;
  rating: number;
  online: boolean;
  /** Сидит за столом: в лобби или в партии — PIN, чтобы зайти или смотреть. */
  where?: { pin: string; state: 'lobby' | 'playing'; era: string };
}

export const REACTIONS = ['👍', '😂', '😱', '🔥', '😤', '🤝', '👀', '🙏', '💀', '🎉'] as const;
