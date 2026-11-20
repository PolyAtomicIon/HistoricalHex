// Игровой экран игрока: карта сверху, рука и кнопки снизу (на ПК — рядом).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Action, DevCardType, PlayerColor, PlayerId, PrivateView, PublicState, Resource, ResourceMap } from '../engine';
import {
  BOT_LEVELS,
  COSTS,
  RESOURCES,
  emptyResources,
  hasResources,
  legalCityVertices,
  legalRoadEdges,
  legalSettlementVertices,
  playersAtHex,
} from '../engine';
import type { PlayerRoom, PlayerSnapshot } from '../net';
import { Board } from '../board/Board';
import { Dice } from '../ui/Dice';
import { DEV_CARD_ICON, PLAYER_HEX, PLAYER_STROKE, RESOURCE_ICON } from '../ui/theme';
import { DEV_CARD_NAME, RESOURCE_NAME, cards, eventText, myPhaseText, namesFrom, phaseText, points, resourcesText } from '../i18n/ru';
import { ZoomPan } from './ZoomPan';
import { useMuted } from '../ui/sound';
import { playerCues, useLogSounds } from '../ui/eventSounds';
import { DEV_CARD_ART, art } from '../ui/art';
import { BOT_LEVEL_NAME } from '../bots';
import { IncomingTrade, TradeSheet } from './trade';
import { Modal, ResourceCards, ResourcePicker, ResourceStepper, sum, useSender } from './widgets';

type BuildMode = 'road' | 'settlement' | 'city';
type Sheet = null | 'trade' | 'dev' | 'yearOfPlenty' | 'monopoly' | 'costs' | 'leave' | 'leaveBot';

const BOT_LEVEL_HINT = { easy: 'играет наугад', medium: 'играет с умом', hard: 'играет на победу' } as const;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Targets {
  kind: 'vertex' | 'edge' | 'hex';
  ids: string[];
  hint: string;
  confirm: string;
  action: (id: string, victim?: PlayerId) => Action;
}

interface Props {
  room: PlayerRoom;
  snap: PlayerSnapshot;
  pub: PublicState;
  priv: PrivateView;
  onLeave: () => void;
}

