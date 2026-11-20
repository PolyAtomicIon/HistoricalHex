// Иконки интерфейса HistoricalHex: свой линейный набор (24×24, линия 1.8, скругления).
// Картинки эпох (ресурсы, карты, эмблемы) — растровые, сгенерированы через Codex: см. ArtIcon.

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export type IconName =
  | 'menu'
  | 'plan'
  | 'cards'
  | 'book'
  | 'smile'
  | 'layers'
  | 'dice'
  | 'road'
  | 'house'
  | 'castle'
  | 'trade'
  | 'bank'
  | 'next'
  | 'sound'
  | 'mute'
  | 'crown'
  | 'door'
  | 'bot'
  | 'star'
  | 'hand'
  | 'close'
  | 'bulb'
  | 'tv'
  | 'check'
  | 'skip'
  | 'ban'
  | 'play'
  | 'up'
  | 'feather';

const P: Record<IconName, ReactNode> = {
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  plan: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="3" />
      <path d="M9 4.5V3.8c0-.4.4-.8.8-.8h4.4c.4 0 .8.4.8.8v.7M8.5 10.5l1.5 1.5 3-3M8.5 16h7" />
    </>
  ),
  cards: (
    <>
      <rect x="7" y="4" width="12" height="16" rx="2.5" />
      <path d="M4.5 7.5 6.8 6M4 10v8.5c0 1 .8 1.6 1.7 1.4L7 19.6" />
      <path d="M13 9.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5C10.3 5 7.8 4.5 4 4.5v13c3.8 0 6.3.5 8 2 1.7-1.5 4.2-2 8-2v-13c-3.8 0-6.3.5-8 2Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 14c.8 1.3 2 2 3.5 2s2.7-.7 3.5-2M9 9.5h.01M15 9.5h.01" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z" />
      <path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" strokeWidth="2.6" />
    </>
  ),
  road: <path d="M8 3.5 5 20.5M16 3.5l3 17M12 5v2.5M12 11v2.5M12 17v2.5" />,
  house: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 9.5V20h12V9.5M10 20v-5h4v5" />
    </>
  ),
  castle: (
    <>
      <path d="M4 20V9h3V7h2v2h2V7h2v2h2V7h2v2h3v11Z" />
      <path d="M10 20v-4a2 2 0 0 1 4 0v4" />
    </>
  ),
  trade: <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />,
  bank: (
    <>
      <path d="M3.5 9 12 4l8.5 5zM5 20h14M6.5 11.5v5.5M10.5 11.5v5.5M13.5 11.5v5.5M17.5 11.5v5.5" />
    </>
  ),
  next: <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" />,
  sound: (
    <>
      <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </>
  ),
  crown: <path d="M4 18h16M5 15.5 3.5 7.5l5 3.5L12 5l3.5 6 5-3.5-1.5 8z" />,
  door: (
    <>
      <path d="M13 4H6v16h7M10 12h10M16.5 8.5 20 12l-3.5 3.5" />
    </>
  ),
  bot: (
    <>
      <rect x="5" y="8" width="14" height="11" rx="3.5" />
      <path d="M12 4.5V8M9.5 13h.01M14.5 13h.01M3 13v2M21 13v2" />
    </>
  ),
  star: <path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" />,
  hand: (
    <>
      <rect x="4" y="6" width="10" height="14" rx="2" />
      <path d="M10 6V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 20 5v12a1.5 1.5 0 0 1-1.5 1.5H14" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  bulb: (
    <>
      <path d="M9 17.5h6M10 20.5h4M12 3.5a6 6 0 0 0-3.5 10.9V15h7v-.6A6 6 0 0 0 12 3.5Z" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2.5" />
      <path d="M8 20h8" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  skip: <path d="m5 6 8 6-8 6zM17 6v12" />,
  ban: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </>
  ),
  play: <path d="m7 5 12 7-12 7z" />,
  up: <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />,
  feather: (
    <>
      <path d="M19.5 4.5c-6 0-11 4.5-11 11v4" />
      <path d="M8.5 15.5c4 0 8-2.5 9.5-7M6 20h5" />
    </>
  ),
};

export function Icon({ name, size = 22, className, style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={`icon ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={style}
    >
      {P[name]}
    </svg>
  );
}

/** Растровая иконка эпохи; если картинки нет — запасной вариант (линейная иконка или текст). */
export function ArtIcon({ src, size = 28, fallback, className, alt = '' }: { src: string; size?: number; fallback?: ReactNode; className?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback ?? null}</>;
  return (
    <img
      className={`art-icon ${className ?? ''}`}
      src={src}
      width={size}
      height={size}
      alt={alt}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
