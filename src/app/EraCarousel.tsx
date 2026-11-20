// Выбор эпохи: горизонтальная карусель больших карточек с прилипанием (scroll-snap).
// Свайп — выбирает ту, что встала по центру; тап — прокручивает к ней.

import { useEffect, useRef } from 'react';
import type { LorePack } from '../lore';
import { eraCover, eraIcon } from './era';
import { haptic, sfx } from '../fx';
import { ArtIcon } from './icons';

export function EraCarousel({ packs, value, onChange }: { packs: LorePack[]; value: string; onChange: (id: string) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Выбранная — та, чей центр ближе к центру ленты
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const mid = el.scrollLeft + el.clientWidth / 2;
        let best: { id: string; d: number } | undefined;
        for (const card of Array.from(el.children) as HTMLElement[]) {
          const d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - mid);
          if (!best || d < best.d) best = { id: card.dataset.id!, d };
        }
        if (best && best.id !== valueRef.current) {
          onChange(best.id);
          sfx.play('tick');
          haptic('tap');
        }
      }, 90);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onChange]);

  const scrollTo = (id: string) => {
    const el = track.current;
    const card = el?.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' });
  };

  return (
    <div className="era-carousel">
      <div className="era-track" ref={track} role="listbox" aria-label="Эпоха">
        {packs.map((p) => (
          <button
            key={p.id}
            data-id={p.id}
            role="option"
            aria-selected={p.id === value}
            className={`era-card ${p.id === value ? 'on' : ''}`}
            style={{ ['--era' as string]: p.palette.accent }}
            onClick={() => {
              onChange(p.id);
              scrollTo(p.id);
            }}
          >
            <span className="era-cover" style={{ backgroundImage: `url(${eraCover(p.id)})` }} aria-hidden />
            <span className="era-body">
              <ArtIcon className="era-icon" src={eraIcon(p.id, 'emblem')} size={44} fallback={<span className="era-icon" />} />
              <span className="era-text">
                <b className="era-title">{p.title}</b>
                <span className="era-years">{p.years}</span>
              </span>
            </span>
            <span className="era-desc">{p.subtitle}</span>
          </button>
        ))}
      </div>
      <div className="era-dots" aria-hidden>
        {packs.map((p) => (
          <i key={p.id} className={p.id === value ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}
