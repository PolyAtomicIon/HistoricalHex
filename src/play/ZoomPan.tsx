// Зум и перемещение карты: двумя пальцами (щипок), одним пальцем (тянуть), колёсиком мыши.
// Тап по подсвеченному месту остаётся тапом; если палец сдвинулся — это перемещение, клик гасим.

import type { ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';

const MAX_SCALE = 4;
const DRAG_THRESHOLD = 8;

type Pt = { x: number; y: number };

export function ZoomPan({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, Pt>());
  const start = useRef<{ t: typeof t; a: Pt; b?: Pt } | null>(null);
  const moved = useRef(false);

  const rel = (e: { clientX: number; clientY: number }): Pt => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const clamp = useCallback((n: { s: number; x: number; y: number }) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return n;
    const s = Math.min(MAX_SCALE, Math.max(1, n.s));
    return {
      s,
      x: Math.min(0, Math.max(r.width - r.width * s, n.x)),
      y: Math.min(0, Math.max(r.height - r.height * s, n.y)),
    };
  }, []);

  const begin = () => {
    const pts = [...pointers.current.values()];
    start.current = { t, a: pts[0], b: pts[1] };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, rel(e));
    if (pointers.current.size === 1) moved.current = false;
    begin();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !start.current) return;
    pointers.current.set(e.pointerId, rel(e));
    const pts = [...pointers.current.values()];
    const st = start.current;
    if (pts.length >= 2 && st.b) {
      const d0 = Math.hypot(st.a.x - st.b.x, st.a.y - st.b.y) || 1;
      const d1 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const m0 = { x: (st.a.x + st.b.x) / 2, y: (st.a.y + st.b.y) / 2 };
      const m1 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const s = Math.min(MAX_SCALE, Math.max(1, st.t.s * (d1 / d0)));
      // Точка карты под пальцами остаётся под пальцами
      const px = (m0.x - st.t.x) / st.t.s;
      const py = (m0.y - st.t.y) / st.t.s;
      moved.current = true;
      setT(clamp({ s, x: m1.x - px * s, y: m1.y - py * s }));
    } else {
      const dx = pts[0].x - st.a.x;
      const dy = pts[0].y - st.a.y;
      if (!moved.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      moved.current = true;
      if (st.t.s > 1) setT(clamp({ s: st.t.s, x: st.t.x + dx, y: st.t.y + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) begin();
    else start.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    const p = rel(e);
    const s = Math.min(MAX_SCALE, Math.max(1, t.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    const px = (p.x - t.x) / t.s;
    const py = (p.y - t.y) / t.s;
    setT(clamp({ s, x: p.x - px * s, y: p.y - py * s }));
  };

  const zoomBy = (k: number) => {
    const r = box.current!.getBoundingClientRect();
    const c = { x: r.width / 2, y: r.height / 2 };
    const s = Math.min(MAX_SCALE, Math.max(1, t.s * k));
    setT(clamp({ s, x: c.x - ((c.x - t.x) / t.s) * s, y: c.y - ((c.y - t.y) / t.s) * s }));
  };

  return (
    <div
      ref={box}
      className="zoompan"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
      onClickCapture={(e) => {
        if (moved.current) {
          e.stopPropagation();
          e.preventDefault();
          moved.current = false;
        }
      }}
    >
      <div className="zoompan-inner" style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }}>
        {children}
      </div>
      <div className="zoom-buttons" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={() => zoomBy(1.4)} aria-label="Приблизить">
          +
        </button>
        <button onClick={() => zoomBy(1 / 1.4)} aria-label="Отдалить">
          −
        </button>
        {t.s > 1.01 && (
          <button onClick={() => setT({ s: 1, x: 0, y: 0 })} aria-label="Показать всю карту">
            ⤢
          </button>
        )}
      </div>
    </div>
  );
}
