// Экран хоста (ноутбук → телевизор): меню → лобби → игра → итоги.

import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import type { Connection, RoomSettings } from '../net';
import { DEFAULT_ROOM_SETTINGS, HostRoom, connectOnce, describeError } from '../net';
import { useSnapshot, storage } from '../ui/hooks';
import { GAME_TITLE } from '../i18n/ru';
import { Lobby } from './Lobby';
import { Emblem } from '../ui/Logo';
import { GameScreen } from './GameScreen';

const PIN_KEY = 'hexland.hostPin';
const SOLO_KEY = 'hexland.solo';

// Экран игрока на странице хоста грузим только когда он нужен (режим «играю с этого устройства»)
const SoloView = lazy(() => import('./SoloView'));

type Stage = { kind: 'connecting' } | { kind: 'error'; message: string } | { kind: 'menu' } | { kind: 'room'; room: HostRoom };

export function HostApp() {
  const [conn, setConn] = useState<Connection>();
  const [stage, setStage] = useState<Stage>({ kind: 'connecting' });
  const [solo, setSoloState] = useState(storage.get(SOLO_KEY) === '1');
  const setSolo = useCallback((on: boolean) => {
    if (on) storage.set(SOLO_KEY, '1');
    else storage.del(SOLO_KEY);
    setSoloState(on);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let resumed: HostRoom | null = null;
    (async () => {
      try {
        const c = await connectOnce();
        if (cancelled) return;
        setConn(c);
        const saved = storage.get(PIN_KEY);
        resumed = saved ? await HostRoom.resume(c, saved).catch(() => null) : null;
        if (cancelled) {
          // Эффект уже отменён — не оставляем второй экземпляр, иначе действия обработаются дважды.
          resumed?.dispose();
          return;
        }
        if (resumed) setStage({ kind: 'room', room: resumed });
        else {
          storage.del(PIN_KEY);
          storage.del(SOLO_KEY);
          setSoloState(false);
          setStage({ kind: 'menu' });
        }
      } catch (e) {
        if (!cancelled) setStage({ kind: 'error', message: describeError(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const createRoom = useCallback(
    async (settings: RoomSettings, keepSolo = false) => {
      if (!conn) return;
      const room = await HostRoom.create(conn, settings);
      storage.set(PIN_KEY, room.pin);
      if (!keepSolo) setSolo(false);
      setStage({ kind: 'room', room });
    },
    [conn, setSolo],
  );

  const closeRoom = useCallback(
    async (room: HostRoom) => {
      storage.del(PIN_KEY);
      setSolo(false);
      await room.close().catch(() => undefined);
      setStage({ kind: 'menu' });
    },
    [setSolo],
  );

  /** Новая игра с теми же настройками: старую комнату закрываем. */
  const newGame = useCallback(
    async (room: HostRoom) => {
      const settings = room.snapshot.settings;
      await room.close().catch(() => undefined);
      await createRoom(settings, true); // в режиме «играю с этого устройства» остаёмся в нём
    },
    [createRoom],
  );

  switch (stage.kind) {
    case 'connecting':
      return <Centered title={GAME_TITLE} text="Подключаемся…" spin />;
    case 'error':
      return <Centered title="Что-то не так 😕" text={stage.message} />;
    case 'menu':
      return <Menu onCreate={createRoom} />;
    case 'room':
      return (
        <RoomView
          key={stage.room.pin}
          room={stage.room}
          conn={conn!}
          solo={solo}
          setSolo={setSolo}
          onClose={closeRoom}
          onNewGame={newGame}
        />
      );
  }
}

function RoomView({
  room,
  conn,
  solo,
  setSolo,
  onClose,
  onNewGame,
}: {
  room: HostRoom;
  conn: Connection;
  solo: boolean;
  setSolo: (on: boolean) => void;
  onClose: (room: HostRoom) => void;
  onNewGame: (room: HostRoom) => void;
}) {
  const snap = useSnapshot(room);
  if (!snap) return null;
  if (solo) {
    return (
      <Suspense fallback={<Centered title={GAME_TITLE} text="Открываем экран игрока…" spin />}>
        <SoloView
          room={room}
          snap={snap}
          conn={conn}
          onExitSolo={() => setSolo(false)}
          onClose={() => onClose(room)}
          onNewGame={() => onNewGame(room)}
        />
      </Suspense>
    );
  }
  if (snap.status === 'lobby') return <Lobby room={room} snap={snap} onClose={() => onClose(room)} onSolo={() => setSolo(true)} />;
  if (!snap.state) return <Centered title={GAME_TITLE} text="Загружаем игру…" spin />;
  return (
    <GameScreen
      room={room}
      snap={snap}
      state={snap.state}
      now={conn.now}
      onClose={() => onClose(room)}
      onNewGame={() => onNewGame(room)}
    />
  );
}

function Menu({ onCreate }: { onCreate: (s: RoomSettings) => Promise<void> }) {
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      await onCreate(settings);
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <main className="screen center menu">
      <Emblem className="big" />
      <h1 className="logo">{GAME_TITLE}</h1>
      <p className="tagline">Ресурсы, торговля и стройка на острове из шестиугольников</p>
      <div className="card settings">
        <label>
          Ждать отвалившегося игрока
          <select
            value={settings.reconnectSeconds}
            onChange={(e) => setSettings({ ...settings, reconnectSeconds: Number(e.target.value) })}
          >
            <option value={60}>1 минуту</option>
            <option value={120}>2 минуты</option>
            <option value={180}>3 минуты</option>
            <option value={300}>5 минут</option>
          </select>
        </label>
        <label>
          Очков для победы
          <select value={settings.vpToWin} onChange={(e) => setSettings({ ...settings, vpToWin: Number(e.target.value) })}>
            <option value={8}>8 (быстрая игра)</option>
            <option value={10}>10 (обычная)</option>
            <option value={12}>12 (длинная)</option>
          </select>
        </label>
      </div>
      <button className="btn primary big" onClick={create} disabled={busy} autoFocus>
        {busy ? 'Создаём…' : 'Создать игру'}
      </button>
      {error && <p className="error">{error}</p>}
    </main>
  );
}

export function Centered({ title, text, spin }: { title: string; text?: string; spin?: boolean }) {
  return (
    <main className="screen center">
      <Emblem />
      <h1 className="logo">{title}</h1>
      {text && <p className="tagline">{text}</p>}
      {spin && <div className="spinner" />}
    </main>
  );
}
