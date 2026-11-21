// Жесты карты: один палец — двигать (если приближено), два — щипок, колесо — зум, двойной тап — приблизить/отдалить.
// Трансформация пишется прямо в style (без перерисовки React). Тап после перетаскивания отменяется.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';

const MIN = 1;
const MAX = 3.2;
const SLOP = 8;

export function usePanZoom(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const t = useRef({ s: 1, x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const g = useRef<{ moved: boolean; sx: number; sy: number; d0: number; s0: number; x0: number; y0: number; mx: number; my: number } | null>(null);
  const suppress = useRef(false);
  const lastTap = useRef(0);
  const anim = useRef(0);
  const [zoomed, setZoomed] = useState(false);

  const clampT = (s: number, x: number, y: number) => {
    const el = ref.current;
    if (!el) return { s, x, y };
    const w = el.clientWidth;
    const h = el.clientHeight;
    s = Math.min(MAX, Math.max(MIN, s));
    // Немного «воздуха» по краям, чтобы край карты можно было вытащить из-под панелей
    const slackX = w * 0.18 * (s - 1);
    const slackY = h * 0.22 * (s - 1);
    x = Math.min(slackX, Math.max(w - w * s - slackX, x));
    y = Math.min(slackY, Math.max(h - h * s - slackY, y));
    return { s, x, y };
  };

  const apply = useCallback((live: boolean) => {
    const el = inner.current;
    if (!el) return;
    const { s, x, y } = t.current;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
    // Во время жеста — слой GPU; после — пусть браузер перерисует SVG чётко
    el.style.willChange = live ? 'transform' : 'auto';
    setZoomed(s > 1.02);
  }, []);

  const animateTo = useCallback(
    (s: number, x: number, y: number) => {
      cancelAnimationFrame(anim.current);
      const from = { ...t.current };
      const to = clampT(s, x, y);
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / 280);
        const e = 1 - Math.pow(1 - k, 3);
        t.current = { s: from.s + (to.s - from.s) * e, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
        apply(k < 1);
        if (k < 1) anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    },
    [apply],
  );

  const zoomAt = (cx: number, cy: number, s: number) => {
    const { s: s0, x, y } = t.current;
    const k = s / s0;
    return { s, x: cx - (cx - x) * k, y: cy - (cy - y) * k };
  };

  const local = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: RPointerEvent) => {
    if (!enabled) return;
    cancelAnimationFrame(anim.current);
    pts.current.set(e.pointerId, local(e));
    const p = [...pts.current.values()];
    if (p.length === 1) {
      g.current = { moved: false, sx: p[0].x, sy: p[0].y, d0: 0, s0: t.current.s, x0: t.current.x, y0: t.current.y, mx: 0, my: 0 };
      suppress.current = false;
    } else if (p.length === 2) {
      const mx = (p[0].x + p[1].x) / 2;
      const my = (p[0].y + p[1].y) / 2;
      g.current = { moved: true, sx: mx, sy: my, d0: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), s0: t.current.s, x0: t.current.x, y0: t.current.y, mx, my };
      suppress.current = true;
    }
  };

  const onPointerMove = (e: RPointerEvent) => {
    if (!enabled || !pts.current.has(e.pointerId) || !g.current) return;
    pts.current.set(e.pointerId, local(e));
    const p = [...pts.current.values()];
    const st = g.current;
    if (p.length >= 2) {
      const mx = (p[0].x + p[1].x) / 2;
      const my = (p[0].y + p[1].y) / 2;
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const s = Math.min(MAX * 1.1, Math.max(MIN * 0.9, (st.s0 * d) / Math.max(1, st.d0)));
      const k = s / st.s0;
      t.current = { s, x: mx - (st.mx - st.x0) * k, y: my - (st.my - st.y0) * k };
      apply(true);
      return;
    }
    const dx = p[0].x - st.sx;
    const dy = p[0].y - st.sy;
    if (!st.moved && Math.hypot(dx, dy) < SLOP) return;
    if (!st.moved) {
      st.moved = true;
      suppress.current = true;
    }
    if (t.current.s <= 1.01) return; // без зума двигать нечего
    t.current = clampT(t.current.s, st.x0 + dx, st.y0 + dy);
    apply(true);
  };

  const end = (e: RPointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.delete(e.pointerId);
    if (pts.current.size === 1) {
      // Остался один палец — продолжаем как перетаскивание от текущего места
      const [p] = [...pts.current.values()];
      g.current = { moved: true, sx: p.x, sy: p.y, d0: 0, s0: t.current.s, x0: t.current.x, y0: t.current.y, mx: 0, my: 0 };
      return;
    }
    if (pts.current.size === 0) {
      const { s, x, y } = t.current;
      const c = clampT(s, x, y);
      if (c.s !== s || c.x !== x || c.y !== y) animateTo(c.s, c.x, c.y);
      else apply(false);
      // Двойной тап по пустому месту — приблизить/отдалить
      if (g.current && !g.current.moved) {
        const now = Date.now();
        const tgt = e.target as Element;
        const onTarget = !!tgt.closest?.('.vertex-target, .edge-target, .hex-target');
        if (!onTarget && now - lastTap.current < 300) {
          const l = local(e);
          const z = s > 1.3 ? { s: 1, x: 0, y: 0 } : zoomAt(l.x, l.y, 2);
          animateTo(z.s, z.x, z.y);
          lastTap.current = 0;
        } else lastTap.current = now;
      }
      g.current = null;
    }
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (suppress.current) {
      e.stopPropagation();
      e.preventDefault();
      suppress.current = false;
    }
  };

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const l = local(e);
      const s = t.current.s * Math.exp(-e.deltaY * 0.0022);
      const z = zoomAt(l.x, l.y, Math.min(MAX, Math.max(MIN, s)));
      t.current = clampT(z.s, z.x, z.y);
      apply(false);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [enabled, apply]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => animateTo(1, 0, 0);

  return {
    ref,
    inner,
    zoomed,
    reset,
    handlers: enabled
      ? { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onPointerLeave: end, onClickCapture }
      : {},
  };
}