export function GameView({ room, snap, pub, priv, onLeave }: Props) {
  const me = snap.uid;
  const { send, busy, error, clearError } = useSender(room, snap);
  const [mode, setMode] = useState<BuildMode | null>(null);
  const [selected, setSelected] = useState<string>();
  const [sheet, setSheet] = useState<Sheet>(null);
  const toast = useToasts(pub, priv, me);
  const [muted, toggleMute] = useMuted();
  const cues = useCallback((e: Parameters<typeof playerCues>[0]) => playerCues(e, me), [me]);
  useLogSounds(pub.log, cues);

  const current = pub.order[pub.current];
  const myTurn = current === me && pub.phase !== 'finished';
  const meP = pub.players[me];
  const name = namesFrom(pub);
  const colors = useMemo(
    () => Object.fromEntries(pub.order.map((id) => [id, pub.players[id].color])) as Record<PlayerId, PlayerColor>,
    [pub],
  );

  // Новая фаза / ход — сбрасываем выбор
  useEffect(() => {
    setSelected(undefined);
    setMode(null);
  }, [pub.phase, pub.current, pub.turn, pub.setup?.step, pub.roadBuildingLeft]);

  useEffect(() => {
    if (pub.phase !== 'main' || !myTurn) setSheet((s) => (s === 'trade' ? null : s));
  }, [pub.phase, myTurn]);

  // Обмен состоялся или отменён — закрываем окно обмена
  const tradeId = pub.trade?.id;
  const prevTradeId = useRef(tradeId);
  useEffect(() => {
    if (prevTradeId.current !== undefined && tradeId === undefined) setSheet((s) => (s === 'trade' ? null : s));
    prevTradeId.current = tradeId;
  }, [tradeId]);

  const targets = useMemo(() => computeTargets(pub, me, myTurn, mode), [pub, me, myTurn, mode]);

  const doSend = async (a: Action) => {
    await send(a);
    setSelected(undefined);
    setMode(null);
  };

  // Жертвы разбойника для выбранного гекса
  const victims =
    targets?.kind === 'hex' && selected
      ? playersAtHex(pub, selected, me).filter((p) => pub.players[p].resourceCount > 0)
      : [];

  const tap = (id: string) => setSelected(id === selected ? undefined : id);

  return (
    <main className={`screen play ${myTurn ? 'my-turn' : ''}`} style={{ ['--me' as string]: PLAYER_HEX[meP.color] }}>
      <header className="play-top">
        <span className="chip" style={{ background: PLAYER_HEX[meP.color], borderColor: PLAYER_STROKE[meP.color] }} />
        <div className="top-text">
          <b>{myTurn ? 'Твой ход!' : phaseText(pub)}</b>
          {myTurn && <small>{myPhaseText(pub)}</small>}
        </div>
        <span className="my-vp" title="Твои очки (вместе со скрытыми)">
          ⭐ {priv.points}
        </span>
        <button className="btn ghost icon" onClick={toggleMute} aria-label={muted ? 'Включить звук' : 'Выключить звук'}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="btn ghost icon" onClick={() => setSheet('costs')} aria-label="Меню: цены и выход">
          ☰
        </button>
      </header>

      <section className="play-board">
        <ZoomPan>
          <Board
            className="touch"
            view={pub}
            colors={colors}
            highlight={
              targets
                ? {
                    vertices: targets.kind === 'vertex' ? targets.ids : [],
                    edges: targets.kind === 'edge' ? targets.ids : [],
                    hexes: targets.kind === 'hex' ? targets.ids : [],
                  }
                : undefined
            }
            onVertex={tap}
            onEdge={tap}
            onHex={tap}
            selected={selected}
          />
        </ZoomPan>
        {targets && !selected && <div className="board-hint">{targets.hint}</div>}
        {targets && selected && (
          <div className="confirm-bar">
            {targets.kind === 'hex' && victims.length > 1 ? (
              <>
                <span>Украсть у:</span>
                {victims.map((v) => (
                  <button key={v} className="btn primary" disabled={busy} onClick={() => doSend(targets.action(selected, v))}>
                    {name(v)}
                  </button>
                ))}
              </>
            ) : (
              <>
                <span>
                  {targets.confirm}
                  {targets.kind === 'hex' && victims.length === 1 && ` (украдёшь у ${name(victims[0])})`}
                </span>
                <button className="btn primary" disabled={busy} onClick={() => doSend(targets.action(selected, victims[0]))}>
                  Да
                </button>
              </>
            )}
            <button className="btn ghost" onClick={() => setSelected(undefined)}>
              Отмена
            </button>
          </div>
        )}
      </section>

      <section className="play-panel">
        <ResourceCards hand={priv.resources} />
        <div className="pieces muted small">
          🛣️ {meP.pieces.roads}/15 · 🏠 {meP.pieces.settlements}/5 · 🏰 {meP.pieces.cities}/4 · 📜 {priv.devCards.length}
          {priv.hiddenPoints > 0 && ` · 🏆 +${priv.hiddenPoints} скрыто`}
        </div>

        {pub.phase === 'finished' ? (
          <Finished pub={pub} me={me} onLeave={onLeave} />
        ) : (
          <Actions
            pub={pub}
            priv={priv}
            me={me}
            myTurn={myTurn}
            mode={mode}
            setMode={(m) => {
              setSelected(undefined);
              setMode(m);
            }}
            setSheet={setSheet}
            send={doSend}
            busy={busy}
          />
        )}

        {!myTurn && pub.phase === 'main' && pub.trade && (
          <IncomingTrade key={pub.trade.id} pub={pub} priv={priv} me={me} send={send} busy={busy} />
        )}

        <div className="mini-log muted small">
          {[...pub.log]
            .reverse()
            .slice(0, 3)
            .map((e) => (
              <div key={e.seq}>{logLine(e, pub)}</div>
            ))}
        </div>
      </section>

      {/* Сброс на 7 — обязателен, окно не закрывается */}
      {pub.phase === 'discard' && priv.mustDiscard > 0 && <DiscardModal priv={priv} send={send} busy={busy} />}

      {sheet === 'trade' && myTurn && pub.phase === 'main' && (
        <Modal title="Обмен" onClose={() => setSheet(null)}>
          <TradeSheet pub={pub} priv={priv} me={me} send={send} busy={busy} />
        </Modal>
      )}
      {sheet === 'dev' && (
        <Modal title="Карты развития" onClose={() => setSheet(null)}>
          <DevCards
            priv={priv}
            busy={busy}
            onPlay={(t) => {
              if (t === 'yearOfPlenty' || t === 'monopoly') setSheet(t);
              else {
                setSheet(null);
                void send(t === 'knight' ? { type: 'playKnight' } : { type: 'playRoadBuilding' });
              }
            }}
          />
        </Modal>
      )}
      {sheet === 'yearOfPlenty' && (
        <YearOfPlenty pub={pub} busy={busy} onClose={() => setSheet(null)} onDone={(r) => send({ type: 'playYearOfPlenty', resources: r })} />
      )}
      {sheet === 'monopoly' && (
        <Modal title="Монополия: какой ресурс забрать у всех?" onClose={() => setSheet(null)}>
          <ResourcePicker
            disabled={() => busy}
            onPick={(r) => {
              setSheet(null);
              void send({ type: 'playMonopoly', resource: r });
            }}
          />
        </Modal>
      )}
      {sheet === 'costs' && (
        <Modal title="Цены и правила" onClose={() => setSheet(null)}>
          <Costs priv={priv} />
          <button className="btn ghost wide" onClick={() => (pub.phase === 'finished' ? onLeave() : setSheet('leave'))}>
            🚪 Выйти из игры
          </button>
        </Modal>
      )}
      {sheet === 'leave' && (
        <Modal title="Точно выйти из игры?" onClose={() => setSheet(null)}>
          <p className="small">
            Твои карты, постройки и очки останутся — дальше за тебя сыграет бот. Передумаешь — вернёшься с этого же
            устройства.
          </p>
          <div className="leave-row">
            <button className="btn ghost" onClick={() => setSheet(null)}>
              Остаться
            </button>
            <button className="btn primary" onClick={() => setSheet('leaveBot')}>
              Выйти
            </button>
          </div>
        </Modal>
      )}
      {sheet === 'leaveBot' && (
        <Modal title="Кто доиграет за тебя?" onClose={() => setSheet(null)}>
          <div className="bot-choice">
            {BOT_LEVELS.map((l) => (
              <button
                key={l}
                className={`btn wide bot-${l}`}
                disabled={busy}
                onClick={() => {
                  setSheet(null);
                  void send({ type: 'handToBot', level: l });
                }}
              >
                <span>🤖 {capitalize(BOT_LEVEL_NAME[l])}</span>
                <small>{BOT_LEVEL_HINT[l]}</small>
              </button>
            ))}
          </div>
          <button className="btn ghost wide" onClick={() => setSheet(null)}>
            Отмена
          </button>
        </Modal>
      )}

      {!snap.hostOnline && pub.phase !== 'finished' && (
        <div className="overlay soft">
          <div className="card center-card">
            <div className="spinner dark" />
            <p>Ждём ведущего… Экран ведущего закрыт или потерял связь.</p>
          </div>
        </div>
      )}

      {(error || toast) && (
        <div className={`toast ${error ? 'bad' : ''}`} onClick={clearError}>
          {error || toast}
        </div>
      )}
    </main>
  );
}

