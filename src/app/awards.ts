// Награды игрока для полосы игроков: «Самая длинная дорога» и «Самая большая армия».
// Чистая функция — проверяется тестами (порядок значков постоянный, ничего лишнего).

export type Award = 'road' | 'army';

export function awardsOf(pub: { longestRoad?: string; largestArmy?: string }, id: string): Award[] {
  const out: Award[] = [];
  if (pub.longestRoad === id) out.push('road');
  if (pub.largestArmy === id) out.push('army');
  return out;
}
