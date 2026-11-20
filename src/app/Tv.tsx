// Экран для телевизора: большая живая карта, игроки, рассказчик, факты эпохи, реакции.

import { useEffect, useMemo, useState } from 'react';
import type { PlayerColor, PlayerId } from '../engine';
import type { RoomView } from '../proto';
import type { LorePack } from '../lore';
import { PLAYER_HEX } from '../ui/theme';
import { eventText, namesFrom, phaseText } from '../i18n/ru';
import { Cinematic, DiceOverlay, ReactionsLayer, sfx, useMuted } from '../fx';
import { GameBoard, MODE_LABEL, useBoardMode } from './GameBoard';
import { useGameFx } from './useGameFx';
import { Fact, useRotatingFact } from './Facts';
import { joinLink, Qr } from './Lobby';

export function Tv({ room, pack }: { room: RoomView; pack: LorePack }) {
  const pub = room.public!;
  const fx = useGameFx(pub, pack);
  const [mode, setMode] = useBoardMode('3d');
  const [muted, setMuted] = useMuted();
  const fact = useRotatingFact(pack);
  const name = namesFrom(pub);
  const current = pub.order[pub.current];
  const colors = useMemo(
    () => Object.fromEntries(pub.order.map((id) => [id, pub.players[id].color])) as Record<PlayerId, PlayerColor>,
    [pub],
  );
  const log = [...pub.log].reverse().map((e) => eventText(e, name)).filter(Boolean).slice(0, 6) as string[];

  // Клавиши: 1/2/3 — вид карты, M — звук
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') setMode('2d');
      if (e.key === '2') setMode('25d');
      if (e.key === '3') setMode('3d');
      if (e.key === 'm') setMuted(!muted);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [muted, setMode, setMuted]);

  const [narr, setNarr] = useState(fx.narration);
  useEffect(() => {
    if (!fx.narration) return;
    setNarr(fx.narration);
    const t = setTimeout(() => setNarr(null), 6000);
    return () => clearTimeout(t);
  }, [fx.narration]);

  return (
    <main className="screen tv">
      <div className="stage">
        <GameBoard pub={pub} colors={colors} mode={mode} palette={pack.palette} fx={fx} />
      </div>

      <aside className="tv-left">
        <div className="tv-era glass">
          <span className="era-emblem">{pack.emblem}</span>
          <div>
            <b>{pack.title}</b>
            <div className="faint small">
              {pack.years} · PIN {room.pin}
            </div>
          </div>
        </div>
        <div className="tv-players">
          {pub.order.map((id) => {
            const p = pub.players[id];
            return (
              <div key={id} className={`tv-player glass ${id === current ? 'turn' : ''}`} style={{ ['--pc' as string]: PLAYER_HEX[p.color] }}>
                <span className="dot" style={{ background: PLAYER_HEX[p.color] }} />
                <div className="grow">
                  <div className="t">
                    {p.name}
                    {!room.online[id] && !p.bot && <span className="faint small"> · не в сети</span>}
                  </div>
                  <div className="faint small">
                    🂠 {p.resourceCount} · 📜 {p.devCardCount} · ⚔️ {p.knightsPlayed} · 🛤️ {p.roadLength}
                    {pub.longestRoad === id && ' · 🛣️'}
                    {pub.largestArmy === id && ' · 🛡️'}
                  </div>
                </div>
                <b className="tv-vp display">{p.points}</b>
              </div>
            );
          })}
        </div>
      </aside>

      <aside className="tv-right">
        <div className="tv-phase glass">{phaseText(pub)}</div>
        <div className="tv-log glass">
          {log.map((l, i) => (
            <div key={`${pub.logSeq}-${i}`} className={i === 0 ? 'fresh' : ''}>
              {l}
            </div>
          ))}
        </div>
        <div className="tv-fact glass">
          <div className="label">📖 Знаете ли вы</div>
          <Fact f={fact} />
        </div>
        <div className="tv-join glass">
          <Qr text={joinLink(room.pin)} size={84} />
          <div className="faint small">
            Вернуться в игру
            <br />
            PIN <b>{room.pin}</b>
          </div>
        </div>
      </aside>

      <div className="tv-modes glass">
        {(['2d', '25d', '3d'] as const).map((m) => (
          <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
            {MODE_LABEL[m]}
          </button>
        ))}
        <button
          onClick={() => {
            setMuted(!muted);
            sfx.play('tick');
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      {narr && (
        <div key={narr.key} className="narration tv glass" style={{ ['--pc' as string]: narr.color ?? 'var(--accent)' }}>
          {narr.text}
        </div>
      )}
      <DiceOverlay roll={fx.roll} big />
      <Cinematic event={fx.cinematic} tv />
      <ReactionsLayer items={fx.reactions} />
    </main>
  );
}
