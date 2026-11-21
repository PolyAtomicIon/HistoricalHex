import { tgHaptic } from '../app/tg';
// Synthesized sound kit (Web Audio, no files) + haptics.
import { useSyncExternalStore } from 'react';

export type SfxName =
  | 'diceShake' | 'diceLand' | 'tick' | 'pop' | 'coin' | 'chime' | 'whoosh' | 'tudum'
  | 'attack' | 'fanfare' | 'victory' | 'error' | 'yourTurn' | 'react' | 'steal'
  | 'gallop' | 'arrows' | 'plane' | 'bomb' | 'shuriken' | 'tank' | 'siren';

export interface SfxOpts {
  /** 0..1.5 extra gain for this call */
  volume?: number;
  /** used by 'coin': pitch rises with count */
  count?: number;
  /** seconds to delay start */
  delay?: number;
  /** pitch multiplier */
  pitch?: number;
}

const MUTE_KEY = 'hh.muted';
const VOL_KEY = 'hh.volume';

function lsGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function lsSet(k: string, v: string): void {
  try { localStorage.setItem(k, v); } catch { /* ignore */ }
}

let muted = typeof window !== 'undefined' && lsGet(MUTE_KEY) === '1';
let volume = (() => {
  const v = typeof window !== 'undefined' ? parseFloat(lsGet(VOL_KEY) ?? '') : NaN;
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.7;
})();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    audio();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
    window.removeEventListener('touchend', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  window.addEventListener('touchend', unlock, true);
  window.addEventListener('storage', (e) => {
    if (e.key === MUTE_KEY) { muted = e.newValue === '1'; emit(); }
  });
}

function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

interface Ctx { c: AudioContext; t0: number; g: number; p: number }

/** Oscillator note with exponential decay envelope and optional pitch slide. */
function tone(x: Ctx, o: {
  at?: number; f: number; to?: number; dur: number; type?: OscillatorType;
  gain?: number; attack?: number; lp?: number; detune?: number;
}): void {
  const { c } = x;
  const t = x.t0 + (o.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f * x.p, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to * x.p), t + o.dur);
  if (o.detune) osc.detune.value = o.detune;
  const peak = (o.gain ?? 0.3) * x.g;
  const a = o.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  let node: AudioNode = osc;
  if (o.lp) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lp;
    osc.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(master!);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

