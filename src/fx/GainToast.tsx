import { useEffect, useRef, useState } from 'react';
import { sfx } from './sfx';
import { FxPortal } from './util';

export interface Gain { res: string; emoji: string; count: number }

export function GainToast({ gains, keyId }: { gains: Gain[]; keyId: number }) {
  const [shown, setShown] = useState<{ gains: Gain[]; key: number } | null>(null);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (last.current === null) { last.current = keyId; return; } // don't toast on mount
    if (keyId === last.current) return;
    last.current = keyId;
    const g = gains.filter((x) => x.count > 0);
    if (!g.length) return;
    setShown({ gains: g, key: keyId });
    const total = g.reduce((s, x) => s + x.count, 0);
    sfx.play('coin', { count: total });
    const t = window.setTimeout(() => setShown(null), 500 + g.length * 110 + 1500);
    return () => clearTimeout(t);
  }, [keyId, gains]);

  if (!shown) return null;
  return (
    <FxPortal>
      <div className="fx-gain" key={shown.key}>
        {shown.gains.map((g, i) => (
          <div key={g.res} className="fx-gain-chip" style={{ animationDelay: `${i * 110}ms` }}>
            <b>+{g.count}</b><span>{g.emoji}</span>
          </div>
        ))}
      </div>
    </FxPortal>
  );
}