// ───────────────────────── куда можно нажать ─────────────────────────

function computeTargets(pub: PublicState, me: PlayerId, myTurn: boolean, mode: BuildMode | null): Targets | null {
  if (!myTurn) return null;
  switch (pub.phase) {
    case 'setup':
      if (pub.setup?.step === 'road') {
        return {
          kind: 'edge',
          ids: legalRoadEdges(pub, me, pub.setup.lastVertex),
          hint: 'Поставь дорогу к своему поселению',
          confirm: 'Поставить дорогу сюда?',
          action: (edge) => ({ type: 'buildRoad', edge }),
        };
      }
      return {
        kind: 'vertex',
        ids: legalSettlementVertices(pub, me, true),
        hint: pub.setup?.round === 2 ? 'Поставь второе поселение — за него дадут ресурсы' : 'Поставь первое поселение',
        confirm: 'Поставить поселение сюда?',
        action: (vertex) => ({ type: 'buildSettlement', vertex }),
      };
    case 'roadBuilding':
      return {
        kind: 'edge',
        ids: legalRoadEdges(pub, me),
        hint: `Поставь бесплатную дорогу (осталось ${pub.roadBuildingLeft ?? 1})`,
        confirm: 'Поставить дорогу сюда?',
        action: (edge) => ({ type: 'buildRoad', edge }),
      };
    case 'moveRobber':
      return {
        kind: 'hex',
        ids: pub.board.hexes.filter((h) => h.id !== pub.robberHex).map((h) => h.id),
        hint: 'Нажми на гекс, куда переставить разбойника',
        confirm: 'Поставить разбойника сюда?',
        action: (hex, victim) => ({ type: 'moveRobber', hex, ...(victim ? { victim } : {}) }),
      };
    case 'main':
      if (mode === 'road') {
        return {
          kind: 'edge',
          ids: legalRoadEdges(pub, me),
          hint: 'Выбери, где построить дорогу',
          confirm: 'Построить дорогу?',
          action: (edge) => ({ type: 'buildRoad', edge }),
        };
      }
      if (mode === 'settlement') {
        return {
          kind: 'vertex',
          ids: legalSettlementVertices(pub, me),
          hint: 'Выбери, где построить поселение',
          confirm: 'Построить поселение?',
          action: (vertex) => ({ type: 'buildSettlement', vertex }),
        };
      }
      if (mode === 'city') {
        return {
          kind: 'vertex',
          ids: legalCityVertices(pub, me),
          hint: 'Выбери поселение, которое станет городом',
          confirm: 'Построить город?',
          action: (vertex) => ({ type: 'buildCity', vertex }),
        };
      }
      return null;
    default:
      return null;
  }
}

