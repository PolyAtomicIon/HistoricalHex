// Экран игры на телевизоре: карта по центру, игроки слева, ход/кубики/обмен/лог справа.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState, HexId, PlayerColor, PlayerId, PublicPlayer, PublicState, Resource } from '../engine';
import { TERRAIN_RESOURCE, toPublicView, topologyFor } from '../engine';
import type { HostRoom, HostSnapshot, Presence } from '../net';
import { OFFLINE_BOT_LEVEL, describeError, takeoverDeadline } from '../net';
import { Board } from '../board/Board';
import { BOT_LEVEL_NAME } from '../bots';
import { Dice } from '../ui/Dice';
import { formatClock, useNow } from '../ui/hooks';
import { PLAYER_HEX, PLAYER_STROKE, RESOURCE_ICON } from '../ui/theme';
import { useMuted } from '../ui/sound';
import { Emblem } from '../ui/Logo';
import { hostCues, useLogSounds } from '../ui/eventSounds';
import { DEV_CARD_ART, art, resourceArt } from '../ui/art';
import { DEV_CARD_NAME, GAME_TITLE, cards, eventText, namesFrom, phaseText, points, resourcesText } from '../i18n/ru';

interface Props {
  room: HostRoom;
  snap: HostSnapshot;
  state: GameState;
  now: () => number;
  onClose: () => void;
  onNewGame: () => void;
  /** false — без звуков (в режиме «играю с этого устройства» звучит экран игрока). */
  sounds?: boolean;
}

const NO_CUES = () => [];

export function GameScreen({ room, snap, state, now, onClose, onNewGame, sounds = true }: Props) {
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
  const flash = useProductionFlash(pub);
  const banner = useTurnBanner(pub);
  const [muted, toggleMute] = useMuted();
  useLogSounds(pub.log, sounds ? hostCues : NO_CUES);

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
  // Если включена замена ботом — хост сделает это сам, кнопки не нужны
  const alerts = snap.settings.offlineBot ? [] : waitingOn.filter(overdue);
  const botIn = (uid: PlayerId) => {
    const d = takeoverDeadline({ ...snap, state }, uid);
    return d === null ? -1 : Math.max(0, d - t);
  };
  // «Ждать дальше» — даём ещё один полный срок ожидания с этого момента.
  const waitMore = (uid: PlayerId) => setExtraWait((w) => ({ ...w, [uid]: offlineFor(uid) }));

  return (
    <main className="screen game">
      <header className="game-header">
        <Emblem className="tiny" />
        <span className="logo small">{GAME_TITLE}</span>
        <span className="turn-chip" style={chipStyle(pub.players[current]?.color)} />
        <h1 className="phase">{phaseText(pub)}</h1>
        <span className="muted">
          {pub.phase === 'setup' ? 'Расстановка' : `Ход ${pub.turn}`} · PIN {room.pin}
        </span>
        <button className="btn ghost icon" onClick={toggleMute} aria-label={muted ? 'Включить звук' : 'Выключить звук'}>
          {muted ? '🔇' : '🔊'}
        </button>
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
            botInMs={botIn(id)}
          />
        ))}
      </aside>

      <section className="board-wrap">
        <Board view={pub} colors={colors} recent={recent} flash={flash} />
      </section>

      {banner && (
        <div
          className="turn-banner"
          key={banner.seq}
          style={{ ['--pc' as string]: PLAYER_HEX[pub.players[banner.player]?.color ?? 'white'] }}
        >
          Ходит {pub.players[banner.player]?.name}
        </div>
      )}

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
                  <button
                    className="btn"
                    onClick={() => run(room.hostAction({ type: 'handToBot', player: uid, level: OFFLINE_BOT_LEVEL }))}
                  >
                    🤖 Отдать боту
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
  botInMs,
}: {
  p: PublicPlayer;
  current: boolean;
  longestRoad: boolean;
  largestArmy: boolean;
  discard?: number;
  offlineMs: number;
  limitMs: number;
  /** Через сколько игрока заменит бот (-1 — не заменит). */
  botInMs: number;
}) {
  return (
    <div className={`player-panel ${current ? 'current' : ''} ${offlineMs >= 0 ? 'is-offline' : ''}`} data-player={p.id}>
      <div className="pp-head">
        <span className="chip" style={chipStyle(p.color)} />
        <span className="name">{p.name}</span>
        {p.bot && (
          <span className={`bot-badge ${p.bot}`} title={p.away ? 'Игрок вышел — вместо него играет бот' : undefined}>
            {BOT_LEVEL_NAME[p.bot]}
          </span>
        )}
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
          {botInMs >= 0
            ? `не в сети · бот через ${formatClock(botInMs)}`
            : offlineMs === 0
            ? 'не в сети'
            : offlineMs < limitMs
              ? `переподключается… ${formatClock(limitMs - offlineMs)}`
              : `не в сети ${formatClock(offlineMs)}`}
        </div>
      )}
    </div>
  );
}

