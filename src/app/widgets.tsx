// Мелкие детали экрана игрока: карточки ресурсов, «степперы», модальные окна, отправка действий.

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action, Resource, ResourceMap } from '../engine';
import { RESOURCES, totalResources } from '../engine';
import { RESOURCE_NAME } from '../i18n/ru';
import { TERRAIN_FILL } from '../ui/theme';
import { ResIcon } from './ResIcon';

export const RESOURCE_BG: Record<Resource, string> = {
  brick: TERRAIN_FILL.hills,
  wood: TERRAIN_FILL.forest,
  sheep: TERRAIN_FILL.pasture,
  wheat: TERRAIN_FILL.fields,
  ore: TERRAIN_FILL.mountains,
};

/** Сколько каждого ресурса только что пришло — для «+1» на карточках. */
function useGains(hand: ResourceMap) {
  const prev = useRef(hand);
  const [gains, setGains] = useState<{ key: number; delta: Partial<Record<Resource, number>> }>();
  useEffect(() => {
    const delta: Partial<Record<Resource, number>> = {};
    for (const r of RESOURCES) if (hand[r] > prev.current[r]) delta[r] = hand[r] - prev.current[r];
    prev.current = hand;
    if (!Object.keys(delta).length) return;
    const key = Date.now();
    setGains({ key, delta });
    const id = setTimeout(() => setGains((g) => (g?.key === key ? undefined : g)), 1400);
    return () => clearTimeout(id);
  }, [hand]);
  return gains;
}

export function ResourceCards({ hand, onTap, dim }: { hand: ResourceMap; onTap?: (r: Resource) => void; dim?: boolean }) {
  const gains = useGains(hand);
  return (
    <div className={`res-cards ${dim ? 'dim' : ''}`}>
      {RESOURCES.map((r) => (
        <button
          key={gains?.delta[r] ? `${r}-${gains.key}` : r}
          type="button"
          className={`res-card ${hand[r] === 0 ? 'zero' : ''} ${gains?.delta[r] ? 'bump' : ''}`}
          style={{ background: RESOURCE_BG[r] }}
          onClick={onTap ? () => onTap(r) : undefined}
          disabled={!onTap}
        >
          <ResIcon r={r} className="res-icon" />
          <span className="res-count">{hand[r]}</span>
          <span className="res-name">{RESOURCE_NAME[r]}</span>
          {gains?.delta[r] ? <span className="res-plus">+{gains.delta[r]}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Выбор количества каждого ресурса (+/−). max — ограничение сверху для каждого. */
export function ResourceStepper({
  value,
  onChange,
  max,
}: {
  value: ResourceMap;
  onChange: (m: ResourceMap) => void;
  max?: Partial<ResourceMap>;
}) {
  const set = (r: Resource, n: number) => onChange({ ...value, [r]: Math.max(0, Math.min(max?.[r] ?? 99, n)) });
  return (
    <div className="stepper">
      {RESOURCES.map((r) => (
        <div key={r} className="step-col" style={{ borderColor: RESOURCE_BG[r] }}>
          <button type="button" onClick={() => set(r, value[r] + 1)} disabled={value[r] >= (max?.[r] ?? 99)}>
            +
          </button>
          <ResIcon r={r} className="step-icon" />
          <span className="step-n">{value[r]}</span>
          <button type="button" onClick={() => set(r, value[r] - 1)} disabled={value[r] <= 0}>
            −
          </button>
        </div>
      ))}
    </div>
  );
}

export function ResourcePicker({ onPick, disabled }: { onPick: (r: Resource) => void; disabled?: (r: Resource) => boolean }) {
  return (
    <div className="res-picker">
      {RESOURCES.map((r) => (
        <button
          key={r}
          type="button"
          style={{ background: RESOURCE_BG[r] }}
          onClick={() => onPick(r)}
          disabled={disabled?.(r)}
        >
          <ResIcon r={r} className="pick-icon" />
          <small>{RESOURCE_NAME[r]}</small>
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          {onClose && (
            <button className="btn ghost icon" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export const sum = totalResources;
