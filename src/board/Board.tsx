// Карта Хексленда в SVG. Общая для экрана хоста и экрана игрока.
// Пока всё нарисовано заглушками (цвета + значки); арт подставим на Этапе 6.

import { useId, useMemo } from 'react';
import type { EdgeId, HexId, PlayerColor, PlayerId, PublicState, VertexId } from '../engine';
import { HEX_CORNERS, topologyFor } from '../engine';
import type { HarborType, Terrain } from '../engine';
import { PLAYER_HEX, PLAYER_STROKE, TERRAIN_FILL, TERRAIN_ICON, harborIcon } from '../ui/theme';
import { art } from '../ui/art';
import './board.css';

/** Радиус гекса в единицах SVG. */
const S = 100;
const SQ3 = Math.sqrt(3);

const px = (x: number, y: number) => ({ x: (x * SQ3 * S) / 2, y: (y * S) / 2 });

const TERRAINS: Terrain[] = ['forest', 'hills', 'pasture', 'fields', 'mountains', 'desert'];
const tileArt = (t: Terrain | 'sea') => art(`tile-${t}`);
const harborArt = (t: HarborType) => art(t === 'any' ? 'harbor-any' : `res-${t}`);
const robberArt = art('robber');

function hexPoints(cx: number, cy: number): string {
  return HEX_CORNERS.map(([dx, dy]) => {
    const p = px(cx + dx, cy + dy);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');
}

export type BoardView = Pick<PublicState, 'board' | 'buildings' | 'roads' | 'robberHex'>;

export interface BoardProps {
  view: BoardView;
  colors: Record<PlayerId, PlayerColor>;
  highlight?: { vertices?: VertexId[]; edges?: EdgeId[]; hexes?: HexId[] };
  onVertex?: (v: VertexId) => void;
  onEdge?: (e: EdgeId) => void;
  onHex?: (h: HexId) => void;
  /** Что подсветить как «только что построено» (вершина или ребро). */
  recent?: string[];
  /** Выбранное игроком место (ждёт подтверждения). */
  selected?: string;
  /** Вспышка гексов (доход при броске); key меняется — вспышка повторяется. */
  flash?: { hexes: HexId[]; key: number };
  className?: string;
}

export function Board({ view, colors, highlight, onVertex, onEdge, onHex, recent = [], selected, flash, className }: BoardProps) {
  const topo = topologyFor(view.board.layout);
  // Свои id узоров у каждой карты: на странице их может быть две (экран игрока + общая карта)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const pat = (t: string) => `hx-${uid}-${t}`;

  const geo = useMemo(() => {
    const vertexPos = new Map<VertexId, { x: number; y: number }>();
    for (const v of topo.vertices.values()) vertexPos.set(v.id, px(v.x, v.y));
    const hexPos = new Map<HexId, { x: number; y: number }>();
    for (const h of topo.hexes.values()) hexPos.set(h.id, px(h.x, h.y));

    const sea = topo.sea.map((c) => ({ key: `${c.q}_${c.r}`, x: 2 * c.q + c.r, y: 3 * c.r }));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const h of sea) {
      for (const [dx, dy] of HEX_CORNERS) {
        const p = px(h.x + dx, h.y + dy);
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    const pad = 10;
    const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`;
    return { vertexPos, hexPos, sea, viewBox };
  }, [topo]);

  const recentSet = new Set(recent);
  const hl = {
    vertices: new Set(highlight?.vertices ?? []),
    edges: new Set(highlight?.edges ?? []),
    hexes: new Set(highlight?.hexes ?? []),
  };

  return (
    <svg className={`board ${className ?? ''}`} viewBox={geo.viewBox} role="img" aria-label="Карта острова">
      {/* Картинки местности: квадрат натягивается на гекс (лишнее по бокам обрезается) */}
      <defs>
        {[...TERRAINS, 'sea' as const].map((t) => {
          const url = tileArt(t);
          return url ? (
            <pattern key={t} id={pat(t)} patternContentUnits="objectBoundingBox" width="1" height="1">
              <image href={url} width="1" height="1" preserveAspectRatio="xMidYMid slice" />
            </pattern>
          ) : null;
        })}
      </defs>

      {/* Море */}
      <g className="sea">
        {geo.sea.map((h) => (
          <polygon key={h.key} points={hexPoints(h.x, h.y)} style={tileArt('sea') ? { fill: `url(#${pat('sea')})` } : undefined} />
        ))}
      </g>

      {/* Гавани: причалы + значок */}
      <g className="harbors">
        {view.board.harbors.map((h) => {
          const edge = topo.edges.get(h.edge);
          if (!edge) return null;
          const a = geo.vertexPos.get(edge.vertices[0])!;
          const b = geo.vertexPos.get(edge.vertices[1])!;
          const c = geo.hexPos.get(edge.hexes[0])!;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const len = Math.hypot(mx - c.x, my - c.y);
          const ox = mx + ((mx - c.x) / len) * S * 0.55;
          const oy = my + ((my - c.y) / len) * S * 0.55;
          return (
            <g key={h.edge} className="harbor">
              <line x1={a.x} y1={a.y} x2={ox} y2={oy} />
              <line x1={b.x} y1={b.y} x2={ox} y2={oy} />
              <circle cx={ox} cy={oy} r={S * 0.3} />
              {harborArt(h.type) ? (
                <image
                  href={harborArt(h.type)}
                  x={ox - S * 0.17}
                  y={oy - S * 0.24}
                  width={S * 0.34}
                  height={S * 0.34}
                />
              ) : (
                <text x={ox} y={oy - S * 0.04} className="harbor-icon">
                  {harborIcon(h.type)}
                </text>
              )}
              <text x={ox} y={oy + S * 0.19} className="harbor-ratio">
                {h.type === 'any' ? '3:1' : '2:1'}
              </text>
            </g>
          );
        })}
      </g>

      {/* Суша */}
      <g className="land">
        {view.board.hexes.map((h) => {
          const t = topo.hexes.get(h.id)!;
          const c = geo.hexPos.get(h.id)!;
          const red = h.number === 6 || h.number === 8;
          const pips = h.number ? 6 - Math.abs(7 - h.number) : 0;
          return (
            <g key={h.id} className={`hex terrain-${h.terrain}`} data-hex={h.id}>
              <polygon
                points={hexPoints(t.x, t.y)}
                fill={tileArt(h.terrain) ? `url(#${pat(h.terrain)})` : TERRAIN_FILL[h.terrain]}
              />
              {flash?.hexes.includes(h.id) && (
                <polygon key={`flash-${flash.key}`} points={hexPoints(t.x, t.y)} className="hex-flash" />
              )}
              {h.number === undefined ? (
                !tileArt(h.terrain) && (
                  <text x={c.x} y={c.y} className="terrain-icon big">
                    {TERRAIN_ICON[h.terrain]}
                  </text>
                )
              ) : (
                <>
                  {!tileArt(h.terrain) && (
                    <text x={c.x} y={c.y - S * 0.52} className="terrain-icon">
                      {TERRAIN_ICON[h.terrain]}
                    </text>
                  )}
                  <g className={`token ${red ? 'red' : ''}`}>
                    <circle cx={c.x} cy={c.y} r={S * 0.3} />
                    <text x={c.x} y={c.y - S * 0.03} className="token-number">
                      {h.number}
                    </text>
                    {Array.from({ length: pips }, (_, i) => (
                      <circle
                        key={i}
                        className="pip"
                        cx={c.x + (i - (pips - 1) / 2) * S * 0.075}
                        cy={c.y + S * 0.17}
                        r={S * 0.025}
                      />
                    ))}
                  </g>
                </>
              )}
            </g>
          );
        })}
      </g>

      {/* Подсветка гексов (для разбойника) */}
      <g className="hex-targets">
        {[...hl.hexes].map((id) => {
          const t = topo.hexes.get(id);
          if (!t) return null;
          return (
            <polygon
              key={id}
              points={hexPoints(t.x, t.y)}
              className={`hex-target ${id === selected ? 'selected' : ''}`}
              onClick={onHex ? () => onHex(id) : undefined}
            />
          );
        })}
      </g>

      {/* Дороги */}
      <g className="roads">
        {Object.entries(view.roads).map(([eid, owner]) => {
          const edge = topo.edges.get(eid);
          const color = colors[owner];
          if (!edge || !color) return null;
          const [a, b] = edge.vertices.map((v) => geo.vertexPos.get(v)!);
          const k = 0.16;
          const x1 = a.x + (b.x - a.x) * k;
          const y1 = a.y + (b.y - a.y) * k;
          const x2 = b.x + (a.x - b.x) * k;
          const y2 = b.y + (a.y - b.y) * k;
          return (
            <g key={eid} className={`road ${recentSet.has(eid) ? 'recent' : ''}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={PLAYER_STROKE[color]} strokeWidth={S * 0.17} pathLength={1} />
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={PLAYER_HEX[color]} strokeWidth={S * 0.11} pathLength={1} />
            </g>
          );
        })}
      </g>

      {/* Поселения и города */}
      <g className="buildings">
        {Object.entries(view.buildings).map(([vid, b]) => {
          const p = geo.vertexPos.get(vid);
          const color = colors[b.owner];
          if (!p || !color) return null;
          return (
            <g
              key={vid}
              transform={`translate(${p.x} ${p.y}) scale(${S})`}
              className={`building ${b.kind} ${recentSet.has(vid) ? 'recent' : ''}`}
            >
              <g className="drop">
                <path
                  d={b.kind === 'city' ? CITY_PATH : SETTLEMENT_PATH}
                  fill={PLAYER_HEX[color]}
                  stroke={PLAYER_STROKE[color]}
                  strokeWidth={0.035}
                  strokeLinejoin="round"
                />
              </g>
            </g>
          );
        })}
      </g>

      {/* Разбойник */}
      {(() => {
        const c = geo.hexPos.get(view.robberHex);
        if (!c) return null;
        // Разбойник «шагает» на новый гекс: плавный переход transform
        return (
          <g className="robber-move" style={{ transform: `translate(${c.x}px, ${c.y}px)` }}>
            {robberArt ? (
              <image
                className="robber robber-img"
                href={robberArt}
                x={-S * 0.78}
                y={-S * 0.42}
                width={S * 0.56}
                height={S * 0.56}
              />
            ) : (
              <g className="robber" transform={`translate(${-S * 0.5} ${S * 0.08}) scale(${S})`}>
                <ellipse cx={0} cy={0.24} rx={0.17} ry={0.05} className="robber-shadow" />
                <path d="M -0.13 0.24 Q -0.15 -0.02 -0.07 -0.08 L 0.07 -0.08 Q 0.15 -0.02 0.13 0.24 Z" />
                <circle cx={0} cy={-0.16} r={0.1} />
              </g>
            )}
          </g>
        );
      })()}

      {/* Доступные места (для телефона) */}
      <g className="edge-targets">
        {[...hl.edges].map((id) => {
          const edge = topo.edges.get(id);
          if (!edge) return null;
          const [a, b] = edge.vertices.map((v) => geo.vertexPos.get(v)!);
          return (
            <line
              key={id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={`edge-target ${id === selected ? 'selected' : ''}`}
              onClick={onEdge ? () => onEdge(id) : undefined}
            />
          );
        })}
      </g>
      <g className="vertex-targets">
        {[...hl.vertices].map((id) => {
          const p = geo.vertexPos.get(id);
          if (!p) return null;
          return (
            <circle
              key={id}
              cx={p.x}
              cy={p.y}
              r={S * (id === selected ? 0.22 : 0.17)}
              className={`vertex-target ${id === selected ? 'selected' : ''}`}
              onClick={onVertex ? () => onVertex(id) : undefined}
            />
          );
        })}
      </g>
    </svg>
  );
}

const SETTLEMENT_PATH = 'M -0.17 0.15 L -0.17 -0.04 L 0 -0.2 L 0.17 -0.04 L 0.17 0.15 Z';
const CITY_PATH = 'M -0.27 0.17 L -0.27 -0.03 L -0.09 -0.03 L -0.09 -0.17 L 0.05 -0.3 L 0.19 -0.17 L 0.19 0.17 Z';
