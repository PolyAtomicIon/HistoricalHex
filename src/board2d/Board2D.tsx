// 2D-карта: нарисованные тайлы эпохи (Codex), деревянные жетоны, фишки с контуром,
// жесты (перетаскивание, щипок, колесо), анимации дохода и построек.
// Работает и на старых телефонах (SVG, без WebGL); в лёгком режиме анимации проще.

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { EdgeId, HarborType, HexId, PlayerColor, PlayerId, PublicState, Terrain, VertexId } from '../engine';
import { HEX_CORNERS, TERRAIN_RESOURCE, topologyFor } from '../engine';
import { PLAYER_HEX, PLAYER_STROKE } from '../ui/theme';
import { eraIcon } from '../app/era';
import { usePanZoom } from './usePanZoom';
import { boardLocator } from '../fx/util';
import './board2d.css';

const S = 100;
const SQ3 = Math.sqrt(3);
const px = (x: number, y: number) => ({ x: (x * SQ3 * S) / 2, y: (y * S) / 2 });
const HEX_PTS = HEX_CORNERS.map(([dx, dy]) => px(dx, dy));
const hexPath = (k = 1) => HEX_PTS.map((p) => `${(p.x * k).toFixed(1)},${(p.y * k).toFixed(1)}`).join(' ');

const BASE_FILL: Record<Terrain, string> = {
  forest: '#2f5f2c',
  hills: '#b65a32',
  pasture: '#9ccf5e',
  fields: '#e0b84a',
  mountains: '#7d8594',
  desert: '#d9c08a',
};

export type BoardView = Pick<PublicState, 'board' | 'buildings' | 'roads' | 'robberHex'>;

export interface Ghost {
  vertex?: string;
  edge?: string;
  kind: 'road' | 'settlement' | 'city';
  color: PlayerColor;
  broken?: boolean;
}

export interface Board2DProps {
  view: BoardView;
  era: string;
  colors: Record<PlayerId, PlayerColor>;
  /** Игрок-зритель: его постройки с кольцом «это твоё». */
  me?: PlayerId;
  /** Рёбра «Самой длинной дороги» — подсветка магистрали. */
  longest?: string[];
  highlight?: { vertices?: VertexId[]; edges?: EdgeId[]; hexes?: HexId[] };
  onVertex?: (v: VertexId) => void;
  onEdge?: (e: EdgeId) => void;
  onHex?: (h: HexId) => void;
  recent?: string[];
  selected?: string;
  flash?: { hexes: HexId[]; key: number };
  /** Идёт атака на гекс — остальные гексы уходят в серое. */
  attack?: { hex?: HexId; key: number };
  focus?: { hex?: string; vertex?: string; edge?: string; key: number };
  ghosts?: Ghost[];
  shake?: number;
  /** Без жестов (например, ТВ). */
  static?: boolean;
  /** Обмен через гавань — кораблик уходит в рейс. */
  sail?: { type: HarborType; key: number };
  /** Подсветить постройки этого игрока, остальные приглушить. */
  spotlight?: string;
  /** Смена района фокуса. */
  spotKey?: number;
  /** Вершины текущего района — к ним приближаем. */
  spotVertices?: string[];
  className?: string;
}

