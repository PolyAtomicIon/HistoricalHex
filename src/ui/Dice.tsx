// Два кубика с точками. При новом броске они ~0,7 с «крутятся», перебирая грани.

import { useEffect, useRef, useState } from 'react';

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

const ROLL_MS = 700;

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <svg viewBox="0 0 30 30" className={`die ${rolling ? 'rolling' : ''}`} aria-label={String(value)}>
      <rect x="1" y="1" width="28" height="28" rx="6" />
      {(PIPS[value] ?? []).map(([cx, cy], i) => (
        <circle key={i} cx={7 + cx * 8} cy={7 + cy * 8} r="2.6" />
      ))}
    </svg>
  );
}

export function Dice({ dice, rollKey }: { dice?: [number, number]; rollKey?: number }) {
  const [faces, setFaces] = useState<[number, number] | null>(null);
  const firstKey = useRef(rollKey);

  useEffect(() => {
    // Бросок, который был до открытия страницы, не анимируем
    if (rollKey === undefined || rollKey === firstKey.current) return;
    const rnd = () => 1 + Math.floor(Math.random() * 6);
    const id = setInterval(() => setFaces([rnd(), rnd()]), 70);
    const stop = setTimeout(() => {
      clearInterval(id);
      setFaces(null);
    }, ROLL_MS);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [rollKey]);

  if (!dice) return <div className="dice empty">🎲</div>;
  const rolling = faces !== null;
  const shown = faces ?? dice;
  const total = dice[0] + dice[1];
  return (
    <div className={`dice ${!rolling && total === 7 ? 'seven' : ''} ${rolling ? 'is-rolling' : ''}`}>
      <Die value={shown[0]} rolling={rolling} />
      <Die value={shown[1]} rolling={rolling} />
      <span className="dice-total">{rolling ? '…' : total}</span>
    </div>
  );
}
