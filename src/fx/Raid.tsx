// Кино-атака, привязанная к гексу на карте: разбойник эпохи налетает на цель (бомбардировщик / лучник / ниндзя),
// рыцарь отбивает (танк / воин). Траектории считаются от экранной позиции гекса, анимация — Web Animations.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { haptic, sfx } from './sfx';
import { duckMusic } from './music';
import { FxPortal, boardLocator, prefersReducedMotion } from './util';


export interface RaidEvent {
  /** robber — налёт разбойника; knight — рыцарь прогоняет. */
  kind: 'robber' | 'knight';
  era: string;
  /** Картинки эпохи (public/eras/<era>/…). */
  sprite: string;
  extra?: string;
  /** Гекс-цель (для налёта). */
  target?: string;
  key: number;
}

type Style = 'archers' | 'ninja' | 'bomber' | 'samurai' | 'tank';

function styleOf(e: RaidEvent): Style {
  if (e.era === 'ww2') return e.kind === 'robber' ? 'bomber' : 'tank';
  if (e.era === 'japan') return e.kind === 'robber' ? 'ninja' : 'samurai';
  return e.kind === 'robber' ? 'archers' : 'samurai';
}

const DURATION: Record<Style, number> = { archers: 2300, ninja: 2000, bomber: 5000, samurai: 1600, tank: 4600 };

/** skipBomber — карта в 3D сама показывает звено бомбардировщиков; здесь только звук. */
export function Raid({ event, skipBomber }: { event: RaidEvent | null; skipBomber?: boolean }) {
  const [shown, setShown] = useState<RaidEvent | null>(null);
  useEffect(() => {
    if (!event || prefersReducedMotion()) return;
    setShown(event);
    const st = styleOf(event);
    // В 3D самолёты/танки идут по длинному сценарию (7.5 / 6.8 с) — звук подстраивается под него
    const in3d = !!skipBomber && !!event.target;
    const long = in3d && (st === 'bomber' || st === 'tank');
    const LONG3D: Record<Style, number> = { bomber: 7500, tank: 6800, archers: 6500, ninja: 5600, samurai: 5200 };
    const charge = event.era === 'genghis' && event.kind === 'knight';
    const dur = in3d ? (charge ? 5200 : LONG3D[st]) : DURATION[st];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, f: () => void) => timers.push(setTimeout(f, ms));
    sfx.play('drama', { volume: long ? 1 : 0.7 });
    duckMusic(dur / 1000 + 1);
    if (long && st === 'bomber') {
      sfx.play('siren');
      at(2300, () => sfx.play('siren', { volume: 0.7 }));
      at(900, () => sfx.play('plane', { volume: 1.2 }));
      at(2200, () => sfx.play('plane', { volume: 1.4 }));
      at(3500, () => sfx.play('plane', { volume: 1 }));
      [3000, 3180, 3360, 3540].forEach((ms, i) => at(ms, () => sfx.play('bomb', { volume: 1 - i * 0.12 })));
      at(3600, () => haptic('heavy'));
      at(3950, () => haptic('heavy'));
    } else if (long && st === 'tank') {
      sfx.play('tank', { volume: 0.8 });
      at(1500, () => sfx.play('tank', { volume: 0.9 }));
      [3200, 3600, 4000, 4700, 5200].forEach((ms) => at(ms, () => {
        sfx.play('cannon');
        haptic('heavy');
      }));
    } else if (in3d && st === 'archers') {
      // барымта: топот подходит, кружат, два залпа огненных стрел
      sfx.play('gallop', { volume: 0.8 });
      at(1100, () => sfx.play('gallop', { volume: 1.1 }));
      at(2300, () => sfx.play('gallop', { volume: 1 }));
      at(2600, () => sfx.play('arrows'));
      at(3150, () => sfx.play('fire'));
      at(3500, () => sfx.play('arrows'));
      at(4050, () => sfx.play('fire'));
      at(4800, () => sfx.play('gallop', { volume: 0.6 }));
      at(3200, () => haptic('heavy'));
    } else if (in3d && charge) {
      // тяжёлая конница: разгон и таран
      sfx.play('gallop', { volume: 0.9 });
      at(1000, () => sfx.play('gallop', { volume: 1.3 }));
      at(2350, () => sfx.play('cannon', { volume: 0.7, pitch: 0.7 }));
      at(2350, () => haptic('heavy'));
      at(2700, () => sfx.play('gallop', { volume: 0.8 }));
    } else if (in3d && st === 'ninja') {
      [200, 420, 640, 860].forEach((ms) => at(ms, () => sfx.play('whoosh', { volume: 0.7 })));
      [2000, 2200, 2400, 2700, 2900, 3100].forEach((ms) => at(ms, () => sfx.play('shuriken', { volume: 0.6 })));
      at(2400, () => haptic('heavy'));
      at(4300, () => sfx.play('whoosh', { volume: 1 }));
    } else if (in3d && st === 'samurai' && event.era === 'japan') {
      at(300, () => sfx.play('gallop', { volume: 0.5, pitch: 1.4 }));
      [2200, 2600, 3000, 3500].forEach((ms) => at(ms, () => sfx.play('slash')));
      at(3000, () => haptic('heavy'));
    } else switch (st) {
      case 'archers':
        sfx.play('gallop');
        at(850, () => sfx.play('arrows'));
        break;
      case 'ninja':
        sfx.play('whoosh');
        at(600, () => sfx.play('shuriken'));
        break;
      case 'samurai':
        sfx.play('attack');
        break;
      case 'bomber':
        sfx.play('siren');
        at(500, () => sfx.play('plane', { volume: 1.3 }));
        at(1500, () => sfx.play('plane', { volume: 1.1 }));
        at(1950, () => sfx.play('bomb'));
        at(2250, () => sfx.play('bomb', { volume: 0.8 }));
        at(1600, () => haptic('heavy'));
        break;
      case 'tank':
        sfx.play('tank');
        at(1100, () => haptic('heavy'));
        break;
    }
    at(dur + 200, () => setShown((s) => (s?.key === event.key ? null : s)));
    return () => timers.forEach(clearTimeout);
  }, [event?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shown) return null;
  // В 3D самолёты и танки летают/едут прямо над картой — здесь только звук
  if (skipBomber && shown.target) return null;
  return (
    <FxPortal>
      <RaidScene key={shown.key} ev={shown} />
    </FxPortal>
  );
}

