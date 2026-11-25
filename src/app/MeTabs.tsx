// «Сводка стола» → две личные вкладки:
//   Я    — что у тебя на руках, на каких числах приходит и сколько в среднем за бросок;
//   Цель — чего не хватает до ближайшей постройки и как это добрать (бросками, обменом, банком).

import { useMemo } from 'react';
import type { PlayerId, PrivateView, PublicState, Resource, ResourceMap } from '../engine';
import { COSTS } from '../engine';
import { RESOURCE_NAME } from '../i18n/ru';
import { ResIcon } from './ResIcon';
import { incomeByNumber, tableHarvest } from './income';

const RES: Resource[] = ['brick', 'wood', 'sheep', 'wheat', 'ore'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (x: number) => x.toFixed(1).replace('.', ',');

/** Доход игрока по ресурсам: в среднем за бросок и на каких числах. */
function myIncome(pub: PublicState, me: PlayerId) {
  const { rows, perRoll } = incomeByNumber(pub, me);
  const per: Record<Resource, number> = { brick: 0, wood: 0, sheep: 0, wheat: 0, ore: 0 };
  const nums: Record<Resource, { n: number; blocked: boolean }[]> = { brick: [], wood: [], sheep: [], wheat: [], ore: [] };
  for (const row of rows) {
    for (const [r, c] of Object.entries(row.res) as [Resource, number][]) {
      per[r] += (row.ways / 36) * c;
      if (!nums[r].some((x) => x.n === row.n)) nums[r].push({ n: row.n, blocked: false });
    }
    for (const r of Object.keys(row.blocked) as Resource[]) if (!nums[r].some((x) => x.n === row.n)) nums[r].push({ n: row.n, blocked: true });
  }
  for (const r of RES) nums[r].sort((a, b) => a.n - b.n);
  return { per, nums, perRoll };
}

/** Кто, кроме тебя, добывает ресурс — им и предлагать обмен. */
function producers(pub: PublicState, me: PlayerId, r: Resource): string[] {
  const s = tableHarvest(pub).supply.find((x) => x.r === r);
  return (s?.by ?? []).filter((b) => b.who !== me).map((b) => pub.players[b.who]?.name ?? '');
}

export function MeTab({ pub, priv, me }: { pub: PublicState; priv: PrivateView; me: PlayerId }) {
  const inc = useMemo(() => myIncome(pub, me), [pub.buildings, pub.robberHex]); // eslint-disable-line react-hooks/exhaustive-deps
  const none = RES.filter((r) => inc.per[r] === 0);
  const total = RES.reduce((s, r) => s + priv.resources[r], 0);
  return (
    <div className="me-tab">
      <div className="me-sum">
        <span>
          <b>{total}</b> <small>на руках</small>
        </span>
        <span>
          <b>≈ {fmt(inc.perRoll)}</b> <small>за бросок</small>
        </span>
      </div>
      <ul className="ti-market me-list">
        {RES.map((r) => (
          <li key={r} className={inc.per[r] === 0 ? 'idle' : ''}>
            <ResIcon r={r} size={32} />
            <span className="ti-m-txt">
              <b>{cap(RESOURCE_NAME[r])}</b>
              <small>
                {inc.nums[r].length === 0
                  ? 'не добываешь'
                  : inc.nums[r].map((x, i) => (
                      <span key={x.n}>
                        {i > 0 && ' · '}
                        <span className={x.blocked ? 'me-blocked' : ''}>{x.n}</span>
                      </span>
                    ))}
                {inc.per[r] > 0 && <> · +{fmt(inc.per[r])}</>}
              </small>
            </span>
            <span className="me-have">{priv.resources[r]}</span>
          </li>
        ))}
      </ul>
      {none.map((r) => {
        const who = producers(pub, me, r);
        return (
          <p key={r} className="me-note">
            {cap(RESOURCE_NAME[r])} не добываешь — {who.length ? `меняй: ${who.join(', ')}` : 'его пока никто не добывает'}
          </p>
        );
      })}
    </div>
  );
}

const BUILDS = [
  { id: 'city', label: 'Город', cost: COSTS.city },
  { id: 'settlement', label: 'Поселение', cost: COSTS.settlement },
  { id: 'road', label: 'Дорога', cost: COSTS.road },
  { id: 'devCard', label: 'Карта развития', cost: COSTS.devCard },
] as const;

export function GoalTab({ pub, priv, me, vpToWin }: { pub: PublicState; priv: PrivateView; me: PlayerId; vpToWin: number }) {
  const inc = useMemo(() => myIncome(pub, me), [pub.buildings, pub.robberHex]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = pub.players[me];
  const hand = priv.resources;
  const list = BUILDS.map((b) => {
    const miss: Partial<ResourceMap> = {};
    let n = 0;
    for (const r of RES) {
      const m = Math.max(0, b.cost[r] - hand[r]);
      if (m) {
        miss[r] = m;
        n += m;
      }
    }
    const out =
      b.id === 'city' ? p.pieces.cities <= 0 || p.pieces.settlements >= 5 : b.id === 'settlement' ? p.pieces.settlements <= 0 : b.id === 'road' ? p.pieces.roads <= 0 : pub.devDeckCount <= 0;
    // Сколько бросков в среднем до недостающего (по самому медленному ресурсу); 0 дохода — только обмен
    let rolls = 0;
    let tradeOnly = false;
    for (const [r, m] of Object.entries(miss) as [Resource, number][]) {
      if (inc.per[r] <= 0) tradeOnly = true;
      else rolls = Math.max(rolls, Math.ceil(m / inc.per[r]));
    }
    return { ...b, miss, n, out, rolls, tradeOnly };
  });
  const live = list.filter((b) => !b.out);
  const ready = live.filter((b) => b.n === 0);
  const next = [...live].filter((b) => b.n > 0).sort((a, b) => a.n - b.n || a.rolls - b.rolls)[0];
  return (
    <div className="me-tab">
      {next && (
        <section className="goal-next">
          <small>Ближе всего</small>
          <b>{next.label} — не хватает</b>
          <span className="goal-miss">
            {(Object.entries(next.miss) as [Resource, number][]).map(([r, m]) => (
              <span key={r} className="goal-chip">
                <ResIcon r={r} size={22} />×{m}
              </span>
            ))}
          </span>
          <small>
            {next.tradeOnly
              ? `только обменом: ${(Object.keys(next.miss) as Resource[])
                  .filter((r) => inc.per[r] <= 0)
                  .map((r) => `${RESOURCE_NAME[r]} — ${producers(pub, me, r).join(', ') || 'никто не добывает'}`)
                  .join('; ')}`
              : `≈ через ${next.rolls} ${next.rolls === 1 ? 'бросок' : next.rolls < 5 ? 'броска' : 'бросков'} или обменом`}
          </small>
        </section>
      )}
      <ul className="goal-list">
        {list.map((b) => (
          <li key={b.id}>
            <span className="goal-l">{b.label}</span>
            {b.out ? (
              <span className="goal-st faint">{b.id === 'devCard' ? 'колода пуста' : 'фишки кончились'}</span>
            ) : b.n === 0 ? (
              <span className="goal-st ok">хватает</span>
            ) : (
              <span className="goal-st">
                нет{' '}
                {(Object.entries(b.miss) as [Resource, number][]).map(([r, m]) => (
                  <span key={r} className="goal-mi">
                    <ResIcon r={r} size={18} />
                    {m > 1 && <small>×{m}</small>}
                  </span>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
      {ready.length === 0 && !next && <p className="me-note">Строить пока нечего — фишки кончились</p>}
      <p className="me-note">
        Банк:{' '}
        {bankText(priv.tradeRatios)}
      </p>
      <p className="me-note">
        Очки: <b>{priv.points}</b> из {vpToWin}
      </p>
    </div>
  );
}

/** «дерево 2:1, остальное 3:1» — коротко, без повторов. */
function bankText(ratios: Record<Resource, number>): string {
  const base = Math.max(...RES.map((r) => ratios[r]));
  const special = RES.filter((r) => ratios[r] < base);
  if (!special.length) return base === 4 ? 'всё 4:1 — порта пока нет' : `всё ${base}:1`;
  return `${special.map((r) => `${RESOURCE_NAME[r]} ${ratios[r]}:1`).join(', ')}, остальное ${base}:1`;
}
