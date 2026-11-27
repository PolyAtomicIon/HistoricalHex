// Настройки ведущего: время на ход и автобросок. В лобби и посреди партии (меню → Ведущий).

import type { Pace, RoomSettings } from '../proto';
import { conn } from '../client/conn';
import { Icon } from './icons';
import { L } from '../i18n/l';

const paces = (): [Pace, string][] => [
  ['calm', L('Спокойный', 'Баяу', 'Calm')],
  ['normal', L('Обычный', 'Қалыпты', 'Normal')],
  ['fast', L('Быстрый', 'Жылдам', 'Fast')],
  ['turbo', L('Турбо', 'Турбо', 'Turbo')],
];
const paceHint = (): Record<Pace, string> => ({
  calm: L('Боты и автоход ждут дольше — все успевают досмотреть и прочитать.', 'Боттар мен авто жүріс ұзағырақ күтеді — бәрі көріп, оқып үлгереді.', 'Bots and auto-moves wait longer, so everyone can watch and read.'),
  normal: L('Обычные паузы между действиями.', 'Әрекеттер арасындағы әдеттегі үзілістер.', 'Normal pauses between actions.'),
  fast: L('Короткие паузы — для тех, кто уже знает игру.', 'Қысқа үзілістер — ойынды білетіндерге.', 'Short pauses, for players who know the game.'),
  turbo: L('Всё сразу: боты ходят мгновенно, кубики и заставки короткие, без сцен налёта.', 'Бәрі бірден: боттар лезде жүреді, сүйек пен заставкалар қысқа, шабуыл көріністерісіз.', 'Everything at once: bots move instantly, dice and intros are short, no raid scenes.'),
});

const fmt = (s: number) =>
  s <= 0
    ? L('без таймера', 'таймерсіз', 'no timer')
    : s % 60 === 0
      ? L('{n} мин', '{n} мин', '{n} min', { n: s / 60 })
      : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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
      <div className="label">{L('Время на ход', 'Жүріске уақыт', 'Time per turn')}</div>
      <div className="ts-row">
        <button className="btn icon-btn" disabled={!editable || sec <= 0} onClick={() => step(-30)} aria-label={L('Меньше', 'Азырақ', 'Less')}>
          −
        </button>
        <span className="ts-val display">{fmt(sec)}</span>
        <button className="btn icon-btn" disabled={!editable || sec >= 3600} onClick={() => step(30)} aria-label={L('Больше', 'Көбірек', 'More')}>
          +
        </button>
      </div>
      {editable && (
        <div className="seg">
          {[0, 60, 120, 180, 300].map((v) => (
            <button key={v} aria-pressed={sec === v} onClick={() => set({ turnSeconds: v })}>
              {v === 0 ? L('Выкл', 'Өшірулі', 'Off') : L('{n} мин', '{n} мин', '{n} min', { n: v / 60 })}
            </button>
          ))}
        </div>
      )}
      <p className="faint small">{L('Когда время вышло, ход заканчивается сам: кубики бросаются, лишние карты сбрасываются.', 'Уақыт біткенде жүріс өзі аяқталады: сүйек лақтырылады, артық карталар тасталады.', 'When time runs out, the turn ends by itself: dice are rolled, extra cards are discarded.')}</p>
      <div className="label">{L('Темп игры', 'Ойын қарқыны', 'Game pace')}</div>
      <div className="seg" role="group">
        {paces().map(([v, label]) => (
          <button key={v} disabled={!editable} aria-pressed={(settings.pace ?? 'normal') === v} onClick={() => set({ pace: v })}>
            {label}
          </button>
        ))}
      </div>
      <p className="faint small">{paceHint()[settings.pace ?? 'normal']}</p>
      <button className="item" disabled={!editable} onClick={() => set({ autoRoll: !settings.autoRoll })}>
        <Icon name="dice" />
        <span className="grow">
          <span className="t">{L('Автобросок кубиков', 'Сүйекті авто лақтыру', 'Auto-roll dice')}</span>
          <span className="s" style={{ display: 'block' }}>
            {settings.autoRoll ? L('Кубики бросаются сами в начале хода', 'Сүйек жүріс басында өзі лақтырылады', 'Dice roll by themselves at the start of the turn') : L('Каждый бросает кнопкой', 'Әрқайсысы түймемен лақтырады', 'Everyone rolls with the button')}
          </span>
        </span>
        <span className={`switch ${settings.autoRoll ? 'on' : ''}`} aria-hidden />
      </button>
    </div>
  );
}
