// Настройки ведущего: время на ход и автобросок. В лобби и посреди партии (меню → Ведущий).

import type { RoomSettings } from '../proto';
import { conn } from '../client/conn';
import { Icon } from './icons';

const fmt = (s: number) => (s <= 0 ? 'без таймера' : s % 60 === 0 ? `${s / 60} мин` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

export function TurnSettings({ settings, editable }: { settings: RoomSettings; editable: boolean }) {
  const set = (patch: Partial<RoomSettings>) => conn.send({ t: 'settings', settings: patch });
  const sec = settings.turnSeconds ?? 180;
  const step = (d: number) => {
    const cur = sec <= 0 ? 0 : sec;
    const next = cur + d;
    set({ turnSeconds: next < 30 ? (d < 0 ? 0 : 30) : next });
  };
  return (
    <div className="stack turn-settings">
      <div className="label">Время на ход</div>
      <div className="ts-row">
        <button className="btn icon-btn" disabled={!editable || sec <= 0} onClick={() => step(-30)} aria-label="Меньше">
          −
        </button>
        <span className="ts-val display">{fmt(sec)}</span>
        <button className="btn icon-btn" disabled={!editable || sec >= 3600} onClick={() => step(30)} aria-label="Больше">
          +
        </button>
      </div>
      {editable && (
        <div className="seg">
          {[0, 60, 120, 180, 300].map((v) => (
            <button key={v} aria-pressed={sec === v} onClick={() => set({ turnSeconds: v })}>
              {v === 0 ? 'Выкл' : `${v / 60} мин`}
            </button>
          ))}
        </div>
      )}
      <p className="faint small">Когда время вышло, ход заканчивается сам: кубики бросаются, лишние карты сбрасываются.</p>
      <button className="item" disabled={!editable} onClick={() => set({ autoRoll: !settings.autoRoll })}>
        <Icon name="dice" />
        <span className="grow">
          <span className="t">Автобросок кубиков</span>
          <span className="s" style={{ display: 'block' }}>
            {settings.autoRoll ? 'Кубики бросаются сами в начале хода' : 'Каждый бросает кнопкой'}
          </span>
        </span>
        <span className={`switch ${settings.autoRoll ? 'on' : ''}`} aria-hidden />
      </button>
    </div>
  );
}
