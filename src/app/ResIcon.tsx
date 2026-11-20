// Иконка ресурса — авторский арт текущей эпохи (public/eras/<эпоха>/res-<ресурс>.webp).
import type { Resource } from '../engine';
import { RESOURCE_NAME } from '../i18n/ru';
import { currentEra, eraIcon } from './era';
import { ArtIcon } from './icons';

const DOT: Record<Resource, string> = { brick: '#c8643c', wood: '#3f8c4a', sheep: '#e8e4d8', wheat: '#e8c14d', ore: '#8d98ad' };

export function ResIcon({ r, className = '', size = 30 }: { r: Resource; className?: string; size?: number }) {
  return (
    <ArtIcon
      key={`${currentEra}-${r}`}
      src={eraIcon(currentEra, `res-${r}`)}
      size={size}
      alt={RESOURCE_NAME[r]}
      className={`res-art ${className}`}
      fallback={<span className={`res-dot ${className}`} style={{ background: DOT[r] }} aria-label={RESOURCE_NAME[r]} />}
    />
  );
}
