// Корень приложения: главная → лобби → партия (телефон) или экран ТВ.

import { useEffect, useState } from 'react';
import type { RoomView } from '../proto';
import { conn, useConn } from '../client/conn';
import { Home } from './Home';
import { Lobby } from './Lobby';
import { PhoneGame, setPieceNames } from './PhoneGame';
import { EraIntro, useIntroOnce } from './EraIntro';
import { Tv } from './Tv';
import { useEra } from './era';
import { Icon } from './icons';

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
      {state.status === 'offline' && <div className="toast glass bad">Нет связи — переподключаемся…</div>}
      {/* в игре сообщения показывает сам экран игры (в колонке сверху) */}
      {state.notice && !(room && !room.kicked && room.status !== 'lobby') && <TimedToast key={state.notice.key} text={state.notice.text} />}
    </>
  );
}

function InGame({ room }: { room: RoomView }) {
  const pack = useEra(room.settings.lore);
  setPieceNames(pack.pieces);
  // Заставка эпохи — один раз на комнату, пока партия не закончилась
  const [intro, closeIntro] = useIntroOnce(room.pin, room.public?.phase !== 'finished');
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
      {intro && <EraIntro pack={pack} onDone={closeIntro} />}
    </>
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
