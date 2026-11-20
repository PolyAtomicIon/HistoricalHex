// Режим «Играю с этого устройства»: хост, боты и экран игрока — в одной вкладке.
// Так телефон не «усыпляет» вкладку хоста, и боты ходят вовремя.
// Сверху — компактная панель ведущего, переключатель «Мой экран / Общая карта».

import { useEffect, useState } from 'react';
import type { BotLevel } from '../engine';
import { BOT_LEVELS, MAX_PLAYERS, MIN_PLAYERS } from '../engine';
import type { Connection, HostRoom, HostSnapshot } from '../net';
import { connectOnce, describeError } from '../net';
import { BOT_LEVEL_NAME } from '../bots';
import { PlayerApp } from '../play/PlayerApp';
import { GameScreen } from './GameScreen';
import { KickDialog, kickable } from './KickDialog';
import '../play/play.css';

interface Props {
  room: HostRoom;
  snap: HostSnapshot;
  conn: Connection;
  onExitSolo: () => void;
  onClose: () => void;
  onNewGame: () => void;
}

export default function SoloView({ room, snap, conn, onExitSolo, onClose, onNewGame }: Props) {
  const [view, setView] = useState<'me' | 'map'>('me');
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState('');
  const [kicking, setKicking] = useState(false);
  // Свой uid игрока (у экрана игрока своё подключение) — себя выгнать нельзя
  const [me, setMe] = useState<string>();
  useEffect(() => {
    connectOnce({ name: 'player' }).then((c) => setMe(c.uid), () => undefined);
  }, []);
  const lobby = snap.status === 'lobby';
  const canKick = !lobby && !!snap.state && snap.state.phase !== 'finished' && kickable(snap.state, me).length > 0;
  const players = snap.lobby;
  const ready =
    players.length >= MIN_PLAYERS &&
    players.length <= MAX_PLAYERS &&
    players.every((p) => p.color) &&
    players.some((p) => !p.bot);

  // Пока открыт режим — страница выглядит как экран игрока
  useEffect(() => {
    document.body.classList.add('player-page');
    return () => document.body.classList.remove('player-page');
  }, []);

  const act = (p: Promise<unknown>) => {
    setError('');
    p.catch((e) => setError(describeError(e)));
  };

  const removeBots = () => {
    for (const p of players) if (p.bot) act(room.kick(p.uid));
  };

  return (
    <div className="solo">
      <div className="solo-bar">
        <span className="solo-pin" title="Другие могут присоединиться по этому PIN">
          PIN <b>{room.pin}</b>
        </span>

        {lobby ? (
          <>
            <select
              className="solo-select"
              value=""
              disabled={players.length >= MAX_PLAYERS}
              onChange={(e) => e.target.value && act(room.addBot(e.target.value as BotLevel))}
              aria-label="Добавить бота"
            >
              <option value="">+ бот</option>
              {BOT_LEVELS.map((l) => (
                <option key={l} value={l}>
                  🤖 {BOT_LEVEL_NAME[l]}
                </option>
              ))}
            </select>
            <button className="btn primary solo-start" disabled={!ready} onClick={() => act(room.start())}>
              Начать ({players.length})
            </button>
          </>
        ) : (
          <div className="seg">
            <button className={view === 'me' ? 'on' : ''} onClick={() => setView('me')}>
              Мой экран
            </button>
            <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>
              Общая карта
            </button>
          </div>
        )}

        <div className="solo-menu">
          <button className="btn ghost icon" onClick={() => setMenu(!menu)} aria-label="Меню ведущего">
            ⋯
          </button>
          {menu && (
            <div className="menu-pop" onClick={() => setMenu(false)}>
              {lobby && players.some((p) => p.bot) && <button onClick={removeBots}>Убрать всех ботов</button>}
              {canKick && <button onClick={() => setKicking(true)}>🚫 Выгнать игрока…</button>}
              <button onClick={onExitSolo}>Экран ведущего (для телевизора)</button>
              <button
                onClick={() => {
                  if (confirm('Закрыть комнату? Игра закончится у всех.')) onClose();
                }}
              >
                Закрыть комнату
              </button>
            </div>
          )}
        </div>
      </div>
      {error && (
        <div className="solo-error" onClick={() => setError('')}>
          {error}
        </div>
      )}

      {kicking && snap.state && (
        <KickDialog
          state={snap.state}
          exclude={me}
          onKick={(uid, level) => room.kickFromGame(uid, level)}
          onClose={() => setKicking(false)}
        />
      )}

      <div className="solo-content">
        {/* Экран игрока не размонтируем при переключении — чтобы не терять состояние */}
        <div className="solo-pane" hidden={view === 'map' && !lobby}>
          <PlayerApp fixedPin={room.pin} />
        </div>
        {view === 'map' && !lobby && snap.state && (
          <div className="solo-pane map">
            <GameScreen
              room={room}
              snap={snap}
              state={snap.state}
              now={conn.now}
              onClose={onClose}
              onNewGame={onNewGame}
              sounds={false}
              me={me}
            />
          </div>
        )}
      </div>
    </div>
  );
}