function RaidScene({ ev }: { ev: RaidEvent }) {
  const root = useRef<HTMLDivElement>(null);
  const st = styleOf(ev);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const p = (ev.target && boardLocator.fn?.(ev.target)) || { x: W / 2, y: H * 0.45 };
    const q = (sel: string) => el.querySelector<HTMLElement>(sel);
    const all = (sel: string) => [...el.querySelectorAll<HTMLElement>(sel)];
    const anims: Animation[] = [];
    const run = (n: HTMLElement | null, k: Keyframe[], o: KeyframeAnimationOptions) => {
      // С задержкой — не показывать первый кадр заранее (бомбы не должны висеть до сброса)
      if (n) anims.push(n.animate(k, { fill: o.delay ? 'forwards' : 'both', ...o }));
    };
    const at = (n: HTMLElement | null, x: number, y: number) => {
      if (n) n.style.transform = `translate(${x}px, ${y}px)`;
    };

    // Вспышка и пыль на самой цели
    const boom = (delay: number, size: number, dx = 0, dy = 0) => {
      const b = document.createElement('i');
      b.className = 'raid-hit';
      b.style.width = b.style.height = `${size}px`;
      b.style.left = `${p.x + dx - size / 2}px`;
      b.style.top = `${p.y + dy - size / 2}px`;
      el.appendChild(b);
      run(b, [{ transform: 'scale(.1)', opacity: 0 }, { transform: 'scale(.9)', opacity: 1, offset: 0.2 }, { transform: 'scale(1.35)', opacity: 0 }], { duration: 750, delay, easing: 'ease-out' });
    };

    if (st === 'bomber') {
      const plane = q('.raid-plane');
      const shadow = q('.raid-plane-shadow');
      const pw = Math.min(W * 0.62, 420);
      const alt = Math.min(H * 0.2, 170);
      // Пролёт: слева над целью направо; тень бежит по земле через цель
      run(plane, [
        { transform: `translate(${-pw - 40}px, ${p.y - alt - pw * 0.25 + 40}px) scale(.85)` },
        { transform: `translate(${p.x - pw * 0.5}px, ${p.y - alt - pw * 0.25}px) scale(1)`, offset: 0.42 },
        { transform: `translate(${W + 40}px, ${p.y - alt - pw * 0.25 - 50}px) scale(1.05)` },
      ], { duration: 2600, easing: 'cubic-bezier(.35,.1,.65,.9)' });
      run(shadow, [
        { transform: `translate(${-pw}px, ${p.y - 10}px)`, opacity: 0 },
        { transform: `translate(${p.x - pw * 0.4}px, ${p.y - 10}px)`, opacity: 0.45, offset: 0.42 },
        { transform: `translate(${W + 40}px, ${p.y - 10}px)`, opacity: 0 },
      ], { duration: 2600, easing: 'cubic-bezier(.35,.1,.65,.9)' });
      all('.raid-bomb').forEach((b, i) => {
        const dx = (i - 1.5) * 14;
        run(b, [
          { transform: `translate(${p.x + dx - 40}px, ${p.y - alt + 10}px) rotate(-30deg)`, opacity: 1 },
          { transform: `translate(${p.x + dx * 1.6}px, ${p.y - 6}px) rotate(0deg)`, opacity: 1, offset: 0.95 },
          { transform: `translate(${p.x + dx * 1.6}px, ${p.y - 6}px)`, opacity: 0 },
        ], { duration: 560, delay: 900 + i * 90, easing: 'cubic-bezier(.5,0,1,.7)' });
      });
      boom(1450, 150, -12, 0);
      boom(1560, 120, 18, 8);
      boom(1680, 90, -4, -14);
    } else if (st === 'archers') {
      const rider = q('.raid-rider');
      const rw = Math.min(W * 0.5, 340);
      const y = p.y - rw * 0.55;
      run(rider, [
        { transform: `translate(${-rw - 30}px, ${y + 30}px)` },
        { transform: `translate(${p.x - rw * 0.95}px, ${y}px)`, offset: 0.45 },
        { transform: `translate(${p.x - rw * 0.85}px, ${y - 8}px)`, offset: 0.6 },
        { transform: `translate(${W + 30}px, ${y + 20}px)` },
      ], { duration: 2200, easing: 'cubic-bezier(.4,.1,.6,.9)' });
      all('.raid-arrow').forEach((a, i) => {
        const sx = p.x - rw * 0.25;
        const sy = y + rw * 0.2;
        const dx = (i % 5 - 2) * 12;
        const dy = (Math.floor(i / 5) - 1) * 10;
        run(a, [
          { transform: `translate(${sx}px, ${sy}px) rotate(-60deg)`, opacity: 1 },
          { transform: `translate(${(sx + p.x) / 2 + dx}px, ${sy - 70}px) rotate(0deg)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${p.x + dx}px, ${p.y + dy}px) rotate(55deg)`, opacity: 1, offset: 0.98 },
          { transform: `translate(${p.x + dx}px, ${p.y + dy}px) rotate(55deg)`, opacity: 0 },
        ], { duration: 620, delay: 900 + i * 45, easing: 'cubic-bezier(.3,.2,.7,1)' });
      });
      boom(1500, 110);
    } else if (st === 'ninja') {
      const n = q('.raid-ninja');
      const nw = Math.min(W * 0.4, 260);
      run(n, [
        { transform: `translate(${-nw}px, ${p.y - nw * 0.2}px) rotate(-14deg)`, opacity: 0 },
        { transform: `translate(${p.x * 0.5 - nw / 2}px, ${p.y - nw * 1.3}px) rotate(0deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${p.x - nw / 2}px, ${p.y - nw * 0.85}px) rotate(8deg)`, opacity: 1, offset: 0.62 },
        { transform: `translate(${p.x - nw / 2}px, ${p.y - nw * 0.85}px) scale(.6)`, opacity: 0 },
      ], { duration: 1800, easing: 'cubic-bezier(.3,.6,.4,1)' });
      all('.raid-star').forEach((s, i) => {
        run(s, [
          { transform: `translate(${p.x * 0.5}px, ${p.y - nw}px) rotate(0)`, opacity: 1 },
          { transform: `translate(${p.x + (i - 1) * 16}px, ${p.y + (i % 2) * 8}px) rotate(900deg)`, opacity: 1, offset: 0.95 },
          { opacity: 0 },
        ], { duration: 520, delay: 500 + i * 80, easing: 'linear' });
      });
      boom(1100, 120);
    } else if (st === 'tank') {
      const t = q('.raid-tank');
      const tw = Math.min(W * 0.62, 420);
      const y = H * 0.62;
      run(t, [
        { transform: `translate(${-tw - 20}px, ${y}px)` },
        { transform: `translate(${W * 0.12}px, ${y}px)`, offset: 0.45 },
        { transform: `translate(${W * 0.1}px, ${y + 2}px)`, offset: 0.5 },
        { transform: `translate(${W * 0.12}px, ${y}px)`, offset: 0.58 },
        { transform: `translate(${W + 20}px, ${y}px)` },
      ], { duration: 2200, easing: 'cubic-bezier(.25,.6,.4,1)' });
      const flash = q('.raid-muzzle');
      at(flash, W * 0.12 + tw * 0.92, y + tw * 0.08);
      run(flash, [{ opacity: 0, transform: `translate(${W * 0.12 + tw * 0.92}px, ${y + tw * 0.08}px) scale(.3)` }, { opacity: 1, transform: `translate(${W * 0.12 + tw * 0.92}px, ${y + tw * 0.08}px) scale(1.2)`, offset: 0.3 }, { opacity: 0, transform: `translate(${W * 0.12 + tw * 0.92}px, ${y + tw * 0.08}px) scale(1.6)` }], { duration: 380, delay: 1050 });
    } else {
      const s = q('.raid-hero');
      run(s, [
        { transform: `translate(-50%, -50%) scale(.3)`, opacity: 0 },
        { transform: `translate(-50%, -50%) scale(1.05)`, opacity: 1, offset: 0.25 },
        { transform: `translate(-50%, -50%) scale(1)`, opacity: 1, offset: 0.75 },
        { transform: `translate(-50%, -50%) scale(1.15)`, opacity: 0 },
      ], { duration: 1500, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }
    return () => anims.forEach((a) => a.cancel());
  }, [ev, st]);

  return (
    <div ref={root} className={`fx-raid raid-${st} ${ev.kind}`} aria-hidden>
      <div className="raid-tint" />
      {st === 'bomber' && (
        <>
          <img className="raid-plane-shadow" src={ev.sprite} alt="" />
          <img className="raid-plane" src={ev.sprite} alt="" />
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className="raid-bomb" />
          ))}
        </>
      )}
      {st === 'archers' && (
        <>
          <img className="raid-rider" src={ev.sprite} alt="" />
          {Array.from({ length: 15 }, (_, i) => (
            <i key={i} className="raid-arrow" />
          ))}
        </>
      )}
      {st === 'ninja' && (
        <>
          <img className="raid-ninja" src={ev.sprite} alt="" />
          {[0, 1, 2].map((i) => (
            <i key={i} className="raid-star" />
          ))}
        </>
      )}
      {st === 'tank' && (
        <>
          <img className="raid-tank" src={ev.sprite} alt="" />
          <i className="raid-muzzle" />
        </>
      )}
      {st === 'samurai' && (
        <>
          <img className="raid-hero" src={ev.sprite} alt="" />
          <i className="raid-slash" />
        </>
      )}
    </div>
  );
}
