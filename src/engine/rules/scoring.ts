// Очки, «Самая длинная дорога», «Самая большая армия», победа.

import type { EdgeId, PlayerId, VertexId } from '../types';
import type { GameState } from '../state';
import { currentPlayerId } from '../state';
import type { GameEvent } from '../events';
import { LARGEST_ARMY_MIN, LONGEST_ROAD_MIN } from '../constants';
import { topologyFor } from '../board/geometry';
import type { BoardView } from './placement';

/**
 * Длина самой длинной непрерывной дороги игрока (ответвления не считаются).
 * Чужое поселение/город на перекрёстке разрывает дорогу: через него пройти нельзя,
 * но дорога может на нём начинаться или заканчиваться.
 */
export function longestRoadLength(s: BoardView, pid: PlayerId): number {
  const topo = topologyFor(s.board.layout);
  const adj = new Map<VertexId, EdgeId[]>();
  for (const [e, owner] of Object.entries(s.roads)) {
    if (owner !== pid) continue;
    for (const v of topo.edges.get(e)!.vertices) {
      const list = adj.get(v) ?? [];
      list.push(e);
      adj.set(v, list);
    }
  }
  const blocked = (v: VertexId) => {
    const b = s.buildings[v];
    return !!b && b.owner !== pid;
  };
  const used = new Set<EdgeId>();
  const dfs = (v: VertexId): number => {
    if (used.size > 0 && blocked(v)) return 0;
    let best = 0;
    for (const e of adj.get(v) ?? []) {
      if (used.has(e)) continue;
      used.add(e);
      const [a, b] = topo.edges.get(e)!.vertices;
      best = Math.max(best, 1 + dfs(a === v ? b : a));
      used.delete(e);
    }
    return best;
  };
  let max = 0;
  for (const v of adj.keys()) max = Math.max(max, dfs(v));
  return max;
}

/**
 * Сама цепочка самой длинной дороги игрока (рёбра по порядку) — для подсветки на карте.
 * Та же логика, что в longestRoadLength: чужая постройка рвёт путь, своя — нет.
 * Длина результата всегда равна longestRoadLength(s, pid).
 */
export function longestRoadPath(s: BoardView, pid: PlayerId): EdgeId[] {
  const topo = topologyFor(s.board.layout);
  const adj = new Map<VertexId, EdgeId[]>();
  for (const [e, owner] of Object.entries(s.roads)) {
    if (owner !== pid) continue;
    for (const v of topo.edges.get(e)!.vertices) {
      const list = adj.get(v) ?? [];
      list.push(e);
      adj.set(v, list);
    }
  }
  const blocked = (v: VertexId) => {
    const b = s.buildings[v];
    return !!b && b.owner !== pid;
  };
  const used = new Set<EdgeId>();
  const path: EdgeId[] = [];
  let best: EdgeId[] = [];
  const dfs = (v: VertexId) => {
    if (path.length > best.length) best = [...path];
    if (path.length > 0 && blocked(v)) return;
    for (const e of adj.get(v) ?? []) {
      if (used.has(e)) continue;
      used.add(e);
      path.push(e);
      const [a, b] = topo.edges.get(e)!.vertices;
      dfs(a === v ? b : a);
      path.pop();
      used.delete(e);
    }
  };
  for (const v of adj.keys()) dfs(v);
  return best;
}

/**
 * Пересчёт владельца «Самой длинной дороги» после постройки дороги или поселения.
 * - Владелец сохраняет карту при ничьей.
 * - Если дорогу владельца разорвали и он больше не лидер: карта уходит единственному лидеру,
 *   а при ничьей между несколькими (или если ни у кого нет 5+) — откладывается.
 */
export function updateLongestRoad(s: GameState, events: GameEvent[]): void {
  const lengths = Object.fromEntries(s.order.map((p) => [p, longestRoadLength(s, p)]));
  const max = Math.max(...Object.values(lengths));
  const holder = s.longestRoad;
  let next: PlayerId | undefined;
  if (holder && lengths[holder] >= LONGEST_ROAD_MIN && lengths[holder] === max) {
    next = holder;
  } else {
    const leaders = s.order.filter((p) => lengths[p] === max);
    next = max >= LONGEST_ROAD_MIN && leaders.length === 1 ? leaders[0] : undefined;
  }
  if (next !== holder) {
    if (next) s.longestRoad = next;
    else delete s.longestRoad;
    events.push({ type: 'longestRoad', player: next, length: next ? lengths[next] : max });
  }
}

/** После сыгранного рыцаря: карта армии переходит, если рыцарей строго больше, чем у владельца. */
export function updateLargestArmy(s: GameState, pid: PlayerId, events: GameEvent[]): void {
  const knights = s.players[pid].knightsPlayed;
  const holder = s.largestArmy;
  if (holder === pid || knights < LARGEST_ARMY_MIN) return;
  if (!holder || knights > s.players[holder].knightsPlayed) {
    s.largestArmy = pid;
    events.push({ type: 'largestArmy', player: pid, knights });
  }
}

/** Видимые всем очки (без скрытых карт «Победное очко»). */
export function publicVictoryPoints(s: Pick<GameState, 'buildings' | 'longestRoad' | 'largestArmy'>, pid: PlayerId): number {
  let vp = 0;
  for (const b of Object.values(s.buildings)) {
    if (b.owner === pid) vp += b.kind === 'city' ? 2 : 1;
  }
  if (s.longestRoad === pid) vp += 2;
  if (s.largestArmy === pid) vp += 2;
  return vp;
}

export function hiddenVictoryPoints(s: GameState, pid: PlayerId): number {
  return s.players[pid].devCards.filter((c) => c.type === 'victoryPoint').length;
}

export function victoryPoints(s: GameState, pid: PlayerId): number {
  return publicVictoryPoints(s, pid) + hiddenVictoryPoints(s, pid);
}

/** Победить можно только в свой ход: проверяем текущего игрока. */
export function checkWinner(s: GameState, events: GameEvent[]): void {
  if (s.phase === 'setup' || s.phase === 'finished') return;
  const pid = currentPlayerId(s);
  const points = victoryPoints(s, pid);
  if (points >= s.settings.vpToWin) {
    s.phase = 'finished';
    s.winner = pid;
    s.trades = [];
    delete s.trade;
    events.push({ type: 'gameWon', player: pid, points });
  }
}
