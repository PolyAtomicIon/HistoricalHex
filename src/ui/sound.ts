// Звуки Хексленда: синтезируются прямо в браузере (Web Audio), без файлов и лицензий.
// Браузер разрешает звук только после первого нажатия на страницу — это делается автоматически.

import { useSyncExternalStore } from 'react';
import { storage } from './hooks';

export type SoundName = 'dice' | 'gain' | 'build' | 'turn' | 'robber' | 'trade' | 'card' | 'win';

const MUTE_KEY = 'hexland.muted';
let muted = storage.get(MUTE_KEY) === '1';
const subscribers = new Set<() => void>();

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// Разблокировка звука первым касанием / нажатием
if (typeof window !== 'undefined') {
  const unlock = () => {
    audio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  storage.set(MUTE_KEY, value ? '1' : '0');
  subscribers.forEach((f) => f());
}

/** [muted, toggle] — для кнопки 🔊/🔇. */
export function useMuted(): [boolean, () => void] {
  const value = useSyncExternalStore(
    (cb) => {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    () => muted,
  );
  return [value, () => setMuted(!muted)];
}

// ───────────────────────── кирпичики ─────────────────────────

interface ToneOpts {
  freq: number;
  at?: number;
  dur?: number;
  vol?: number;
  type?: OscillatorType;
  slideTo?: number;
}

function tone(c: AudioContext, { freq, at = 0, dur = 0.2, vol = 0.2, type = 'sine', slideTo }: ToneOpts) {
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master!);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(c: AudioContext, { at = 0, dur = 0.05, vol = 0.3, freq = 2000, q = 1 }: Omit<ToneOpts, 'freq' | 'type'> & { freq?: number; q?: number }) {
  const t0 = c.currentTime + at;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master!);
  src.start(t0);
}

// ───────────────────────── звуки ─────────────────────────

const RECIPES: Record<SoundName, (c: AudioContext) => void> = {
  // Стук кубиков: серия деревянных щелчков
  dice(c) {
    let t = 0;
    for (let i = 0; i < 7; i++) {
      t += 0.04 + Math.random() * 0.07;
      noise(c, { at: t, dur: 0.035, vol: 0.5 - i * 0.05, freq: 1800 + Math.random() * 1500, q: 3 });
      tone(c, { freq: 300 + Math.random() * 200, at: t, dur: 0.05, vol: 0.06, type: 'triangle' });
    }
  },
  // Монетка: два звонких тона
  gain(c) {
    tone(c, { freq: 988, dur: 0.12, vol: 0.12, type: 'triangle' });
    tone(c, { freq: 1319, at: 0.07, dur: 0.3, vol: 0.12, type: 'triangle' });
  },
  // Постройка: глухой «тук» с призвуком
  build(c) {
    tone(c, { freq: 180, dur: 0.18, vol: 0.35, type: 'sine', slideTo: 90 });
    noise(c, { dur: 0.06, vol: 0.25, freq: 900, q: 1.5 });
    tone(c, { freq: 523, at: 0.05, dur: 0.15, vol: 0.05, type: 'triangle' });
  },
  // «Твой ход»: два восходящих колокольчика
  turn(c) {
    tone(c, { freq: 659, dur: 0.25, vol: 0.13, type: 'triangle' });
    tone(c, { freq: 988, at: 0.12, dur: 0.45, vol: 0.13, type: 'triangle' });
  },
  // Разбойник / семёрка: мрачное «дун-дун»
  robber(c) {
    tone(c, { freq: 196, dur: 0.3, vol: 0.18, type: 'sawtooth', slideTo: 185 });
    tone(c, { freq: 147, at: 0.28, dur: 0.5, vol: 0.18, type: 'sawtooth', slideTo: 110 });
    noise(c, { at: 0.28, dur: 0.2, vol: 0.08, freq: 300, q: 0.7 });
  },
  // Обмен: «блип-блип»
  trade(c) {
    tone(c, { freq: 587, dur: 0.1, vol: 0.12, type: 'square' });
    tone(c, { freq: 880, at: 0.1, dur: 0.16, vol: 0.1, type: 'square' });
  },
  // Карта развития: шорох + аккорд
  card(c) {
    noise(c, { dur: 0.25, vol: 0.18, freq: 3500, q: 0.6 });
    tone(c, { freq: 523, at: 0.12, dur: 0.5, vol: 0.08, type: 'triangle' });
    tone(c, { freq: 659, at: 0.16, dur: 0.5, vol: 0.08, type: 'triangle' });
    tone(c, { freq: 784, at: 0.2, dur: 0.6, vol: 0.08, type: 'triangle' });
  },
  // Победа: фанфара
  win(c) {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(c, { freq: f, at: i * 0.14, dur: 0.3, vol: 0.15, type: 'triangle' }));
    tone(c, { freq: 1047, at: 0.56, dur: 1.1, vol: 0.15, type: 'triangle' });
    tone(c, { freq: 784, at: 0.56, dur: 1.1, vol: 0.1, type: 'triangle' });
    tone(c, { freq: 523, at: 0.56, dur: 1.1, vol: 0.1, type: 'triangle' });
  },
};

export function playSound(name: SoundName, delayMs = 0): void {
  if (muted) return;
  const run = () => {
    if (muted) return;
    const c = audio();
    if (!c || !master) return;
    try {
      RECIPES[name](c);
    } catch {
      /* звук не критичен */
    }
  };
  if (delayMs > 0) setTimeout(run, delayMs);
  else run();
}
