// Шторка снизу на базе Drawer из Vercel UI SDK: тянется за пальцем, пружинит, складывается стопкой.

import type { ReactNode } from 'react';
import { Drawer, DrawerBackdrop, DrawerContent, DrawerDescription, DrawerTitle } from '@ui-sdk/react/drawer';
import { sfx } from '../fx';

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
