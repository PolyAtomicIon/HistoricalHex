// Экран игры на телевизоре: карта по центру, игроки слева, ход/кубики/обмен/лог справа.

import { useEffect, useMemo, useState } from 'react';
import type { GameState, PlayerColor, PlayerId, PublicPlayer, PublicState } from '../engine';
import { toPublicView } from '../engine';
import type { HostRoom, HostSnapshot, Presence } from '../net';
import { describeError } from '../net';
import { Board } from '../board/Board';
import { BOT_LEVEL_NAME } from '../bots';
import { Dice } from '../ui/Dice';
import { formatClock, useNow } from '../ui/hooks';
import { PLAYER_HEX, PLAYER_STROKE } from '../ui/theme';
import { DEV_CARD_ART, art } from '../ui/art';
import { DEV_CARD_NAME, GAME_TITLE, cards, eventText, namesFrom, phaseText, points, resourcesText } from '../i18n/ru';

interface Props {
  room: HostRoom;
  snap: HostSnapshot;
  state: GameState;
  now: () => number;
  onClose: () => void;
  onNewGame: () => void;
}

export function GameScreen({ room, snap, state, now, onClose, onNewGame }: Props) {
  const pub = useMemo(() => toPublicView(state), [state]);
  const colors = useMemo(
    () => Object.fromEntries(pub.order.map((id) => [id, pub.players[id].color])) as Record<PlayerId, PlayerColor>,
    [pub],
  );
  const t = useNow(now);
  const [extraWait, setExtraWait] = useState<Record<PlayerId, number>>({});
  const [error, setError] = useState('');

  const current = pub.order[pub.current];
  const recent = useMemo(() => recentBuilt(pub), [pub]);
  const rollSeq = [...pub.log].reverse().find((e) => e.type === 'diceRolled')?.seq;
  const played = usePlayedCard(pub);

  const run = (p: Promise<{ ok: boolean; error?: string }>) =>
    p.then((r) => setError(r.ok ? '' : (r.error ?? ''))).catch((e) => setError(describeError(e)));

  // ── кто отвалился и от кого игра сейчас ждёт действия ──
  const limit = snap.settings.reconnectSeconds * 1000;
  const offline = (uid: PlayerId) => !pub.players[uid]?.bot && snap.presence[uid]?.online !== true;
  const offlineFor = (uid: PlayerId) => {
    const p: Presence | undefined = snap.presence[uid];
    return p && !p.online ? t - p.changedAt : 0;
  };
  const overdue = (uid: PlayerId) => offline(uid) && offlineFor(uid) > limit + (extraWait[uid] ?? 0);
  const waitingOn: PlayerId[] =
    pub.phase === 'discard'
      ? Object.keys(pub.pendingDiscards ?? {})
      : pub.phase === 'finished'
        ? []
        : [current];
  const alerts = waitingOn.filter(overdue);
  // «Ждать дальше» — даём ещё один полный срок ожидания с этого момента.
  const waitMore = (uid: PlayerId) => setExtraWait((w) => ({ ...w, [uid]: offlineFor(uid) }));

  return (
    <main className="screen game">
      <header className="game-header">
        <span className="logo small">{GAME_TITLE}</span>
        <span className="turn-chip" style={chipStyle(pub.players[current]?.color)} />
        <h1 className="phase">{phaseText(pub)}</h1>
        <span className="muted">
          {pub.phase === 'setup' ? 'Расстановка' : `Ход ${pub.turn}`} · PIN {room.pin}
        </span>
        <HostMenu
          onSkip={() => {
            if (confirm(`Пропустить ход игрока ${pub.players[current]?.name}?`)) run(room.hostAction({ type: 'skipTurn' }));
          }}
          onClose={() => {
            if (confirm('Закрыть комнату? Игра закончится у всех.')) onClose();
          }}
          canSkip={pub.phase !== 'finished' && pub.phase !== 'discard'}
        />
      </header>

      <aside className="players">
        {pub.order.map((id) => (
          <PlayerPanel
            key={id}
            p={pub.players[id]}
            current={id === current && pub.phase !== 'finished'}
            longestRoad={pub.longestRoad === id}
            largestArmy={pub.largestArmy === id}
            discard={pub.pendingDiscards?.[id]}
            offlineMs={offline(id) ? offlineFor(id) : -1}
            limitMs={limit + (extraWait[id] ?? 0)}
          />
        ))}
      </aside>

      <section className="board-wrap">
        <Board view={pub} colors={colors} recent={recent} />
      </section>

      <aside className="side">
        <div className="card dice-card">
          <Dice dice={pub.dice} rollKey={rollSeq} />
          <div className="bank">
            <small>Банк</small> {resourcesText(pub.bank)} · 🃏 {pub.devDeckCount}
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="card alert">
            {alerts.map((uid) => (
              <div key={uid} className="alert-row">
                <p>
                  <b>{pub.players[uid].name}</b> не в сети уже {formatClock(offlineFor(uid))}
                </p>
                <div className="row">
                  <button className="btn" onClick={() => waitMore(uid)}>
                    Ждать дальше
                  </button>
                  {pub.phase === 'discard' ? (
                    <button className="btn primary" onClick={() => run(room.hostAction({ type: 'forceDiscard', player: uid }))}>
                      Сбросить за него
                    </button>
                  ) : (
                    <button className="btn primary" onClick={() => run(room.hostAction({ type: 'skipTurn' }))}>
                      {pub.phase === 'setup' ? 'Поставить за него' : 'Пропустить ход'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {played && (
          <div className="card played-card" key={played.seq}>
            {art(DEV_CARD_ART[played.card]) && <img src={art(DEV_CARD_ART[played.card])} alt="" />}
            <p>
              <b>{namesFrom(pub)(played.player)}</b> играет «{DEV_CARD_NAME[played.card]}»
            </p>
          </div>
        )}

        {pub.trade && <TradeCard pub={pub} />}

        <div className="card log">
          <h3>Что происходит</h3>
          <ol>
            {[...pub.log]
              .reverse()
              .map((e) => ({ seq: e.seq, text: eventText(e, namesFrom(pub)) }))
              .filter((e) => e.text)
              .slice(0, 14)
              .map((e) => (
                <li key={e.seq}>{e.text}</li>
              ))}
          </ol>
        </div>
        {(error || snap.error) && <p className="error">{error || snap.error}</p>}
      </aside>

      {pub.phase === 'finished' && <WinnerOverlay pub={pub} onNewGame={onNewGame} onClose={onClose} />}
    </main>
  );
}

function chipStyle(color?: PlayerColor) {
  return color ? { background: PLAYER_HEX[color], borderColor: PLAYER_STROKE[color] } : undefined;
}

/** Постройки из последних событий — подсвечиваем на карте. */
function recentBuilt(pub: PublicState): string[] {
  const out: string[] = [];
  for (const e of pub.log.slice(-4)) if (e.type === 'built') out.push(e.at);
  return out;
}

function PlayerPanel({
  p,
  current,
  longestRoad,
  largestArmy,
  discard,
  offlineMs,
  limitMs,
}: {
  p: PublicPlayer;
  current: boolean;
  longestRoad: boolean;
  largestArmy: boolean;
  discard?: number;
  offlineMs: number;
  limitMs: number;
}) {
  return (
    <div className={`player-panel ${current ? 'current' : ''} ${offlineMs >= 0 ? 'is-offline' : ''}`}>
      <div className="pp-head">
        <span className="chip" style={chipStyle(p.color)} />
        <span className="name">{p.name}</span>
        {p.bot && <span className={`bot-badge ${p.bot}`}>{BOT_LEVEL_NAME[p.bot]}</span>}
        <span className="vp" title="Очки">
          ⭐ {p.points}
        </span>
      </div>
      <div className="pp-stats">
        <span title="Карты ресурсов">🃏 {p.resourceCount}</span>
        <span title="Карты развития">📜 {p.devCardCount}</span>
        <span title="Сыграно рыцарей">⚔️ {p.knightsPlayed}</span>
        <span title="Самая длинная дорога игрока">🛣️ {p.roadLength}</span>
      </div>
      <div className="pp-pieces muted">
        дороги {p.pieces.roads} · поселения {p.pieces.settlements} · города {p.pieces.cities}
      </div>
      {(longestRoad || largestArmy) && (
        <div className="pp-badges">
          {longestRoad && <BonusBadge img="bonus-road" text="Самая длинная дорога +2" />}
          {largestArmy && <BonusBadge img="bonus-army" text="Самая большая армия +2" />}
        </div>
      )}
      {discard ? <div className="pp-note">сбрасывает {cards(discard)}…</div> : null}
      {current && p.bot && <div className="pp-note thinking">думает…</div>}
      {offlineMs >= 0 && (
        <div className="pp-offline">
          {offlineMs === 0
            ? 'не в сети'
            : offlineMs < limitMs
              ? `переподключается… ${formatClock(limitMs - offlineMs)}`
              : `не в сети ${formatClock(offlineMs)}`}
        </div>
      )}
    </div>
  );
}

function BonusBadge({ img, text }: { img: string; text: string }) {
  const url = art(img);
  return (
    <span className={`badge ${url ? 'with-art' : ''}`}>
      {url && <img src={url} alt="" />}
      {text}
    </span>
  );
}

/** Последняя сыгранная карта развития — показываем её на телевизоре несколько секунд. */
function usePlayedCard(pub: PublicState) {
  const last = [...pub.log].reverse().find((e) => e.type === 'devCardPlayed');
  const [shown, setShown] = useState<number | undefined>();
  useEffect(() => {
    if (!last) return;
    setShown(last.seq);
    const id = setTimeout(() => setShown(undefined), 6000);
    return () => clearTimeout(id);
  }, [last?.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!last || last.type !== 'devCardPlayed' || shown !== last.seq) return null;
  return last;
}

function TradeCard({ pub }: { pub: PublicState }) {
  const trade = pub.trade!;
  const name = namesFrom(pub);
  const from = pub.order[pub.current];
  const others = pub.order.filter((id) => id !== from);
  return (
    <div className="card trade">
      <h3>{name(from)} предлагает обмен</h3>
      <p className="trade-terms">
        отдаёт {resourcesText(trade.give)} <br />
        хочет {resourcesText(trade.want)}
      </p>
      <ul>
        {others.map((id) => {
          const r = trade.responses?.[id];
          let text = 'думает…';
          if (r?.kind === 'accept') text = '✅ согласен';
          if (r?.kind === 'decline') text = '❌ отказ';
          if (r?.kind === 'counter') text = `🔁 предлагает: ${resourcesText(r.want)} за ${resourcesText(r.give)}`;
          return (
            <li key={id}>
              <b>{name(id)}</b>: {text}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function WinnerOverlay({ pub, onNewGame, onClose }: { pub: PublicState; onNewGame: () => void; onClose: () => void }) {
  const ranking = [...pub.order].sort((a, b) => pub.players[b].points - pub.players[a].points);
  const winner = pub.winner ? pub.players[pub.winner] : undefined;
  return (
    <div className="overlay">
      <div className="card winner">
        <div className="trophy">🏆</div>
        <h1>{winner ? `${winner.name} побеждает!` : 'Игра окончена'}</h1>
        <ol className="ranking">
          {ranking.map((id) => (
            <li key={id}>
              <span className="chip" style={chipStyle(pub.players[id].color)} />
              <span className="name">{pub.players[id].name}</span>
              <span>{points(pub.players[id].points)}</span>
            </li>
          ))}
        </ol>
        <div className="row">
          <button className="btn primary big" onClick={onNewGame}>
            Новая игра
          </button>
          <button className="btn ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

function HostMenu({ onSkip, onClose, canSkip }: { onSkip: () => void; onClose: () => void; canSkip: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="host-menu">
      <button className="btn ghost icon" onClick={() => setOpen(!open)} aria-label="Меню хоста">
        ⋯
      </button>
      {open && (
        <div className="menu-pop" onClick={() => setOpen(false)}>
          {canSkip && <button onClick={onSkip}>Пропустить ход текущего игрока</button>}
          <button onClick={onClose}>Закрыть комнату</button>
        </div>
      )}
    </div>
  );
}
