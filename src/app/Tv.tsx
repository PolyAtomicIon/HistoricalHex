// Экран для телевизора: большая живая карта, игроки, рассказчик, факты эпохи, реакции.

import { useEffect, useMemo, useState } from 'react';
import type { PlayerColor, PlayerId } from '../engine';
import type { RoomView } from '../proto';
import type { LorePack } from '../lore';
import { PLAYER_HEX } from '../ui/theme';
import { eventText, namesFrom, phaseText } from '../i18n/ru';
import { Cinematic, DiceOverlay, Raid, ReactionsLayer, sfx, useMuted } from '../fx';
import { GameBoard, MODE_LABEL, useBoardMode } from './GameBoard';
import { useGameFx } from './useGameFx';
import { Fact, useRotatingFact } from './Facts';
import { joinLink, Qr } from './Lobby';
import { conn } from '../client/conn';
import { ArtIcon, Icon } from './icons';
import { eraIcon } from './era';
import { useLite } from './lite';
import { Sheet } from './Sheet';
import { savedName, saveName } from './Home';

export function Tv({ room, pack, screen = true }: { room: RoomView; pack: LorePack; screen?: boolean }) {
  const [panel, setPanel] = useState<null | 'host' | 'claim'>(null);
  const { lite } = useLite();
  const [claimName, setNameState] = useState(savedName());
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
        <GameBoard pub={pub} era={pack.id} boardStatic colors={colors} mode={mode} palette={pack.palette} fx={fx} />
      </div>

      <aside className="tv-left">
        <div className="tv-era glass">
          <ArtIcon src={eraIcon(pack.id, 'emblem')} size={40} />
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
                    <span className="stat"><Icon name="hand" size={14} />{p.resourceCount}</span>
                    <span className="stat"><Icon name="cards" size={14} />{p.devCardCount}</span>
                    <span className="stat"><Icon name="road" size={14} />{p.roadLength}</span>
                    {pub.longestRoad === id && <span className="bonus">{pack.bonuses.longestRoad}</span>}
                    {pub.largestArmy === id && <span className="bonus">{pack.bonuses.largestArmy}</span>}
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
          <div className="label row"><Icon name="book" size={14} /> Знаете ли вы</div>
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
        {!lite && (['2d', '3d'] as const).map((m) => (
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
          <Icon name={muted ? 'mute' : 'sound'} size={18} />
        </button>
      </div>

      <div className="tv-actions">
        {room.isHost && (
          <button className="btn glass" onClick={() => setPanel('host')}>
            <Icon name="crown" /> Ведущий
          </button>
        )}
        {!screen && !room.seated && pub.phase !== 'finished' && (
          <button className="btn primary" onClick={() => setPanel('claim')}>
            Я играю в этой партии
          </button>
        )}
        {!screen && (
          <button className="btn glass" onClick={() => conn.forget()}>
            На главную
          </button>
        )}
      </div>

      <Sheet open={panel === 'host'} onClose={() => setPanel(null)} title="Ведущий">
        <div className="stack">
          {pub.phase !== 'finished' && (
            <button className="btn wide" onClick={() => void conn.host({ type: 'skipTurn' })}>
              <Icon name="skip" /> Пропустить ход: {pub.players[current].name}
            </button>
          )}
          {pub.order
            .filter((id) => !pub.players[id].kicked && !pub.players[id].bot)
            .map((id) => (
              <button key={id} className="btn danger wide" onClick={() => conn.send({ t: 'kick', player: id, level: 'medium' })}>
                <Icon name="ban" /> Заменить ботом: {pub.players[id].name}
              </button>
            ))}
          <button className="btn ghost wide" onClick={() => conn.send({ t: 'close' })}>
            Закрыть комнату
          </button>
        </div>
      </Sheet>

      <Sheet open={panel === 'claim'} onClose={() => setPanel(null)} title="Вернуться на своё место" description="Новый телефон или браузер? Введи имя, под которым играешь в этой партии.">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (!claimName.trim()) return;
            saveName(claimName.trim());
            conn.join(room.pin, claimName.trim());
            setPanel(null);
          }}
        >
          <input className="field" value={claimName} maxLength={20} onChange={(e) => setNameState(e.target.value)} placeholder="Имя" />
          <button className="btn primary wide" disabled={!claimName.trim()}>
            Занять место
          </button>
          <p className="faint small">Сработает, если старое устройство сейчас не в сети.</p>
        </form>
      </Sheet>

      {narr && (
        <div key={narr.key} className="narration tv glass" style={{ ['--pc' as string]: narr.color ?? 'var(--accent)' }}>
          {narr.text}
        </div>
      )}
      <DiceOverlay roll={fx.roll} big />
      <Raid event={fx.raid} />
      <Cinematic event={fx.cinematic} tv />
      <ReactionsLayer items={fx.reactions} />
    </main>
  );
}
