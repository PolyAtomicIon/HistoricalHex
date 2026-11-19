// Два кубика с точками.

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

function Die({ value }: { value: number }) {
  return (
    <svg viewBox="0 0 30 30" className="die" aria-label={String(value)}>
      <rect x="1" y="1" width="28" height="28" rx="6" />
      {(PIPS[value] ?? []).map(([cx, cy], i) => (
        <circle key={i} cx={7 + cx * 8} cy={7 + cy * 8} r="2.6" />
      ))}
    </svg>
  );
}

export function Dice({ dice, rollKey }: { dice?: [number, number]; rollKey?: number }) {
  if (!dice) return <div className="dice empty">🎲</div>;
  const total = dice[0] + dice[1];
  return (
    <div className={`dice ${total === 7 ? 'seven' : ''}`} key={rollKey}>
      <Die value={dice[0]} />
      <Die value={dice[1]} />
      <span className="dice-total">{total}</span>
    </div>
  );
}
