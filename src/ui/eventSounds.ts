// Какие звуки играть на события лога.
// Телевизор озвучивает общее, телефон — только то, что касается этого игрока.

import { useEffect, useRef } from 'react';
import type { GameEvent, LogEntry, PlayerId } from '../engine';
import type { SoundName } from './sound';
import { playSound } from './sound';

type Cue = [SoundName, number?]; // звук и задержка, мс

/** Задержка дохода — после анимации кубиков. */
const AFTER_DICE = 750;

export function hostCues(e: GameEvent): Cue[] {
  switch (e.type) {
    case 'diceRolled':
      return e.total === 7 ? [['dice'], ['robber', AFTER_DICE]] : [['dice']];
    case 'produced':
      return Object.keys(e.gains ?? {}).length ? [['gain', AFTER_DICE]] : [];
    case 'built':
      return [['build']];
    case 'robberMoved':
      return [['robber']];
    case 'tradeCompleted':
    case 'bankTrade':
      return [['trade']];
    case 'devCardPlayed':
      return [['card']];
    case 'longestRoad':
    case 'largestArmy':
      return e.player ? [['card', 300]] : [];
    case 'turnStarted':
      return [['turn']];
    case 'gameWon':
      return [['win']];
    default:
      return [];
  }
}

export function playerCues(e: GameEvent, me: PlayerId): Cue[] {
  switch (e.type) {
    case 'turnStarted':
      return e.player === me ? [['turn']] : [];
    case 'diceRolled':
      return e.player === me ? [['dice']] : [];
    case 'produced':
      return e.gains?.[me] ? [['gain', AFTER_DICE]] : [];
    case 'setupResources':
      return e.player === me ? [['gain']] : [];
    case 'mustDiscard':
      return e.players?.[me] ? [['robber']] : [];
    case 'stole':
      return e.victim === me ? [['robber']] : e.thief === me ? [['gain']] : [];
    case 'monopoly':
      return e.player === me ? [['gain']] : [['robber']];
    case 'tradeCompleted':
      return e.from === me || e.to === me ? [['trade']] : [];
    case 'bankTrade':
      return e.player === me ? [['trade']] : [];
    case 'built':
      return e.player === me ? [['build']] : [];
    case 'devCardPlayed':
      return e.player === me ? [['card']] : [];
    case 'gameWon':
      return [['win']];
    default:
      return [];
  }
}

/**
 * Проигрывает звуки для новых событий лога. Уже бывшие при открытии страницы события
 * не озвучиваются. За раз — не больше 3 звуков (например, после переподключения).
 */
export function useLogSounds(log: LogEntry[] | undefined, cues: (e: GameEvent) => Cue[]): void {
  const lastSeq = useRef<number | null>(null);
  useEffect(() => {
    if (!log?.length) return;
    const maxSeq = Math.max(...log.map((e) => e.seq));
    if (lastSeq.current === null) {
      lastSeq.current = maxSeq;
      return;
    }
    const fresh = log.filter((e) => e.seq > lastSeq.current!);
    lastSeq.current = Math.max(lastSeq.current, maxSeq);
    const all = fresh.flatMap(cues).slice(0, 3);
    const seen = new Set<string>();
    for (const [name, delay] of all) {
      if (seen.has(name)) continue; // один и тот же звук дважды подряд не нужен
      seen.add(name);
      playSound(name, delay ?? 0);
    }
  }, [log, cues]);
}
