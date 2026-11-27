// «Сводка стола» → две личные вкладки:
//   Я    — что у тебя на руках, на каких числах приходит и сколько в среднем за бросок;
//   Цель — чего не хватает до ближайшей постройки и как это добрать (бросками, обменом, банком).

import { useMemo } from 'react';
import type { PlayerId, PrivateView, PublicState, Resource, ResourceMap } from '../engine';
import { COSTS } from '../engine';
import { RESOURCE_NAME } from '../i18n/ru';
import { ResIcon } from './ResIcon';
import { incomeByNumber, tableHarvest } from './income';
import { L, pick } from '../i18n/l';

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
          <b>{total}</b> <small>{L('на руках', 'қолыңда', 'in hand')}</small>
        </span>
        <span>
          <b>≈ {fmt(inc.perRoll)}</b> <small>{L('за бросок', 'лақтыру үшін', 'per roll')}</small>
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
                  ? L('не добываешь', 'өндірмейсің', 'not produced')
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
            {cap(RESOURCE_NAME[r])} {L('не добываешь', 'өндірмейсің', 'not produced')} — {who.length ? L('меняй: {who}', 'айырбаста: {who}', 'trade with: {who}', { who: who.join(', ') }) : L('его пока никто не добывает', 'оны әзірге ешкім өндірмейді', 'nobody produces it yet')}
          </p>
        );
      })}
    </div>
  );
}

const buildLabel = (id: string) =>
  id === 'city'
    ? L('Город', 'Қала', 'City')
    : id === 'settlement'
      ? L('Поселение', 'Қоныс', 'Settlement')
      : id === 'road'
        ? L('Дорога', 'Жол', 'Road')
        : L('Карта развития', 'Даму картасы', 'Development card');

const BUILDS = [
  { id: 'city', cost: COSTS.city },
  { id: 'settlement', cost: COSTS.settlement },
  { id: 'road', cost: COSTS.road },
  { id: 'devCard', cost: COSTS.devCard },
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
          <small>{L('Ближе всего', 'Ең жақыны', 'Closest')}</small>
          <b>{buildLabel(next.id)} — {L('не хватает', 'жетіспейді', 'missing')}</b>
          <span className="goal-miss">
            {(Object.entries(next.miss) as [Resource, number][]).map(([r, m]) => (
              <span key={r} className="goal-chip">
                <ResIcon r={r} size={22} />×{m}
              </span>
            ))}
          </span>
          <small>
            {next.tradeOnly
              ? L('только обменом: {list}', 'тек айырбаспен: {list}', 'trade only: {list}', {
                  list: (Object.keys(next.miss) as Resource[])
                    .filter((r) => inc.per[r] <= 0)
                    .map((r) => `${RESOURCE_NAME[r]} — ${producers(pub, me, r).join(', ') || L('никто не добывает', 'ешкім өндірмейді', 'nobody produces')}`)
                    .join('; '),
                })
              : L('≈ через {n} {w} или обменом', '≈ {n} лақтырудан кейін немесе айырбаспен', '≈ in {n} {w} or by trading', {
                  n: next.rolls,
                  w: pick(next.rolls === 1 ? 'бросок' : next.rolls < 5 ? 'броска' : 'бросков', '', next.rolls === 1 ? 'roll' : 'rolls'),
                })}
          </small>
        </section>
      )}
      <ul className="goal-list">
        {list.map((b) => (
          <li key={b.id}>
            <span className="goal-l">{buildLabel(b.id)}</span>
            {b.out ? (
              <span className="goal-st faint">{b.id === 'devCard' ? L('колода пуста', 'колода бос', 'deck is empty') : L('фишки кончились', 'фишкалар таусылды', 'out of pieces')}</span>
            ) : b.n === 0 ? (
              <span className="goal-st ok">{L('хватает', 'жеткілікті', 'enough')}</span>
            ) : (
              <span className="goal-st">
                {L('нет', 'жоқ', 'need')}{' '}
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
      {ready.length === 0 && !next && <p className="me-note">{L('Строить пока нечего — фишки кончились', 'Әзірге салатын ештеңе жоқ — фишкалар таусылды', 'Nothing to build yet — out of pieces')}</p>}
      <p className="me-note">
        {L('Банк', 'Банк', 'Bank')}:{' '}
        {bankText(priv.tradeRatios)}
      </p>
      <p className="me-note">
        {L('Очки', 'Ұпай', 'Points')}: <b>{priv.points}</b> {L('из', '/', 'of')} {vpToWin}
      </p>
    </div>
  );
}

/** «дерево 2:1, остальное 3:1» — коротко, без повторов. */
function bankText(ratios: Record<Resource, number>): string {
  const base = Math.max(...RES.map((r) => ratios[r]));
  const special = RES.filter((r) => ratios[r] < base);
  if (!special.length) return base === 4 ? L('всё 4:1 — порта пока нет', 'бәрі 4:1 — порт әзірге жоқ', 'all 4:1 — no port yet') : L('всё {b}:1', 'бәрі {b}:1', 'all {b}:1', { b: base });
  return `${special.map((r) => `${RESOURCE_NAME[r]} ${ratios[r]}:1`).join(', ')}, ${L('остальное', 'қалғаны', 'others')} ${base}:1`;
}
