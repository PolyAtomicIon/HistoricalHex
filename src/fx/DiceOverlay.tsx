import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { sfx, haptic } from './sfx';
import { FxPortal, prefersReducedMotion, rand } from './util';

export interface DiceRoll {
  dice: [number, number];
  key: number;
  source?: string;
  player?: string;
  color?: string;
}

/** Time (ms) from roll start until both dice have landed. */
import { fxMs } from './speed';
/** Сколько катятся кубики (быстро: игроки ждут результат, а не анимацию). */
export const rollDurationMs = () => fxMs(700);

const PIPS: Record<number, number[]> = {
  1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
// opposite faces sum to 7
const FACES: { v: number; t: string }[] = [
  { v: 1, t: 'rotateY(0deg)' },
  { v: 6, t: 'rotateY(180deg)' },
  { v: 3, t: 'rotateY(90deg)' },
  { v: 4, t: 'rotateY(-90deg)' },
  { v: 2, t: 'rotateX(90deg)' },
  { v: 5, t: 'rotateX(-90deg)' },
];
/** cube rotation (x, y) that brings value v to face the viewer */
const FACE_ROT: Record<number, [number, number]> = {
  1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0],
};

function Cube({ cubeRef, wrapRef, v }: { cubeRef: React.Ref<HTMLDivElement>; wrapRef: React.Ref<HTMLDivElement>; v: number }) {
  const [rx, ry] = FACE_ROT[v] ?? [0, 0];
  return (
    <div className="fx-die-wrap" ref={wrapRef}>
      <div className="fx-die-shadow" />
      <div className="fx-die" ref={cubeRef} style={{ transform: `rotateX(${rx}deg) rotateY(${ry}deg)` }}>
        {FACES.map((f) => (
          <div key={f.v} className="fx-die-face" style={{ transform: `${f.t} translateZ(calc(var(--die) / 2))` }}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={PIPS[f.v]!.includes(i) ? `fx-pip${f.v === 1 ? ' fx-pip-one' : ''}` : ''} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DiceOverlay({ roll, big = false }: { roll: DiceRoll | null; big?: boolean }) {
  const [active, setActive] = useState<DiceRoll | null>(null);
  const [landed, setLanded] = useState(false);
  const cubes = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const wraps = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const lastKey = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const anims = useRef<Animation[]>([]);

  useEffect(() => {
    if (!roll || roll.key === lastKey.current) return;
    lastKey.current = roll.key;
    timers.current.forEach(clearTimeout);
    anims.current.forEach((a) => a.cancel());
    timers.current = [];
    anims.current = [];
    setLanded(false);
    setActive(roll);
    const total = roll.dice[0] + roll.dice[1];
    const reduced = prefersReducedMotion();
    const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

    sfx.play('diceShake');
    haptic([12, 30, 12, 30, 12]);
    const landAt = reduced ? 150 : rollDurationMs();
    later(() => {
      sfx.play('diceLand');
      later(() => setLanded(true), 40);
      if (total === 7) {
        sfx.play('tudum', { delay: 0.25 });
        haptic('heavy');
        document.body.classList.add('fx-shake');
        later(() => document.body.classList.remove('fx-shake'), 650);
      } else haptic('tap');
    }, landAt - 120);

    // run the tumble after the DOM nodes are mounted
    // Кубики монтируются через портал на рендер позже — ждём, пока появятся в DOM (иначе анимация не стартует
    // и кубики остаются прозрачными)
    let raf = 0;
    let tries = 0;
    const start = () => {
      if (reduced) {
        wraps.forEach((w) => w.current && (w.current.style.opacity = '1'));
        return;
      }
      if (!cubes[0]!.current || !wraps[0]!.current || !cubes[1]!.current || !wraps[1]!.current) {
        if (tries++ < 30) raf = requestAnimationFrame(start);
        return;
      }
      roll.dice.forEach((v, i) => {
        const cube = cubes[i]!.current;
        const wrap = wraps[i]!.current;
        if (!cube || !wrap) return;
        const [tx, ty] = FACE_ROT[v] ?? [0, 0];
        const spinsX = 360 * (2 + i), spinsY = 360 * (3 - i) * (Math.random() < 0.5 ? 1 : -1);
        const from = `rotateX(${rand(0, 360)}deg) rotateY(${rand(0, 360)}deg) rotateZ(${rand(-40, 40)}deg)`;
        const dir = i === 0 ? -1 : 1;
        anims.current.push(
          cube.animate(
            [
              { transform: from, easing: 'cubic-bezier(.2,.7,.3,1)' },
              { transform: `rotateX(${tx + spinsX * 0.85}deg) rotateY(${ty + spinsY * 0.85}deg) rotateZ(0deg)`, offset: 0.7, easing: 'cubic-bezier(.3,.9,.5,1)' },
              { transform: `rotateX(${tx + spinsX}deg) rotateY(${ty + spinsY}deg) rotateZ(0deg)` },
            ],
            { duration: rollDurationMs() - 100 + i * 60, fill: 'forwards' },
          ),
        );
        const D = 'cubic-bezier(.2,.7,.4,1)';
        anims.current.push(
          wrap.animate(
            [
              { transform: `translate3d(${dir * 22}vw, 20vh, 0) scale(.7)`, opacity: 0, offset: 0 },
              { transform: `translate3d(${dir * 18}vw, 16vh, 0) scale(.74)`, opacity: 1, offset: 0.06 },
              { transform: `translate3d(0, 0, 0) scale(1.08)`, opacity: 1, offset: 0.52, easing: D },
              { transform: `translate3d(0, -34px, 0) scale(1)`, offset: 0.68, easing: 'cubic-bezier(.5,0,.9,.6)' },
              { transform: 'translate3d(0, 0, 0) scale(1)', offset: 0.8, easing: D },
              { transform: 'translate3d(0, -12px, 0)', offset: 0.9, easing: 'cubic-bezier(.5,0,.9,.6)' },
              { transform: 'translate3d(0, 0, 0)', opacity: 1, offset: 1 },
            ],
            { duration: rollDurationMs() + i * 60, delay: i * 70, fill: 'both' },
          ),
        );
      });
    };
    raf = requestAnimationFrame(start);

    later(() => setActive(null), big ? 3000 : 2200);
    return () => cancelAnimationFrame(raf);
  }, [roll, big]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    anims.current.forEach((a) => a.cancel());
    document.body.classList.remove('fx-shake');
  }, []);

  if (!active) return null;
  const total = active.dice[0] + active.dice[1];
  const seven = total === 7;
  const badge = active.source === 'randomOrg' ? 'random.org' : active.source === 'physical' ? 'настоящие кубики' : null;
  const style = { '--fx-player': active.color ?? 'var(--accent, #7aa2ff)' } as CSSProperties;

  return (
    <FxPortal>
      <div className={`fx-dice-root${big ? ' fx-dice-big' : ''}`} key={active.key} style={style}>
        <div className="fx-dice-scrim" />
        <div className="fx-dice-stage">
          <div className="fx-dice-row">
            <Cube cubeRef={cubes[0]!} wrapRef={wraps[0]!} v={active.dice[0]} />
            <Cube cubeRef={cubes[1]!} wrapRef={wraps[1]!} v={active.dice[1]} />
          </div>
          <div className={`fx-dice-total${landed ? ' is-in' : ''}${seven ? ' is-seven' : ''}`}>
            {active.player && <span className="fx-dice-player"><i />{active.player}</span>}
            <b>{total}</b>
          </div>
          {badge && <div className={`fx-dice-badge${landed ? ' is-in' : ''}`}>{badge}</div>}
        </div>
      </div>
    </FxPortal>
  );
}
