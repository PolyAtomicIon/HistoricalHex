// Кино-атака поверх карты: разбойник эпохи налетает (лучники, ниндзя, бомбардировщики),
// рыцарь отбивает (всадник, самурай, танковая колонна). 1.8–2.4 с, без перекрытия интерфейса.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { haptic, sfx } from './sfx';
import { FxPortal, prefersReducedMotion, rand } from './util';

export interface RaidEvent {
  /** robber — налёт разбойника; knight — рыцарь прогоняет. */
  kind: 'robber' | 'knight';
  era: string;
  /** Картинки эпохи (public/eras/<era>/…). */
  sprite: string;
  extra?: string;
  key: number;
}

type Style = 'archers' | 'ninja' | 'bomber' | 'rider' | 'samurai' | 'tank';

function styleOf(e: RaidEvent): Style {
  if (e.era === 'ww2') return e.kind === 'robber' ? 'bomber' : 'tank';
  if (e.era === 'japan') return e.kind === 'robber' ? 'ninja' : 'samurai';
  return e.kind === 'robber' ? 'archers' : 'samurai';
}

const DURATION: Record<Style, number> = { archers: 2100, ninja: 1800, bomber: 2500, rider: 1900, samurai: 1600, tank: 2300 };

export function Raid({ event }: { event: RaidEvent | null }) {
  const [shown, setShown] = useState<RaidEvent | null>(null);
  useEffect(() => {
    if (!event || prefersReducedMotion()) return;
    setShown(event);
    const st = styleOf(event);
    switch (st) {
      case 'archers':
        sfx.play('gallop');
        setTimeout(() => sfx.play('arrows'), 700);
        break;
      case 'rider':
        sfx.play('gallop');
        setTimeout(() => sfx.play('attack'), 500);
        break;
      case 'ninja':
        sfx.play('whoosh');
        setTimeout(() => sfx.play('shuriken'), 450);
        break;
      case 'samurai':
        sfx.play('attack');
        break;
      case 'bomber':
        sfx.play('plane');
        setTimeout(() => sfx.play('bomb'), 900);
        setTimeout(() => haptic('heavy'), 1500);
        break;
      case 'tank':
        sfx.play('tank');
        setTimeout(() => haptic('heavy'), 1100);
        break;
    }
    const t = setTimeout(() => setShown((s) => (s?.key === event.key ? null : s)), DURATION[st]);
    return () => clearTimeout(t);
  }, [event?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const bits = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ i, x: rand(-30, 30), d: rand(0, 0.35), r: rand(-25, 25) })), [shown?.key]);
  if (!shown) return null;
  const st = styleOf(shown);
  return (
    <FxPortal>
      <div className={`fx-raid raid-${st} ${shown.kind}`} aria-hidden>
        <div className="raid-tint" />
        {st === 'archers' && (
          <>
            <img className="raid-sprite run" src={shown.sprite} alt="" />
            {bits.map((b) => (
              <i key={b.i} className="raid-arrow" style={{ '--x': `${b.x}vw`, '--r': `${b.r}deg`, animationDelay: `${0.6 + b.d}s` } as CSSProperties} />
            ))}
          </>
        )}
        {st === 'rider' && <img className="raid-sprite run back" src={shown.sprite} alt="" />}
        {st === 'ninja' && (
          <>
            <img className="raid-sprite leap" src={shown.sprite} alt="" />
            {bits.slice(0, 5).map((b) => (
              <i key={b.i} className="raid-star" style={{ '--x': `${b.x}vw`, animationDelay: `${0.4 + b.d}s` } as CSSProperties} />
            ))}
          </>
        )}
        {st === 'samurai' && (
          <>
            <img className="raid-sprite pop" src={shown.sprite} alt="" />
            <i className="raid-slash" />
          </>
        )}
        {st === 'bomber' && (
          <>
            <img className="raid-sprite fly" src={shown.sprite} alt="" />
            {bits.slice(0, 6).map((b) => (
              <i key={b.i} className="raid-bomb" style={{ '--x': `${b.x * 0.6}vw`, animationDelay: `${0.55 + b.i * 0.08}s` } as CSSProperties} />
            ))}
            <i className="raid-boom" />
            <i className="raid-boom b2" />
          </>
        )}
        {st === 'tank' && (
          <>
            <img className="raid-sprite roll" src={shown.sprite} alt="" />
            <i className="raid-muzzle" />
            <i className="raid-boom far" />
          </>
        )}
      </div>
    </FxPortal>
  );
}
