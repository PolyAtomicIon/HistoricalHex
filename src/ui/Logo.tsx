// Эмблема Хексленда (остров из гексов) — если картинки нет, ничего не рисуем.
import { art } from './art';

export function Emblem({ className = '' }: { className?: string }) {
  const url = art('logo');
  return url ? <img src={url} alt="" className={`emblem ${className}`} draggable={false} /> : null;
}