export function Board2D(props: Board2DProps) {
  const { view, era, colors, highlight, onVertex, onEdge, onHex, recent = [], selected, flash, focus, ghosts = [], shake = 0 } = props;
  const [atk, setAtk] = useState<HexId | null>(null);
  useEffect(() => {
    if (!props.attack?.hex) return;
    setAtk(props.attack.hex);
    const t = setTimeout(() => setAtk(null), 5200);
    return () => clearTimeout(t);
  }, [props.attack?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const topo = topologyFor(view.board.layout);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (s: string) => `b2-${uid}-${s}`;
  // Поворот карты свайпом влево-вправо (шаг 60° — сетка гексов совпадает сама с собой)
  const [rot, setRot] = useState(0);
  const pz = usePanZoom(!props.static, (d) => setRot((r) => r + d * 60));
  const tiles = useImages(TERRAINS.map((t) => eraIcon(era, `tile-${t}`)));
  const unit = useImages([eraIcon(era, 'camp'), eraIcon(era, 'robber-unit')]);
  const shipSrc = `${import.meta.env.BASE_URL}eras/ship.webp`;
  const ship = useImages([shipSrc]).has(shipSrc);
  // На захваченном гексе — лагерь эпохи (шатёр); самолёты/всадники только в анимации налёта
  const robbedHex = view.board.hexes.find((h) => h.id === view.robberHex);
  // На старте захватчики стоят на пустыне (дохода там нет) — лагерь и «захват» не рисуем, пока не было удара
  const idleRobber = !robbedHex || robbedHex.terrain === 'desert';
  const robberSrc = unit.has(eraIcon(era, 'camp')) ? eraIcon(era, 'camp') : unit.has(eraIcon(era, 'robber-unit')) ? eraIcon(era, 'robber-unit') : eraIcon(era, 'robber');

  const geo = useMemo(() => {
    const vertexPos = new Map<VertexId, { x: number; y: number }>();
    for (const v of topo.vertices.values()) vertexPos.set(v.id, px(v.x, v.y));
    const hexPos = new Map<HexId, { x: number; y: number }>();
    for (const h of topo.hexes.values()) hexPos.set(h.id, px(h.x, h.y));
    // Точки контура; рамка считается по всем шести поворотам (карту можно крутить свайпом по 60°)
    const pts: { x: number; y: number }[] = [];
    const grow = (x: number, y: number) => void pts.push({ x, y });
    for (const c of hexPos.values()) for (const p of HEX_PTS) grow(c.x + p.x, c.y + p.y);
    const harbors = view.board.harbors.flatMap((h) => {
      const edge = topo.edges.get(h.edge);
      if (!edge) return [];
      const a = vertexPos.get(edge.vertices[0])!;
      const b = vertexPos.get(edge.vertices[1])!;
      const c = hexPos.get(edge.hexes[0])!;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const len = Math.hypot(mx - c.x, my - c.y);
      const ox = mx + ((mx - c.x) / len) * S * 0.6;
      const oy = my + ((my - c.y) / len) * S * 0.6;
      grow(ox - S * 0.4, oy - S * 0.4);
      grow(ox + S * 0.4, oy + S * 0.4);
      return [{ ...h, a, b, ox, oy }];
    });
    const pad = 14;
    let cx = 0, cy = 0;
    for (const c of hexPos.values()) { cx += c.x; cy += c.y; }
    cx /= Math.max(1, hexPos.size);
    cy /= Math.max(1, hexPos.size);
    // Рамка для каждого из шести поворотов: при повороте viewBox плавно подстраивается
    const boxes = Array.from({ length: 6 }, (_, k) => {
      const a = (k * Math.PI) / 3;
      const co = Math.cos(a), si = Math.sin(a);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of pts) {
        const x = cx + (p.x - cx) * co - (p.y - cy) * si;
        const y = cy + (p.x - cx) * si + (p.y - cy) * co;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y);
        x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      return [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad];
    });
    return { vertexPos, hexPos, harbors, cx, cy, boxes };
  }, [topo, view.board.harbors]);

  // viewBox следует за поворотом: рамка под текущий угол, переход синхронно с CSS-поворотом (600 мс)
  const svgRef = useRef<SVGSVGElement>(null);
  const kRot = (((rot / 60) % 6) + 6) % 6;
  const vb = useRef(geo.boxes[kRot]);
  useEffect(() => {
    const from = vb.current;
    const to = geo.boxes[kRot];
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 600);
      const e = 1 - Math.pow(1 - k, 5); // ≈ cubic-bezier(0.22, 1, 0.36, 1) у .b2d-rot
      vb.current = from.map((v, i) => v + (to[i] - v) * e);
      svgRef.current?.setAttribute('viewBox', vb.current.join(' '));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [kRot, geo]);

  const recentSet = new Set(recent);
  const longestSet = new Set(props.longest ?? []);
  const hl = {
    vertices: highlight?.vertices ?? [],
    edges: highlight?.edges ?? [],
    hexes: highlight?.hexes ?? [],
  };

  // Тряска (семёрка, атака)
  const [shaking, setShaking] = useState(0);
  const firstShake = useRef(shake);
  useEffect(() => {
    if (shake === firstShake.current) return;
    setShaking((k) => k + 1);
  }, [shake]);

  const focusPos = focus
    ? focus.vertex
      ? geo.vertexPos.get(focus.vertex)
      : focus.hex
        ? geo.hexPos.get(focus.hex)
        : focus.edge
          ? (() => {
              const e = topo.edges.get(focus.edge!);
              if (!e) return undefined;
              const [a, b] = e.vertices.map((v) => geo.vertexPos.get(v)!);
              return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            })()
          : undefined
    : undefined;

  const edgeLine = (eid: string, k = 0.15) => {
    const e = topo.edges.get(eid);
    if (!e) return null;
    const [a, b] = e.vertices.map((v) => geo.vertexPos.get(v)!);
    return { x1: a.x + (b.x - a.x) * k, y1: a.y + (b.y - a.y) * k, x2: b.x + (a.x - b.x) * k, y2: b.y + (a.y - b.y) * k };
  };

  const interactive = hl.vertices.length + hl.edges.length + hl.hexes.length > 0;

  // Автозум к месту, где можно ставить (например, дорога — рядом со своими постройками)
  const hlKey = [...hl.vertices, ...hl.edges].join(',');
  const autoZoomed = useRef(false);
  useEffect(() => {
    if (props.static) return;
    const el = pz.ref.current;
    if (!el) return;
    if (!hlKey) {
      if (autoZoomed.current) pz.reset();
      autoZoomed.current = false;
      return;
    }
    const box = el.getBoundingClientRect();
    let r: { left: number; top: number; right: number; bottom: number } | undefined;
    el.querySelectorAll('.vertex-target .vis, .edge-target .vis').forEach((n) => {
      const b = n.getBoundingClientRect();
      const q = { left: b.left - box.left, top: b.top - box.top, right: b.right - box.left, bottom: b.bottom - box.top };
      r = r ? { left: Math.min(r.left, q.left), top: Math.min(r.top, q.top), right: Math.max(r.right, q.right), bottom: Math.max(r.bottom, q.bottom) } : q;
    });
    if (r) {
      pz.fitTo(r, 1.9);
      autoZoomed.current = true;
    }
  }, [hlKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Фокус на игроке: приблизить к его постройкам, через 4 с вернуть общий вид
  useEffect(() => {
    if (props.static) return;
    const el = pz.ref.current;
    if (!el) return;
    if (!props.spotlight) {
      pz.reset();
      return;
    }
    const box = el.getBoundingClientRect();
    let r: { left: number; top: number; right: number; bottom: number } | undefined;
    const sel = props.spotVertices?.length ? props.spotVertices.map((v) => `[data-v="${v}"]`).join(',') : '.piece.lit';
    el.querySelectorAll(sel).forEach((n) => {
      const b = n.getBoundingClientRect();
      const q = { left: b.left - box.left, top: b.top - box.top, right: b.right - box.left, bottom: b.bottom - box.top };
      r = r ? { left: Math.min(r.left, q.left), top: Math.min(r.top, q.top), right: Math.max(r.right, q.right), bottom: Math.max(r.bottom, q.bottom) } : q;
    });
    if (r) {
      // небольшой район — приблизить сильнее, но не больше 2.2
      const pad = 40;
      pz.fitTo({ left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad }, 2.2);
    }
  }, [props.spotlight, props.spotKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Для кино-атаки: где на экране центр гекса
  useEffect(() => {
    const fn = (hex: string) => {
      const c = geo.hexPos.get(hex);
      const svg = pz.ref.current?.querySelector<SVGSVGElement>('svg.b2d-svg');
      const m = (svg?.querySelector<SVGGElement>('.b2d-rot') ?? svg)?.getScreenCTM();
      if (!c || !svg || !m) return null;
      const pt = new DOMPoint(c.x, c.y).matrixTransform(m);
      return { x: pt.x, y: pt.y };
    };
    boardLocator.fn = fn;
    return () => {
      if (boardLocator.fn === fn) boardLocator.fn = null;
    };
  }, [geo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Тап мимо цели — берём ближайшую в радиусе 36 px (пальцу не нужно попадать точно)
  const onSnap = (e: React.MouseEvent) => {
    if (!interactive) return;
    const tgt = e.target as Element;
    if (tgt.closest('.vertex-target, .edge-target, .hex-target')) return;
    let best: { el: Element; d: number } | undefined;
    pz.ref.current?.querySelectorAll('.vertex-target .vis, .edge-target .vis').forEach((n) => {
      const b = n.getBoundingClientRect();
      const d = Math.hypot(b.left + b.width / 2 - e.clientX, b.top + b.height / 2 - e.clientY);
      if (!best || d < best.d) best = { el: n.parentElement!, d };
    });
    if (best && best.d < 36) best.el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };

  return (
    <div className={`b2d ${props.className ?? ''} ${interactive ? 'picking' : ''} ${props.spotlight ? 'spot' : ''}`} ref={pz.ref} {...pz.handlers} onClick={onSnap}>
      <div className="b2d-sea" aria-hidden />
      <div className="b2d-inner" ref={pz.inner}>
        <svg key={`s${shaking}`} ref={svgRef} className={`b2d-svg ${shaking ? 'shake' : ''}`} viewBox={vb.current.join(' ')} role="img" aria-label="Карта острова">
          <defs>
            <clipPath id={id('hex')}>
              <polygon points={hexPath(0.965)} />
            </clipPath>
            <radialGradient id={id('bevel')} cx="50%" cy="45%" r="60%">
              <stop offset="62%" stopColor="#000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.38" />
            </radialGradient>
            <radialGradient id={id('token')} cx="40%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#fffaf0" />
              <stop offset="100%" stopColor="#e6cf9f" />
            </radialGradient>
            <pattern id={id('hatch')} patternUnits="userSpaceOnUse" width="16" height="16" patternTransform="rotate(45)">
              <rect width="6" height="16" fill="rgba(20, 0, 0, 0.32)" />
            </pattern>
            <radialGradient id={id('smoke')} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--smoke, #3a3a3e)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="var(--smoke, #3a3a3e)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={id('halo')} cx="50%" cy="50%" r="50%">
              <stop offset="55%" stopColor="#ff3b2f" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#ff3b2f" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={id('fire')} cx="50%" cy="60%" r="50%">
              <stop offset="0%" stopColor="#fff3b0" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#ff8a1f" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#c21d0e" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={id('shade')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
              <stop offset="45%" stopColor="#fff" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
            </linearGradient>
          </defs>
          <RotCtx.Provider value={rot}>
          <g className="b2d-rot" style={{ transform: `rotate(${rot}deg)`, transformOrigin: `${geo.cx}px ${geo.cy}px` }}>

          {/* Берег: песок и пена под тайлами */}
          <g className="b2d-coast">
            {view.board.hexes.map((h) => {
              const c = geo.hexPos.get(h.id)!;
              return <polygon key={`f${h.id}`} className="foam" points={hexPath(1.16)} transform={`translate(${c.x} ${c.y})`} />;
            })}
            {view.board.hexes.map((h) => {
              const c = geo.hexPos.get(h.id)!;
              return <polygon key={`s${h.id}`} className="sand" points={hexPath(1.06)} transform={`translate(${c.x} ${c.y})`} />;
            })}
          </g>

          {/* Гавани */}
          <g className="b2d-harbors">
            {geo.harbors.map((h) => (
              <Harbor key={h.edge} h={h} era={era} ship={ship ? shipSrc : undefined} sailKey={props.sail && props.sail.type === h.type ? props.sail.key : undefined} />
            ))}
          </g>

          {/* Тайлы */}
          <g className={`b2d-tiles ${atk ? 'attack' : ''}`}>
            {view.board.hexes.map((h, i) => {
              const c = geo.hexPos.get(h.id)!;
              const mirror = (i * 7) % 3 === 1;
              const robbed = h.id === view.robberHex && !idleRobber;
              return (
                <g key={h.id} transform={`translate(${c.x} ${c.y})`} className={`tile t-${h.terrain} ${robbed ? 'robbed' : ''} ${h.id === atk ? 'atk' : ''}`}>
                  <g clipPath={`url(#${id('hex')})`}>
                    <rect x={-S} y={-S} width={2 * S} height={2 * S} fill={BASE_FILL[h.terrain]} />
                    {tiles.has(eraIcon(era, `tile-${h.terrain}`)) && (
                      <image
                        href={eraIcon(era, `tile-${h.terrain}`)}
                        x={-S}
                        y={-S}
                        width={2 * S}
                        height={2 * S}
                        preserveAspectRatio="xMidYMid slice"
                        transform={mirror ? 'scale(-1 1)' : undefined}
                      />
                    )}
                    {/* Единый цвет местности поверх рисунка эпохи: лес всегда тёмно-зелёный, глина — кирпичная и т.д. */}
                    <rect className="tile-tint" x={-S} y={-S} width={2 * S} height={2 * S} fill={BASE_FILL[h.terrain]} />
                    <polygon points={hexPath(0.965)} fill={`url(#${id('bevel')})`} />
                  </g>
                  <polygon className="tile-edge" points={hexPath(0.955)} />
                  {/* Какой ресурс даёт гекс — значок над жетоном, одинаковый во всех эпохах */}
                  {h.terrain !== 'desert' && (
                    <g className="tile-res" transform={`translate(0 ${-S * 0.585})`}>
                      <circle r={S * 0.25} className="tr-disk" style={{ ['--tc' as string]: BASE_FILL[h.terrain] }} />
                      <image href={eraIcon(era, `res-${TERRAIN_RESOURCE[h.terrain]}`)} x={-S * 0.21} y={-S * 0.21} width={S * 0.42} height={S * 0.42} />
                    </g>
                  )}
                  {robbed && (
                    <g className="raid-zone-base">
                      <polygon className="tile-dim" points={hexPath(0.965)} />
                      <polygon points={hexPath(0.74)} fill={`url(#${id('hatch')})`} />
                      <polygon className="rz-glow" points={hexPath(0.72)} />
                    </g>
                  )}
                  {flash?.hexes.includes(h.id) && <polygon key={`fl${flash.key}`} className="tile-flash" points={hexPath(0.965)} />}
                </g>
              );
            })}
          </g>

          {interactive && <rect className="b2d-dim" x="-5000" y="-5000" width="10000" height="10000" />}

          {/* Жетоны с числами */}
          <g className="b2d-tokens">
            {view.board.hexes.map((h) => {
              if (h.number === undefined) return null;
              const c = geo.hexPos.get(h.id)!;
              const red = h.number === 6 || h.number === 8;
              const pips = 6 - Math.abs(7 - h.number);
              const robbed = h.id === view.robberHex && !idleRobber;
              return (
                <g key={h.id} transform={`translate(${c.x} ${c.y})`} className={`token ${red ? 'red' : ''} ${robbed ? 'off' : ''}`}>
                  <Up>
                  <circle className="tk-shadow" cx={0} cy={5} r={S * 0.29} />
                  <circle className="tk-face" r={S * 0.29} fill={`url(#${id('token')})`} />
                  <text className="tk-num" y={-S * 0.035}>
                    {h.number}
                  </text>
                  {Array.from({ length: pips }, (_, k) => (
                    <circle key={k} className="tk-pip" cx={(k - (pips - 1) / 2) * S * 0.07} cy={S * 0.16} r={S * 0.022} />
                  ))}
                  {robbed && <line className="tk-slash" x1={-S * 0.22} y1={S * 0.22} x2={S * 0.22} y2={-S * 0.22} />}
                  </Up>
                </g>
              );
            })}
          </g>

          {/* Доход: ресурс выпрыгивает из гекса */}
          {flash && (
            <g key={`gain${flash.key}`} className="b2d-gains" aria-hidden>
              {flash.hexes.map((hid) => {
                const h = view.board.hexes.find((x) => x.id === hid);
                const c = geo.hexPos.get(hid);
                if (!h || !c || h.terrain === 'desert') return null;
                return (
                  <g key={hid} transform={`translate(${c.x} ${c.y - S * 0.2})`}>
                    <Up>
                      <image className="gain-pop" href={eraIcon(era, `res-${TERRAIN_RESOURCE[h.terrain]}`)} x={-S * 0.3} y={-S * 0.3} width={S * 0.6} height={S * 0.6} />
                    </Up>
                  </g>
                );
              })}
            </g>
          )}

          {/* Цели для разбойника */}
          <g className="b2d-hex-targets">
            {hl.hexes.map((hid) => {
              const c = geo.hexPos.get(hid);
              if (!c) return null;
              return (
                <polygon
                  key={hid}
                  points={hexPath(0.9)}
                  transform={`translate(${c.x} ${c.y})`}
                  className={`hex-target ${hid === selected ? 'selected' : ''}`}
                  onClick={onHex ? () => onHex(hid) : undefined}
                />
              );
            })}
          </g>

          {/* Разбойник эпохи */}
          {(() => {
            const c = geo.hexPos.get(view.robberHex);
            if (!c || idleRobber) return null;
            return (
              <g className="b2d-robber" style={{ transform: `translate(${c.x}px, ${c.y}px)` }}>
                <Up>
                <g key={view.robberHex} className="rb-land">
                  <ellipse className="rb-shadow" cx={0} cy={S * 0.06} rx={S * 0.36} ry={S * 0.36} />
                  <circle className="rb-halo" r={S * 0.5} fill={`url(#${id('halo')})`} />
                  <circle className="rb-ring" r={S * 0.34} />
                  <image href={robberSrc} x={-S * 0.38} y={-S * 0.42} width={S * 0.76} height={S * 0.76} />
                  {robbedHex?.number !== undefined && robbedHex.terrain !== 'desert' && (
                    <g className="rb-badge" transform={`translate(0 ${-S * 0.52}) scale(0.8)`}>
                      <rect x={-S * 0.46} y={-S * 0.17} width={S * 0.92} height={S * 0.34} rx={S * 0.17} />
                      <image href={eraIcon(era, `res-${TERRAIN_RESOURCE[robbedHex.terrain as Exclude<Terrain, 'desert'>]}`)} x={-S * 0.42} y={-S * 0.15} width={S * 0.3} height={S * 0.3} />
                      <text x={S * 0.14} y={S * 0.01} className={`rb-num ${robbedHex.number === 6 || robbedHex.number === 8 ? 'red' : ''}`}>
                        {robbedHex.number}
                      </text>
                      <line x1={-S * 0.36} y1={S * 0.11} x2={S * 0.36} y2={-S * 0.11} className="rb-strike" />
                    </g>
                  )}
                </g>
                </Up>
              </g>
            );
          })()}

          {/* Захваченный гекс: дым / пожар / пыль — видно сразу, что он не приносит доход */}
          {(() => {
            const c = geo.hexPos.get(view.robberHex);
            if (!c || idleRobber) return null;
            return (
              <g key={`rz${view.robberHex}`} className={`raid-zone era-${era}`} transform={`translate(${c.x} ${c.y})`} aria-hidden>
                {era === 'ww2' && (
                  <>
                    <ellipse className="rz-fire f1" cx={-S * 0.3} cy={S * 0.26} rx={S * 0.16} ry={S * 0.2} fill={`url(#${id('fire')})`} />
                    <ellipse className="rz-fire f2" cx={S * 0.32} cy={S * 0.22} rx={S * 0.13} ry={S * 0.17} fill={`url(#${id('fire')})`} />
                  </>
                )}
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => (
                  <circle
                    key={k}
                    className={`rz-smoke s${k}`}
                    cx={[-0.3, 0.32, -0.08, 0.2, -0.22, 0.08, 0.28, -0.36, 0][k] * S}
                    cy={[0.22, 0.2, 0.36, 0.34, -0.06, 0.08, -0.04, 0.04, 0.22][k] * S}
                    r={S * (k % 3 === 0 ? 0.28 : 0.22)}
                    fill={`url(#${id('smoke')})`}
                  />
                ))}
              </g>
            );
          })()}


          {/* Дороги */}
          <g className="b2d-roads">
            {Object.entries(view.roads).map(([eid, owner]) => {
              const l = edgeLine(eid);
              const color = colors[owner];
              if (!l || !color) return null;
              return (
                <g key={eid} className={`road ${recentSet.has(eid) ? 'recent' : ''} ${longestSet.has(eid) ? 'longest' : ''} ${props.spotlight ? (owner === props.spotlight ? 'lit' : 'dim') : ''}`}>
                  <line {...l} className="rd-halo" pathLength={1} />
                  <line {...l} className="rd-edge" stroke={PLAYER_STROKE[color]} pathLength={1} />
                  <line {...l} className="rd-body" stroke={PLAYER_HEX[color]} pathLength={1} />
                  {longestSet.has(eid) && <line {...l} className="rd-lane" />}
                </g>
              );
            })}
            {ghosts
              .filter((g) => g.edge)
              .map((g) => {
                const l = edgeLine(g.edge!);
                if (!l) return null;
                return <line key={`g${g.edge}`} {...l} className={`rd-ghost ${g.broken ? 'broken' : ''}`} stroke={PLAYER_HEX[g.color]} />;
              })}
          </g>

          {/* Поселения и города */}
          <g className="b2d-buildings">
            {Object.entries(view.buildings).map(([vid, b]) => {
              const p = geo.vertexPos.get(vid);
              const color = colors[b.owner];
              if (!p || !color) return null;
              return (
                <g key={vid} data-v={vid} transform={`translate(${p.x} ${p.y})`}>
                  {b.owner === props.me && <circle className="mine-ring" r={S * 0.36} style={{ ['--pc' as string]: color === 'white' ? '#fff6d8' : PLAYER_HEX[color] }} />}
                  <g className={`piece ${b.kind} ${recentSet.has(vid) ? 'recent' : ''} ${b.owner === props.me ? 'mine' : ''} ${props.spotlight ? (b.owner === props.spotlight ? 'lit' : 'dim') : ''}`}>
                    <Up>
                      <Piece kind={b.kind} color={color} shade={id('shade')} />
                    </Up>
                  </g>
                </g>
              );
            })}
            {ghosts
              .filter((g) => g.vertex)
              .map((g) => {
                const p = geo.vertexPos.get(g.vertex!);
                if (!p) return null;
                return (
                  <g key={`g${g.vertex}`} transform={`translate(${p.x} ${p.y})`} className={`ghost ${g.broken ? 'broken' : ''}`}>
                    <path d={g.kind === 'city' ? CITY : HOUSE} transform={`scale(${S})`} stroke={PLAYER_HEX[g.color]} />
                  </g>
                );
              })}
          </g>

          {/* Место события (куда смотреть) */}
          {focusPos && (
            <g key={`fc${focus!.key}`} transform={`translate(${focusPos.x} ${focusPos.y})`} className="b2d-ping" aria-hidden>
              <circle r={S * 0.3} />
              <circle r={S * 0.3} className="d2" />
            </g>
          )}

          {/* Куда можно нажать */}
          <g className="b2d-edge-targets">
            {hl.edges.map((eid) => {
              const l = edgeLine(eid, 0.2);
              if (!l) return null;
              return (
                <g key={eid} className={`edge-target ${eid === selected ? 'selected' : ''}`} onClick={onEdge ? () => onEdge(eid) : undefined}>
                  <line {...l} className="hit" />
                  <line {...l} className="vis" />
                </g>
              );
            })}
          </g>
          <g className="b2d-vertex-targets">
            {hl.vertices.map((vid) => {
              const p = geo.vertexPos.get(vid);
              if (!p) return null;
              return (
                <g
                  key={vid}
                  transform={`translate(${p.x} ${p.y})`}
                  className={`vertex-target ${vid === selected ? 'selected' : ''}`}
                  onClick={onVertex ? () => onVertex(vid) : undefined}
                >
                  <circle className="hit" r={S * 0.34} />
                  <circle className="vis" r={S * 0.15} />
                </g>
              );
            })}
          </g>
          </g>
          </RotCtx.Provider>
        </svg>
      </div>
      {!props.static && pz.zoomed && (
        <button className="b2d-reset glass" onClick={pz.reset} aria-label="Показать всю карту">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
      )}
    </div>
  );
}

const TERRAINS: Terrain[] = ['forest', 'hills', 'pasture', 'fields', 'mountains', 'desert'];

/** Какие картинки реально загрузились (чтобы не показывать битые). */
function useImages(urls: string[]): Set<string> {
  const key = urls.join('|');
  const [ok, setOk] = useState<Set<string>>(() => new Set(urls.filter((u) => loaded.has(u))));
  useEffect(() => {
    let alive = true;
    setOk(new Set(urls.filter((u) => loaded.has(u))));
    for (const u of urls) {
      if (loaded.has(u)) continue;
      const img = new Image();
      img.onload = () => {
        loaded.add(u);
        if (alive) setOk((s) => new Set(s).add(u));
      };
      img.src = u;
    }
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return ok;
}
const loaded = new Set<string>();

const RotCtx = createContext(0);
/** Обратный поворот: числа, постройки, значки остаются прямыми, когда карта повёрнута. */
function Up({ children }: { children: ReactNode }) {
  const rot = useContext(RotCtx);
  return <g style={{ transform: `rotate(${-rot}deg)`, transformOrigin: '0px 0px', transition: 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1)' }}>{children}</g>;
}

const HOUSE = 'M -0.2 0.17 L -0.2 -0.04 L 0 -0.24 L 0.2 -0.04 L 0.2 0.17 Z';
const CITY = 'M -0.32 0.2 L -0.32 -0.04 L -0.1 -0.04 L -0.1 -0.2 L 0.06 -0.36 L 0.22 -0.2 L 0.22 0.2 Z';

function Piece({ kind, color, shade }: { kind: 'settlement' | 'city'; color: PlayerColor; shade: string }) {
  const d = kind === 'city' ? CITY : HOUSE;
  return (
    <g transform={`scale(${S * 1.3})`}>
      <ellipse className="pc-shadow" cx={0.02} cy={kind === 'city' ? 0.22 : 0.19} rx={kind === 'city' ? 0.34 : 0.24} ry={0.07} />
      <path d={d} className="pc-halo" />
      <path d={d} fill={PLAYER_HEX[color]} stroke={PLAYER_STROKE[color]} strokeWidth={0.04} strokeLinejoin="round" />
      <path d={d} fill={`url(#${shade})`} />
      {kind === 'city' && (
        <>
          <rect x={-0.26} y={0.02} width={0.07} height={0.09} rx={0.015} className="pc-win lit" />
          <rect x={-0.16} y={0.02} width={0.07} height={0.09} rx={0.015} className="pc-win lit" />
          <rect x={0.11} y={-0.12} width={0.06} height={0.08} rx={0.015} className="pc-win lit" />
          <circle cx={0.06} cy={-0.39} r={0.045} className="pc-crown" />
        </>
      )}
      <rect x={kind === 'city' ? 0.02 : -0.04} y={0.03} width={0.08} height={0.14} rx={0.015} className="pc-door" />
    </g>
  );
}

function Harbor({
  h,
  era,
  ship,
  sailKey,
}: {
  h: { type: HarborType; a: { x: number; y: number }; b: { x: number; y: number }; ox: number; oy: number };
  era: string;
  ship?: string;
  sailKey?: number;
}) {
  const r = S * 0.3;
  const mx = (h.a.x + h.b.x) / 2;
  const my = (h.a.y + h.b.y) / 2;
  const l = Math.hypot(h.ox - mx, h.oy - my) || 1;
  const dx = (h.ox - mx) / l;
  const dy = (h.oy - my) / l;
  // кораблик сбоку от причала
  const sx = h.ox + dx * S * 0.15 - dy * S * 0.48;
  const sy = h.oy + dy * S * 0.15 + dx * S * 0.48;
  const flip = dx < 0;
  return (
    <g className="harbor">
      {ship && (
        <g transform={`translate(${sx} ${sy})`}>
          <g key={sailKey ?? 'home'} className={`ship ${sailKey !== undefined ? 'sailing' : ''}`} style={{ ['--dx' as string]: `${dx * S * 1.6}px`, ['--dy' as string]: `${dy * S * 1.6}px` }}>
            <image href={ship} x={-S * 0.3} y={-S * 0.3} width={S * 0.6} height={S * 0.6} transform={flip ? 'scale(-1 1)' : undefined} />
          </g>
        </g>
      )}
      <line x1={h.a.x} y1={h.a.y} x2={h.ox} y2={h.oy} className="pier" />
      <line x1={h.b.x} y1={h.b.y} x2={h.ox} y2={h.oy} className="pier" />
      <g transform={`translate(${h.ox} ${h.oy})`}>
        <Up>
          <circle cx={0} cy={4} r={r} className="hb-shadow" />
          <circle cx={0} cy={0} r={r} className="hb-face" />
          {h.type === 'any' ? (
            <text x={0} y={-S * 0.03} className="hb-any">
              ?
            </text>
          ) : (
            <image href={eraIcon(era, `res-${h.type}`)} x={-S * 0.17} y={-S * 0.24} width={S * 0.34} height={S * 0.34} />
          )}
          <text x={0} y={S * 0.18} className="hb-ratio">
            {h.type === 'any' ? '3:1' : '2:1'}
          </text>
        </Up>
      </g>
    </g>
  );
}
