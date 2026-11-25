// Корень приложения: главная → лобби → партия (телефон) или экран ТВ.

import { useEffect, useState } from 'react';
import type { RoomView } from '../proto';
import { conn, useConn } from '../client/conn';
import { Home } from './Home';
import { Lobby } from './Lobby';
import { PhoneGame, setPieceNames } from './PhoneGame';
import { EraIntro, useIntroOnce } from './EraIntro';
import { useFacts } from './prefs';
import { setFxPace } from '../fx';
import { Tv } from './Tv';
import { useEra } from './era';
import { Icon } from './icons';
import { InviteToast } from './Social';

const params = new URLSearchParams(location.search);
const urlPin = params.get('pin')?.replace(/\D/g, '') || undefined;
const tvMode = params.has('tv');

export function App() {
  const state = useConn();
  const room = state.room;

  useEffect(() => {
    conn.start();
    // ?pin=… — открыть эту комнату; иначе — вернуться в прошлую игру
    const pin = urlPin ?? conn.lastPin();
    if (pin) conn.open(pin);
  }, []);

  let screen;
  if (!room) screen = <Home initialPin={urlPin && !tvMode ? urlPin : undefined} />;
  else if (room.kicked) screen = <Kicked />;
  else if (room.status === 'lobby') screen = <Lobby room={room} tv={tvMode} />;
  else screen = <InGame room={room} />;

  return (
    <>
      {screen}
      {!tvMode && <InviteToast />}
      {state.status === 'offline' && (
        <div className="toast glass bad" role="status" style={{ pointerEvents: 'none' }}>
          Нет связи — переподключаемся…
        </div>
      )}
      {/* в игре сообщения показывает сам экран игры (в колонке сверху) */}
      {state.notice && !(room && !room.kicked && room.status !== 'lobby') && <TimedToast key={state.notice.key} text={state.notice.text} />}
    </>
  );
}

function InGame({ room }: { room: RoomView }) {
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
    ? `в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="pause-veil" role="dialog" aria-label="Партия на паузе">
      <div className="pause-card glass strong">
        <span className="pc-ic">
          <Icon name="pause" size={26} />
        </span>
        <b className="display">Партия на паузе</b>
        <small className="muted">
          {p.name} · {when}
          <br />
          Таймеры и боты стоят. Доска и карты на месте.
        </small>
        {room.seated && !tvMode ? (
          <button className="btn primary wide" onClick={() => conn.send({ t: 'pause', on: false })}>
            <Icon name="play" /> Продолжить
          </button>
        ) : (
          <small className="faint">Продолжит любой игрок за столом</small>
        )}
        {!tvMode && (
          <button className="btn ghost wide" onClick={() => conn.forget()}>
            На главную
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
          <h2>За тебя играет бот</h2>
          <p className="muted">Карты и постройки на месте. Вернись — и бот отдаст место.</p>
          <button className="btn primary big wide" onClick={() => void conn.act({ type: 'returnFromBot' })}>
            Вернуться в игру
          </button>
          <button className="btn ghost wide" onClick={() => conn.forget()}>
            На главную
          </button>
        </div>
      </div>
    </main>
  );
}

function Kicked() {
  return (
    <main className="screen">
      <div className="ambient" aria-hidden />
      <div className="center-col">
        <div className="panel glass stack center">
          <h2>Ведущий убрал тебя из игры</h2>
          <button className="btn wide" onClick={() => conn.forget()}>
            На главную
          </button>
        </div>
      </div>
    </main>
  );
}

function TimedToast({ text }: { text: string }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 3200);
    return () => clearTimeout(t);
  }, []);
  return show ? (
    <div className="toast glass" role="status" onClick={() => setShow(false)}>
      {text}
    </div>
  ) : null;
}
