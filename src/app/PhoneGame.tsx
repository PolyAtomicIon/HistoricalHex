// Экран игрока: карта на весь экран, поверх — стеклянные панели и шторки.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Action, DevCardType, PlayerColor, PlayerId, PrivateView, PublicState, Resource, ResourceMap } from '../engine';
import {
  BOT_LEVELS,
  COSTS,
  RESOURCES,
  canBuildRoad,
  canBuildSettlement,
  emptyResources,
  hasResources,
  legalCityVertices,
  legalRoadEdges,
  legalSettlementVertices,
  playersAtHex,
  topologyFor,
  TERRAIN_RESOURCE,
} from '../engine';
import type { RoomView } from '../proto';
import { REACTIONS } from '../proto';
import { conn, useConn } from '../client/conn';
import type { LoreFact, LorePack } from '../lore';
import { PLAYER_HEX } from '../ui/theme';
import { Icon, ArtIcon } from './icons';
import { eraIcon } from './era';
import { setGfxPref, setLitePref, useGfx, useLite, type GfxPref } from './lite';
import { DEV_CARD_NAME, RESOURCE_NAME, ROBBER, myPhaseText, phaseText } from '../i18n/ru';
import { Cinematic, DiceOverlay, GainToast, Raid, ReactionBar, ReactionsLayer, Threat, haptic, sfx, useMuted, useMusicOn } from '../fx';
import { Sheet } from './Sheet';
import { playerClusters } from './clusters';
import { PlayerProfileCard } from './Profile';
import { enablePush, pushSupport } from './pwa';
import { TurnSettings } from './TurnSettings';
import { IncomingTrade, TradeSheet } from './trade';
import { HandMini, RES_COLOR, ResChips, ResourcePicker, ResourceStepper, TradeGrid, sum } from './widgets';
import { ResIcon } from './ResIcon';
import { threatInfo, useAttacking, useGameFx } from './useGameFx';
import { GameBoard, chose3d, useBoardMode, MODE_LABEL } from './GameBoard';
import type { PlanStep } from './planner';
import { awardsOf } from './awards';
import { incomeByNumber } from './income';
import { TRADE_UI_LABEL, TradeCard, TradeCaravan, setTradeUi, useTradeUi } from './TradeOffer';
import type { TradeUi } from './TradeOffer';
import type { LogEntry } from './gameLog';
import { STEP_ICON, STEP_LABEL, STEP_SHORT, checkPlan, doneSteps, settlementRoutes, goalHints, loadPlan, newStepId, savePlan, stepAction } from './planner';
import { Fact, FactsList, useRotatingFact } from './Facts';

type BuildMode = 'road' | 'settlement' | 'city';
type SheetId = null | 'trade' | 'incoming' | 'dev' | 'plenty' | 'monopoly' | 'menu' | 'leave' | 'plan' | 'lore' | 'dice' | 'react' | 'players' | 'fact' | 'pprofile';
type PlanPick = null | 'road' | 'settlement' | 'city';

interface Targets {
  kind: 'vertex' | 'edge' | 'hex';
  ids: string[];
  hint: string;
  confirm: string;
  action: (id: string, victim?: PlayerId) => Action;
}

const AUTO_ROLL_KEY = 'hh.autoroll';
const readAuto = () => {
  try {
    return localStorage.getItem(AUTO_ROLL_KEY) !== '0';
  } catch {
    return true;
  }
};

