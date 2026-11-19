// Лобби: PIN, QR-код, кто зашёл, кнопка «Начать».

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { MAX_PLAYERS, MIN_PLAYERS } from '../engine';
import type { HostRoom, HostSnapshot } from '../net';
import { describeError } from '../net';
import { COLOR_NAME, GAME_TITLE, plural } from '../i18n/ru';
import { PLAYER_HEX, PLAYER_STROKE } from '../ui/theme';

export function Lobby({ room, snap, onClose }: { room: HostRoom; snap: HostSnapshot; onClose: () => void }) {
  const joinUrl = room.joinUrl(window.location.href);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    QRCode.toString(joinUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(''));
  }, [joinUrl]);

  const players = snap.lobby;
  const ready = players.length >= MIN_PLAYERS && players.length <= MAX_PLAYERS && players.every((p) => p.color);
  const isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      await room.start();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  const kick = async (uid: string, name: string) => {
    if (!confirm(`Убрать «${name}» из игры? Зайти снова он не сможет.`)) return;
    await room.kick(uid).catch((e) => setError(describeError(e)));
  };

  let hint: string;
  if (players.length < MIN_PLAYERS) {
    const need = MIN_PLAYERS - players.length;
    hint = `Ждём ещё ${need} ${plural(need, 'игрока', 'игроков', 'игроков')}`;
  } else if (players.length > MAX_PLAYERS) hint = `Максимум ${MAX_PLAYERS} игроков — нажми на имя лишнего`;
  else if (!players.every((p) => p.color)) hint = 'Ждём, пока все выберут цвет';
  else hint = players.length >= 5 ? 'Будет большая карта на 5–6 игроков' : 'Можно начинать!';

  return (
    <main className="screen lobby">
      <section className="lobby-join">
        <h1 className="logo small">{GAME_TITLE}</h1>
        <p className="join-label">Сканируй QR или открой сайт и введи PIN</p>
        <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="pin-box">
          <small>PIN игры</small>
          <div className="pin">{room.pin.replace(/(\d{3})(\d{3})/, '$1 $2')}</div>
        </div>
        <p className="join-url">{joinUrl.replace(/^https?:\/\//, '').replace(/\?.*$/, '')}</p>
        {isLocalhost && (
          <p className="warn">
            Страница открыта как localhost — QR на телефонах не откроется. Открой хост по адресу сети (Network в окне
            Vite) или с сайта.
          </p>
        )}
      </section>

      <section className="lobby-players">
        <h2>
          Игроки <span className="muted">{players.length} / {MAX_PLAYERS}</span>
        </h2>
        <ul className="player-list">
          {players.map((p) => (
            <li key={p.uid} className="lobby-player" onClick={() => kick(p.uid, p.name)} title="Нажми, чтобы убрать">
              <span
                className="chip"
                style={
                  p.color
                    ? { background: PLAYER_HEX[p.color], borderColor: PLAYER_STROKE[p.color] }
                    : { background: 'transparent' }
                }
              />
              <span className="name">{p.name}</span>
              <span className="muted">{p.color ? COLOR_NAME[p.color] : 'выбирает цвет…'}</span>
              {!p.online && <span className="offline">не в сети</span>}
            </li>
          ))}
          {players.length === 0 && <li className="muted empty">Пока никого…</li>}
        </ul>
        <p className="hint">{hint}</p>
        <div className="row">
          <button className="btn primary big" onClick={start} disabled={!ready || busy}>
            {busy ? 'Начинаем…' : 'Начать игру'}
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              if (confirm('Закрыть комнату? Все игроки выйдут.')) onClose();
            }}
          >
            Закрыть комнату
          </button>
        </div>
        <p className="muted small">
          Победа: {snap.settings.vpToWin} очков · ждём отвалившихся {Math.round(snap.settings.reconnectSeconds / 60)} мин
        </p>
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}
