// Значок ресурса — эмодзи эпохи (меняется вместе с пакетом лора).
import type { Resource } from '../engine';
import { RESOURCE_NAME } from '../i18n/ru';
import { RESOURCE_ICON } from '../ui/theme';

export function ResIcon({ r, className = '' }: { r: Resource; className?: string }) {
  return (
    <span className={`res-emoji ${className}`} role="img" aria-label={RESOURCE_NAME[r]}>
      {RESOURCE_ICON[r]}
    </span>
  );
}
