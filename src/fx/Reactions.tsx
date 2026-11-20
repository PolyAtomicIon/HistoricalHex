import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { sfx, haptic } from './sfx';
import { FxPortal, hashStr } from './util';

export interface ReactionItem { id: string; emoji: string; from: string; color?: string }

const LIFE = 2600;

export function ReactionsLayer({ items }: { items: ReactionItem[] }) {
  const seen = useRef<Set<string> | null>(null);
  const timers = useRef<number[]>([]);
  const [live, setLive] = useState<ReactionItem[]>([]);

  useEffect(() => {
    if (seen.current === null) {
      // anything present on first mount is history, don't replay it
      seen.current = new Set(items.map((i) => i.id));
      return;
    }
    const fresh = items.filter((i) => !seen.current!.has(i.id));
    if (!fresh.length) return;
    fresh.forEach((i) => seen.current!.add(i.id));
    setLive((l) => [...l, ...fresh].slice(-24));
    sfx.play('react');
    fresh.forEach((it, n) => {
      if (n > 0 && n < 3) window.setTimeout(() => sfx.play('react', { pitch: 1 + n * 0.12, volume: 0.6 }), n * 90);
      timers.current.push(window.setTimeout(() => setLive((l) => l.filter((x) => x.id !== it.id)), LIFE + 100));
    });
  }, [items]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (!live.length) return null;
  return (
    <FxPortal>
      <div className="fx-react-layer">
        {live.map((it) => {
          const h = hashStr(it.id);
          const style = {
            left: `${10 + h * 80}%`,
            '--fx-sway': `${(h < 0.5 ? -1 : 1) * (14 + h * 22)}px`,
            '--fx-c': it.color ?? 'var(--accent, #7aa2ff)',
            '--fx-rise': `${-(48 + h * 22)}vh`,
          } as CSSProperties;
          return (
            <div key={it.id} className="fx-react" style={style}>
              <div className="fx-react-emoji">{it.emoji}</div>
              <div className="fx-react-chip"><i />{it.from}</div>
            </div>
          );
        })}
      </div>
    </FxPortal>
  );
}

export function ReactionBar({ onReact, emojis }: { onReact: (emoji: string) => void; emojis: readonly string[] }) {
  return (
    <div className="fx-rbar" role="group" aria-label="Reactions">
      {emojis.map((e) => (
        <button
          key={e}
          type="button"
          className="fx-rbar-btn"
          onClick={() => { haptic('tap'); sfx.play('tick'); onReact(e); }}
        >
          <span>{e}</span>
        </button>
      ))}
    </div>
  );
}
