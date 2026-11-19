// Доход с гексов: при броске кубиков и за второе поселение на расстановке.

import type { PlayerId, Resource, ResourceMap, VertexId } from '../types';
import { RESOURCES, TERRAIN_RESOURCE } from '../types';
import type { GameState } from '../state';
import type { GameEvent } from '../events';
import { topologyFor } from '../board/geometry';

/**
 * Раздача ресурсов за выпавшее число.
 * Нехватка в банке: если ресурса не хватает всем, никто его не получает;
 * если получатель один — он берёт сколько осталось.
 */
export function produce(s: GameState, total: number, events: GameEvent[]): void {
  const topo = topologyFor(s.board.layout);
  const demand = {} as Record<Resource, Record<PlayerId, number>>;
  for (const r of RESOURCES) demand[r] = {};

  for (const hex of s.board.hexes) {
    if (hex.number !== total || hex.id === s.robberHex || hex.terrain === 'desert') continue;
    const res = TERRAIN_RESOURCE[hex.terrain];
    for (const v of topo.hexes.get(hex.id)!.vertices) {
      const b = s.buildings[v];
      if (!b) continue;
      demand[res][b.owner] = (demand[res][b.owner] ?? 0) + (b.kind === 'city' ? 2 : 1);
    }
  }

  const gains: Record<PlayerId, Partial<ResourceMap>> = {};
  const shortages: Resource[] = [];
  const give = (pid: PlayerId, r: Resource, n: number) => {
    if (n <= 0) return;
    s.players[pid].resources[r] += n;
    s.bank[r] -= n;
    gains[pid] = gains[pid] ?? {};
    gains[pid][r] = (gains[pid][r] ?? 0) + n;
  };

  for (const r of RESOURCES) {
    const receivers = Object.entries(demand[r]);
    const need = receivers.reduce((sum, [, n]) => sum + n, 0);
    if (need === 0) continue;
    if (need <= s.bank[r]) {
      for (const [pid, n] of receivers) give(pid, r, n);
    } else {
      shortages.push(r);
      if (receivers.length === 1) give(receivers[0][0], r, s.bank[r]);
    }
  }

  events.push({ type: 'produced', total, gains, shortages });
}

/** За второе поселение на расстановке: по 1 ресурсу с каждого соседнего гекса. */
export function giveSetupResources(s: GameState, pid: PlayerId, v: VertexId, events: GameEvent[]): void {
  const topo = topologyFor(s.board.layout);
  const byId = new Map(s.board.hexes.map((h) => [h.id, h]));
  const gains: Partial<ResourceMap> = {};
  for (const hid of topo.vertices.get(v)!.hexes) {
    const hex = byId.get(hid)!;
    if (hex.terrain === 'desert') continue;
    const r = TERRAIN_RESOURCE[hex.terrain];
    if (s.bank[r] <= 0) continue;
    s.bank[r] -= 1;
    s.players[pid].resources[r] += 1;
    gains[r] = (gains[r] ?? 0) + 1;
  }
  events.push({ type: 'setupResources', player: pid, gains });
}
