// Карта партии: 2D (нарисованные тайлы, SVG — работает везде) или 3D (WebGL). Без WebGL и в лёгком режиме — 2D.

import { Component, Suspense, lazy, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { PlayerColor, PlayerId, PublicState } from '../engine';
import { longestRoadPath, topologyFor } from '../engine';
import { Board2D } from '../board2d/Board2D';
import type { GameFx } from './useGameFx';
import { useLite } from './lite';

const Board3D = lazy(() => import('../board3d/Board3D'));

const MODE_KEY = 'hh.boardMode';
export type BoardMode = '2d' | '3d';
export const MODE_LABEL: Record<BoardMode, string> = { '2d': '2D', '3d': '3D' };

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function useBoardMode(fallback: BoardMode = '2d'): [BoardMode, (m: BoardMode) => void] {
  const [mode, setMode] = useState<BoardMode>(() => {
    try {
      const v = localStorage.getItem(MODE_KEY) as BoardMode | null;
      return v === '2d' || v === '3d' ? v : fallback;
    } catch {
      return fallback;
    }
  });
  return [
    mode,
    (m) => {
      setMode(m);
      try {
        localStorage.setItem(MODE_KEY, m);
      } catch {
        /* ok */
      }
    },
  ];
}

class Fallback extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const lowPower = (() => {
  if (typeof navigator === 'undefined') return false;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory;
  return (mem !== undefined && mem <= 3) || (navigator.hardwareConcurrency ?? 8) <= 4;
})();

export function GameBoard({
  pub,
  era,
  colors,
  mode,
  palette,
  boardStatic,
  spotlight,
  highlight,
  onVertex,
  onEdge,
  onHex,
  selected,
  fx,
  ghosts,
  me,
  pin,
}: {
  /** Показать место на карте (шаг плана): камера летит туда, место подсвечивается. */
  pin?: { at: string; key: number } | null;
  pub: PublicState;
  /** Кто смотрит: его постройки помечаются («это твоё»). */
  me?: string;
  era: string;
  /** Без жестов (ТВ). */
  boardStatic?: boolean;
  colors: Record<PlayerId, PlayerColor>;
  mode: BoardMode;
  palette: { sea: string; seaDeep: string; accent: string; light: string };
  highlight?: { vertices?: string[]; edges?: string[]; hexes?: string[] };
  onVertex?: (v: string) => void;
  onEdge?: (e: string) => void;
  onHex?: (h: string) => void;
  selected?: string;
  fx: GameFx;
  /** Показать постройки игрока (тап по игроку). */
  spotlight?: { id: string; key: number; vertices?: string[] } | null;
  ghosts?: { vertex?: string; edge?: string; kind: 'road' | 'settlement' | 'city'; color: PlayerColor; broken?: boolean }[];
}) {
  const [gl] = useState(hasWebGL);
  const pinFocus = useMemo(() => {
    if (!pin) return undefined;
    const t = topologyFor(pub.board.layout);
    return t.vertices.has(pin.at) ? { vertex: pin.at, key: pin.key } : { edge: pin.at, key: pin.key };
  }, [pin, pub.board.layout]);
  const hl = useMemo(() => {
    if (!pin) return highlight;
    const t = topologyFor(pub.board.layout);
    const isV = t.vertices.has(pin.at);
    return { ...highlight, vertices: [...(highlight?.vertices ?? []), ...(isV ? [pin.at] : [])], edges: [...(highlight?.edges ?? []), ...(isV ? [] : [pin.at])] };
  }, [pin, highlight, pub.board.layout]);
  // «Самая длинная дорога»: её цепочка подсвечивается на карте
  const longest = useMemo(() => (pub.longestRoad ? longestRoadPath(pub, pub.longestRoad) : []), [pub]);
  // Для 3D: постройка игрока ближе всего к центру его построек — туда летит камера
  const spotFocus = (() => {
    if (!spotlight) return undefined;
    const own = (spotlight.vertices ?? []).filter((v) => pub.buildings[v]?.owner === spotlight.id);
    const mine = own.length ? own : Object.entries(pub.buildings).filter(([, b]) => b.owner === spotlight.id).map(([v]) => v);
    if (!mine.length) return undefined;
    return { vertex: mine[Math.floor(mine.length / 2)], key: spotlight.key };
  })();
  const { lite } = useLite();
  const svg = (
    <Board2D
      view={pub}
      era={era}
      colors={colors}
      highlight={hl}
      onVertex={onVertex}
      onEdge={onEdge}
      onHex={onHex}
      selected={selected}
      recent={fx.recent}
      flash={fx.flash}
      focus={pinFocus ?? fx.focus}
      ghosts={ghosts}
      shake={fx.shake}
      static={boardStatic}
      spotlight={spotlight?.id}
      spotKey={spotlight?.key}
      spotVertices={spotlight?.vertices}
      sail={fx.sail}
      me={me}
      longest={longest}
    />
  );
  if (!gl || lite || mode === '2d') return svg;
  return (
    <Fallback fallback={svg}>
      <Suspense fallback={<div className="board-loading"><div className="spinner" /></div>}>
        <Board3D
          view={pub}
          colors={colors}
          highlight={hl}
          onVertex={onVertex}
          onEdge={onEdge}
          onHex={onHex}
          selected={selected}
          recent={fx.recent}
          flash={fx.flash}
          mode="3d"
          palette={palette}
          focus={pinFocus ?? spotFocus ?? fx.focus}
          ghosts={ghosts}
          shake={fx.shake}
          lowPower={lowPower}
          era={era}
          sail={fx.sail}
          viewStatic={boardStatic}
          raid={fx.raid}
          me={me}
          longest={longest}
          spot={spotlight?.id}
        />
      </Suspense>
    </Fallback>
  );
}
