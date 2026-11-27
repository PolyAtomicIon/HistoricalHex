// Корень приложения: главная → лобби → партия (телефон) или экран ТВ.

import { Suspense, lazy, useEffect, useState } from 'react';
import { conn, useConn } from '../client/conn';
import { Home } from './Home';
import { useLang } from './learn/lang';

import { InviteToast } from './Social';
import { L } from '../i18n/l';

// Лобби и партия грузятся отдельно — главная открывается быстрее
const InGame = lazy(() => import('./GameScreen'));
const Lobby = lazy(() => import('./Lobby').then((m) => ({ default: m.Lobby })));

const params = new URLSearchParams(location.search);
const urlPin = params.get('pin')?.replace(/\D/g, '') || undefined;
const tvMode = params.has('tv');

export function App() {
  const state = useConn();
  const room = state.room;
  // Смена языка перерисовывает всё приложение: тексты берутся через L() на каждом рендере
  useLang();

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
      <Suspense fallback={<Loading />}>{screen}</Suspense>
      {!tvMode && <InviteToast />}
      {state.portalLinked && (
        <div className="toast glass good" role="status">
          {L(
            'Готово: вход через AQL Portal выполнен. Вернись в игру на главном экране — профиль уже там.',
            'Дайын: AQL Portal арқылы кірдің. Басты экрандағы ойынға орал — профиль сонда.',
            'Done: signed in with AQL Portal. Go back to the game on your Home Screen — your profile is there.',
          )}
        </div>
      )}
      {state.status === 'offline' && (
        <div className="toast glass bad" role="status" style={{ pointerEvents: 'none' }}>
          {L('Нет связи — переподключаемся…', 'Байланыс жоқ — қайта қосылып жатырмыз…', 'No connection — reconnecting…')}
        </div>
      )}
      {/* в игре сообщения показывает сам экран игры (в колонке сверху) */}
      {state.notice && !(room && !room.kicked && room.status !== 'lobby') && <TimedToast key={state.notice.key} text={state.notice.text} />}
    </>
  );
}

function Loading() {
  return (
    <main className="screen">
      <div className="ambient" aria-hidden />
    </main>
  );
}

function Kicked() {
  return (
    <main className="screen">
      <div className="ambient" aria-hidden />
      <div className="center-col">
        <div className="panel glass stack center">
          <h2>{L('Ведущий убрал тебя из игры', 'Жүргізуші сені ойыннан шығарды', 'The host removed you from the game')}</h2>
          <button className="btn wide" onClick={() => conn.forget()}>
            {L('На главную', 'Басты бетке', 'Home')}
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
