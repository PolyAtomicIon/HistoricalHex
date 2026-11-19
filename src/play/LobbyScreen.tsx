import { useState } from 'react';
import type { PlayerColor } from '../engine';
import { PLAYER_COLORS } from '../engine';
import type { PlayerRoom, PlayerSnapshot } from '../net';
import { describeError } from '../net';
import { COLOR_NAME } from '../i18n/ru';
import { PLAYER_HEX, PLAYER_STROKE } from '../ui/theme';

export function LobbyScreen({ room, snap, onLeave }: { room: PlayerRoom; snap: PlayerSnapshot; onLeave: () => void }) {
  const [error, setError] = useState('');
  const me = snap.lobby.find((p) => p.uid === snap.uid);
  const nameOf = (uid?: string) => snap.lobby.find((p) => p.uid === uid)?.name;

  const choose = async (color: PlayerColor) => {
    setError('');
    try {
      await room.chooseColor(color);
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <main className="screen center lobby-p">
      <h2 className="hello">Привет, {me?.name ?? 'игрок'}! 👋</h2>
      <p className="tagline">{me?.color ? 'Цвет выбран. Ждём, пока ведущий начнёт игру…' : 'Выбери свой цвет'}</p>

      <div className="color-grid">
        {PLAYER_COLORS.map((c) => {
          const owner = snap.colors[c];
          const mine = owner === snap.uid;
          const taken = !!owner && !mine;
          return (
            <button
              key={c}
              className={`color-btn ${mine ? 'mine' : ''}`}
              disabled={taken}
              onClick={() => choose(c)}
              style={{ background: PLAYER_HEX[c], borderColor: mine ? '#ffd27a' : PLAYER_STROKE[c] }}
            >
              <span className={c === 'white' ? 'dark' : ''}>{mine ? '✓ ' : ''}{COLOR_NAME[c]}</span>
              {taken && <small>{nameOf(owner) ?? 'занят'}</small>}
            </button>
          );
        })}
      </div>
      {error && <p className="error">{error}</p>}

      <div className="card lobby-who">
        <b>В игре:</b>{' '}
        {snap.lobby.map((p, i) => (
          <span key={p.uid}>
            {i > 0 && ', '}
            {p.name}
          </span>
        ))}
      </div>
      {me?.color && <div className="spinner" />}
      <button className="btn ghost" onClick={onLeave}>
        Выйти
      </button>
    </main>
  );
}
