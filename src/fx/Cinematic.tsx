import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { sfx, haptic } from './sfx';
import { FxPortal, prefersReducedMotion, rand } from './util';
import { fxMs, isTurbo } from './speed';

export type CinematicKind =
  | 'seven' | 'knight' | 'monopoly' | 'yearOfPlenty' | 'roadBuilding'
  | 'longestRoad' | 'largestArmy' | 'victory' | 'built-city';

export interface CinematicEvent {
  kind: CinematicKind;
  title: string;
  subtitle?: string;
  /** Что произошло по правилам — простыми словами (под заголовком). */
  explain?: string;
  emoji: string;
  /** Картинка вместо эмодзи (авторский арт эпохи). */
  img?: string;
  /** Картинка для «дождя» (монеты, зерно). */
  rain?: string;
  color?: string;
  key: number;
}

const DEFAULT_COLOR: Record<CinematicKind, string> = {
  seven: '#ff453a', knight: '#ff9f0a', monopoly: '#ffd60a', yearOfPlenty: '#32d74b',
  roadBuilding: '#64d2ff', longestRoad: '#ffd60a', largestArmy: '#ffd60a', victory: '#ffd60a', 'built-city': '#bf5af2',
};
const CONFETTI = ['#ff453a', '#ff9f0a', '#ffd60a', '#32d74b', '#64d2ff', '#0a84ff', '#bf5af2', '#ff375f'];

function sounds(kind: CinematicKind, later: (fn: () => void, ms: number) => void) {
  switch (kind) {
    case 'seven': sfx.play('tudum'); haptic('heavy'); break;
    case 'knight': sfx.play('attack'); haptic([20, 60, 20, 60, 50]); break;
    case 'monopoly':
      for (let i = 0; i < 6; i++) later(() => sfx.play('coin', { count: 2 + i, volume: 0.8 }), 200 + i * 170);
      haptic('success');
      break;
    case 'yearOfPlenty':
      sfx.play('chime');
      for (let i = 0; i < 3; i++) later(() => sfx.play('coin', { count: 3 + i }), 250 + i * 160);
      break;
    case 'roadBuilding': sfx.play('pop'); later(() => sfx.play('pop', { pitch: 1.25 }), 160); break;
    case 'longestRoad': case 'largestArmy': sfx.play('fanfare'); haptic('success'); break;
    case 'victory': sfx.play('victory'); haptic([30, 40, 30, 40, 120]); break;
    case 'built-city': sfx.play('pop'); later(() => sfx.play('chime'), 150); haptic('success'); break;
  }
}

function Particles({ kind, k, rain }: { kind: CinematicKind; k: number; rain?: string }) {
  const items = useMemo(() => {
    if (kind === 'victory') {
      return Array.from({ length: 90 }, (_, i) => ({
        i, x: rand(-55, 55), y: rand(-75, -20), fall: rand(60, 110), r: rand(-720, 720), d: rand(0, 0.35), t: rand(1.6, 2.6),
        c: CONFETTI[i % CONFETTI.length]!, w: rand(6, 12), h: rand(8, 18),
      }));
    }
    if (kind === 'monopoly' || kind === 'yearOfPlenty') {
      const e = '●';
      return Array.from({ length: 28 }, (_, i) => ({
        i, x: rand(-48, 48), y: -60, fall: rand(95, 115), r: rand(-360, 360), d: rand(0, 1), t: rand(1.1, 1.7), e, s: rand(1.4, 2.6),
      }));
    }
    return [];
  }, [kind, k]);
  if (kind === 'victory') {
    return (
      <div className="fx-cin-particles">
        {(items as any[]).map((p) => (
          <i key={p.i} className="fx-confetti" style={{
            '--x': `${p.x}vw`, '--y': `${p.y}vh`, '--f': `${p.fall}vh`, '--r': `${p.r}deg`, background: p.c,
            width: p.w, height: p.h, animationDelay: `${p.d}s`, animationDuration: `${p.t}s`,
          } as CSSProperties} />
        ))}
      </div>
    );
  }
  if (kind === 'monopoly' || kind === 'yearOfPlenty') {
    return (
      <div className="fx-cin-particles">
        {(items as any[]).map((p) => (
          <i key={p.i} className="fx-rain" style={{
            '--x': `${p.x}vw`, '--f': `${p.fall}vh`, '--r': `${p.r}deg`, fontSize: `${p.s}rem`,
            animationDelay: `${p.d}s`, animationDuration: `${p.t}s`,
          } as CSSProperties}>{rain ? <img src={rain} alt="" style={{ width: '1em', height: '1em' }} /> : p.e}</i>
        ))}
      </div>
    );
  }
  if (kind === 'knight') {
    return (
      <div className="fx-cin-particles">
        {[0, 1, 2].map((i) => (
          <i key={i} className="fx-slash" style={{ top: `${28 + i * 17}%`, animationDelay: `${0.05 + i * 0.09}s`, width: `${90 - i * 12}%`, left: `${-10 + i * 6}%` }} />
        ))}
      </div>
    );
  }
  if (kind === 'longestRoad' || kind === 'largestArmy') return <div className="fx-rays" />;
  return null;
}

