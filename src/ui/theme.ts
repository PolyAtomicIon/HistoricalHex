// Цвета и значки-заглушки. Когда будет арт из ChatGPT (Этап 6), значки заменятся картинками.

import type { DevCardType, HarborType, PlayerColor, Resource, Terrain } from '../engine';

export const PLAYER_HEX: Record<PlayerColor, string> = {
  red: '#d94841',
  blue: '#2f6fdb',
  white: '#f4f1ea',
  orange: '#f08a24',
  green: '#2e9e5b',
  purple: '#8a4fd1',
};

/** Цвет обводки фишки (белым фишкам нужна тёмная обводка). */
export const PLAYER_STROKE: Record<PlayerColor, string> = {
  red: '#5c1512',
  blue: '#0f2b63',
  white: '#3a3a3a',
  orange: '#6b3500',
  green: '#0d3d20',
  purple: '#33155e',
};

export const TERRAIN_FILL: Record<Terrain, string> = {
  forest: '#2f7d3a',
  hills: '#c3643d',
  pasture: '#8fc657',
  fields: '#e9c046',
  mountains: '#8c95a6',
  desert: '#e3cf9e',
};

// Только эмодзи, которые есть в шрифте Windows 10 (🪵 и 🪨 там не отображаются).
export const RESOURCE_ICON: Record<Resource, string> = {
  brick: '🧱',
  wood: '🌳',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛏️',
};

export const TERRAIN_ICON: Record<Terrain, string> = {
  forest: '🌲',
  hills: '🧱',
  pasture: '🐑',
  fields: '🌾',
  mountains: '⛰️',
  desert: '🏜️',
};

export const DEV_CARD_ICON: Record<DevCardType, string> = {
  knight: '⚔️',
  victoryPoint: '🏆',
  roadBuilding: '🛤️',
  yearOfPlenty: '🎁',
  monopoly: '💰',
};

export function harborIcon(type: HarborType): string {
  return type === 'any' ? '❓' : RESOURCE_ICON[type];
}
