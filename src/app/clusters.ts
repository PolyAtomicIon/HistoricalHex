// Районы построек игрока: постройки, стоящие недалеко друг от друга, — один район.
// Нужно для фокуса: камера показывает районы по очереди, а не один общий кадр.

import type { PlayerId, PublicState, VertexId } from '../engine';
import { topologyFor } from '../engine';

export function playerClusters(pub: PublicState, id: PlayerId): VertexId[][] {
  const topo = topologyFor(pub.board.layout);
  const mine = Object.entries(pub.buildings)
    .filter(([, b]) => b.owner === id)
    .map(([v]) => v);
  // добавить концы дорог — так район включает и дорожную сеть
  const roadEnds = Object.entries(pub.roads)
    .filter(([, o]) => o === id)
    .flatMap(([e]) => topo.edges.get(e)?.vertices ?? []);
  const pts = [...new Set([...mine, ...roadEnds])]
    .map((v) => ({ v, p: topo.vertices.get(v) }))
    .filter((x): x is { v: string; p: NonNullable<typeof x.p> } => !!x.p);
  // Жадная кластеризация: точки ближе ~2 гексов (в радиусах гекса) — один район
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot((a.x - b.x) * 0.866, (a.y - b.y) * 0.5);
  const groups: { v: string; p: { x: number; y: number } }[][] = [];
  for (const pt of pts) {
    const g = groups.find((gr) => gr.some((q) => dist(q.p, pt.p) < 3.6));
    if (g) g.push(pt);
    else groups.push([pt]);
  }
  // Только районы с постройками; крупные — первыми
  return groups
    .map((g) => g.map((x) => x.v))
    .filter((g) => g.some((v) => mine.includes(v)))
    .sort((a, b) => b.length - a.length);
}