/** Сколько держится кино-карточка события (мс). */
export const CINE_MS = (tv: boolean) => fxMs(tv ? 4000 : 4800);

/** mini — компактная плашка сверху вместо заставки на весь экран (невысокие телефоны, настройка). */
export function Cinematic({ event, tv = false, mini = false }: { event: CinematicEvent | null; tv?: boolean; mini?: boolean }) {
  const [active, setActive] = useState<CinematicEvent | null>(null);
  const lastKey = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!event || event.key === lastKey.current) return;
    lastKey.current = event.key;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
    setActive(event);
    sounds(event.kind, later);
    if ((event.kind === 'seven' || event.kind === 'knight') && !prefersReducedMotion() && !mini) {
      document.body.classList.add('fx-shake');
      later(() => document.body.classList.remove('fx-shake'), 650);
    }
    // держим столько, чтобы успеть прочитать; на телефоне можно закрыть касанием
    later(() => setActive(null), CINE_MS(tv));
  }, [event, tv, mini]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    document.body.classList.remove('fx-shake');
  }, []);

  if (!active) return null;
  const color = active.color ?? DEFAULT_COLOR[active.kind];
  const style = { '--fx-c': color, '--fx-dur': `${CINE_MS(tv) / 1000}s` } as CSSProperties;
  if ((mini || isTurbo()) && !tv)
    return (
      <FxPortal>
        <div key={active.key} className={`fx-cin-mini fx-cin-${active.kind}`} style={style} role="status">
          <button className="fx-mini-card" onClick={() => setActive(null)} aria-label="Закрыть">
            <span className="fx-mini-ic">{active.img ? <img src={active.img} alt="" /> : active.emoji}</span>
            <span className="fx-mini-txt">
              <b>{active.title}</b>
              {active.explain && <small>{active.explain}</small>}
            </span>
          </button>
        </div>
      </FxPortal>
    );
  return (
    <FxPortal>
      <div
        key={active.key}
        className={`fx-cin fx-cin-${active.kind}${tv ? ' fx-cin-tv' : ' fx-cin-tap'}`}
        style={style}
        onClick={tv ? undefined : () => setActive(null)}
        role={tv ? undefined : 'button'}
        aria-label={tv ? undefined : 'Закрыть'}
      >
        <div className="fx-cin-vignette" />
        <div className="fx-cin-flash" />
        <Particles kind={active.kind} k={active.key} rain={active.rain} />
        <div className="fx-cin-center">
          <div className="fx-cin-emoji-wrap">
            <i className="fx-streak fx-streak-l" /><i className="fx-streak fx-streak-r" />
            <div className="fx-cin-emoji">{active.img ? <img className="fx-cin-img" src={active.img} alt="" /> : active.emoji}</div>
          </div>
          <div className="fx-cin-title">{active.title}</div>
          {active.explain && <div className="fx-cin-explain">{active.explain}</div>}
          {active.subtitle && <div className="fx-cin-sub">{active.subtitle}</div>}
        </div>
      </div>
    </FxPortal>
  );
}
