// Фоновая музыка эпохи — генеративная (WebAudio, без файлов):
//   genghis — бурдон квинтой + пентатонические «домбровые» переборы;
//   japan   — щипки в ладу «ин» (как кото) с эхом, тихий фон;
//   ww2     — медленные минорные аккорды (гармошка/струнные), редкие колокольчики.
// Тихо (≈ −24 дБ), стартует только после жеста пользователя, выключается в меню.

import { useSyncExternalStore } from 'react';

const KEY = 'hh.music';
let on = (() => {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
})();
const subs = new Set<() => void>();

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let echo: DelayNode | null = null;
let current: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let wanted: string | null = null;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    // Мягкое эхо — даёт «зал» без тяжёлого ревёрба
    echo = ctx.createDelay(1.5);
    echo.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    echo.connect(lp);
    lp.connect(fb);
    fb.connect(echo);
    lp.connect(master);
    master.connect(ctx.destination);
    return ctx;
  } catch {
    return null;
  }
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function note(f: number, at: number, dur: number, opts: { type?: OscillatorType; gain?: number; attack?: number; lp?: number; echo?: number } = {}) {
  const c = ctx!;
  const o = c.createOscillator();
  o.type = opts.type ?? 'triangle';
  o.frequency.value = f;
  const g = c.createGain();
  const peak = opts.gain ?? 0.12;
  const a = opts.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(peak, at + a);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  let node: AudioNode = o;
  if (opts.lp) {
    const f2 = c.createBiquadFilter();
    f2.type = 'lowpass';
    f2.frequency.value = opts.lp;
    o.connect(f2);
    node = f2;
  }
  node.connect(g);
  g.connect(master!);
  if (opts.echo && echo) {
    const s = c.createGain();
    s.gain.value = opts.echo;
    g.connect(s);
    s.connect(echo);
  }
  o.start(at);
  o.stop(at + dur + 0.05);
}

/** Один «такт» музыки эпохи (≈ 4–8 с), потом планируется следующий. */
const BARS: Record<string, (t: number) => number> = {
  genghis: (t) => {
    // бурдон: ля + ми
    note(midi(45), t, 8.5, { type: 'sawtooth', gain: 0.05, attack: 1.5, lp: 500 });
    note(midi(52), t, 8.5, { type: 'sawtooth', gain: 0.035, attack: 1.8, lp: 600 });
    // пентатоника ля-минор: ля до ре ми соль
    const scale = [57, 60, 62, 64, 67, 69, 72];
    let x = t + 0.4;
    for (let i = 0; i < 12; i++) {
      const n = scale[Math.floor(Math.random() * scale.length)];
      note(midi(n), x, 0.9, { type: 'triangle', gain: 0.09, echo: 0.25 });
      if (Math.random() < 0.35) note(midi(n - 12), x, 0.6, { type: 'triangle', gain: 0.05 });
      x += [0.25, 0.25, 0.5, 0.75][Math.floor(Math.random() * 4)];
      if (x > t + 7.5) break;
    }
    return 8;
  },
  japan: (t) => {
    note(midi(50), t, 9, { type: 'sine', gain: 0.05, attack: 2 });
    // лад «ин»: ре ми♭ соль ля си♭
    const scale = [62, 63, 67, 69, 70, 74, 75];
    let x = t + 0.6;
    for (let i = 0; i < 7; i++) {
      const n = scale[Math.floor(Math.random() * scale.length)];
      note(midi(n), x, 2.2, { type: 'triangle', gain: 0.1, echo: 0.45 });
      x += [0.6, 0.9, 1.2, 1.5][Math.floor(Math.random() * 4)];
      if (x > t + 8) break;
    }
    return 9;
  },
  ww2: (t) => {
    // ля-минор → фа → до → ми: медленные аккорды
    const chords = [
      [57, 60, 64],
      [53, 57, 60],
      [48, 52, 55],
      [52, 56, 59],
    ];
    const ch = chords[Math.floor((t / 6) % 4)] ?? chords[0];
    for (const n of ch) note(midi(n), t, 6.2, { type: 'sawtooth', gain: 0.035, attack: 1.4, lp: 900 });
    note(midi(ch[0] - 12), t, 6.2, { type: 'triangle', gain: 0.06, attack: 1 });
    if (Math.random() < 0.5) note(midi(ch[2] + 12), t + 2 + Math.random() * 2, 2.5, { type: 'sine', gain: 0.05, echo: 0.4 });
    return 6;
  },
};

function schedule() {
  if (!ctx || !current) return;
  const bar = BARS[current] ?? BARS.genghis;
  const len = bar(ctx.currentTime + 0.05);
  timer = setTimeout(schedule, len * 1000 - 60);
}

function fadeTo(v: number, sec: number) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(v, t + sec);
}

function apply() {
  if (!on || !wanted) {
    fadeTo(0, 1.2);
    if (timer) clearTimeout(timer);
    timer = null;
    current = null;
    return;
  }
  if (!ensure()) return;
  if (ctx!.state === 'suspended') void ctx!.resume();
  if (current === wanted && timer) return;
  if (timer) clearTimeout(timer);
  current = wanted;
  fadeTo(0.55, 2.5);
  schedule();
}

/** Включить музыку эпохи (или null — тишина). Реально зазвучит после первого жеста пользователя. */
export function playEraMusic(era: string | null): void {
  wanted = era;
  if (ctx) apply();
}

export function setMusicOn(v: boolean): void {
  on = v;
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch {
    /* ok */
  }
  subs.forEach((f) => f());
  apply();
}

export function useMusicOn(): [boolean, (v: boolean) => void] {
  const v = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => on,
  );
  return [v, setMusicOn];
}

// Браузер разрешает звук только после жеста — стартуем на первом касании
if (typeof window !== 'undefined') {
  const kick = () => {
    if (wanted && on) apply();
  };
  window.addEventListener('pointerdown', kick, { passive: true });
  window.addEventListener('keydown', kick);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else if (on && wanted) void ctx.resume();
  });
}
