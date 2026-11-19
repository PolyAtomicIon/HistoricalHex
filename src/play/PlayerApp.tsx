// Экран игрока (телефон или ПК): вход → лобби → игра.

import { useCallback, useEffect, useState } from 'react';
import type { Connection } from '../net';
import { PlayerRoom, connectOnce, describeError } from '../net';
import { storage, useSnapshot } from '../ui/hooks';
import { GAME_TITLE } from '../i18n/ru';
import { JoinScreen } from './JoinScreen';
import { LobbyScreen } from './LobbyScreen';
import { GameView } from './GameView';
import { Emblem } from '../ui/Logo';

const SAVED_KEY = 'hexland.player';

interface Saved {
  pin: string;
  name: string;
}

function loadSaved(): Saved | null {
  try {
    return JSON.parse(storage.get(SAVED_KEY) ?? 'null') as Saved | null;
  } catch {
    return null;
  }
}

type Stage =
  | { kind: 'connecting' }
  | { kind: 'error'; message: string }
  | { kind: 'join'; message?: string }
  | { kind: 'room'; room: PlayerRoom };

/**
 * fixedPin — экран игрока встроен в страницу хоста (режим «играю с этого устройства»):
 * PIN берётся оттуда, а не из адреса, и если имя уже известно — входим сразу.
 */
export function PlayerApp({ fixedPin }: { fixedPin?: string } = {}) {
  const [conn, setConn] = useState<Connection>();
  const [stage, setStage] = useState<Stage>({ kind: 'connecting' });
  const urlPin = fixedPin ?? new URLSearchParams(window.location.search).get('pin') ?? '';
  const saved = loadSaved();

  useEffect(() => {
    let cancelled = false;
    let joined: PlayerRoom | null = null;
    (async () => {
      try {
        const c = await connectOnce({ name: 'player' });
        if (cancelled) return;
        setConn(c);
        // Автоматически возвращаемся, если это устройство уже в игре
        const s = loadSaved();
        const pin = urlPin || s?.pin;
        if (pin && s && s.pin === pin && (await PlayerRoom.isMember(c, pin))) {
          joined = await PlayerRoom.join(c, pin, s.name).catch(() => null);
        } else if (fixedPin && s?.name) {
          // На своём устройстве имя уже вводили — сразу в лобби
          joined = await PlayerRoom.join(c, fixedPin, s.name).catch(() => null);
          if (joined) storage.set(SAVED_KEY, JSON.stringify({ pin: fixedPin, name: s.name }));
        }
        if (cancelled) {
          joined?.dispose();
          return;
        }
        setStage(joined ? { kind: 'room', room: joined } : { kind: 'join' });
      } catch (e) {
        if (!cancelled) setStage({ kind: 'error', message: describeError(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlPin, fixedPin]);

  const join = useCallback(
    async (pin: string, name: string) => {
      if (!conn) return;
      const room = await PlayerRoom.join(conn, pin, name);
      storage.set(SAVED_KEY, JSON.stringify({ pin: room.pin, name: name.trim() }));
      setStage({ kind: 'room', room });
    },
    [conn],
  );

  const leave = useCallback(async (room: PlayerRoom, message?: string) => {
    await room.leave();
    const name = loadSaved()?.name;
    // Имя помним (чтобы не вводить заново), а PIN забываем — чтобы не войти обратно автоматически
    if (name) storage.set(SAVED_KEY, JSON.stringify({ pin: '', name }));
    else storage.del(SAVED_KEY);
    if (!fixedPin) window.history.replaceState(null, '', window.location.pathname);
    setStage({ kind: 'join', message });
  }, [fixedPin]);

  switch (stage.kind) {
    case 'connecting':
      return <Splash text="Подключаемся…" spin />;
    case 'error':
      return <Splash title="Что-то не так 😕" text={stage.message} />;
    case 'join':
      return <JoinScreen initialPin={urlPin || saved?.pin || ''} initialName={saved?.name ?? ''} onJoin={join} message={stage.message} />;
    case 'room':
      return <RoomView key={stage.room.pin} room={stage.room} onLeave={(m) => leave(stage.room, m)} />;
  }
}

function RoomView({ room, onLeave }: { room: PlayerRoom; onLeave: (message?: string) => void }) {
  const snap = useSnapshot(room);
  if (!snap) return null;
  if (snap.kicked) {
    return (
      <Splash title="Тебя убрали из игры" text="Ведущий удалил тебя из этой комнаты.">
        <button className="btn primary" onClick={() => onLeave()}>
          Войти в другую игру
        </button>
      </Splash>
    );
  }
  if (snap.closed) {
    return (
      <Splash title="Игра закрыта" text="Ведущий закрыл комнату.">
        <button className="btn primary" onClick={() => onLeave()}>
          Войти в другую игру
        </button>
      </Splash>
    );
  }
  if (!snap.meta) return <Splash text="Загружаем…" spin />;
  if (snap.meta.status === 'lobby') return <LobbyScreen room={room} snap={snap} onLeave={() => onLeave()} />;
  if (!snap.public || !snap.private) return <Splash text="Загружаем игру…" spin />;
  return <GameView room={room} snap={snap} pub={snap.public} priv={snap.private} onLeave={() => onLeave()} />;
}

export function Splash({
  title = GAME_TITLE,
  text,
  spin,
  children,
}: {
  title?: string;
  text?: string;
  spin?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <main className="screen center">
      <Emblem />
      <h1 className="logo">{title}</h1>
      {text && <p className="tagline">{text}</p>}
      {spin && <div className="spinner" />}
      {children}
    </main>
  );
}
