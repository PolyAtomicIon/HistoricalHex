// Шторка снизу на базе Drawer из Vercel UI SDK: тянется за пальцем, пружинит, складывается стопкой.

import type { ReactNode } from 'react';
import { Drawer, DrawerBackdrop, DrawerContent, DrawerDescription, DrawerTitle } from '@ui-sdk/react/drawer';
import { useEffect } from 'react';
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
  if (lite) return <LiteSheet {...{ open, onClose, title, description, children, dismissible, right }} />;
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
        <div className="sheet-body">{children}</div>
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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  dismissible: boolean;
  right?: ReactNode;
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
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
