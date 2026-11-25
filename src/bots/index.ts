// Боты Хексленда: решения (brain.ts) и кто из ботов должен ходить сейчас.

import type { BotLevel, PlayerId, PublicState } from '../engine';

export { decide, TRADE_WAIT_MS } from './brain';
export type { BotContext, BotMemory } from './brain';

export const BOT_LEVEL_NAME: Record<BotLevel, string> = {
  easy: 'лёгкий',
  medium: 'средний',
  hard: 'сложный',
};

export const BOT_NAMES = ['Арман', 'Алия', 'Тимур', 'Дана', 'Ерлан', 'Сауле', 'Нурлан', 'Айгерим', 'Бекзат', 'Мадина'];

/**
 * Кто из ботов должен сделать действие прямо сейчас (первым — самый срочный).
 * Сброс на 7 и ответы на обмен могут делать и те, чей сейчас не ход.
 */
export function botsToAct(pub: PublicState, isBot: (id: PlayerId) => boolean): PlayerId[] {
  if (pub.phase === 'finished') return [];
  const current = pub.order[pub.current];
  if (pub.phase === 'discard') return Object.keys(pub.pendingDiscards ?? {}).filter(isBot);
  const out: PlayerId[] = [];
  if (pub.phase === 'main' && pub.trade) {
    const to = pub.trade.to;
    for (const p of pub.order) if (p !== current && isBot(p) && !pub.trade.responses?.[p] && (!to || to.includes(p))) out.push(p);
  }
  if (isBot(current)) out.push(current);
  return out;
}
