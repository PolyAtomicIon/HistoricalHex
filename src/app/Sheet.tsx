// Шторка снизу на базе Drawer из Vercel UI SDK: тянется за пальцем, пружинит, складывается стопкой.

import type { ReactNode } from 'react';
import { Drawer, DrawerBackdrop, DrawerContent, DrawerDescription, DrawerTitle } from '@ui-sdk/react/drawer';
import { useEffect, useRef } from 'react';
import { sfx } from '../fx';
import { useLite } from './lite';

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  dismissible = true,
  right,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** false — шторку нельзя смахнуть (например, обязательный сброс карт). */
  dismissible?: boolean;
  right?: ReactNode;
}) {
  const { lite } = useLite();
  const bodyRef = useRef<HTMLDivElement>(null);
  // в лёгком режиме жеста «язычка» нет — тянуть можно за всю шторку (и заголовок, и содержимое)
  useDragToClose(bodyRef, onClose, open && dismissible, lite);
  if (lite) return <LiteSheet {...{ open, onClose, title, description, children, dismissible, right, bodyRef }} />;
  return (
    <Drawer
      open={open}
      onOpenChange={(o: boolean) => {
        if (o) sfx.play('whoosh');
        else onClose();
      }}
      dismissible={dismissible}
    >
      <DrawerBackdrop className="sheet-backdrop" />
      <DrawerContent className="sheet">
        <div className="sheet-grip" aria-hidden />
        <div className="sheet-head">
          <DrawerTitle className="sheet-title">{title}</DrawerTitle>
          {right}
        </div>
        {description && <DrawerDescription className="sheet-desc">{description}</DrawerDescription>}
        <div className="sheet-body" ref={bodyRef}>
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Простая шторка без жестов — для старых браузеров (лёгкий режим). */
function LiteSheet({
  open,
  onClose,
  title,
  description,
  children,
  dismissible,
  right,
  bodyRef,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  dismissible: boolean;
  right?: ReactNode;
  bodyRef: React.RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);
  if (!open) return null;
  return (
    <div className="lite-sheet-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <div className="lite-sheet-backdrop" onClick={() => dismissible && onClose()} />
      <div className="sheet lite-sheet">
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          {right}
          {dismissible && (
            <button className="btn ghost icon" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          )}
        </div>
        {description && <p className="sheet-desc">{description}</p>}
        <div className="sheet-body" ref={bodyRef}>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Смахнуть шторку можно не только за «язычок», но и за содержимое — как в портале:
 * если список прокручен до верха, свайп вниз тянет всю шторку за пальцем; отпустил ниже порога
 * или резко — закрывается, иначе пружинит обратно. Прокрутка вверх/вниз внутри списка не страдает.
 */
function useDragToClose(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void, enabled: boolean, whole = false) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    // шторка монтируется в портал чуть позже — ждём кадр
    let off = () => {};
    let tries = 0;
    let timer = 0;
    const attach = () => {
      const body = ref.current;
      const sheet = body?.closest<HTMLElement>('.sheet');
      if (!body || !sheet) {
        if (tries++ < 10) timer = window.setTimeout(attach, 60);
        return;
      }
      let y0 = 0;
      let t0 = 0;
      let dy = 0;
      let armed = false;
      let dragging = false;
      let prev = '';
      const target: HTMLElement = whole ? sheet : body;
      const start = (e: TouchEvent) => {
        if (e.touches.length !== 1) return;
        // за заголовок тянуть можно всегда, за содержимое — только когда оно прокручено до верха
        armed = !body.contains(e.target as Node) || body.scrollTop <= 0;
        dragging = false;
        dy = 0;
        y0 = e.touches[0].clientY;
        t0 = Date.now();
      };
      const move = (e: TouchEvent) => {
        if (!armed) return;
        const d = e.touches[0].clientY - y0;
        if (!dragging) {
          if (d < -2) {
            armed = false; // повёл вверх — это прокрутка
            return;
          }
          if (d < 8 || (body.contains(e.target as Node) && body.scrollTop > 0)) return;
          dragging = true;
          prev = sheet.style.transform;
        }
        e.preventDefault(); // не даём iOS «оттягивать» список
        dy = Math.max(0, d - 8);
        sheet.style.transition = 'none';
        sheet.style.transform = `translateY(${dy}px)`;
      };
      const end = () => {
        if (!dragging) return;
        dragging = false;
        const v = dy / Math.max(1, Date.now() - t0);
        sheet.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
        if (dy > 120 || (v > 0.6 && dy > 40)) {
          sheet.style.transform = 'translateY(100%)';
          setTimeout(() => close.current(), 160);
          setTimeout(() => {
            sheet.style.transform = prev;
            sheet.style.transition = '';
          }, 420);
        } else {
          sheet.style.transform = prev;
          setTimeout(() => (sheet.style.transition = ''), 240);
        }
      };
      target.addEventListener('touchstart', start, { passive: true });
      target.addEventListener('touchmove', move, { passive: false });
      target.addEventListener('touchend', end);
      target.addEventListener('touchcancel', end);
      off = () => {
        target.removeEventListener('touchstart', start);
        target.removeEventListener('touchmove', move);
        target.removeEventListener('touchend', end);
        target.removeEventListener('touchcancel', end);
      };
    };
    attach();
    return () => {
      window.clearTimeout(timer);
      off();
    };
  }, [ref, enabled, whole]);
}