const CONFETTI_COLORS = ['#ffd27a', '#e8792b', '#2f6fdb', '#2e9e5b', '#d94841', '#8a4fd1', '#fff'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        dur: 2.8 + Math.random() * 2.5,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rot: Math.random() * 360,
        w: 6 + Math.random() * 8,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.w,
            height: p.w * 0.45,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

/** Плашка «Ходит …» на ~1,5 с при смене хода. */
function useTurnBanner(pub: PublicState) {
  const last = [...pub.log].reverse().find((e) => e.type === 'turnStarted');
  const first = useRef(last?.seq);
  const [shown, setShown] = useState<number>();
  useEffect(() => {
    if (!last || last.seq === first.current) return;
    setShown(last.seq);
    const id = setTimeout(() => setShown(undefined), 1600);
    return () => clearTimeout(id);
  }, [last?.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  return last && last.type === 'turnStarted' && shown === last.seq ? last : null;
}

/**
 * Доход: гексы с выпавшим числом вспыхивают, а значки ресурсов летят
 * от гекса к панели игрока, который их получил.
 */
function useProductionFlash(pub: PublicState): { hexes: HexId[]; key: number } | undefined {
  const last = [...pub.log].reverse().find((e) => e.type === 'produced');
  const first = useRef(last?.seq);
  const [flash, setFlash] = useState<{ hexes: HexId[]; key: number }>();

  useEffect(() => {
    if (!last || last.type !== 'produced' || last.seq === first.current) return;
    const hexes = pub.board.hexes.filter((h) => h.number === last.total && h.id !== pub.robberHex && h.terrain !== 'desert');
    setFlash({ hexes: hexes.map((h) => h.id), key: last.seq });

    // Летящие значки — после того, как кубики докрутятся
    const timer = setTimeout(() => {
      const topo = topologyFor(pub.board.layout);
      let n = 0;
      for (const h of hexes) {
        if (h.terrain === 'desert') continue;
        const res = TERRAIN_RESOURCE[h.terrain];
        const from = document.querySelector(`[data-hex="${h.id}"]`)?.getBoundingClientRect();
        if (!from) continue;
        for (const v of topo.hexes.get(h.id)!.vertices) {
          const b = pub.buildings[v];
          if (!b || !last.gains?.[b.owner]?.[res]) continue;
          const to = document.querySelector(`[data-player="${b.owner}"]`)?.getBoundingClientRect();
          if (!to) continue;
          for (let k = 0; k < (b.kind === 'city' ? 2 : 1); k++) flyIcon(res, from, to, n++ * 110);
        }
      }
    }, 750);
    return () => clearTimeout(timer);
  }, [last?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  return flash;
}

function flyIcon(res: Resource, from: DOMRect, to: DOMRect, delay: number) {
  const url = resourceArt(res);
  const el = document.createElement(url ? 'img' : 'span');
  el.className = 'fly-icon';
  if (url) (el as HTMLImageElement).src = url;
  else el.textContent = RESOURCE_ICON[res];
  const x0 = from.left + from.width / 2 - 22;
  const y0 = from.top + from.height / 2 - 22;
  el.style.left = `${x0}px`;
  el.style.top = `${y0}px`;
  document.body.appendChild(el);
  const dx = to.left + 40 - x0;
  const dy = to.top + to.height / 2 - 22 - y0;
  const anim = el.animate(
    [
      { transform: 'translate(0, 0) scale(0.4)', opacity: 0 },
      { transform: 'translate(0, -30px) scale(1.15)', opacity: 1, offset: 0.25 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.7)`, opacity: 0.9 },
    ],
    { duration: 1000, delay, easing: 'cubic-bezier(0.5, 0, 0.4, 1)', fill: 'both' },
  );
  anim.onfinish = () => el.remove();
  anim.oncancel = () => el.remove();
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
      <Confetti />
      <div className="card winner">
        <div className="trophy">🏆</div>
        <h1>{winner ? `${winner.name}${winner.away ? ' 🤖' : ''} побеждает!` : 'Игра окончена'}</h1>
        <ol className="ranking">
          {ranking.map((id) => (
            <li key={id}>
              <span className="chip" style={chipStyle(pub.players[id].color)} />
              <span className="name">
                {pub.players[id].name}
                {pub.players[id].away && ' 🤖'}
              </span>
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