export function PhoneGame({ room, pack }: { room: RoomView; pack: LorePack }) {
  const pub = room.public!;
  const priv = room.private!;
  const me = room.me;
  const meP = pub.players[me];
  const current = pub.order[pub.current];
  const myTurn = current === me && pub.phase !== 'finished';
  // DEV: подставить награды, чтобы проверить значки и подсветку магистрали в крайних случаях
  const [awardDbg, setAwardDbg] = useState<{ r?: string; a?: string } | null>(null);
  if (import.meta.env.DEV) (window as unknown as { __awards: (r?: string, a?: string) => void }).__awards = (r, a) => setAwardDbg({ r, a });
  const pubShown = awardDbg ? { ...pub, longestRoad: awardDbg.r, largestArmy: awardDbg.a } : pub;
  const fx = useGameFx(pub, pack, me);
  // пока идёт сцена атаки, кубики не бросаем — сначала досмотреть
  const attacking = useAttacking(fx.attackUntil);
  // Сообщения сервера/игры — внутри колонки сверху, а не поверх полосы игроков
  const connNotice = useConn().notice;
  const [gameToast, setGameToast] = useState<{ text: string; key: number } | null>(null);
  // Подпись к атаке (налёт / изгнание): что за атака, на какой гекс, что это значит
  const [raidCap, setRaidCap] = useState<{ key: number; title: string; text: string } | null>(null);
  useEffect(() => {
    const r = fx.raid;
    if (!r) return;
    const hex = r.target ? pub.board.hexes.find((h) => h.id === r.target) : undefined;
    const resN = hex && hex.terrain !== 'desert' ? TERRAIN_RESOURCE[hex.terrain] : undefined;
    const where = resN ? `${RESOURCE_NAME[resN]}${hex?.number ? ` ${hex.number}` : ''}` : 'гекс';
    const mine = hex && Object.entries(pub.buildings).some(([v, b]) => b.owner === me && topologyFor(pub.board.layout).vertices.get(v)?.hexes.includes(hex.id));
    setRaidCap(
      r.kind === 'robber'
        ? { key: r.key, title: `${pack.robber.name}: ${where}`, text: mine ? 'Это твой гекс — он не приносит дохода, пока захватчиков не прогонят' : 'Этот гекс не приносит дохода, пока захватчиков не прогонят' }
        : { key: r.key, title: `${pack.devCards.knight.name}: ${where}`, text: mine ? 'Войско перегнало захватчиков на твой гекс — он без дохода' : 'Войско перегнало захватчиков сюда — этот гекс теперь без дохода' },
    );
    const t = setTimeout(() => setRaidCap((c) => (c?.key === r.key ? null : c)), 6000);
    return () => clearTimeout(t);
  }, [fx.raid?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!connNotice) return;
    setGameToast(connNotice);
    const t = setTimeout(() => setGameToast((g) => (g?.key === connNotice.key ? null : g)), 3600);
    return () => clearTimeout(t);
  }, [connNotice?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [logOpen, setLogOpen] = useState(false);
  // Важное (награды, монополия) — карточкой с объяснением, пока не нажали «Понятно»
  const [noticeSeen, setNoticeSeen] = useState<number[]>([]);
  const notice = fx.notices.find((n) => !noticeSeen.includes(n.key)) ?? null;
  const markSeen = (key: number) => setNoticeSeen((s) => [...s.slice(-20), key]);
  const { status: connStatus, vapid, pushOn } = useConn();
  // Один раз предложить уведомления «Твой ход» (через 20 с после входа в партию)
  const [askPush, setAskPushState] = useState(false);
  const setAskPush = (v: boolean) => {
    setAskPushState(v);
    if (!v) {
      try {
        localStorage.setItem('hh.pushAsk', '1');
      } catch {
        /* ok */
      }
    }
  };
  useEffect(() => {
    if (pushOn || pushSupport() !== 'ok') return;
    try {
      if (localStorage.getItem('hh.pushAsk')) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setAskPushState(true), 20000);
    return () => clearTimeout(t);
  }, [pushOn]);
  const [mode, setMode] = useBoardMode();
  const [muted, setMuted] = useMuted();
  const [music, setMusic] = useMusicOn();
  const { pref: litePref, auto: liteAuto, lite: liteOn } = useLite();
  // что реально на экране: в лёгком режиме 3D — только если игрок сам его выбрал
  const shownMode = mode === '3d' && (!liteOn || chose3d()) ? '3d' : '2d';
  const { hi: gfxHi, pref: gfxPref, auto: gfxAuto } = useGfx();
  const [sheet, setSheet] = useState<SheetId>(null);
  // Фокус на постройках игрока (тап по ячейке игрока сверху): подсветка + камера, 4 секунды
  const [focusPlayer, setFocusPlayer] = useState<{ id: PlayerId; key: number; idx?: number } | null>(null);
  const focusClusters = useMemo(() => (focusPlayer ? playerClusters(pub, focusPlayer.id) : []), [focusPlayer?.id, pub]); // eslint-disable-line react-hooks/exhaustive-deps
  const [profileOf, setProfileOf] = useState<PlayerId | null>(null);
  const [openFact, setOpenFact] = useState<LoreFact | null>(null);
  // Районы показываются по очереди (≈4.5 с на район), потом фокус гаснет
  useEffect(() => {
    if (!focusPlayer) return;
    const idx = focusPlayer.idx ?? 0;
    const last = idx >= focusClusters.length - 1;
    const t = setTimeout(() => setFocusPlayer((f) => (f && f.key === focusPlayer.key ? (last ? null : { ...f, idx: idx + 1 }) : f)), 4500);
    return () => clearTimeout(t);
  }, [focusPlayer, focusClusters.length]);
  const focusSpot = focusPlayer ? { id: focusPlayer.id, key: focusPlayer.key * 10 + (focusPlayer.idx ?? 0), vertices: focusClusters[focusPlayer.idx ?? 0] ?? [] } : null;
  const stepFocus = (d: number) =>
    setFocusPlayer((f) => (f ? { ...f, idx: ((f.idx ?? 0) + d + focusClusters.length) % Math.max(1, focusClusters.length) } : f));
  const [build, setBuild] = useState<BuildMode | null>(null);
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [plan, setPlanState] = useState<PlanStep[]>(() => loadPlan(room.pin, me));
  const [planPick, setPlanPick] = useState<PlanPick>(null);
  // Тап по шагу плана — показать место на карте на несколько секунд
  const [planPin, setPlanPin] = useState<{ at: string; key: number } | null>(null);
  useEffect(() => {
    if (!planPin) return;
    const t = setTimeout(() => setPlanPin(null), 3500);
    return () => clearTimeout(t);
  }, [planPin]);
  const [autoRoll, setAutoRoll] = useState(readAuto);
  const [countdown, setCountdown] = useState<number | null>(null);
  const physical = room.settings.dice === 'physical';
  const dockRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--dock-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const planRef = useRef(plan);
  const setPlan = (p: PlanStep[]) => {
    planRef.current = p;
    setPlanState(p);
    savePlan(room.pin, me, p);
  };

  // Что уже построено своими руками — из плана убираем само («молодец, сделано»), чужое — оставляем сломанным
  useEffect(() => {
    const done = doneSteps(planRef.current, pub, me);
    if (done.size === 0) return;
    setPlan(planRef.current.filter((s) => !done.has(s.id)));
  }, [pub.roads, pub.buildings]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (a: Action, dice?: [number, number]): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    const res = await conn.act(a, dice);
    setBusy(false);
    if (!res.ok) {
      sfx.play('error');
      haptic('error');
    }
    return res.ok;
  };
  const sendVoid = async (a: Action) => {
    await send(a);
  };
  // Входящий обмен: вид выбирает игрок (меню), по умолчанию — карточка сделки
  const tradeUi = useTradeUi();
  // DEV: показать входящее предложение без бота — window.__offer({brick:1},{sheep:1})
  const [offerDbg, setOfferDbg] = useState<PublicState['trade'] | null>(null);
  if (import.meta.env.DEV)
    (window as unknown as { __offer: (w?: Partial<ResourceMap>, g?: Partial<ResourceMap>) => void }).__offer = (w, g) =>
      setOfferDbg(w ? { id: Date.now(), want: { ...emptyResources(), ...w }, give: { ...emptyResources(), ...g }, responses: {} } : null);
  const offerPub = offerDbg ? { ...pub, trade: offerDbg } : pub;
  const showOffer = !!offerPub.trade && (offerDbg ? true : !myTurn && pub.phase === 'main') && !planPick && sheet === null;
  const offerProps = { pub: offerPub, priv, me, pack, busy, send: offerDbg ? async () => setOfferDbg(null) : sendVoid, counter: () => setSheet('incoming') };

  // Новая фаза / ход — сбрасываем выбор
  useEffect(() => {
    setSelected(undefined);
    setBuild(null);
  }, [pub.phase, pub.current, pub.turn, pub.setup?.step, pub.roadBuildingLeft]);

  // Входящее предложение обмена — открываем шторку
  const tradeId = pub.trade?.id;
  // Входящее предложение не открывает шторку само (раньше рвало план и чтение) — показываем плашку над доком
  useEffect(() => {
    if (tradeId === undefined) setSheet((s) => (s === 'incoming' ? null : s));
  }, [tradeId]);

  // Обязательный сброс на 7
  const mustDiscard = pub.phase === 'discard' && priv.mustDiscard > 0;

  // Авто-бросок в свой ход
  const playable = priv.devCards.filter((c) => c.playable);
  useEffect(() => {
    if (!(myTurn && pub.phase === 'roll')) {
      setCountdown(null);
      return;
    }
    if (physical) {
      setSheet('dice');
      return;
    }
    if (room.settings.autoRoll) return; // бросает сервер
    if (!autoRoll || attacking) return;
    // Есть карта, которую можно сыграть до броска (рыцарь) — не бросаем сами, ждём решения
    if (playable.some((c) => c.type === 'knight')) return;
    setCountdown(2);
  }, [myTurn, pub.phase, pub.turn, physical, autoRoll, attacking]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      void send({ type: 'rollDice' });
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  const targets = useMemo(() => computeTargets(pub, me, myTurn, build), [pub, me, myTurn, build]);

  // Планирование: куда можно поставить с учётом уже запланированного
  const planTargets = useMemo(() => {
    if (!planPick) return null;
    const view = { board: pub.board, buildings: { ...pub.buildings }, roads: { ...pub.roads } };
    for (const s of plan) {
      if (s.kind === 'road') view.roads[s.at] = me;
      if (s.kind === 'settlement') view.buildings[s.at] = { owner: me, kind: 'settlement' };
      if (s.kind === 'city') view.buildings[s.at] = { owner: me, kind: 'city' };
    }
    const topo = topologyFor(pub.board.layout);
    if (planPick === 'road') return { kind: 'edge' as const, ids: [...topo.edges.keys()].filter((e) => canBuildRoad(view, me, e)) };
    if (planPick === 'settlement') {
      // места в 0–3 дорогах от своей сети: дороги план добавит сам
      const routes = settlementRoutes(view, me);
      return { kind: 'vertex' as const, ids: [...routes.keys()], routes };
    }
    return {
      kind: 'vertex' as const,
      ids: Object.entries(view.buildings)
        .filter(([, b]) => b.owner === me && b.kind === 'settlement')
        .map(([v]) => v),
    };
  }, [planPick, plan, pub, me]);

  const checked = useMemo(() => checkPlan(plan, pub, priv, me), [plan, pub, priv, me]);
  const broken = checked.filter((c) => c.status === 'broken').length;
  const prevBroken = useRef(broken);
  useEffect(() => {
    if (broken > prevBroken.current) {
      conn.notify('Твой план сломался — загляни в «План»');
      haptic('error');
    }
    prevBroken.current = broken;
  }, [broken]);

  const victims =
    targets?.kind === 'hex' && selected ? playersAtHex(pub, selected, me).filter((p) => pub.players[p].resourceCount > 0) : [];

  const colors = useMemo(
    () => Object.fromEntries(pub.order.map((id) => [id, pub.players[id].color])) as Record<PlayerId, PlayerColor>,
    [pub],
  );

  const tap = (id: string) => {
    sfx.play('tick');
    if (planPick) {
      if (!planTargets?.ids.includes(id)) return;
      const step: PlanStep =
        planPick === 'road' ? { id: newStepId(), kind: 'road', at: id } : { id: newStepId(), kind: planPick, at: id };
      // к дальнему поселению — сначала нужные дороги
      const roads: PlanStep[] =
        planPick === 'settlement' && 'routes' in planTargets && planTargets.routes
          ? (planTargets.routes.get(id) ?? []).map((e) => ({ id: newStepId(), kind: 'road' as const, at: e }))
          : [];
      setPlan([...plan, ...roads, step]);
      setPlanPick(null);
      setSheet('plan');
      haptic('tap');
      return;
    }
    setSelected(id === selected ? undefined : id);
  };

  const runPlan = async () => {
    for (const c of checkPlan(plan, pub, priv, me)) {
      if (c.status !== 'ready') break;
      const ok = await send(stepAction(c.step));
      if (!ok) break;
      setPlan(planRef.current.filter((s) => s.id !== c.step.id));
      if (c.step.kind === 'offer') break; // ждём ответов
      await new Promise((r) => setTimeout(r, 350));
    }
  };

  const highlight = planTargets
    ? { vertices: planTargets.kind === 'vertex' ? planTargets.ids : [], edges: planTargets.kind === 'edge' ? planTargets.ids : [] }
    : targets
      ? {
          vertices: targets.kind === 'vertex' ? targets.ids : [],
          edges: targets.kind === 'edge' ? targets.ids : [],
          hexes: targets.kind === 'hex' ? targets.ids : [],
        }
      : undefined;

  const ghosts = checked
    .filter((c) => c.step.kind === 'road' || c.step.kind === 'settlement' || c.step.kind === 'city')
    .map((c) => {
      const s = c.step as Extract<PlanStep, { at: string }>;
      return {
        ...(s.kind === 'road' ? { edge: s.at } : { vertex: s.at }),
        kind: s.kind,
        color: meP.color,
        broken: c.status === 'broken',
      };
    });

  const status = myTurn ? myPhaseText(pub) : phaseText(pub);
  const deadline = room.deadlines[current];
  const hints = goalHints(pub, priv, me);
  const fact = useRotatingFact(pack, 16000);
  const showFact = !myTurn && pub.phase !== 'finished' && pub.phase !== 'discard' && !planPick && !pub.trade;
  // «Пинок» плана: пока ждёшь — предложить наметь ход (план пуст или весь сломан)
  const [nudgeOff, setNudgeOff] = useState(false);
  const [nudgeDue, setNudgeDue] = useState(false);
  const planIdle = plan.length === 0 || checked.every((c) => c.status === 'broken');
  const nudgeWanted = !myTurn && pub.phase === 'main' && planIdle && !planPick && !pub.trade && sheet === null && !nudgeOff;
  useEffect(() => {
    if (myTurn) setNudgeOff(false); // в каждый свой ход — снова можно напомнить
  }, [myTurn]);
  useEffect(() => {
    if (!nudgeWanted) return setNudgeDue(false);
    const t = setTimeout(() => setNudgeDue(true), 1200);
    return () => clearTimeout(t);
  }, [nudgeWanted]);
  const showNudge = nudgeWanted && nudgeDue;
  const planHead = myTurn && pub.phase === 'main' && checked.length > 0 && checked[0].status !== 'ready' ? checked[0] : null;
  // Мои постройки у захваченного гекса — показать явно и подсказать, как убрать
  const blocked = useMemo(() => {
    const hex = pub.board.hexes.find((h) => h.id === pub.robberHex);
    if (!hex || hex.terrain === 'desert' || hex.number === undefined) return null;
    const topo = topologyFor(pub.board.layout);
    const corners = [...topo.vertices.values()].filter((v) => v.hexes.includes(hex.id)).map((v) => v.id);
    const mine = corners.filter((v) => pub.buildings[v]?.owner === me);
    if (!mine.length) return null;
    const cities = mine.filter((v) => pub.buildings[v]?.kind === 'city').length;
    return { res: TERRAIN_RESOURCE[hex.terrain], number: hex.number, loss: mine.length + cities };
  }, [pub.robberHex, pub.buildings, pub.board, me]);
  const [blockInfo, setBlockInfo] = useState(false);
  const wasBlocked = useRef<string | null>(null);
  useEffect(() => {
    const k = blocked ? pub.robberHex : null;
    if (k && k !== wasBlocked.current) {
      haptic('error');
    }
    wasBlocked.current = k;
  }, [blocked, pub.robberHex]); // eslint-disable-line react-hooks/exhaustive-deps
  const readyCard =
    myTurn && (pub.phase === 'roll' || pub.phase === 'main') && !pub.devCardPlayed
      ? priv.devCards.find((c) => c.playable && c.type !== 'victoryPoint')?.type
      : undefined;
  const planReady = myTurn && pub.phase === 'main' && checked.length > 0 && checked[0].status === 'ready';

  return (
    <main className={`screen game ${myTurn ? 'my-turn' : ''} phase-${pub.phase}`} style={{ ['--me' as string]: PLAYER_HEX[meP.color] }}>
      <div className="stage" data-drawer-no-drag>
        <GameBoard
          pub={pubShown}
          era={pack.id}
          colors={colors}
          mode={mode}
          palette={pack.palette}
          highlight={highlight}
          onVertex={tap}
          onEdge={tap}
          onHex={tap}
          selected={selected}
          fx={fx}
          ghosts={ghosts}
          spotlight={focusSpot}
          me={me}
          pin={planPin}
          hifi={gfxHi}
        />
      </div>

      <header className="hud-top">
        <PlayersBar
          pub={pubShown}
          room={room}
          pack={pack}
          deadline={deadline ? deadline - conn.getState().clockSkew : undefined}
          focused={focusPlayer?.id}
          onFocus={(id) => {
            sfx.play('tick');
            setFocusPlayer((f) => (f?.id === id ? null : { id, key: Date.now() }));
          }}
        />
        <button className="fab glass" onClick={() => setSheet('menu')} aria-label="Меню">
          <Icon name="menu" />
        </button>
      </header>

      {/* Верх экрана — одна колонка: статус, рассказчик, захват, уведомления. Ничего не накладывается. */}
      <div className="hud-stack">
        {focusPlayer ? (
          <FocusCard
            key={focusPlayer.key}
            pub={pub}
            id={focusPlayer.id}
            pack={pack}
            me={me}
            onMore={() => {
              setProfileOf(focusPlayer.id);
              setSheet('pprofile');
            }}
            part={{ idx: focusPlayer.idx ?? 0, total: focusClusters.length, step: stepFocus }}
          />
        ) : (
          <div key={`s${status}`} className={`status-pill glass ${myTurn ? 'mine' : ''} ${deadline && pub.phase !== 'finished' ? 'has-clock' : ''}`} aria-live="polite">
            {status}
            {deadline && pub.phase !== 'finished' && <TurnClock until={deadline - conn.getState().clockSkew} mine={myTurn} />}
          </div>
        )}
        {fx.narration && (
          <div key={`n${fx.narration.key}`} className="narr-line" style={{ ['--pc' as string]: fx.narration.color ?? 'var(--accent)' }}>
            <i />
            {fx.narration.text}
          </div>
        )}
        {connStatus !== 'online' && <div className="reconnect glass">Переподключаемся…</div>}

        {blocked && !focusPlayer && !raidCap && (
          <button className="blocked-chip glass strong" onClick={() => setBlockInfo(true)}>
            <span className="bc-ic">
              <ResIcon r={blocked.res} size={22} />
            </span>
            <span className="bc-text">
              <b>Твой гекс захвачен</b>
              <small>
                {RESOURCE_NAME[blocked.res]} · {blocked.number} — без дохода
              </small>
            </span>
            <span className="bc-q">?</span>
          </button>
        )}

        {askPush && (
          <div className="push-ask glass strong">
            <span className="pa-ic">
              <Icon name="bell" size={18} />
            </span>
            <span className="pa-text">Напомнить о ходе?</span>
            <button
              className="btn primary small-act"
              onClick={async () => {
                setAskPush(false);
                const err = await enablePush(vapid, (sub) => conn.send({ t: 'pushSub', sub }));
                if (err) conn.notify(err);
              }}
            >
              Включить
            </button>
            <button className="btn ghost small-act" onClick={() => setAskPush(false)} aria-label="Не сейчас">
              <Icon name="close" size={16} />
            </button>
          </div>
        )}

        {showOffer && tradeUi === 'caravan' && <TradeCaravan {...offerProps} />}
        {raidCap && (
          <div key={raidCap.key} className="raid-cap" role="status">
            <span className="rc-ic">
              <ArtIcon src={eraIcon(pack.id, 'robber-unit')} size={26} />
            </span>
            <span>
              <b>{raidCap.title}</b>
              <small>{raidCap.text}</small>
            </span>
          </div>
        )}
        {gameToast && (
          <div key={gameToast.key} className="game-toast glass" role="status" onClick={() => setGameToast(null)}>
            {gameToast.text}
          </div>
        )}
      </div>

      {myTurn && <TurnBanner key={`tb${pub.turn}`} color={PLAYER_HEX[meP.color]} />}

      {(planPick || (targets && !selected)) && (
        <div className="board-hint glass">
          {planPick ? (planTargets && planTargets.ids.length === 0 ? `Нет свободных мест для: ${STEP_LABEL[planPick].toLowerCase()}` : planPick === 'settlement' ? 'План: место для дома — дороги добавлю' : `План: выбери место — ${STEP_LABEL[planPick].toLowerCase()}`) : targets!.hint}
          {planPick && (
            <button className="btn ghost small-btn" onClick={() => setPlanPick(null)}>
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      )}

      {targets && selected && !planPick && (
        <div className="confirm glass strong">
          {targets.kind === 'hex' && victims.length > 1 ? (
            <>
              <span className="q">У кого украсть?</span>
              {victims.map((v) => (
                <button key={v} className="btn primary" disabled={busy} onClick={() => void send(targets.action(selected, v))}>
                  {pub.players[v].name}
                </button>
              ))}
            </>
          ) : (
            <>
              <span className="q">
                {targets.confirm}
                {targets.kind === 'hex' && victims.length === 1 && ` Украдёшь у ${pub.players[victims[0]].name}`}
              </span>
              <button className="btn ghost" onClick={() => setSelected(undefined)}>
                Отмена
              </button>
              <button
                className="btn primary"
                disabled={busy}
                onClick={async () => {
                  haptic('success');
                  const ok = await send(targets.action(selected, victims[0]));
                  if (ok) setSelected(undefined);
                }}
              >
                Да
              </button>
            </>
          )}
        </div>
      )}

      {planHead && !build && !planPick && !selected ? (
        <button key="ph" className={`board-hint glass turn-hint plan-hint ${planHead.status}`} onClick={() => setSheet('plan')}>
          <Icon name="plan" size={18} />
          {planHead.status === 'short' ? (
            <>
              План · {STEP_SHORT[planHead.step.kind]}: нужно <ResChips value={planHead.missing ?? {}} />
            </>
          ) : (
            <>План · {STEP_SHORT[planHead.step.kind]}: место занято</>
          )}
          <span className="ph-go">›</span>
        </button>
      ) : readyCard && !build && !planPick && !selected ? (
        <button key="rc" className="board-hint glass turn-hint card-hint" onClick={() => setSheet('dev')}>
          <ArtIcon src={eraIcon(pack.id, `dev-${readyCard}`)} size={26} /> Можно сыграть: {pack.devCards[readyCard].name} ›
        </button>
      ) : myTurn && pub.phase === 'main' && !build && !planPick && !selected && hints[0] && (
        <div key={hints[0]} className="board-hint glass turn-hint">
          <Icon name="bulb" size={18} /> {hints[0]}
        </div>
      )}

      {notice && (
        <div key={notice.key} className="fact-pop notice-card glass strong" role="alert">
          <span className="nc-ic" style={{ ['--pc' as string]: notice.who && pub.players[notice.who] ? PLAYER_HEX[pub.players[notice.who].color] : 'var(--accent)' }}>
            <Icon name="crown" size={20} />
          </span>
          <div className="fp-body">
            <b className="nc-title">{notice.title}</b>
            <p className="nc-text">{notice.text}</p>
            <div className="fp-actions">
              <button className="btn primary small-act" onClick={() => markSeen(notice.key)}>
                Понятно
              </button>
              <button className="btn ghost small-act" onClick={() => { markSeen(notice.key); setSheet('plan'); setLogOpen(true); }}>
                <Icon name="book" size={16} /> Журнал
              </button>
            </div>
          </div>
        </div>
      )}
      {showNudge && !notice && (
        <PlanNudge
          hint={hints[0]}
          onPick={(k) => {
            sfx.play('tick');
            setPlanPick(k);
          }}
          onOpen={() => setSheet('plan')}
          onClose={() => setNudgeOff(true)}
        />
      )}
      <FactPopup pack={pack} allowed={showFact && !sheet && !showNudge && !notice} onRead={(f) => { setOpenFact(f); setSheet('fact'); }} />

      {planReady && !build && !selected && !planPick && (
        <button className="plan-run glass" disabled={busy} onClick={() => void runPlan()}>
          <Icon name="play" size={18} /> Выполнить план · {checked.filter((c) => c.status === 'ready').length} из {checked.length}
        </button>
      )}

      {showOffer && tradeUi === 'card' && <TradeCard {...offerProps} />}

      <section ref={dockRef} className="dock glass strong">
        <Hand hand={priv.resources} />
        <Actions
          pub={pub}
          priv={priv}
          me={me}
          myTurn={myTurn}
          build={build}
          setBuild={(b) => {
            setSelected(undefined);
            setBuild(b);
            sfx.play('tick');
          }}
          busy={busy}
          send={sendVoid}
          openSheet={setSheet}
          countdown={countdown}
          attacking={attacking}
          cancelCountdown={() => setCountdown(null)}
          physical={physical}
          planCount={plan.length}
          planBroken={broken}
        />
      </section>

      {/* ─── шторки ─── */}
      <Sheet open={sheet === 'trade'} onClose={() => setSheet(null)} title="Обмен">
        {myTurn && pub.phase === 'main' ? (
          <TradeSheet pub={pub} priv={priv} me={me} send={sendVoid} busy={busy} />
        ) : (
          <p className="muted">Торговать можно в свой ход после броска. А пока — заготовь обмен в «Плане»</p>
        )}
      </Sheet>

      <Sheet open={sheet === 'incoming' && !!pub.trade && !myTurn} onClose={() => setSheet(null)} title={`${pub.players[current]?.name ?? 'Игрок'} предлагает обмен`}>
        {pub.trade && <IncomingTrade key={pub.trade.id} pub={pub} priv={priv} me={me} send={sendVoid} busy={busy} />}
      </Sheet>

      <Sheet open={sheet === 'dev'} onClose={() => setSheet(null)} title="Карты развития">
        <DevCards
          priv={priv}
          pack={pack}
          canPlay={myTurn && (pub.phase === 'roll' || pub.phase === 'main') && !pub.devCardPlayed}
          played={myTurn && !!pub.devCardPlayed}
          busy={busy}
          onPlay={(t) => {
            if (t === 'yearOfPlenty') return setSheet('plenty');
            if (t === 'monopoly') return setSheet('monopoly');
            setSheet(null);
            setCountdown(null);
            void send(t === 'knight' ? { type: 'playKnight' } : { type: 'playRoadBuilding' });
          }}
        />
      </Sheet>

      <Sheet open={sheet === 'plenty'} onClose={() => setSheet(null)} title={DEV_CARD_NAME.yearOfPlenty} description="Выбери два ресурса из банка">
        <Plenty
          busy={busy}
          onDone={(r) => {
            setSheet(null);
            void send({ type: 'playYearOfPlenty', resources: r });
          }}
        />
      </Sheet>

      <Sheet open={sheet === 'monopoly'} onClose={() => setSheet(null)} title={DEV_CARD_NAME.monopoly} description="Какой ресурс забрать у всех?">
        <ResourcePicker
          onPick={(r) => {
            setSheet(null);
            void send({ type: 'playMonopoly', resource: r });
          }}
        />
      </Sheet>

      <Sheet open={mustDiscard} onClose={() => undefined} dismissible={false} title={`Сбрось ${priv.mustDiscard} ${plural(priv.mustDiscard, 'карту', 'карты', 'карт')}`} description="Выпала 7 — сбрось половину карт">
        <Discard priv={priv} busy={busy} send={sendVoid} />
      </Sheet>

      <Sheet open={sheet === 'dice'} onClose={() => setSheet(null)} title="Что выпало на кубиках?" description="Отметь, что выпало">
        <PhysicalDice
          busy={busy}
          canRoll={myTurn && pub.phase === 'roll'}
          onDone={async (d) => {
            const ok = await send({ type: 'rollDice' }, d);
            if (ok) setSheet(null);
          }}
        />
      </Sheet>

      <Sheet open={sheet === 'plan'} onClose={() => setSheet(null)} title="План хода" description="Ходы заранее — в свой ход одной кнопкой">
        <PlanSheet
          checked={checked}
          plan={plan}
          setPlan={setPlan}
          hints={hints}
          pub={pub}
          priv={priv}
          canRun={myTurn && pub.phase === 'main'}
          busy={busy}
          onRun={() => {
            setSheet(null);
            void runPlan();
          }}
          onPick={(k) => {
            setSheet(null);
            setPlanPick(k);
          }}
          onShow={(at) => {
            setSheet(null);
            setPlanPin({ at, key: Date.now() });
          }}
          onLog={() => setLogOpen(true)}
          me={me}
          logCount={fx.log.length}
        />
        <Sheet open={logOpen && sheet === 'plan'} onClose={() => setLogOpen(false)} title="Журнал партии" description="Что происходило — новое сверху">
          <GameLogList log={fx.log} pub={pub} />
        </Sheet>
      </Sheet>

      <Sheet open={sheet === 'players'} onClose={() => setSheet(null)} title="Игроки" description={`До победы — ${room.settings.vpToWin} очков`}>
        <PlayersSheet
          pub={pub}
          room={room}
          pack={pack}
          onPick={(id) => {
            setProfileOf(id);
            setSheet('pprofile');
          }}
        />
      </Sheet>

      <Sheet open={blockInfo && !!blocked} onClose={() => setBlockInfo(false)} title={`${pack.robber.name} на твоём гексе`}>
        {blocked && (
          <div className="stack">
            <div className="hint-card">
              <ResIcon r={blocked.res} size={28} />
              <span>
                Пока он там, на число <b>{blocked.number}</b> ты не получаешь {RESOURCE_NAME[blocked.res]}
                {blocked.loss > 1 ? ` (теряешь ${blocked.loss} шт. за бросок)` : ''}.
              </span>
            </div>
            <div className="label">Как убрать</div>
            <div className="item">
              <ArtIcon src={eraIcon(pack.id, 'dev-knight')} size={40} />
              <span className="grow">
                <span className="t">Сыграй карту «{pack.devCards.knight.name}»</span>
                <span className="s" style={{ display: 'block' }}>
                  Переставишь его на чужой гекс и заберёшь карту у соседа. {priv.devCards.some((c) => c.type === 'knight') ? 'У тебя она есть!' : 'Купить: овцы, зерно, руда.'}
                </span>
              </span>
            </div>
            <div className="item">
              <Icon name="dice" />
              <span className="grow">
                <span className="t">Выброси 7 в свой ход</span>
                <span className="s" style={{ display: 'block' }}>
                  Тогда переставляешь его ты.
                </span>
              </span>
            </div>
            {priv.devCards.some((c) => c.type === 'knight' && c.playable) && myTurn && !pub.devCardPlayed && (
              <button
                className="btn primary wide"
                onClick={() => {
                  setBlockInfo(false);
                  setSheet('dev');
                }}
              >
                Сыграть «{pack.devCards.knight.name}»
              </button>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={sheet === 'pprofile' && !!profileOf} onClose={() => setSheet(null)} title="Профиль игрока">
        {profileOf && pub.players[profileOf] && (
          <PlayerProfileCard
            pid={profileOf}
            name={pub.players[profileOf].name}
            color={PLAYER_HEX[pub.players[profileOf].color]}
            onShow={() => {
              setSheet(null);
              setFocusPlayer({ id: profileOf, key: Date.now() });
            }}
          />
        )}
      </Sheet>

      <Sheet open={sheet === 'fact'} onClose={() => setSheet(null)} title={pack.title} description={pack.years}>
        <div className="stack">
          <Fact f={openFact ?? fact} big />
          <button className="btn wide" onClick={() => setSheet('lore')}>
            <Icon name="book" /> Все факты и словарь эпохи
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'lore'} onClose={() => setSheet(null)} title={pack.title} description={pack.years}>
        <FactsList pack={pack} />
      </Sheet>

      <Sheet open={sheet === 'react'} onClose={() => setSheet(null)} title="Реакция">
        <ReactionBar
          emojis={REACTIONS}
          onReact={(e) => {
            conn.send({ t: 'react', emoji: e });
            setSheet(null);
          }}
        />
      </Sheet>

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title="Меню">
        <div className="stack">
          <button className="item" onClick={() => setSheet('lore')}>
            <ArtIcon src={eraIcon(pack.id, 'emblem')} size={34} />
            <span className="grow">
              <span className="t">{pack.title}</span>
              <span className="s" style={{ display: 'block' }}>История, словарь эпохи, факты</span>
            </span>
          </button>
          <button className="item" onClick={() => setSheet('players')}>
            <Icon name="crown" />
            <span className="grow t">Игроки и очки</span>
          </button>
          {
            <>
              <div className="label">Вид карты</div>
              <div className="seg">
                {(['2d', '3d'] as const).map((m) => (
                  <button key={m} aria-pressed={shownMode === m} onClick={() => setMode(m)}>
                    {m === '2d' ? '2D — рисованная' : '3D — объёмная'}
                  </button>
                ))}
              </div>
              {liteOn && <p className="faint small">Включён лёгкий режим: 3D может подтормаживать на этом телефоне.</p>}
            </>
          }
          <div className="label">Вид предложения обмена</div>
          <div className="seg">
            {(['card', 'caravan'] as TradeUi[]).map((v) => (
              <button key={v} aria-pressed={tradeUi === v} onClick={() => setTradeUi(v)}>
                {TRADE_UI_LABEL[v]}
              </button>
            ))}
          </div>
          <div className="label">Графика карты</div>
          <div className="seg">
            {(['auto', 'hi', 'normal'] as GfxPref[]).map((v) => (
              <button key={v} aria-pressed={gfxPref === v} onClick={() => setGfxPref(v)}>
                {v === 'auto' ? `Авто${gfxAuto ? ' · детальная' : ''}` : v === 'hi' ? 'Детальная' : 'Обычная'}
              </button>
            ))}
          </div>
          <div className="label">Лёгкий режим (старые телефоны)</div>
          <div className="seg">
            {(['auto', 'on', 'off'] as const).map((v) => (
              <button key={v} aria-pressed={litePref === v} onClick={() => setLitePref(v)}>
                {v === 'auto' ? `Авто${liteAuto ? ' · вкл' : ''}` : v === 'on' ? 'Вкл' : 'Выкл'}
              </button>
            ))}
          </div>
          <button
            className="item"
            onClick={async () => {
              if (pushOn) {
                conn.send({ t: 'pushOff' });
                return;
              }
              const err = await enablePush(vapid, (sub) => conn.send({ t: 'pushSub', sub }));
              if (err) conn.notify(err);
            }}
          >
            <Icon name="bell" />
            <span className="grow">
              <span className="t">Уведомлять о моём ходе</span>
              <span className="s" style={{ display: 'block' }}>
                {pushSupport() === 'install' ? 'На iPhone — после установки на экран «Домой»' : 'Когда игра свёрнута или телефон спит'}
              </span>
            </span>
            <span className={`switch ${pushOn ? 'on' : ''}`} aria-hidden />
          </button>
          <button className="item" onClick={() => setMusic(!music)}>
            <Icon name="music" />
            <span className="grow t">Музыка эпохи</span>
            <span className={`switch ${music ? 'on' : ''}`} aria-hidden />
          </button>
          <button className="item" onClick={() => setMuted(!muted)}>
            <Icon name={muted ? 'mute' : 'sound'} />
            <span className="grow t">{muted ? 'Звук выключен' : 'Звук включён'}</span>
          </button>
          {!physical && !room.settings.autoRoll && (
            <button
              className="item"
              onClick={() => {
                const v = !autoRoll;
                setAutoRoll(v);
                try {
                  localStorage.setItem(AUTO_ROLL_KEY, v ? '1' : '0');
                } catch {
                  /* ok */
                }
              }}
            >
              <Icon name="dice" />
              <span className="grow t">Авто-бросок в свой ход</span>
              <span className="faint">{autoRoll ? 'вкл' : 'выкл'}</span>
            </button>
          )}
          <Costs />
          {pub.phase !== 'finished' ? (
            <button className="btn danger wide" onClick={() => setSheet('leave')}>
              <Icon name="door" /> Выйти — за меня доиграет бот
            </button>
          ) : (
            <button className="btn wide" onClick={() => conn.forget()}>
              На главную
            </button>
          )}
          {room.isHost && <HostTools room={room} pub={pub} />}
        </div>
      </Sheet>

      <Sheet open={sheet === 'leave'} onClose={() => setSheet(null)} title="Кто доиграет за тебя?" description="Вернёшься — место снова твоё">
        <div className="stack">
          {BOT_LEVELS.map((l) => (
            <button
              key={l}
              className="btn wide"
              disabled={busy}
              onClick={async () => {
                const ok = await send({ type: 'handToBot', level: l });
                if (ok) setSheet(null);
              }}
            >
              <Icon name="bot" /> {l === 'easy' ? 'Лёгкий — играет наугад' : l === 'medium' ? 'Средний — с умом' : 'Сложный — на победу'}
            </button>
          ))}
        </div>
      </Sheet>

      <DiceOverlay roll={fx.roll} />
      <NewCard cards={priv.devCards} pack={pack} />
      <Threat t={threatInfo(fx, pub, pack, me)} />
      <Raid event={fx.raid} skipBomber={shownMode === '3d'} />
      <Cinematic event={fx.cinematic} />
      <GainToast gains={fx.gains.list} keyId={fx.gains.key} />
      <ReactionsLayer items={fx.reactions} />
      {pub.phase === 'finished' && <Finished pub={pub} me={me} pack={pack} />}
    </main>
  );
}

// ───────────────────────── части ─────────────────────────

/** Игроки сверху: аватары с цветом, очками и таймером у того, кто ходит. Тап — подробности. */
/** Игроки сверху: ячейка на игрока — аватар, имя, очки и карты. Тап — показать его постройки на карте. */
export function PlayersBar({
  pub,
  room,
  deadline,
  onFocus,
  focused,
  pack,
}: {
  pub: PublicState;
  room: RoomView;
  deadline?: number;
  onFocus?: (id: PlayerId) => void;
  focused?: PlayerId;
  /** Для подписей наград (названия эпохи). */
  pack?: LorePack;
}) {
  const current = pub.order[pub.current];
  const compact = pub.order.length > 4;
  return (
    <div className={`pbar glass ${compact ? 'compact' : ''}`} role="list" aria-label="Игроки">
      {pub.order.map((id) => {
        const p = pub.players[id];
        const turn = id === current && pub.phase !== 'finished';
        const bot = p.bot || p.away || p.kicked;
        return (
          <button
            key={id}
            role="listitem"
            className={`pcell ${turn ? 'turn' : ''} ${turn && deadline ? 'timed' : ''} ${focused === id ? 'focused' : ''} ${!room.online[id] && !p.bot ? 'off' : ''}`}
            style={{ ['--pc' as string]: PLAYER_HEX[p.color] }}
            onClick={() => onFocus?.(id)}
            aria-label={`${p.name}: ${p.points} очков${awardsOf(pub, id).map((a) => `, ${a === 'road' ? pack?.bonuses.longestRoad ?? 'самая длинная дорога' : pack?.bonuses.largestArmy ?? 'самая большая армия'}`).join('')}. Показать постройки`}
          >
            <span className="pc-ava">
              {turn && deadline && <TimerRing until={deadline} />}
              <span className="pc-face">{p.name.charAt(0).toUpperCase()}</span>
              {bot && !compact && (
                <span className="pc-bot" aria-label="бот">
                  <Icon name="bot" size={9} />
                </span>
              )}
              {!compact && awardsOf(pub, id).length > 0 && (
                <span className="pc-awb">
                  {awardsOf(pub, id).map((a) => (
                    <span key={a} className={`pc-aw ${a}`} title={a === 'road' ? pack?.bonuses.longestRoad : pack?.bonuses.largestArmy}>
                      <Icon name={a === 'road' ? 'road' : 'army'} size={9} />
                    </span>
                  ))}
                </span>
              )}
            </span>
            {!compact && (
              <span className="pc-info">
                <span className="pc-nrow">
                  <span className="pc-name">{id === room.me ? 'Ты' : p.name}</span>
                </span>
                <span className="pc-stats">
                  <Icon name="star" size={11} />
                  <b>{p.points}</b>
                  <Icon name="hand" size={11} className="pc-hand" />
                  {p.resourceCount}
                </span>
              </span>
            )}
            {compact && (
              <span className="pc-mini">
                <Icon name="star" size={10} />
                <b>{p.points}</b>
                {awardsOf(pub, id).map((a) => (
                  <span key={a} className={`pc-aw ${a}`}>
                    <Icon name={a === 'road' ? 'road' : 'army'} size={8} />
                  </span>
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Факт эпохи: всплывает снизу, пока ждёшь чужой ход. Не меняется от хода к ходу:
 * один и тот же факт висит, пока его не дочитали (время — по длине текста) или не закрыли;
 * в свой ход прячется на паузу и потом возвращается тот же. Следующий — через ~75 с.
 */
function FactPopup({ pack, allowed, onRead }: { pack: LorePack; allowed: boolean; onRead: (f: LoreFact) => void }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * pack.facts.length));
  const [shown, setShown] = useState(false);
  const st = useRef({ seen: 0, nextAt: Date.now() + 30000, hold: false });
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;
  const iRef = useRef(i);
  iRef.current = i;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const next = () => {
    setShown(false);
    setI((x) => (x + 1 + Math.floor(Math.random() * 3)) % Math.max(1, pack.facts.length));
    st.current.nextAt = Date.now() + 75000;
  };
  useEffect(() => {
    const id = setInterval(() => {
      if (!allowedRef.current || document.hidden) return; // пауза: свой ход / вкладка скрыта
      const s = st.current;
      if (shownRef.current) {
        const text = pack.facts[iRef.current % pack.facts.length]?.text ?? '';
        if (!s.hold) s.seen += 1000;
        if (s.seen >= Math.max(20000, text.length * 75)) next();
      } else if (Date.now() >= s.nextAt) {
        s.seen = 0;
        setShown(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [pack]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = pack.facts[i % pack.facts.length];
  if (!shown || !allowed || !f) return null;
  const hold = (v: boolean) => () => (st.current.hold = v);
  return (
    <div key={i} className="fact-pop glass strong" role="status" onPointerDown={hold(true)} onPointerUp={hold(false)} onPointerLeave={hold(false)}>
      <ArtIcon src={eraIcon(pack.id, 'emblem')} size={40} className="fp-ic" />
      <div className="fp-body">
        <div className="fp-head">
          {f.year && <span className="fp-year">{f.year}</span>}
          {f.kz && <span className="kz-tag">Казахстан</span>}
          <span className="fp-label">Факт эпохи</span>
        </div>
        <p className="fp-text">{f.text}</p>
        <div className="fp-actions">
          <button className="btn small-act" onClick={() => { onRead(f); next(); }}>
            <Icon name="book" size={16} /> Читать
          </button>
          <button className="btn ghost small-act" onClick={next} aria-label="Скрыть">
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Карточка игрока под полосой, пока его постройки подсвечены. */
function FocusCard({
  pub,
  id,
  pack,
  me,
  onMore,
  part,
}: {
  pub: PublicState;
  id: PlayerId;
  pack: LorePack;
  me: PlayerId;
  onMore: () => void;
  part?: { idx: number; total: number; step: (d: number) => void };
}) {
  const p = pub.players[id];
  const b = Object.values(pub.buildings).filter((x) => x.owner === id);
  const towns = b.filter((x) => x.kind === 'settlement').length;
  const cities = b.filter((x) => x.kind === 'city').length;
  return (
    <div className="focus-card glass strong" style={{ ['--pc' as string]: PLAYER_HEX[p.color] }}>
      {part && part.total > 1 && (
        <button className="fc-nav" onClick={() => part.step(-1)} aria-label="Предыдущий район">
          ‹
        </button>
      )}
      <button className="fc-open" onClick={onMore}>
      <span className="fc-ava">{p.name.charAt(0).toUpperCase()}</span>
      <span className="fc-main">
        <b>
          {id === me ? 'Ты' : p.name} · <Icon name="star" size={13} /> {p.points}
        </b>
        <small>
          <span><Icon name="house" size={12} /> {towns}</span>
          <span><Icon name="castle" size={12} /> {cities}</span>
          <span><Icon name="road" size={12} /> {p.roadLength}</span>
          <span><Icon name="hand" size={12} /> {p.resourceCount}</span>
          <span><Icon name="cards" size={12} /> {p.devCardCount}</span>
          {pub.longestRoad === id && <span className="bonus">{pack.bonuses.longestRoad}</span>}
          {pub.largestArmy === id && <span className="bonus">{pack.bonuses.largestArmy}</span>}
        </small>
      </span>
      </button>
      {part && part.total > 1 && (
        <>
          <span className="fc-count">
            {part.idx + 1}/{part.total}
          </span>
          <button className="fc-nav" onClick={() => part.step(1)} aria-label="Следующий район">
            ›
          </button>
        </>
      )}
      <IncomeStrip pub={pub} pid={id} />
    </div>
  );
}

/** Доход по числам: [число · ресурсы], от частых к редким; захваченное — зачёркнуто; ≈ карт за бросок. */
export function IncomeStrip({ pub, pid, label }: { pub: PublicState; pid: PlayerId; label?: string }) {
  const { rows, perRoll } = incomeByNumber(pub, pid);
  if (rows.length === 0) return null;
  return (
    <div className="income">
      {label && <span className="in-label">{label}</span>}
      <div className="in-row">
        {rows.map((r) => (
          <span key={r.n} className={`in-chip ${Object.keys(r.res).length === 0 ? 'off' : ''}`} title={`${r.n}: шанс ${r.ways} из 36`}>
            <span className={`in-n ${r.n === 6 || r.n === 8 ? 'hot' : ''}`}>
              {r.n}
              <i style={{ width: `${r.ways * 2}px` }} />
            </span>
            {(Object.entries(r.res) as [Resource, number][]).map(([res, c]) => (
              <span key={res} className="in-r">
                <ResIcon r={res} size={16} />
                {c > 1 && <small>×{c}</small>}
              </span>
            ))}
            {(Object.entries(r.blocked) as [Resource, number][]).map(([res, c]) => (
              <span key={`b${res}`} className="in-r blocked" aria-label="захвачено">
                <ResIcon r={res} size={16} />
                {c > 1 && <small>×{c}</small>}
              </span>
            ))}
          </span>
        ))}
      </div>
      <span className="in-avg">≈{perRoll.toFixed(1)} карт за бросок</span>
    </div>
  );
}

/** Пока ждёшь чужой ход — карточка снизу: наметь ход заранее, одной кнопкой. */
function PlanNudge({ hint, onPick, onOpen, onClose }: { hint?: string; onPick: (k: Exclude<PlanPick, null>) => void; onOpen: () => void; onClose: () => void }) {
  return (
    <div className="fact-pop plan-nudge glass strong" role="status">
      <span className="pn-ic">
        <Icon name="plan" size={20} />
      </span>
      <div className="fp-body">
        <div className="pn-head">
          <b>Пока ждёшь — наметь ход</b>
          <button className="btn ghost icon-only pn-x" onClick={onClose} aria-label="Не сейчас">
            <Icon name="close" size={16} />
          </button>
        </div>
        <p className="pn-sub">{hint ?? 'В свой ход выполнишь одной кнопкой'}</p>
        <div className="pn-acts">
          <button className="btn small-act" onClick={() => onPick('road')}>
            <Icon name="road" size={16} /> Дорога
          </button>
          <button className="btn small-act" onClick={() => onPick('settlement')}>
            <Icon name="house" size={16} /> Дом
          </button>
          <button className="btn small-act" onClick={() => onPick('city')}>
            <Icon name="castle" size={16} /> Город
          </button>
          <button className="btn ghost small-act icon-only" onClick={onOpen} aria-label="Весь план">
            <Icon name="next" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Сколько осталось на ход: «2:41». Последние 30 с — красным, в свой ход последние 10 с тикают. */
function TurnClock({ until, mine }: { until: number; mine: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  const prev = useRef(left);
  useEffect(() => {
    if (mine && left > 0 && left <= 10 && left !== prev.current) sfx.play('tick');
    prev.current = left;
  }, [left, mine]);
  const m = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return (
    <span className={`tclock ${left <= 30 ? 'low' : ''}`} aria-label={`Осталось ${m} мин ${left % 60} с`}>
      <Icon name="timer" size={15} />
      {m}:{ss}
    </span>
  );
}

function TimerRing({ until }: { until: number }) {
  const [now, setNow] = useState(Date.now());
  const [total] = useState(() => Math.max(1, until - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const k = Math.max(0, Math.min(1, (until - now) / total));
  const C = 2 * Math.PI * 21;
  return (
    <svg className="pav-timer" viewBox="0 0 46 46" aria-hidden>
      <circle className="trk" cx="23" cy="23" r="21" />
      <circle cx="23" cy="23" r="21" strokeDasharray={`${C * k} ${C}`} />
    </svg>
  );
}

/** Подробно об игроках — шторка по тапу на аватары. */
function PlayersSheet({ pub, room, pack, onPick }: { pub: PublicState; room: RoomView; pack: LorePack; onPick?: (id: PlayerId) => void }) {
  const current = pub.order[pub.current];
  return (
    <div className="list">
      {pub.order.map((id) => {
        const p = pub.players[id];
        return (
          <button key={id} className={`item pl-row ${id === current ? 'turn' : ''}`} style={{ ['--pc' as string]: PLAYER_HEX[p.color] }} onClick={() => onPick?.(id)}>
            <span className="pl-face">{p.bot || p.away || p.kicked ? <Icon name="bot" size={20} /> : p.name.charAt(0).toUpperCase()}</span>
            <div className="grow">
              <div className="t">
                {p.name}
                {id === room.me && <span className="faint"> · ты</span>}
                {!room.online[id] && !p.bot && <span className="faint"> · не в сети</span>}
              </div>
              <div className="pl-stats">
                <span title="Карт на руке"><Icon name="hand" size={14} /> {p.resourceCount} карт</span>
                <span title="Карт развития"><Icon name="cards" size={14} /> {p.devCardCount} разв.</span>
                <span title="Самая длинная дорога"><Icon name="road" size={14} /> {p.roadLength} дор.</span>
                <span title="Сыграно рыцарей"><ArtIcon src={eraIcon(pack.id, 'dev-knight')} size={16} /> {p.knightsPlayed}</span>
              </div>
              {(pub.longestRoad === id || pub.largestArmy === id) && (
                <div className="pl-bonus">
                  {pub.longestRoad === id && <span className="bonus">{pack.bonuses.longestRoad} +2</span>}
                  {pub.largestArmy === id && <span className="bonus">{pack.bonuses.largestArmy} +2</span>}
                </div>
              )}
            </div>
            <b className="pl-vp">
              <Icon name="star" size={16} /> {p.points}
            </b>
          </button>
        );
      })}
    </div>
  );
}

/** Купил карту развития — показываем её крупно (переворот), чтобы не забыть, что она есть. */
function NewCard({ cards, pack }: { cards: PrivateView['devCards']; pack: LorePack }) {
  const prev = useRef(cards.length);
  const [shown, setShown] = useState<{ type: DevCardType; key: number } | null>(null);
  useEffect(() => {
    if (cards.length > prev.current) {
      const c = cards[cards.length - 1];
      setShown({ type: c.type, key: Date.now() });
      sfx.play('chime');
      haptic('success');
      const t = setTimeout(() => setShown(null), 2200);
      prev.current = cards.length;
      return () => clearTimeout(t);
    }
    prev.current = cards.length;
  }, [cards]);
  if (!shown) return null;
  const info = pack.devCards[shown.type];
  return (
    <div key={shown.key} className="new-card" aria-live="polite">
      <div className="nc-card">
        <ArtIcon src={eraIcon(pack.id, `dev-${shown.type}`)} size={120} />
        <small>Новая карта</small>
        <b>{info.name}</b>
        <span>{DEV_RULE[shown.type]}</span>
      </div>
    </div>
  );
}

/** «Твой ход»: короткая вспышка цвета игрока по краям экрана и плашка. */
function TurnBanner({ color }: { color: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 1700);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  return (
    <div className="turn-banner" style={{ ['--me' as string]: color }} aria-hidden>
      <div className="tb-edge" />
      <div className="tb-plate display">Твой ход</div>
    </div>
  );
}

/** Чужое предложение обмена: компактная плашка над доком. Тап — подробности и встречное. */
function IncomingBanner({ pub, priv, me, busy, send, open }: { pub: PublicState; priv: PrivateView; me: PlayerId; busy: boolean; send: (a: Action) => Promise<void>; open: () => void }) {
  const t = pub.trade!;
  const from = pub.players[pub.order[pub.current]];
  const mine = t.responses?.[me];
  const can = hasResources(priv.resources, t.want);
  return (
    <div key={t.id} className="incoming-bar glass strong" style={{ ['--pc' as string]: PLAYER_HEX[from.color] }}>
      <button className="ib-body" onClick={open}>
        <span className="ib-ava">{from.name.charAt(0).toUpperCase()}</span>
        <span className="ib-terms">
          <small>{from.name} предлагает</small>
          <span className="counter-line">
            <ResChips value={t.want} /> → <ResChips value={t.give} />
          </span>
        </span>
      </button>
      {mine ? (
        <span className="ib-answer faint">{mine.kind === 'accept' ? 'Ты согласен' : mine.kind === 'decline' ? 'Отказ' : 'Встречное'}</span>
      ) : (
        <>
          <button className="btn small-act" disabled={busy} onClick={() => void send({ type: 'respondTrade', tradeId: t.id, kind: 'decline' })}>
            Нет
          </button>
          <button className="btn primary small-act" disabled={busy || !can} onClick={() => void send({ type: 'respondTrade', tradeId: t.id, kind: 'accept' })}>
            Да
          </button>
        </>
      )}
    </div>
  );
}

function Hand({ hand }: { hand: ResourceMap }) {
  const prev = useRef(hand);
  const [bump, setBump] = useState<Partial<Record<Resource, number>>>({});
  useEffect(() => {
    const b: Partial<Record<Resource, number>> = {};
    for (const r of RESOURCES) if (hand[r] > prev.current[r]) b[r] = Date.now();
    prev.current = hand;
    if (Object.keys(b).length) setBump(b);
  }, [hand]);
  return (
    <div className="hand">
      {RESOURCES.map((r) => (
        <div key={`${r}-${bump[r] ?? 0}`} className={`rcard ${hand[r] ? '' : 'zero'} ${bump[r] ? 'bump' : ''}`} style={{ ['--rc' as string]: RES_COLOR[r] }}>
          <ResIcon r={r} className="e" size={30} />
          <span className="n">{hand[r]}</span>
          <span className="lbl">{RESOURCE_NAME[r]}</span>
        </div>
      ))}
    </div>
  );
}

/** Цена постройки иконками. */
function Cost({ cost }: { cost: ResourceMap }) {
  return (
    <span className="cost">
      {RESOURCES.filter((r) => cost[r] > 0).map((r) => (
        <span key={r} className="cost-i">
          <ResIcon r={r} size={15} />
          {cost[r] > 1 && <small>×{cost[r]}</small>}
        </span>
      ))}
    </span>
  );
}

function Actions(props: {
  pub: PublicState;
  priv: PrivateView;
  me: PlayerId;
  myTurn: boolean;
  build: BuildMode | null;
  setBuild: (b: BuildMode | null) => void;
  busy: boolean;
  send: (a: Action) => Promise<void>;
  openSheet: (s: SheetId) => void;
  countdown: number | null;
  attacking: boolean;
  cancelCountdown: () => void;
  physical: boolean;
  planCount: number;
  planBroken: number;
}) {
  const { pub, priv, me, myTurn, build, setBuild, busy, send, openSheet, countdown, attacking, cancelCountdown, physical } = props;
  const meP = pub.players[me];
  const playable = priv.devCards.filter((c) => c.playable && c.type !== 'victoryPoint').length;
  const canPlayNow = myTurn && (pub.phase === 'roll' || pub.phase === 'main') && !pub.devCardPlayed && playable > 0;
  const cardsBtn = (
    <button className={`btn ${canPlayNow ? 'glow' : ''}`} onClick={() => openSheet('dev')}>
      <Icon name="cards" /> Карты
      {priv.devCards.length > 0 && <span className={`cnt ${canPlayNow ? 'hot' : ''}`}>{priv.devCards.length}</span>}
    </button>
  );
  if (!myTurn || pub.phase === 'discard') {
    return (
      <div className="actions tools">
        <button className="tool" onClick={() => openSheet('plan')}>
          <Icon name="plan" />
          <small>План</small>
          {props.planCount > 0 && <span className={`cnt dot ${props.planBroken ? 'bad' : ''}`}>{props.planBroken || props.planCount}</span>}
        </button>
        <button className="tool" onClick={() => openSheet(pub.trade ? 'incoming' : 'trade')}>
          <Icon name="trade" />
          <small>Обмен</small>
          {pub.trade && <span className="cnt dot hot">1</span>}
        </button>
        <button className="tool" onClick={() => openSheet('dev')}>
          <Icon name="cards" />
          <small>Карты</small>
          {priv.devCards.length > 0 && <span className="cnt dot">{priv.devCards.length}</span>}
        </button>
        <button className="tool" onClick={() => openSheet('react')}>
          <Icon name="smile" />
          <small>Реакция</small>
        </button>
      </div>
    );
  }

  switch (pub.phase) {
    case 'setup':
    case 'moveRobber':
    case 'roadBuilding':
      return <p className="dock-note">Нажми на светящееся место на карте</p>;
    case 'roll':
      return (
        <div className="actions">
          {countdown !== null ? (
            <button className="btn primary big grow2" onClick={cancelCountdown}>
              <Icon name="dice" /> Бросаю через {countdown}… <small>стоп</small>
            </button>
          ) : (
            <button className="btn primary big grow2" disabled={busy || attacking} onClick={() => (physical ? openSheet('dice') : void send({ type: 'rollDice' }))}>
              <Icon name={attacking ? 'army' : 'dice'} /> {attacking ? 'Идёт атака…' : physical ? 'Ввести бросок' : 'Бросить кубики'}
            </button>
          )}
          {playable > 0 && cardsBtn}
        </div>
      );
    case 'main': {
      const can = (cost: ResourceMap) => hasResources(priv.resources, cost);
      const road = meP.pieces.roads > 0 && can(COSTS.road) && legalRoadEdges(pub, me).length > 0;
      const settl = meP.pieces.settlements > 0 && can(COSTS.settlement) && legalSettlementVertices(pub, me).length > 0;
      const city = meP.pieces.cities > 0 && can(COSTS.city) && legalCityVertices(pub, me).length > 0;
      const dev = pub.devDeckCount > 0 && can(COSTS.devCard);
      const t = (b: BuildMode) => setBuild(build === b ? null : b);
      return (
        <>
          <div className="actions builds">
            <button className={`act ${build === 'road' ? 'on' : ''}`} disabled={!road && build !== 'road'} onClick={() => t('road')} aria-label="Дорога" title="Дорога">
              <Icon name="road" className="i" size={24} />
              <Cost cost={COSTS.road} />
            </button>
            <button className={`act ${build === 'settlement' ? 'on' : ''}`} disabled={!settl && build !== 'settlement'} onClick={() => t('settlement')} aria-label="Поселение" title="Поселение">
              <Icon name="house" className="i" size={24} />
              <Cost cost={COSTS.settlement} />
            </button>
            <button className={`act ${build === 'city' ? 'on' : ''}`} disabled={!city && build !== 'city'} onClick={() => t('city')} aria-label="Город" title="Город">
              <Icon name="castle" className="i" size={24} />
              <Cost cost={COSTS.city} />
            </button>
            <button className="act" disabled={!dev || busy} onClick={() => void send({ type: 'buyDevCard' })} aria-label="Купить карту развития" title="Карта развития">
              <Icon name="cards" className="i" size={24} />
              <Cost cost={COSTS.devCard} />
            </button>
          </div>
          <div className="actions">
            <button className="btn icon-only" onClick={() => openSheet('plan')} aria-label="План">
              <Icon name="plan" />
              {props.planCount > 0 && <span className={`cnt dot ${props.planBroken ? 'bad' : ''}`}>{props.planBroken || props.planCount}</span>}
            </button>
            <button className={`btn icon-only ${canPlayNow ? 'glow' : ''}`} onClick={() => openSheet('dev')} aria-label="Карты развития">
              <Icon name="cards" />
              {priv.devCards.length > 0 && <span className={`cnt dot ${canPlayNow ? 'hot' : ''}`}>{priv.devCards.length}</span>}
            </button>
            <button className="btn" onClick={() => openSheet('trade')}>
              <Icon name="trade" /> Обмен{pub.trade ? ' ·' : ''}
            </button>
            <button className="btn primary" disabled={busy} onClick={() => void send({ type: 'endTurn' })}>
              Конец хода <Icon name="next" />
            </button>
          </div>
        </>
      );
    }
    default:
      return null;
  }
}

const pieceNames: { road: string; settlement: string; city: string } = { road: 'дорога', settlement: 'поселение', city: 'город' };
const shortName = (k: keyof typeof pieceNames) => pieceNames[k];
const plural = (n: number, one: string, few: string, many: string) => {
  const a = n % 10;
  const b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Названия построек эпохи — только для рассказчика; в кнопках всегда короткие «Дорога/Поселение/Город». */
export function setPieceNames(_p: { road: string; settlement: string; city: string }) {
  /* намеренно пусто */
}

function computeTargets(pub: PublicState, me: PlayerId, myTurn: boolean, mode: BuildMode | null): Targets | null {
  if (!myTurn) return null;
  switch (pub.phase) {
    case 'setup':
      if (pub.setup?.step === 'road') {
        return {
          kind: 'edge',
          ids: legalRoadEdges(pub, me, pub.setup.lastVertex),
          hint: 'Поставь дорогу к своему поселению',
          confirm: 'Поставить сюда?',
          action: (edge) => ({ type: 'buildRoad', edge }),
        };
      }
      return {
        kind: 'vertex',
        ids: legalSettlementVertices(pub, me, true),
        hint: pub.setup?.round === 2 ? 'Второе поселение — за него дадут ресурсы' : 'Поставь первое поселение',
        confirm: 'Поставить поселение сюда?',
        action: (vertex) => ({ type: 'buildSettlement', vertex }),
      };
    case 'roadBuilding':
      return {
        kind: 'edge',
        ids: legalRoadEdges(pub, me),
        hint: `Бесплатная дорога (осталось ${pub.roadBuildingLeft ?? 1})`,
        confirm: 'Поставить сюда?',
        action: (edge) => ({ type: 'buildRoad', edge }),
      };
    case 'moveRobber':
      return {
        kind: 'hex',
        ids: pub.board.hexes.filter((h) => h.id !== pub.robberHex).map((h) => h.id),
        hint: `Куда отправить: ${ROBBER.name}?`,
        confirm: 'Сюда?',
        action: (hex, victim) => ({ type: 'moveRobber', hex, ...(victim ? { victim } : {}) }),
      };
    case 'main':
      if (mode === 'road')
        return { kind: 'edge', ids: legalRoadEdges(pub, me), hint: 'Где строим дорогу?', confirm: 'Построить дорогу?', action: (edge) => ({ type: 'buildRoad', edge }) };
      if (mode === 'settlement')
        return {
          kind: 'vertex',
          ids: legalSettlementVertices(pub, me),
          hint: 'Где строим поселение?',
          confirm: 'Построить поселение?',
          action: (vertex) => ({ type: 'buildSettlement', vertex }),
        };
      if (mode === 'city')
        return {
          kind: 'vertex',
          ids: legalCityVertices(pub, me),
          hint: 'Какое поселение станет городом?',
          confirm: 'Построить город?',
          action: (vertex) => ({ type: 'buildCity', vertex }),
        };
      return null;
    default:
      return null;
  }
}

const DEV_RULE: Record<DevCardType, string> = {
  knight: 'Переставь разбойника и забери карту у соседа. Три сыгранные — бонус +2 очка.',
  roadBuilding: 'Две дороги бесплатно.',
  yearOfPlenty: 'Возьми из банка любые два ресурса.',
  monopoly: 'Назови ресурс — все отдают тебе его целиком.',
  victoryPoint: 'Тайное +1 очко. Играть не нужно — считается само.',
};
const DEV_ORDER: DevCardType[] = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly', 'victoryPoint'];

function DevCards({
  priv,
  pack,
  canPlay,
  played,
  busy,
  onPlay,
}: {
  priv: PrivateView;
  pack: LorePack;
  canPlay: boolean;
  played: boolean;
  busy: boolean;
  onPlay: (t: DevCardType) => void;
}) {
  if (!priv.devCards.length)
    return (
      <div className="stack center">
        <p className="muted">Карт пока нет.</p>
        <p className="faint small row" style={{ justifyContent: 'center' }}>
          Купить в свой ход: <Cost cost={COSTS.devCard} />
        </p>
      </div>
    );
  const groups = DEV_ORDER.map((t) => {
    const cards = priv.devCards.filter((c) => c.type === t);
    return { t, n: cards.length, ready: cards.some((c) => c.playable) };
  }).filter((g) => g.n > 0);
  return (
    <div className="list">
      {played && <p className="faint small center">В этот ход карта уже сыграна — следующая в следующий ход.</p>}
      {groups.map(({ t, n, ready }) => {
        const info = pack.devCards[t];
        const usable = t !== 'victoryPoint' && ready && canPlay;
        return (
          <div key={t} className={`devcard ${usable ? 'ready' : ''}`}>
            <ArtIcon src={eraIcon(pack.id, `dev-${t}`)} size={64} className="dev-ic" fallback={<Icon name="cards" size={32} />} />
            <div className="dc-body">
              <div className="dc-title">
                <b>{info.name}</b>
                {n > 1 && <span className="dc-n">×{n}</span>}
              </div>
              <div className="dc-rule">{DEV_RULE[t]}</div>
              <div className="dc-flavor">{info.flavor}</div>
              {t !== 'victoryPoint' && (
                <button className="btn primary dc-btn" disabled={!usable || busy} onClick={() => onPlay(t)}>
                  {ready ? (canPlay ? 'Сыграть' : 'Сыграть можно в свой ход') : 'Куплена в этот ход — со следующего'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Plenty({ busy, onDone }: { busy: boolean; onDone: (r: [Resource, Resource]) => void }) {
  const [picked, setPicked] = useState<Resource[]>([]);
  return (
    <div className="stack">
      <ResourcePicker
        onPick={(r) => {
          const next = [...picked, r].slice(-2);
          setPicked(next);
          sfx.play('tick');
        }}
      />
      <div className="picked-row">{picked.length ? picked.map((r, i) => <ResIcon key={i} r={r} size={48} />) : <span className="faint">выбери два</span>}</div>
      <button className="btn primary wide" disabled={picked.length !== 2 || busy} onClick={() => onDone(picked as [Resource, Resource])}>
        Взять
      </button>
    </div>
  );
}

function Discard({ priv, busy, send }: { priv: PrivateView; busy: boolean; send: (a: Action) => Promise<void> }) {
  const [sel, setSel] = useState<ResourceMap>(emptyResources());
  const n = sum(sel);
  return (
    <div className="stack">
      <ResourceStepper value={sel} onChange={setSel} max={priv.resources} />
      <button className="btn primary wide" disabled={n !== priv.mustDiscard || busy} onClick={() => void send({ type: 'discard', resources: sel })}>
        Сбросить {n}/{priv.mustDiscard}
      </button>
    </div>
  );
}

function PhysicalDice({ busy, canRoll, onDone }: { busy: boolean; canRoll: boolean; onDone: (d: [number, number]) => void }) {
  const [a, setA] = useState<number>();
  const [b, setB] = useState<number>();
  const pick = (which: 'a' | 'b', v: number) => {
    sfx.play('diceLand');
    haptic('tap');
    if (which === 'a') setA(v);
    else setB(v);
  };
  const row = (which: 'a' | 'b', val?: number) => (
    <div className="die-row">
      {[1, 2, 3, 4, 5, 6].map((v) => (
        <button key={v} className={`die-btn ${val === v ? 'on' : ''}`} onClick={() => pick(which, v)} aria-label={`${v}`}>
          <Pips n={v} />
        </button>
      ))}
    </div>
  );
  return (
    <div className="stack">
      <div className="label">Первый кубик</div>
      {row('a', a)}
      <div className="label">Второй кубик</div>
      {row('b', b)}
      <div className={`dice-total display ${a && b && a + b === 7 ? 'seven' : ''}`}>{a && b ? a + b : '—'}</div>
      <button className="btn primary big wide" disabled={!a || !b || busy || !canRoll} onClick={() => onDone([a!, b!])}>
        Готово
      </button>
    </div>
  );
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function Pips({ n }: { n: number }) {
  return (
    <span className="pips">
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={PIPS[n].includes(i) ? 'on' : ''} />
      ))}
    </span>
  );
}

function PlanSheet({
  checked,
  plan,
  setPlan,
  hints,
  pub,
  priv,
  canRun,
  busy,
  onRun,
  onPick,
  onShow,
  onLog,
  logCount,
  me,
}: {
  checked: ReturnType<typeof checkPlan>;
  plan: PlanStep[];
  setPlan: (p: PlanStep[]) => void;
  hints: string[];
  pub: PublicState;
  priv: PrivateView;
  canRun: boolean;
  busy: boolean;
  onRun: () => void;
  onPick: (k: PlanPick) => void;
  /** Показать место шага на карте. */
  onShow?: (at: string) => void;
  onLog?: () => void;
  logCount?: number;
  me?: PlayerId;
}) {
  const [adding, setAdding] = useState<null | 'bank' | 'offer'>(null);
  const [give, setGive] = useState<Resource | null>(null);
  const [offerGive, setOfferGive] = useState<ResourceMap>(emptyResources());
  const [offerWant, setOfferWant] = useState<ResourceMap>(emptyResources());

  if (adding === 'bank') {
    return (
      <div className="stack">
        <HandMini hand={priv.resources} />
        <div className="label">Отдаю банку</div>
        <ResourcePicker selected={give} sub={(r) => `${priv.tradeRatios[r]}:1`} onPick={setGive} />
        <div className="label">Получаю</div>
        <ResourcePicker
          disabled={(r) => !give || r === give}
          onPick={(r) => {
            setPlan([...plan, { id: newStepId(), kind: 'bank', give: give!, receive: r }]);
            setAdding(null);
            setGive(null);
          }}
        />
        <button className="btn ghost wide" onClick={() => setAdding(null)}>
          Назад
        </button>
      </div>
    );
  }
  if (adding === 'offer') {
    const ok = sum(offerGive) > 0 && sum(offerWant) > 0;
    return (
      <div className="stack">
        <TradeGrid
          give={offerGive}
          want={offerWant}
          hand={priv.resources}
          onChange={(g, w) => {
            setOfferGive(g);
            setOfferWant(w);
          }}
        />
        <div className="row">
          <button className="btn ghost grow" onClick={() => setAdding(null)}>
            Назад
          </button>
          <button
            className="btn primary grow"
            disabled={!ok}
            onClick={() => {
              setPlan([...plan, { id: newStepId(), kind: 'offer', give: offerGive, want: offerWant }]);
              setAdding(null);
              setOfferGive(emptyResources());
              setOfferWant(emptyResources());
            }}
          >
            В план
          </button>
        </div>
      </div>
    );
  }

  const ready = checked.filter((c) => c.status === 'ready').length;
  const missing: Partial<ResourceMap> = {};
  for (const c of checked) if (c.status === 'short' && c.missing) for (const r of RESOURCES) missing[r] = (missing[r] ?? 0) + (c.missing[r] ?? 0);
  const points = plan.filter((s) => s.kind === 'settlement' || s.kind === 'city').length;
  const brokenN = checked.filter((c) => c.status === 'broken').length;

  return (
    <div className="stack">
      {me && <IncomeStrip pub={pub} pid={me} label="Твой доход по числам" />}
      {checked.length > 0 ? (
        <div className={`plan-sum ${brokenN ? 'bad' : ready === checked.length ? 'good' : ''}`}>
          <div className="ps-main">
            <b>
              Готово {ready} из {checked.length}
            </b>
            {points > 0 && <span className="ps-vp">+{points} очк.</span>}
          </div>
          {brokenN > 0 && <div className="ps-line">Сломалось шагов: {brokenN} — кто-то занял место. Убери или замени.</div>}
          {Object.keys(missing).length > 0 && (
            <div className="ps-line">
              Не хватает: <ResChips value={missing} />
            </div>
          )}
        </div>
      ) : (
        <p className="muted small">Пусто. Добавь стройку — план перепроверяется после каждого чужого хода.</p>
      )}

      {checked.length > 0 && (
        <ol className="plan-steps">
          {checked.map((c, i) => (
            <li key={c.step.id} className={`pstep ${c.status}`}>
              <span className="pstep-ic">
                <Icon name={STEP_ICON[c.step.kind]} size={20} />
              </span>
              <div
                className={`pstep-body ${'at' in c.step && onShow ? 'tappable' : ''}`}
                role={'at' in c.step && onShow ? 'button' : undefined}
                onClick={'at' in c.step && onShow ? () => onShow((c.step as { at: string }).at) : undefined}
              >
                <b>
                  <span className="pstep-n">{i + 1}</span>
                  {STEP_LABEL[c.step.kind]}
                </b>
                <span className="pstep-st">
                  {c.status === 'ready' && (c.step.kind === 'bank' || c.step.kind === 'offer' ? <StepTerms step={c.step} /> : 'готово')}
                  {c.status === 'short' && (
                    <>
                      не хватает <ResChips value={c.missing ?? {}} />
                    </>
                  )}
                  {c.status === 'broken' && (c.reason ?? 'место занято')}
                </span>
              </div>
              <div className="pstep-ctl">
                <button className="pstep-btn" aria-label="Выше" disabled={i === 0} onClick={() => setPlan(move(plan, i, i - 1))}>
                  <Icon name="up" size={16} />
                </button>
                <button className="pstep-btn" aria-label="Убрать" onClick={() => setPlan(plan.filter((s) => s.id !== c.step.id))}>
                  <Icon name="close" size={16} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="label">Добавить шаг</div>
      <div className="plan-add">
        <button className="act" onClick={() => onPick('road')}>
          <span className="act-top"><Icon name="road" size={18} /> Дорога</span>
          <Cost cost={COSTS.road} />
        </button>
        <button className="act" onClick={() => onPick('settlement')}>
          <span className="act-top"><Icon name="house" size={18} /> Поселение</span>
          <Cost cost={COSTS.settlement} />
        </button>
        <button className="act" onClick={() => onPick('city')}>
          <span className="act-top"><Icon name="castle" size={18} /> Город</span>
          <Cost cost={COSTS.city} />
        </button>
        <button className="act" disabled={pub.devDeckCount <= 0} onClick={() => setPlan([...plan, { id: newStepId(), kind: 'devCard' }])}>
          <span className="act-top"><Icon name="cards" size={18} /> Карта</span>
          <Cost cost={COSTS.devCard} />
        </button>
        <button className="act" onClick={() => setAdding('bank')}>
          <span className="act-top"><Icon name="bank" size={18} /> Банк</span>
          <small className="faint">курс {Math.min(...RESOURCES.map((r) => priv.tradeRatios[r]))}:1</small>
        </button>
        <button className="act" onClick={() => setAdding('offer')}>
          <span className="act-top"><Icon name="trade" size={18} /> Обмен</span>
          <small className="faint">игрокам</small>
        </button>
      </div>

      {hints.length > 0 && (
        <div className="hint-card">
          <Icon name="bulb" size={18} />
          <span>{hints.join(' · ')}</span>
        </div>
      )}

      {checked.length > 0 && (
        <div className="row">
          <button className="btn ghost grow" onClick={() => setPlan([])}>
            Очистить
          </button>
          <button className="btn primary grow" disabled={!canRun || busy || checked[0].status !== 'ready'} onClick={onRun}>
            <Icon name="play" /> Выполнить
          </button>
        </div>
      )}
      {!canRun && checked.length > 0 && <p className="faint small center">Выполнить можно в свой ход после броска</p>}

      {onLog && (
        <button className="log-open" onClick={onLog}>
          <Icon name="book" size={18} />
          <span className="grow">Журнал партии</span>
          <small>{logCount}</small>
          <Icon name="next" size={16} />
        </button>
      )}
    </div>
  );
}

/** Журнал партии: кто что сделал, с разделителями по ходам; новое — сверху. */
function GameLogList({ log, pub }: { log: LogEntry[]; pub: PublicState }) {
  if (log.length === 0) return <p className="muted small">Пока пусто — события появятся по ходу партии.</p>;
  const rows = [...log].reverse();
  return (
    <ol className="glog">
      {rows.map((l) => {
        const c = l.who ? pub.players[l.who]?.color : undefined;
        return (
          <li key={l.key} className={l.turn ? 'turn' : ''} style={{ ['--pc' as string]: c ? PLAYER_HEX[c] : 'rgba(255,255,255,.35)' }}>
            {!l.turn && <i />}
            <span>{l.text}</span>
          </li>
        );
      })}
    </ol>
  );
}

function StepTerms({ step }: { step: PlanStep }) {
  if (step.kind === 'bank') {
    const g: Partial<ResourceMap> = { [step.give]: 1 };
    const w: Partial<ResourceMap> = { [step.receive]: 1 };
    return (
      <span className="counter-line">
        <ResChips value={g} /> → <ResChips value={w} />
      </span>
    );
  }
  if (step.kind === 'offer')
    return (
      <span className="counter-line">
        <ResChips value={step.give} /> → <ResChips value={step.want} />
      </span>
    );
  return null;
}

function move<T>(a: T[], from: number, to: number): T[] {
  const b = [...a];
  const [x] = b.splice(from, 1);
  b.splice(to, 0, x);
  return b;
}

function Costs() {
  const rows: [string, ResourceMap][] = [
    [cap(shortName('road')), COSTS.road],
    [cap(shortName('settlement')), COSTS.settlement],
    [cap(shortName('city')), COSTS.city],
    ['Карта развития', COSTS.devCard],
  ];
  return (
    <div className="list costs">
      {rows.map(([n, c]) => (
        <div key={n} className="item">
          <span className="grow t">{n}</span>
          <Cost cost={c} />
        </div>
      ))}
    </div>
  );
}

function HostTools({ room, pub }: { room: RoomView; pub: PublicState }) {
  const [open, setOpen] = useState(false);
  if (pub.phase === 'finished') return null;
  return (
    <div className="stack">
      <button className="btn ghost wide" onClick={() => setOpen(!open)}>
        <Icon name="crown" /> Ведущий {open ? '▴' : '▾'}
      </button>
      {open && (
        <>
          <TurnSettings settings={room.settings} editable />
          <button className="btn wide" onClick={() => void conn.host({ type: 'skipTurn' })}>
            <Icon name="skip" /> Пропустить ход {pub.players[pub.order[pub.current]].name}
          </button>
          {pub.order
            .filter((id) => id !== room.me && !pub.players[id].kicked)
            .map((id) => (
              <button key={id} className="btn danger wide" onClick={() => conn.send({ t: 'kick', player: id, level: 'medium' })}>
                <Icon name="ban" /> Заменить ботом: {pub.players[id].name}
              </button>
            ))}
        </>
      )}
    </div>
  );
}

function Finished({ pub, me, pack }: { pub: PublicState; me: PlayerId; pack: LorePack }) {
  const winner = pub.winner!;
  const prof = useConn().profile?.profile;
  useEffect(() => {
    // Сервер записывает партию сразу; чуть ждём и берём свежий профиль
    const t = setTimeout(() => conn.send({ t: 'profile' }), 600);
    return () => clearTimeout(t);
  }, []);
  const order = [...pub.order].sort((a, b) => pub.players[b].points - pub.players[a].points);
  return (
    <div className="finish-overlay">
      <div className="panel glass strong stack center">
        <ArtIcon src={eraIcon(pack.id, 'dev-victoryPoint')} size={96} className="win-art" fallback={<Icon name="crown" size={56} />} />
        <h2 className="display">{winner === me ? 'Ты победил!' : `Победа: ${pub.players[winner].name}`}</h2>
        <p className="muted">{pack.victory.replace('{player}', pub.players[winner].name)}</p>
        {prof && (
          <div className="fin-prof">
            <span>
              <b>{prof.rating}</b> рейтинг
            </span>
            <span>
              <b>{prof.streak}</b> дн. подряд
            </span>
            <span>
              <b>{prof.games}</b> партий
            </span>
          </div>
        )}
        <ol className="list">
          {order.map((id) => (
            <li key={id} className="item">
              <span className="seat-dot" style={{ background: PLAYER_HEX[pub.players[id].color] }} />
              <span className="grow t">{pub.players[id].name}</span>
              <b className="row"><Icon name="star" size={16} /> {pub.players[id].points}</b>
            </li>
          ))}
        </ol>
        <button className="btn primary wide" onClick={() => conn.forget()}>
          На главную
        </button>
      </div>
    </div>
  );
}