// ───────────────────────── кнопки ─────────────────────────

function Actions({
  pub,
  priv,
  me,
  myTurn,
  mode,
  setMode,
  setSheet,
  send,
  busy,
}: {
  pub: PublicState;
  priv: PrivateView;
  me: PlayerId;
  myTurn: boolean;
  mode: BuildMode | null;
  setMode: (m: BuildMode | null) => void;
  setSheet: (s: Sheet) => void;
  send: (a: Action) => Promise<void>;
  busy: boolean;
}) {
  const name = namesFrom(pub);
  const meP = pub.players[me];
  const playable = priv.devCards.filter((c) => c.playable);
  const devButton = (
    <button className="btn" onClick={() => setSheet('dev')} disabled={priv.devCards.length === 0}>
      📜 Карты{playable.length ? ` (${playable.length})` : ''}
    </button>
  );

  if (pub.phase === 'discard') {
    const waiting = Object.keys(pub.pendingDiscards ?? {}).map(name);
    return <p className="status">Семёрка! Ждём, пока сбросят карты: {waiting.join(', ')}</p>;
  }
  if (!myTurn) {
    return (
      <div className="status">
        {pub.dice && <Dice dice={pub.dice} />}
        <p>Ходит {name(pub.order[pub.current])}</p>
      </div>
    );
  }

  switch (pub.phase) {
    case 'setup':
    case 'moveRobber':
    case 'roadBuilding':
      return <p className="status">Нажми на подсвеченное место на карте 👆</p>;
    case 'roll':
      return (
        <div className="actions">
          <button className="btn primary big wide" disabled={busy} onClick={() => send({ type: 'rollDice' })}>
            🎲 Бросить кубики
          </button>
          {devButton}
        </div>
      );
    case 'main': {
      const can = (cost: ResourceMap) => hasResources(priv.resources, cost);
      const roads = meP.pieces.roads > 0 && can(COSTS.road) && legalRoadEdges(pub, me).length > 0;
      const settl = meP.pieces.settlements > 0 && can(COSTS.settlement) && legalSettlementVertices(pub, me).length > 0;
      const city = meP.pieces.cities > 0 && can(COSTS.city) && legalCityVertices(pub, me).length > 0;
      const dev = pub.devDeckCount > 0 && can(COSTS.devCard);
      const toggle = (m: BuildMode) => setMode(mode === m ? null : m);
      return (
        <div className="actions">
          {pub.dice && <Dice dice={pub.dice} />}
          <div className="build-row">
            <BuildButton label="Дорога" cost={COSTS.road} on={mode === 'road'} disabled={!roads || busy} onClick={() => toggle('road')} />
            <BuildButton label="Поселение" cost={COSTS.settlement} on={mode === 'settlement'} disabled={!settl || busy} onClick={() => toggle('settlement')} />
            <BuildButton label="Город" cost={COSTS.city} on={mode === 'city'} disabled={!city || busy} onClick={() => toggle('city')} />
            <BuildButton label="Карта" cost={COSTS.devCard} disabled={!dev || busy} onClick={() => send({ type: 'buyDevCard' })} />
          </div>
          <div className="row">
            <button className={`btn ${pub.trade ? 'primary' : ''}`} onClick={() => setSheet('trade')}>
              🤝 Обмен{pub.trade ? ' (идёт)' : ''}
            </button>
            {devButton}
            <button className="btn end" disabled={busy} onClick={() => send({ type: 'endTurn' })}>
              Конец хода ➜
            </button>
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

function BuildButton({
  label,
  cost,
  on,
  disabled,
  onClick,
}: {
  label: string;
  cost: ResourceMap;
  on?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`build-btn ${on ? 'on' : ''}`} disabled={disabled && !on} onClick={onClick}>
      <b>{label}</b>
      <small>{resourcesText(cost).replace(/×1/g, '')}</small>
    </button>
  );
}

function DevCards({ priv, busy, onPlay }: { priv: PrivateView; busy: boolean; onPlay: (t: DevCardType) => void }) {
  if (priv.devCards.length === 0) return <p>Карт развития пока нет.</p>;
  return (
    <ul className="dev-list">
      {priv.devCards.map((c, i) => (
        <li key={i}>
          {art(DEV_CARD_ART[c.type]) ? (
            <img className="dev-thumb" src={art(DEV_CARD_ART[c.type])} alt="" draggable={false} />
          ) : (
            <span className="dev-icon">{DEV_CARD_ICON[c.type]}</span>
          )}
          <span className="dev-name">
            {DEV_CARD_NAME[c.type]}
            {c.isNew && <small> · куплена в этот ход</small>}
            <small className="muted">{DEV_HINT[c.type]}</small>
          </span>
          {c.type !== 'victoryPoint' && (
            <button className="btn primary" disabled={!c.playable || busy} onClick={() => onPlay(c.type)}>
              Сыграть
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

const DEV_HINT: Record<DevCardType, string> = {
  knight: 'Переставь разбойника и укради карту',
  victoryPoint: '+1 очко, другие не видят',
  roadBuilding: '2 дороги бесплатно',
  yearOfPlenty: '2 любые карты из банка',
  monopoly: 'Забери у всех один ресурс',
};

function YearOfPlenty({
  pub,
  busy,
  onClose,
  onDone,
}: {
  pub: PublicState;
  busy: boolean;
  onClose: () => void;
  onDone: (r: [Resource, Resource]) => Promise<void>;
}) {
  const [picked, setPicked] = useState<Resource[]>([]);
  const left = (r: Resource) => pub.bank[r] - picked.filter((x) => x === r).length;
  return (
    <Modal title="Изобилие: выбери 2 карты" onClose={onClose}>
      <ResourcePicker disabled={(r) => picked.length >= 2 || left(r) <= 0} onPick={(r) => setPicked([...picked, r])} />
      <p className="picked">{picked.length ? picked.map((r) => RESOURCE_ICON[r]).join(' ') : 'Пока ничего'}</p>
      <div className="row">
        <button
          className="btn primary"
          disabled={picked.length !== 2 || busy}
          onClick={async () => {
            onClose();
            await onDone([picked[0], picked[1]]);
          }}
        >
          Взять
        </button>
        <button className="btn ghost" onClick={() => setPicked([])}>
          Заново
        </button>
      </div>
    </Modal>
  );
}

function DiscardModal({ priv, send, busy }: { priv: PrivateView; send: (a: Action) => Promise<void>; busy: boolean }) {
  const [pick, setPick] = useState<ResourceMap>(emptyResources());
  const need = priv.mustDiscard;
  const chosen = sum(pick);
  return (
    <Modal title={`Семёрка! Сбрось ${cards(need)}`}>
      <p className="muted">У тебя больше 7 карт — половина уходит в банк. Выбери, что отдать.</p>
      <ResourceStepper value={pick} onChange={setPick} max={priv.resources} />
      <button
        className="btn primary big wide"
        disabled={chosen !== need || busy}
        onClick={() => send({ type: 'discard', resources: pick })}
      >
        {chosen === need ? 'Сбросить' : `Выбрано ${chosen} из ${need}`}
      </button>
    </Modal>
  );
}

function Costs({ priv }: { priv: PrivateView }) {
  const rows: [string, ResourceMap, string][] = [
    ['Дорога', COSTS.road, ''],
    ['Поселение', COSTS.settlement, '1 очко'],
    ['Город', COSTS.city, '2 очка, ставится на своё поселение'],
    ['Карта развития', COSTS.devCard, ''],
  ];
  return (
    <div className="costs">
      <table>
        <tbody>
          {rows.map(([n, c, note]) => (
            <tr key={n}>
              <td>
                <b>{n}</b>
                {note && <small className="muted"> · {note}</small>}
              </td>
              <td>{resourcesText(c)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small">
        Твой курс с банком:{' '}
        {RESOURCES.map((r) => `${RESOURCE_ICON[r]} ${priv.tradeRatios?.[r] ?? 4}:1`).join(' · ')}
      </p>
      <p className="small muted">
        Победа — 10 очков в свой ход. «Самая длинная дорога» (5+) и «Самая большая армия» (3+ рыцаря) — по 2 очка.
      </p>
    </div>
  );
}

function Finished({ pub, me, onLeave }: { pub: PublicState; me: PlayerId; onLeave: () => void }) {
  const ranking = [...pub.order].sort((a, b) => pub.players[b].points - pub.players[a].points);
  const won = pub.winner === me;
  return (
    <div className="card finished">
      <div className="trophy">{won ? '🏆' : '🎉'}</div>
      <h2>{won ? 'Ты победил!' : `Победил ${pub.players[pub.winner ?? '']?.name ?? '…'}`}</h2>
      <ol className="ranking">
        {ranking.map((id) => (
          <li key={id}>
            <span className="chip" style={{ background: PLAYER_HEX[pub.players[id].color] }} />
            <span className="name">
              {pub.players[id].name}
              {pub.players[id].away && ' 🤖'}
            </span>
            <span>{points(pub.players[id].points)}</span>
          </li>
        ))}
      </ol>
      <button className="btn ghost" onClick={onLeave}>
        В новую игру
      </button>
    </div>
  );
}

// ───────────────────────── уведомления ─────────────────────────

function logLine(e: PublicState['log'][number], pub: PublicState): string {
  return eventText(e, namesFrom(pub)) ?? '';
}

/** «Твой ход!», кражи у тебя и тобой — коротким сообщением на пару секунд. */
function useToasts(pub: PublicState, priv: PrivateView, me: PlayerId): string {
  const [msg, setMsg] = useState('');
  const seen = useRef<number>(Infinity);
  const wasMyTurn = useRef(false);
  const name = namesFrom(pub);

  useEffect(() => {
    const steals = priv.steals ?? [];
    const latest = Math.max(0, ...steals.map((s) => s.seq));
    if (seen.current === Infinity) {
      seen.current = latest; // старые кражи не показываем
      return;
    }
    for (const s of steals) {
      if (s.seq <= seen.current || s.type !== 'stole') continue;
      const r = s.resource ? `${RESOURCE_ICON[s.resource]} ${RESOURCE_NAME[s.resource]}` : 'карту';
      setMsg(s.victim === me ? `${name(s.thief)} украл у тебя ${r}` : `Ты украл у ${name(s.victim)}: ${r}`);
    }
    seen.current = Math.max(seen.current, latest);
  }, [priv.steals, me, name]);

  const myTurn = pub.order[pub.current] === me && pub.phase !== 'finished' && pub.phase !== 'setup';
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) {
      setMsg('Твой ход! 🎲');
      try {
        // Браузер разрешает вибрацию только после того, как по странице уже нажимали
        if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(200);
      } catch {
        /* не все телефоны умеют */
      }
    }
    wasMyTurn.current = myTurn;
  }, [myTurn]);

  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(''), 3500);
    return () => clearTimeout(id);
  }, [msg]);

  return msg;
}
