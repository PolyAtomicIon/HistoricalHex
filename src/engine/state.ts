// Полное состояние игры (хранится только у хоста) и создание новой партии.
//
// Важно для Firebase: он не хранит null, пустые объекты и пустые массивы.
// Поэтому необязательные поля помечены `?`, а после чтения из базы
// состояние надо прогнать через normalizeState().

import type { BotLevel, DevCardType, EdgeId, HexId, PlayerColor, PlayerId, ResourceMap, VertexId } from './types';
import { DEV_CARD_TYPES, RESOURCES, emptyResources } from './types';
import type { Board } from './board/generate';
import { generateBoard } from './board/generate';
import { DEFAULT_VP_TO_WIN, LAYOUTS, MAX_PLAYERS, MIN_PLAYERS, PIECES, layoutForPlayerCount } from './constants';
import type { Rng } from './rng';
import { shuffle } from './rng';
import type { LogEntry } from './events';

export type Phase =
  | 'setup' // расстановка змейкой
  | 'roll' // начало хода: можно бросить кубики или сыграть карту развития
  | 'discard' // выпала 7: ждём, пока все с >7 картами сбросят
  | 'moveRobber' // текущий игрок переставляет разбойника (и крадёт)
  | 'main' // торговля и стройка
  | 'roadBuilding' // карта «Строительство дорог»: ставим бесплатные дороги
  | 'finished';

export interface DevCardEntry {
  type: DevCardType;
  /** Номер хода, в который карту купили (в этот же ход её играть нельзя). */
  boughtTurn: number;
}

export interface Player {
  id: PlayerId;
  name: string;
  color: PlayerColor;
  resources: ResourceMap;
  devCards: DevCardEntry[];
  knightsPlayed: number;
  pieces: { roads: number; settlements: number; cities: number };
  /** Есть, если это бот (за него ходит хост). */
  bot?: BotLevel;
}

export interface Building {
  owner: PlayerId;
  kind: 'settlement' | 'city';
}

export type TradeResponse =
  | { kind: 'accept' }
  | { kind: 'decline' }
  | { kind: 'counter'; give: ResourceMap; want: ResourceMap };

export interface TradeOffer {
  id: number;
  /** Что отдаёт активный игрок. */
  give: ResourceMap;
  /** Что хочет получить активный игрок. */
  want: ResourceMap;
  responses: Record<PlayerId, TradeResponse>;
}

export interface SetupState {
  round: 1 | 2;
  step: 'settlement' | 'road';
  /** Поселение, к которому должна примыкать дорога на этом шаге. */
  lastVertex?: VertexId;
}

export interface GameSettings {
  vpToWin: number;
}

export interface GameState {
  phase: Phase;
  settings: GameSettings;
  board: Board;
  robberHex: HexId;
  players: Record<PlayerId, Player>;
  /** Порядок ходов. */
  order: PlayerId[];
  /** Индекс текущего игрока в order. */
  current: number;
  /** Номер хода: 0 — расстановка, дальше 1, 2, 3… */
  turn: number;
  setup?: SetupState;
  bank: ResourceMap;
  devDeck: DevCardType[];
  buildings: Record<VertexId, Building>;
  roads: Record<EdgeId, PlayerId>;
  dice?: [number, number];
  /** Сыграна ли уже карта развития в этот ход. */
  devCardPlayed: boolean;
  /** Сколько карт должен сбросить каждый (при семёрке). */
  pendingDiscards?: Record<PlayerId, number>;
  /** Куда вернуться после разбойника / бесплатных дорог. */
  resumePhase?: 'roll' | 'main';
  roadBuildingLeft?: number;
  trade?: TradeOffer;
  tradeSeq: number;
  longestRoad?: PlayerId;
  largestArmy?: PlayerId;
  winner?: PlayerId;
  log: LogEntry[];
  logSeq: number;
}

export interface NewPlayer {
  id: PlayerId;
  name: string;
  color: PlayerColor;
  bot?: BotLevel;
}

export interface CreateGameOptions {
  vpToWin?: number;
}

export function createGame(newPlayers: readonly NewPlayer[], rng: Rng, options: CreateGameOptions = {}): GameState {
  const n = newPlayers.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) {
    throw new Error(`Нужно от ${MIN_PLAYERS} до ${MAX_PLAYERS} игроков`);
  }
  if (new Set(newPlayers.map((p) => p.id)).size !== n) throw new Error('Повторяющиеся игроки');
  if (new Set(newPlayers.map((p) => p.color)).size !== n) throw new Error('У игроков должны быть разные цвета');

  const layout = layoutForPlayerCount(n);
  const spec = LAYOUTS[layout];
  const { board, robberHex } = generateBoard(layout, rng);

  const players: Record<PlayerId, Player> = {};
  for (const p of newPlayers) {
    players[p.id] = {
      id: p.id,
      name: p.name,
      color: p.color,
      resources: emptyResources(),
      devCards: [],
      knightsPlayed: 0,
      pieces: { ...PIECES },
      ...(p.bot ? { bot: p.bot } : {}),
    };
  }

  const deck: DevCardType[] = [];
  for (const t of DEV_CARD_TYPES) for (let i = 0; i < spec.devCards[t]; i++) deck.push(t);

  const bank = emptyResources();
  for (const r of RESOURCES) bank[r] = spec.bankPerResource;

  const order = shuffle(
    rng,
    newPlayers.map((p) => p.id),
  );

  return {
    phase: 'setup',
    settings: { vpToWin: options.vpToWin ?? DEFAULT_VP_TO_WIN },
    board,
    robberHex,
    players,
    order,
    current: 0,
    turn: 0,
    setup: { round: 1, step: 'settlement' },
    bank,
    devDeck: shuffle(rng, deck),
    buildings: {},
    roads: {},
    devCardPlayed: false,
    tradeSeq: 0,
    log: [{ seq: 1, type: 'gameStarted', order }],
    logSeq: 1,
  };
}

/** Восстанавливает поля, которые Firebase выбрасывает (пустые объекты/массивы). */
export function normalizeState(raw: GameState): GameState {
  const s = raw;
  s.buildings ??= {};
  s.roads ??= {};
  s.devDeck ??= [];
  s.log ??= [];
  s.logSeq ??= 0;
  s.tradeSeq ??= 0;
  s.devCardPlayed ??= false;
  s.bank = { ...emptyResources(), ...(s.bank ?? {}) };
  s.board.harbors ??= [];
  for (const p of Object.values(s.players ?? {})) {
    p.resources = { ...emptyResources(), ...(p.resources ?? {}) };
    p.devCards ??= [];
    p.knightsPlayed ??= 0;
  }
  if (s.trade) s.trade.responses ??= {};
  if (s.trade) {
    s.trade.give = { ...emptyResources(), ...(s.trade.give ?? {}) };
    s.trade.want = { ...emptyResources(), ...(s.trade.want ?? {}) };
    for (const resp of Object.values(s.trade.responses)) {
      if (resp.kind === 'counter') {
        resp.give = { ...emptyResources(), ...(resp.give ?? {}) };
        resp.want = { ...emptyResources(), ...(resp.want ?? {}) };
      }
    }
  }
  return s;
}

export function currentPlayerId(s: Pick<GameState, 'order' | 'current'>): PlayerId {
  return s.order[s.current];
}
