// Значок ресурса: картинка из арта или эмодзи-заглушка.
import type { Resource } from '../engine';
import { RESOURCE_NAME } from '../i18n/ru';
import { RESOURCE_ICON } from './theme';
import { resourceArt } from './art';

export function ResIcon({ r, className = '' }: { r: Resource; className?: string }) {
  const url = resourceArt(r);
  return url ? (
    <img src={url} alt={RESOURCE_NAME[r]} className={`res-img ${className}`} draggable={false} />
  ) : (
    <span className={className}>{RESOURCE_ICON[r]}</span>
  );
}
