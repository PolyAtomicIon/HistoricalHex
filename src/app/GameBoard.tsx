// Карта партии: WebGL (2D / 2.5D / 3D) с запасным SVG, если WebGL недоступен.

import { Component, Suspense, lazy, useState } from 'react';
import type { ReactNode } from 'react';
import type { PlayerColor, PlayerId, PublicState } from '../engine';
import type { BoardMode } from '../board3d/Board3D';
import { Board } from '../board/Board';
import type { GameFx } from './useGameFx';

const Board3D = lazy(() => import('../board3d/Board3D'));

const MODE_KEY = 'hh.boardMode';
export const MODE_LABEL: Record<BoardMode, string> = { '2d': '2D', '25d': '2.5D', '3d': '3D' };

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function useBoardMode(fallback: BoardMode = '25d'): [BoardMode, (m: BoardMode) => void] {
  const [mode, setMode] = useState<BoardMode>(() => {
    try {
      const v = localStorage.getItem(MODE_KEY) as BoardMode | null;
      return v === '2d' || v === '25d' || v === '3d' ? v : fallback;
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
  colors,
  mode,
  palette,
  highlight,
  onVertex,
  onEdge,
  onHex,
  selected,
  fx,
  ghosts,
}: {
  pub: PublicState;
  colors: Record<PlayerId, PlayerColor>;
  mode: BoardMode;
  palette: { sea: string; seaDeep: string; accent: string; light: string };
  highlight?: { vertices?: string[]; edges?: string[]; hexes?: string[] };
  onVertex?: (v: string) => void;
  onEdge?: (e: string) => void;
  onHex?: (h: string) => void;
  selected?: string;
  fx: GameFx;
  ghosts?: { vertex?: string; edge?: string; kind: 'road' | 'settlement' | 'city'; color: PlayerColor; broken?: boolean }[];
}) {
  const [gl] = useState(hasWebGL);
  const svg = (
    <div className="svg-board">
      <Board view={pub} colors={colors} highlight={highlight} onVertex={onVertex} onEdge={onEdge} onHex={onHex} selected={selected} recent={fx.recent} flash={fx.flash} />
    </div>
  );
  if (!gl) return svg;
  return (
    <Fallback fallback={svg}>
      <Suspense fallback={<div className="board-loading"><div className="spinner" /></div>}>
        <Board3D
          view={pub}
          colors={colors}
          highlight={highlight}
          onVertex={onVertex}
          onEdge={onEdge}
          onHex={onHex}
          selected={selected}
          recent={fx.recent}
          flash={fx.flash}
          mode={mode}
          palette={palette}
          focus={fx.focus}
          ghosts={ghosts}
          shake={fx.shake}
          lowPower={lowPower}
        />
      </Suspense>
    </Fallback>
  );
}
