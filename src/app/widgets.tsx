// Мелкие детали экрана игрока: рука, чипы ресурсов, сетка «отдаю/хочу», выбор ресурса.

import type { Resource, ResourceMap } from '../engine';
import { RESOURCES, totalResources } from '../engine';
import { RESOURCE_NAME } from '../i18n/ru';
import { ResIcon } from './ResIcon';
import { sfx } from '../fx';

export const RES_COLOR: Record<Resource, string> = {
  brick: '#c8643c',
  wood: '#3f8c4a',
  sheep: '#9fd06a',
  wheat: '#e8c14d',
  ore: '#8d98ad',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Ресурсы иконками: [иконка]×2 [иконка]×1. */
export function ResChips({ value, empty = '—' }: { value: Partial<ResourceMap>; empty?: string }) {
  const items = RESOURCES.filter((r) => (value[r] ?? 0) > 0);
  if (!items.length) return <span className="faint">{empty}</span>;
  return (
    <span className="res-chips">
      {items.map((r) => (
        <span key={r} className="res-chip" title={RESOURCE_NAME[r]}>
          <ResIcon r={r} size={26} />
          <b>×{value[r]}</b>
        </span>
      ))}
    </span>
  );
}

/** Своя рука одной строкой — видна внутри шторок (обмен, сброс, план). */
export function HandMini({ hand, label = 'У тебя' }: { hand: ResourceMap; label?: string }) {
  return (
    <div className="hand-mini">
      <span className="hm-label">{label}</span>
      {RESOURCES.map((r) => (
        <span key={r} className={`hm-item ${hand[r] ? '' : 'zero'}`} title={RESOURCE_NAME[r]}>
          <ResIcon r={r} size={24} />
          <b>{hand[r]}</b>
        </span>
      ))}
    </div>
  );
}

function Step({ n, onChange, max, tone }: { n: number; onChange: (n: number) => void; max: number; tone: 'give' | 'want' }) {
  return (
    <div className={`step ${tone} ${n > 0 ? 'on' : ''}`}>
      <button
        type="button"
        aria-label="Меньше"
        disabled={n <= 0}
        onClick={() => {
          sfx.play('tick');
          onChange(n - 1);
        }}
      >
        −
      </button>
      <span className="step-n">{n}</span>
      <button
        type="button"
        aria-label="Больше"
        disabled={n >= max}
        onClick={() => {
          sfx.play('tick');
          onChange(n + 1);
        }}
      >
        +
      </button>
    </div>
  );
}

/**
 * Сетка обмена: по строке на ресурс — иконка, название, сколько есть, «отдаю» и «хочу».
 * Если в одной колонке ставишь ресурс, в другой он сбрасывается (нельзя отдавать и просить одно и то же).
 */
export function TradeGrid({
  give,
  want,
  onChange,
  hand,
  giveLabel = 'Отдаю',
  wantLabel = 'Хочу',
}: {
  give: ResourceMap;
  want: ResourceMap;
  onChange: (give: ResourceMap, want: ResourceMap) => void;
  hand: ResourceMap;
  giveLabel?: string;
  wantLabel?: string;
}) {
  return (
    <div className="trade-grid">
      <div className="tg-head">
        <span />
        <span>{giveLabel}</span>
        <span>{wantLabel}</span>
      </div>
      {RESOURCES.map((r) => (
        <div key={r} className="tg-row" style={{ ['--rc' as string]: RES_COLOR[r] }}>
          <div className="tg-res">
            <ResIcon r={r} size={34} />
            <div className="tg-txt">
              <b>{cap(RESOURCE_NAME[r])}</b>
              <small className={hand[r] ? '' : 'none'}>есть {hand[r]}</small>
            </div>
          </div>
          <Step tone="give" n={give[r]} max={hand[r]} onChange={(n) => onChange({ ...give, [r]: n }, n > 0 ? { ...want, [r]: 0 } : want)} />
          <Step tone="want" n={want[r]} max={19} onChange={(n) => onChange(n > 0 ? { ...give, [r]: 0 } : give, { ...want, [r]: n })} />
        </div>
      ))}
    </div>
  );
}

/** Количество каждого ресурса одним столбцом (сброс на 7, планы). */
export function ResourceStepper({ value, onChange, max }: { value: ResourceMap; onChange: (m: ResourceMap) => void; max?: Partial<ResourceMap> }) {
  return (
    <div className="trade-grid single">
      {RESOURCES.map((r) => (
        <div key={r} className="tg-row" style={{ ['--rc' as string]: RES_COLOR[r] }}>
          <div className="tg-res">
            <ResIcon r={r} size={34} />
            <div className="tg-txt">
              <b>{cap(RESOURCE_NAME[r])}</b>
              {max && <small className={max[r] ? '' : 'none'}>есть {max[r] ?? 0}</small>}
            </div>
          </div>
          <Step tone="give" n={value[r]} max={max?.[r] ?? 19} onChange={(n) => onChange({ ...value, [r]: n })} />
        </div>
      ))}
    </div>
  );
}

/** Выбор одного ресурса плиткой. sub — подпись под названием (например, «4:1 · есть 5»). */
export function ResourcePicker({
  onPick,
  disabled,
  selected,
  sub,
}: {
  onPick: (r: Resource) => void;
  disabled?: (r: Resource) => boolean;
  selected?: Resource | null;
  sub?: (r: Resource) => string;
}) {
  return (
    <div className="res-picker">
      {RESOURCES.map((r) => (
        <button
          key={r}
          type="button"
          className={selected === r ? 'on' : ''}
          style={{ ['--rc' as string]: RES_COLOR[r] }}
          onClick={() => {
            sfx.play('tick');
            onPick(r);
          }}
          disabled={disabled?.(r)}
          aria-label={cap(RESOURCE_NAME[r])}
          title={cap(RESOURCE_NAME[r])}
        >
          <ResIcon r={r} size={42} />
          {sub && <small className="pick-sub">{sub(r)}</small>}
        </button>
      ))}
    </div>
  );
}

export const sum = totalResources;
