import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Renders children into document.body so fixed overlays are never trapped by transformed ancestors. */
export function FxPortal({ children, className }: { children: ReactNode; className?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready || typeof document === 'undefined') return null;
  return createPortal(<div className={`fx-layer ${className ?? ''}`} data-fx-portal="">{children}</div>, document.body);
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}
