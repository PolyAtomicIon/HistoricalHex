// Игрок вышел из партии — за него играет бот. Отсюда можно вернуться и забрать место обратно.

import type { PublicState } from '../engine';
import type { PlayerRoom, PlayerSnapshot } from '../net';
import { BOT_LEVEL_NAME } from '../bots';
import { phaseText } from '../i18n/ru';
import { PLAYER_HEX, PLAYER_STROKE } from '../ui/theme';
import { Emblem } from '../ui/Logo';
import { useSender } from './widgets';

interface Props {
  room: PlayerRoom;
  snap: PlayerSnapshot;
  pub: PublicState;
  onLeave: () => void;
}

export function AwayScreen({ room, snap, pub, onLeave }: Props) {
  const { send, busy, error } = useSender(room, snap);
  const me = pub.players[snap.uid];
  const level = me.bot ? BOT_LEVEL_NAME[me.bot] : '';
  const vp = snap.private?.points ?? me.points;
  return (
    <main className="screen center away">
      <Emblem />
      <h1 className="logo">Ты вышел из игры</h1>
      <p className="tagline">
        За тебя играет бот «{level}» 🤖
        <br />
        Карты, постройки и очки — на месте.
      </p>
      <div className="card away-card">
        <span className="chip" style={{ background: PLAYER_HEX[me.color], borderColor: PLAYER_STROKE[me.color] }} />
        <b>{me.name}</b>
        <span>⭐ {vp}</span>
        <small className="muted">{phaseText(pub)}</small>
      </div>
      <button className="btn primary big" disabled={busy} onClick={() => void send({ type: 'returnFromBot' })}>
        {busy ? 'Возвращаемся…' : 'Вернуться в игру'}
      </button>
      <button className="btn ghost" onClick={onLeave}>
        Выйти на главную
      </button>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
