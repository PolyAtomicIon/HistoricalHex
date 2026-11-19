// Мелкие детали экрана игрока: карточки ресурсов, «степперы», модальные окна, отправка действий.

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action, Resource, ResourceMap } from '../engine';
import { RESOURCES, totalResources } from '../engine';
import type { PlayerRoom, PlayerSnapshot } from '../net';
import { describeError } from '../net';
import { RESOURCE_NAME } from '../i18n/ru';
import { TERRAIN_FILL } from '../ui/theme';
import { ResIcon } from '../ui/ResIcon';

export const RESOURCE_BG: Record<Resource, string> = {
  brick: TERRAIN_FILL.hills,
  wood: TERRAIN_FILL.forest,
  sheep: TERRAIN_FILL.pasture,
  wheat: TERRAIN_FILL.fields,
  ore: TERRAIN_FILL.mountains,
};

/** Отправка действия хосту: ждём ответ, показываем ошибку. */
export function useSender(room: PlayerRoom, snap: PlayerSnapshot) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const r = snap.lastResult;
    if (pending && r?.actionId === pending) {
      clearTimeout(timer.current);
      setPending(null);
      if (!r.ok) setError(r.error ?? 'Не получилось');
    }
  }, [snap.lastResult, pending]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const send = useCallback(
    async (action: Action): Promise<void> => {
      if (pending) return;
      setError('');
      try {
        const id = await room.send(action);
        setPending(id);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          setPending(null);
          setError('Ведущий не отвечает — проверь, что экран ведущего открыт');
        }, 12000);
      } catch (e) {
        setError(describeError(e));
      }
    },
    [room, pending],
  );

  return { send, busy: pending !== null, error, clearError: () => setError('') };
}

export function ResourceCards({ hand, onTap, dim }: { hand: ResourceMap; onTap?: (r: Resource) => void; dim?: boolean }) {
  return (
    <div className={`res-cards ${dim ? 'dim' : ''}`}>
      {RESOURCES.map((r) => (
        <button
          key={r}
          type="button"
          className={`res-card ${hand[r] === 0 ? 'zero' : ''}`}
          style={{ background: RESOURCE_BG[r] }}
          onClick={onTap ? () => onTap(r) : undefined}
          disabled={!onTap}
        >
          <ResIcon r={r} className="res-icon" />
          <span className="res-count">{hand[r]}</span>
          <span className="res-name">{RESOURCE_NAME[r]}</span>
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
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export const sum = totalResources;
