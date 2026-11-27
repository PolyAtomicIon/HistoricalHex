// Экран партии (телефон / ТВ) и пауза — отдельный чанк: на главной этот код не нужен.

import type { RoomView } from '../proto';
import { conn } from '../client/conn';
import { PhoneGame, setPieceNames } from './PhoneGame';
import { EraIntro, useIntroOnce } from './EraIntro';
import { useFacts } from './prefs';
import { setFxPace } from '../fx';
import { Tv } from './Tv';
import { useEra } from './era';
import { Icon } from './icons';
import { L, locale } from '../i18n/l';

const tvMode = new URLSearchParams(location.search).has('tv');

export default function InGame({ room }: { room: RoomView }) {
  const pack = useEra(room.settings.lore);
  setPieceNames(pack.pieces);
  // Заставка эпохи — один раз на комнату, пока партия не закончилась
  const factsShown = useFacts();
  setFxPace(room.settings.pace); // скорость анимаций — по темпу комнаты
  const [intro, closeIntro] = useIntroOnce(room.pin, factsShown && room.public?.phase !== 'finished');
  const screen =
    tvMode || !room.private ? (
      <Tv room={room} pack={pack} screen={tvMode} />
    ) : room.public!.players[room.me]?.away && room.public!.phase !== 'finished' ? (
      <Away />
    ) : (
      <PhoneGame room={room} pack={pack} />
    );
  return (
    <>
      {screen}
      {room.paused && room.public?.phase !== 'finished' && <PauseCard room={room} />}
      {intro && <EraIntro pack={pack} onDone={closeIntro} />}
    </>
  );
}

/** Партия на паузе: ходить нельзя, таймеры и боты стоят. Любой игрок за столом продолжает. */
function PauseCard({ room }: { room: RoomView }) {
  const p = room.paused!;
  const d = new Date(p.at);
  const today = new Date().toDateString() === d.toDateString();
  const when = today
    ? L('в {t}', '{t}-да', 'at {t}', { t: d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) })
    : d.toLocaleString(locale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="pause-veil" role="dialog" aria-label={L('Партия на паузе', 'Ойын тоқтатылған', 'Game paused')}>
      <div className="pause-card glass strong">
        <span className="pc-ic">
          <Icon name="pause" size={26} />
        </span>
        <b className="display">{L('Партия на паузе', 'Ойын тоқтатылған', 'Game paused')}</b>
        <small className="muted">
          {p.name} · {when}
          <br />
          {L('Таймеры и боты стоят. Доска и карты на месте.', 'Таймерлер мен боттар тоқтаған. Тақта мен карталар орнында.', 'Timers and bots are stopped. The board and cards are untouched.')}
        </small>
        {room.seated && !tvMode ? (
          <button className="btn primary wide" onClick={() => conn.send({ t: 'pause', on: false })}>
            <Icon name="play" /> {L('Продолжить', 'Жалғастыру', 'Resume')}
          </button>
        ) : (
          <small className="faint">{L('Продолжит любой игрок за столом', 'Үстелдегі кез келген ойыншы жалғастыра алады', 'Any player at the table can resume')}</small>
        )}
        {!tvMode && (
          <button className="btn ghost wide" onClick={() => conn.forget()}>
            {L('На главную', 'Басты бетке', 'Home')}
          </button>
        )}
      </div>
    </div>
  );
}

function Away() {
  return (
    <main className="screen">
      <div className="ambient" aria-hidden />
      <div className="center-col">
        <div className="panel glass stack center">
          <Icon name="bot" size={56} />
          <h2>{L('За тебя играет бот', 'Орныңа бот ойнап жатыр', 'A bot is playing for you')}</h2>
          <p className="muted">{L('Карты и постройки на месте. Вернись — и бот отдаст место.', 'Карталар мен құрылыстар орнында. Қайт — бот орынды береді.', 'Your cards and buildings are safe. Come back and the bot will give your seat back.')}</p>
          <button className="btn primary big wide" onClick={() => void conn.act({ type: 'returnFromBot' })}>
            {L('Вернуться в игру', 'Ойынға оралу', 'Back to the game')}
          </button>
          <button className="btn ghost wide" onClick={() => conn.forget()}>
            {L('На главную', 'Басты бетке', 'Home')}
          </button>
        </div>
      </div>
    </main>
  );
}

