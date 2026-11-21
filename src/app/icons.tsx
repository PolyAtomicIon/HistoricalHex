// Иконки интерфейса HistoricalHex: Lucide (открытый набор, ISC) под нашими именами.
// Картинки эпох (ресурсы, карты, эмблемы) — растровые, сгенерированы через Codex: см. ArtIcon.

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ChartNoAxesColumn,
  Undo2,
  Timer,
  Swords,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Ban,
  Bell,
  BookOpen,
  Bot,
  Castle,
  Check,
  ClipboardList,
  Crown,
  Dices,
  Hand,
  House,
  Landmark,
  Layers,
  Lightbulb,
  LogOut,
  Map as MapIcon,
  Menu,
  Music,
  Pencil,
  Play,
  Route,
  SkipForward,
  Smile,
  Star,
  Tv,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

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
  | 'feather'
  | 'music'
  | 'bell'
  | 'timer'
  | 'army'
  | 'stats'
  | 'undo';

const L: Record<IconName, LucideIcon> = {
  menu: Menu,
  plan: ClipboardList,
  cards: Layers,
  book: BookOpen,
  smile: Smile,
  layers: MapIcon,
  dice: Dices,
  road: Route,
  house: House,
  castle: Castle,
  trade: ArrowLeftRight,
  bank: Landmark,
  next: ArrowRight,
  sound: Volume2,
  mute: VolumeX,
  crown: Crown,
  door: LogOut,
  bot: Bot,
  star: Star,
  hand: Hand,
  close: X,
  bulb: Lightbulb,
  tv: Tv,
  check: Check,
  skip: SkipForward,
  ban: Ban,
  play: Play,
  up: ArrowUp,
  feather: Pencil,
  music: Music,
  bell: Bell,
  timer: Timer,
  stats: ChartNoAxesColumn,
  undo: Undo2,
  army: Swords,
};

export function Icon({ name, size = 22, className, style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  const C = L[name];
  return <C className={`icon ${className ?? ''}`} size={size} strokeWidth={1.9} aria-hidden style={style} />;
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
