// Кинематографичная заставка эпохи в начале партии: обложка с медленным наездом, эмблема, название,
// строки вступления по одной. ~11 с, тап — пропустить. Один раз на комнату.

import { useEffect, useState } from 'react';
import type { LorePack } from '../lore';
import { eraCover, eraIcon } from './era';
import { ArtIcon } from './icons';
import { sfx } from '../fx';

const seenKey = (pin: string) => `hh.intro.${pin}`;

export function useIntroOnce(pin: string, show: boolean): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    if (!show) return false;
    try {
      return !localStorage.getItem(seenKey(pin));
    } catch {
      return true;
    }
  });
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(seenKey(pin), '1');
    } catch {
      /* ok */
    }
  };
  return [open, close];
}

export function EraIntro({ pack, onDone }: { pack: LorePack; onDone: () => void }) {
  const lines = pack.intro.slice(0, 3);
  const [step, setStep] = useState(0);
  useEffect(() => {
    sfx.play('tudum', { volume: 0.6 });
    const ts = [setTimeout(() => setStep(1), 900), ...lines.map((_, i) => setTimeout(() => setStep(2 + i), 2200 + i * 2600)), setTimeout(onDone, 2200 + lines.length * 2600 + 1800)];
    return () => ts.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="era-intro" onClick={onDone} role="dialog" aria-label={pack.title}>
      <div className="ei-cover" style={{ backgroundImage: `url(${eraCover(pack.id)})` }} />
      <div className="ei-shade" />
      <div className="ei-content">
        <div className={`ei-head ${step >= 1 ? 'in' : ''}`}>
          <ArtIcon src={eraIcon(pack.id, 'emblem')} size={84} className="ei-emblem" />
          <h1 className="display ei-title">{pack.title}</h1>
          <div className="ei-years">
            {pack.years} · {pack.region}
          </div>
        </div>
        <div className="ei-lines">
          {lines.map((l, i) => (
            <p key={i} className={step >= 2 + i ? 'in' : ''}>
              {l}
            </p>
          ))}
        </div>
      </div>
      <button className="ei-skip" onClick={onDone}>
        Пропустить
      </button>
      <div className="ei-progress" style={{ animationDuration: `${2200 + lines.length * 2600 + 1800}ms` }} />
    </div>
  );
}