/** Filtered noise burst. */
function hiss(x: Ctx, o: {
  at?: number; dur: number; type?: BiquadFilterType; f: number; to?: number; q?: number;
  gain?: number; attack?: number;
}): void {
  const { c } = x;
  const t = x.t0 + (o.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(o.f, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  f.Q.value = o.q ?? 1;
  const g = c.createGain();
  const a = o.attack ?? 0.003;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime((o.gain ?? 0.3) * x.g, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f);
  f.connect(g);
  g.connect(master!);
  src.start(t, Math.random() * 0.5);
  src.stop(t + o.dur + 0.05);
}

const bell = (x: Ctx, at: number, f: number, dur = 0.9, gain = 0.2) => {
  tone(x, { at, f, dur, gain });
  tone(x, { at, f: f * 2.76, dur: dur * 0.5, gain: gain * 0.35 });
  tone(x, { at, f: f * 5.4, dur: dur * 0.25, gain: gain * 0.15 });
};

const brass = (x: Ctx, at: number, f: number, dur: number, gain = 0.16) => {
  tone(x, { at, f, dur, type: 'sawtooth', gain, attack: 0.03, lp: 1800 });
  tone(x, { at, f, dur, type: 'sawtooth', gain: gain * 0.7, attack: 0.03, lp: 1400, detune: 8 });
};

const knock = (x: Ctx, at: number, f: number, gain = 0.5) => {
  tone(x, { at, f, to: f * 0.5, dur: 0.09, type: 'triangle', gain });
  tone(x, { at, f: f * 2.1, to: f, dur: 0.05, gain: gain * 0.4 });
  hiss(x, { at, dur: 0.04, f: 2200, q: 1.2, gain: gain * 0.6 });
};

const drum = (x: Ctx, at: number, f: number, gain = 0.6, len = 0.35) => {
  tone(x, { at, f, to: f * 0.45, dur: len, gain });
  hiss(x, { at, dur: 0.06, type: 'lowpass', f: 700, gain: gain * 0.5 });
};

const RECIPES: Record<SfxName, (x: Ctx, o: SfxOpts) => void> = {
  siren: (x) => {
    // воздушная тревога: вой вверх-вниз, две волны
    for (let i = 0; i < 2; i++) {
      const at = i * 1.1;
      tone(x, { at, f: 330, to: 620, dur: 0.55, type: 'sawtooth', gain: 0.09, attack: 0.15, lp: 1600 });
      tone(x, { at: at + 0.55, f: 620, to: 330, dur: 0.55, type: 'sawtooth', gain: 0.08, attack: 0.02, lp: 1600 });
      tone(x, { at, f: 332, to: 624, dur: 0.55, type: 'square', gain: 0.03, attack: 0.15, lp: 1200 });
    }
  },
  gallop: (x) => {
    // топот: тройки ударов, нарастает и уходит
    for (let i = 0; i < 7; i++) {
      const env = Math.sin((i / 6) * Math.PI) * 0.8 + 0.2;
      const at = i * 0.21;
      knock(x, at, 170, 0.5 * env);
      knock(x, at + 0.06, 150, 0.4 * env);
      knock(x, at + 0.11, 190, 0.45 * env);
    }
  },
  arrows: (x) => {
    for (let i = 0; i < 6; i++) {
      hiss(x, { at: i * 0.06, dur: 0.35, type: 'highpass', f: 2500, to: 6000, q: 2, gain: 0.12, attack: 0.02 });
    }
    for (let i = 0; i < 5; i++) knock(x, 0.45 + i * 0.05 + Math.random() * 0.03, 700 + Math.random() * 300, 0.25);
  },
  plane: (x) => {
    tone(x, { f: 70, to: 95, dur: 1.8, type: 'sawtooth', gain: 0.16, attack: 0.5, lp: 420 });
    tone(x, { f: 72, to: 92, dur: 1.8, type: 'sawtooth', gain: 0.12, attack: 0.5, lp: 380, detune: 14 });
    hiss(x, { dur: 1.8, type: 'lowpass', f: 300, to: 900, gain: 0.18, attack: 0.6 });
  },
  bomb: (x) => {
    tone(x, { f: 1400, to: 300, dur: 0.6, gain: 0.05, attack: 0.05 });
    drum(x, 0.6, 60, 1, 1.2);
    tone(x, { at: 0.6, f: 38, to: 24, dur: 1.4, gain: 0.9, attack: 0.01 });
    hiss(x, { at: 0.6, dur: 1.1, type: 'lowpass', f: 1200, to: 90, gain: 0.55 });
  },
  shuriken: (x) => {
    for (let i = 0; i < 3; i++) {
      tone(x, { at: i * 0.12, f: 3200, to: 1800, dur: 0.22, type: 'triangle', gain: 0.06 });
      hiss(x, { at: i * 0.12, dur: 0.2, type: 'bandpass', f: 5000, to: 3000, q: 6, gain: 0.12 });
    }
    knock(x, 0.5, 1200, 0.3);
  },
  tank: (x) => {
    tone(x, { f: 45, to: 55, dur: 1.6, type: 'sawtooth', gain: 0.2, attack: 0.3, lp: 220 });
    for (let i = 0; i < 10; i++) knock(x, i * 0.14, 300 + (i % 2) * 60, 0.12);
    drum(x, 1.1, 90, 1, 0.6);
    hiss(x, { at: 1.1, dur: 0.5, type: 'lowpass', f: 2000, to: 200, gain: 0.5 });
  },
  diceShake: (x) => {
    let t = 0;
    for (let i = 0; i < 16; i++) {
      const env = 1 - i / 22;
      hiss(x, { at: t, dur: 0.035, f: 2000 + Math.random() * 2500, q: 2.5, gain: 0.35 * env });
      if (i % 3 === 0) tone(x, { at: t, f: 700 + Math.random() * 500, to: 300, dur: 0.04, type: 'triangle', gain: 0.12 * env });
      t += 0.025 + Math.random() * 0.045;
    }
  },
  diceLand: (x) => {
    knock(x, 0, 560, 0.55);
    knock(x, 0.14, 470, 0.45);
  },
  tick: (x) => {
    tone(x, { f: 1500, to: 1100, dur: 0.05, gain: 0.22 });
    hiss(x, { dur: 0.015, f: 4000, gain: 0.08 });
  },
  pop: (x) => {
    tone(x, { f: 260, to: 720, dur: 0.12, gain: 0.4 });
    tone(x, { at: 0.02, f: 980, to: 520, dur: 0.1, gain: 0.12 });
    hiss(x, { dur: 0.03, f: 1800, gain: 0.12 });
  },
  coin: (x, o) => {
    const n = Math.min(Math.max(o.count ?? 1, 1), 10);
    const r = Math.pow(2, (n - 1) / 12);
    const hits = Math.min(n, 3);
    for (let i = 0; i < hits; i++) {
      const at = i * 0.07;
      tone(x, { at, f: 1318 * r, dur: 0.07, type: 'square', gain: 0.1, lp: 5000 });
      tone(x, { at: at + 0.06, f: 1760 * r, dur: 0.35, type: 'square', gain: 0.09, lp: 6000 });
      tone(x, { at: at + 0.06, f: 3520 * r, dur: 0.2, gain: 0.05 });
    }
  },
  chime: (x) => {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(x, i * 0.09, f, 0.9, 0.18));
  },
  whoosh: (x) => {
    hiss(x, { dur: 0.3, f: 500, to: 3200, q: 0.9, gain: 0.22, attack: 0.1 });
    tone(x, { f: 300, to: 900, dur: 0.18, gain: 0.05 });
  },
  tudum: (x) => {
    drum(x, 0, 95, 0.8, 0.5);
    tone(x, { f: 48, to: 34, dur: 0.9, gain: 0.7, attack: 0.01 });
    drum(x, 0.3, 80, 1, 0.9);
    tone(x, { at: 0.3, f: 42, to: 28, dur: 1.5, gain: 0.9, attack: 0.012 });
    hiss(x, { at: 0.3, dur: 0.6, type: 'lowpass', f: 400, to: 80, gain: 0.35 });
  },
  attack: (x) => {
    hiss(x, { dur: 0.28, type: 'highpass', f: 1500, to: 7000, q: 0.7, gain: 0.35, attack: 0.12 });
    tone(x, { f: 2200, to: 900, dur: 0.12, type: 'sawtooth', gain: 0.04, lp: 4000 });
    drum(x, 0.3, 120, 0.7, 0.3);
    drum(x, 0.45, 120, 0.7, 0.3);
    drum(x, 0.6, 105, 0.95, 0.5);
    brass(x, 0.62, 196, 0.5, 0.13);
    brass(x, 0.62, 294, 0.5, 0.09);
  },
  fanfare: (x) => {
    brass(x, 0, 261.6, 0.18);
    brass(x, 0.17, 329.6, 0.18);
    brass(x, 0.34, 392, 0.18);
    brass(x, 0.52, 523.3, 0.8, 0.18);
    brass(x, 0.52, 392, 0.8, 0.1);
    bell(x, 0.55, 1568, 1, 0.1);
    drum(x, 0, 110, 0.4, 0.25);
    drum(x, 0.52, 100, 0.6, 0.5);
  },
  victory: (x) => {
    const seq: [number, number][] = [[0, 261.6], [0.14, 329.6], [0.28, 392], [0.42, 523.3], [0.7, 392], [0.84, 523.3], [0.98, 659.3]];
    seq.forEach(([t, f]) => brass(x, t, f, 0.16, 0.17));
    brass(x, 1.2, 784, 1.4, 0.2);
    brass(x, 1.2, 523.3, 1.4, 0.12);
    brass(x, 1.2, 392, 1.4, 0.1);
    [1046, 1318, 1568, 2093, 2637].forEach((f, i) => bell(x, 1.25 + i * 0.1, f, 1.2, 0.12));
    drum(x, 0, 110, 0.5, 0.3);
    drum(x, 0.7, 110, 0.5, 0.3);
    drum(x, 1.2, 90, 0.9, 0.8);
    hiss(x, { at: 1.2, dur: 1.2, type: 'highpass', f: 6000, gain: 0.08, attack: 0.05 });
  },
  error: (x) => {
    tone(x, { f: 220, to: 120, dur: 0.16, type: 'triangle', gain: 0.35 });
    tone(x, { at: 0.02, f: 110, to: 70, dur: 0.14, gain: 0.2 });
  },
  yourTurn: (x) => {
    bell(x, 0, 880, 1.1, 0.22);
    bell(x, 0.16, 1318.5, 1.3, 0.2);
  },
  react: (x) => {
    tone(x, { f: 420, to: 980, dur: 0.1, gain: 0.3 });
    tone(x, { at: 0.07, f: 640, to: 1400, dur: 0.1, gain: 0.22 });
    hiss(x, { at: 0.12, dur: 0.03, f: 3500, gain: 0.07 });
  },
  steal: (x) => {
    [520, 440, 620, 330].forEach((f, i) => {
      tone(x, { at: i * 0.09, f, to: f * 0.8, dur: 0.14, type: 'triangle', gain: 0.28 });
      tone(x, { at: i * 0.09, f: f * 2, dur: 0.05, gain: 0.08 });
    });
  },
};

function play(name: SfxName, opts: SfxOpts = {}): void {
  if (muted) return;
  const c = audio();
  if (!c || !master) return;
  const recipe = RECIPES[name];
  if (!recipe) return;
  try {
    recipe({ c, t0: c.currentTime + 0.01 + (opts.delay ?? 0), g: opts.volume ?? 1, p: opts.pitch ?? 1 }, opts);
  } catch { /* audio must never break the game */ }
}

export const sfx = {
  play,
  /** Call from a user gesture to make sure audio is unlocked. */
  unlock(): void { audio(); },
  get muted(): boolean { return muted; },
  set muted(v: boolean) {
    if (v === muted) return;
    muted = v;
    lsSet(MUTE_KEY, v ? '1' : '0');
    emit();
  },
  get volume(): number { return volume; },
  set volume(v: number) {
    volume = Math.min(1, Math.max(0, v));
    lsSet(VOL_KEY, String(volume));
    if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
    emit();
  },
  subscribe(fn: () => void): () => void {
    subs.add(fn);
    return () => { subs.delete(fn); };
  },
};

export function useMuted(): [boolean, (v: boolean) => void] {
  const m = useSyncExternalStore(sfx.subscribe, () => muted, () => false);
  return [m, (v: boolean) => { sfx.muted = v; }];
}

export type HapticPattern = number | number[] | 'tap' | 'success' | 'heavy' | 'error';
const PATTERNS: Record<string, number | number[]> = {
  tap: 8, success: [10, 40, 18], heavy: [30, 30, 60], error: [40, 40, 40],
};

export function haptic(pattern: HapticPattern = 'tap'): void {
  try {
    const kind = typeof pattern === 'string' ? pattern : 'heavy';
    if ((kind === 'tap' || kind === 'success' || kind === 'error' || kind === 'heavy') && tgHaptic(kind)) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(typeof pattern === 'string' ? PATTERNS[pattern] ?? 8 : pattern);
  } catch { /* unsupported */ }
}
