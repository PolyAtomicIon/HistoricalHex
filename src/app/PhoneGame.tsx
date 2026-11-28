// Экран игрока: карта на весь экран, поверх — стеклянные панели и шторки.

import { GoalTab, MeTab } from './MeTabs';
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
import { L, pick } from '../i18n/l';
import { ThemeToggle } from './ThemeToggle';
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
import { ArmyRace, MarketTab, NumbersTab } from './TableInfo';
import { TRADE_UI_LABEL, TradeCard, TradeCaravan, setTradeUi, useTradeUi } from './TradeOffer';
import type { TradeUi } from './TradeOffer';
import type { LogEntry } from './gameLog';
import { STEP_ICON, STEP_LABEL, STEP_SHORT, checkPlan, doneSteps, settlementRoutes, goalHints, loadPlan, moveUnit, newStepId, planUnits, removeUnit, savePlan, smartOrder, stepAction } from './planner';
import { Fact, FactsList, useRotatingFact } from './Facts';
import { useLearn } from './learn/Learn';
import { LOOK_DEFAULT, setBoardLook, setFacts, setFxStyle, setPlanNudge, useBoardLook, useFacts, useFxStyle, usePlanNudge } from './prefs';
import type { FxStyle } from './prefs';

type BuildMode = 'road' | 'settlement' | 'city';
type SheetId = null | 'trade' | 'incoming' | 'dev' | 'plenty' | 'monopoly' | 'menu' | 'leave' | 'plan' | 'lore' | 'dice' | 'react' | 'players' | 'fact' | 'pprofile' | 'info' | 'status';
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
  const learn = useLearn();
  // вложенные шторки меню: ведущий (→ замена ботом) и «Вид и подсказки»
  const [sub, setSub] = useState<null | 'host' | 'kick' | 'look'>(null);
  // Высота полосы игроков → --pbar-h: подсказки сверху начинаются под ней (на iPad она выше, чем на телефоне)
  const hudRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const bar = hudRef.current?.querySelector<HTMLElement>('.pbar');
    const root = hudRef.current?.closest<HTMLElement>('main');
    if (!bar || !root) return;
    const set = () => root.style.setProperty('--pbar-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    set();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null;
    ro?.observe(bar);
    return () => ro?.disconnect();
  }, []);
  const factsShown = useFacts();
  const { style: fxStyle, mini: miniFx } = useFxStyle();
  const meP = pub.players[me];
  const current = pub.order[pub.current];
  const myTurn = current === me && pub.phase !== 'finished';
  // DEV: подставить награды, чтобы проверить значки и подсветку магистрали в крайних случаях
  const [awardDbg, setAwardDbg] = useState<{ r?: string; a?: string } | null>(null);
  if (import.meta.env.DEV) (window as unknown as { __awards: (r?: string, a?: string) => void }).__awards = (r, a) => setAwardDbg({ r, a });
  const pubShown = awardDbg ? { ...pub, longestRoad: awardDbg.r, largestArmy: awardDbg.a } : pub;
  const fx = useGameFx(pub, pack, me);
  // Лента событий: последнее действие другого игрока (постройка, обмен, покупка) — коротко в верхней подсказке
  const [tick, setTick] = useState<{ key: number; text: string; who?: string } | null>(null);
  const lastLog = fx.log[fx.log.length - 1];
  useEffect(() => {
    if (!lastLog || lastLog.turn || lastLog.who === me) return;
    setTick({ key: lastLog.key, text: lastLog.text, who: lastLog.who });
    const t = setTimeout(() => setTick((x) => (x?.key === lastLog.key ? null : x)), 3500);
    return () => clearTimeout(t);
  }, [lastLog?.key]); // eslint-disable-line react-hooks/exhaustive-deps
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
    const where = resN ? `${RESOURCE_NAME[resN]}${hex?.number ? ` ${hex.number}` : ''}` : L('гекс', 'гекс', 'hex');
    const mine = hex && Object.entries(pub.buildings).some(([v, b]) => b.owner === me && topologyFor(pub.board.layout).vertices.get(v)?.hexes.includes(hex.id));
    setRaidCap(
      r.kind === 'robber'
        ? { key: r.key, title: `${pack.robber.name}: ${where}`, text: mine ? L('Это твой гекс — он не приносит дохода, пока захватчиков не прогонят', 'Бұл сенің гексің — басқыншылар қуылмайынша табыс әкелмейді', 'This is your hex — it earns nothing until the raiders are driven off') : L('Этот гекс не приносит дохода, пока захватчиков не прогонят', 'Бұл гекс басқыншылар қуылмайынша табыс әкелмейді', 'This hex earns nothing until the raiders are driven off') }
        : { key: r.key, title: `${pack.devCards.knight.name}: ${where}`, text: mine ? L('Войско перегнало захватчиков на твой гекс — он без дохода', 'Әскер басқыншыларды сенің гексіңе қуды — ол табыссыз қалды', 'The army drove the raiders onto your hex — it earns nothing') : L('Войско перегнало захватчиков сюда — этот гекс теперь без дохода', 'Әскер басқыншыларды осында қуды — бұл гекс енді табыссыз', 'The army drove the raiders here — this hex now earns nothing') },
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
  const [infoTab, setInfoTab] = useState<'market' | 'nums' | 'log' | 'me' | 'goal'>('market');
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
  // Предложение мне: адресовано мне (или всем) и не от того, с кем я тайно не торгую
  const bans = room.bans ?? [];
  // Несколько открытых предложений: мне показываем первое, на которое я ещё не ответил
  const offersToMe = (pub.trades ?? (pub.trade ? [pub.trade] : [])).filter((t) => !t.to || t.to.includes(me));
  const incomingOffer = offersToMe.find((t) => !t.responses?.[me]) ?? offersToMe[offersToMe.length - 1];
  const pubIn = { ...pub, trade: incomingOffer };
  const offerForMe = !!incomingOffer && !bans.includes(pub.order[pub.current]);
  const offerPub = offerDbg ? { ...pub, trade: offerDbg } : pubIn;
  const showOffer = !!offerPub.trade && (offerDbg ? true : !myTurn && pub.phase === 'main' && offerForMe) && !planPick && sheet === null;
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
    // Рыцаря до броска играть нельзя (правило стола), ждать нечего — бросаем сразу
    void send({ type: 'rollDice' });
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
      conn.notify(L('Твой план сломался — загляни в «План»', 'Жоспарың бұзылды — «Жоспар» бөлімін қара', 'Your plan broke — check the "Plan"'));
      haptic('error');
    }
    prevBroken.current = broken;
  }, [broken]);

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
          ? (planTargets.routes.get(id) ?? []).map((e) => ({ id: newStepId(), kind: 'road' as const, at: e, for: step.id }))
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
  const nudgeOn = usePlanNudge();
  const showNudge = nudgeOn && nudgeWanted && nudgeDue;
  // Игрок ставит постройку — никаких карточек поверх карты; награды и т. п. ждут и сами уходят через 7 с
  const placing = !!build || !!selected || !!planPick || (myTurn && (pub.phase === 'setup' || pub.phase === 'roadBuilding'));
  useEffect(() => {
    if (!notice || placing) return;
    const t = setTimeout(() => markSeen(notice.key), 7000);
    return () => clearTimeout(t);
  }, [notice?.key, placing]); // eslint-disable-line react-hooks/exhaustive-deps
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

      <header className="hud-top" ref={hudRef}>
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
        {/* меню и сводка — рядом с полосой игроков (на iPad они не разъезжаются по краям) */}
        <span className="hud-btns">
          <button className="fab glass" onClick={() => setSheet('menu')} aria-label={L('Меню', 'Мәзір', 'Menu')}>
            <Icon name="menu" />
          </button>
          {!focusPlayer && (
            <button className="info-fab glass" onClick={() => setSheet('info')} aria-label={L('Сводка стола: рынок, числа, журнал', 'Үстел жиынтығы: нарық, сандар, журнал', 'Table summary: market, numbers, log')}>
              <Icon name="stats" size={20} />
            </button>
          )}
        </span>
      </header>

      {/* Верх экрана — одна колонка: статус, захват, уведомления. Ничего не накладывается. */}
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
            banned={bans.includes(focusPlayer.id)}
            onBan={() => {
              const on = !bans.includes(focusPlayer.id);
              conn.send({ t: 'ban', player: focusPlayer.id, on });
              const pn = pub.players[focusPlayer.id]?.name;
              setGameToast({ text: on ? L('Ты не торгуешь с игроком {n}. Он не узнает.', '{n} ойыншымен сауда жасамайсың. Ол білмейді.', "You won't trade with {n}. They won't know.", { n: pn }) : L('Снова торгуешь с игроком {n}', '{n} ойыншымен қайтадан сауда жасайсың', 'You trade with {n} again', { n: pn }), key: Date.now() });
            }}
          />
        ) : (
          tick ? (
            // Лента событий: что сделал другой игрок — на 3,5 с вместо подсказки фазы, потом подсказка возвращается
            <div
              key={`t${tick.key}`}
              className="status-pill glass ticker"
              aria-live="polite"
              role="button"
              onClick={() => {
                setInfoTab('log');
                setSheet('info');
              }}
            >
              <i style={{ background: tick.who && pub.players[tick.who] ? PLAYER_HEX[pub.players[tick.who].color] : 'var(--accent)' }} />
              <span>{tick.text}</span>
            </div>
          ) : (
            <div
              key={`s${status}`}
              className={`status-pill glass ${myTurn ? 'mine' : ''} ${deadline && pub.phase !== 'finished' ? 'has-clock' : ''}`}
              aria-live="polite"
              role="button"
              onClick={() => setSheet('status')}
            >
              <span className="sp-text">{status}</span>
              {deadline && pub.phase !== 'finished' && <TurnClock until={deadline - conn.getState().clockSkew} mine={myTurn} />}
            </div>
          )
        )}
        {connStatus !== 'online' && <div className="reconnect glass">{L('Переподключаемся…', 'Қайта қосылудамыз…', 'Reconnecting…')}</div>}

        {blocked && !focusPlayer && !raidCap && (
          <button className="blocked-chip glass strong" onClick={() => setBlockInfo(true)}>
            <span className="bc-ic">
              <ResIcon r={blocked.res} size={22} />
            </span>
            <span className="bc-text">
              <b>{L('Твой гекс захвачен', 'Гексің басып алынды', 'Your hex is captured')}</b>
              <small>
                {RESOURCE_NAME[blocked.res]} · {blocked.number} {L('— без дохода', '— табыссыз', '— no income')}
              </small>
            </span>
            <span className="bc-q">?</span>
          </button>
        )}

        {askPush && !myTurn && (
          <div className="push-ask glass strong">
            <span className="pa-ic">
              <Icon name="bell" size={18} />
            </span>
            <span className="pa-text">{L('Напомнить о ходе?', 'Жүріс туралы еске салайық па?', 'Remind you about your turn?')}</span>
            <button
              className="btn primary small-act"
              onClick={async () => {
                setAskPush(false);
                const err = await enablePush(vapid, (sub) => conn.send({ t: 'pushSub', sub }));
                if (err) conn.notify(err);
              }}
            >
              {L('Включить', 'Қосу', 'Turn on')}
            </button>
            <button className="btn ghost small-act" onClick={() => setAskPush(false)} aria-label={L('Не сейчас', 'Қазір емес', 'Not now')}>
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

      {(planPick || (targets && !selected && pub.phase === 'main')) && (
        <div className="board-hint glass">
          {planPick ? (planTargets && planTargets.ids.length === 0 ? L('Нет свободных мест для: {s}', '{s} үшін бос орын жоқ', 'No free spots for: {s}', { s: STEP_LABEL[planPick].toLowerCase() }) : planPick === 'settlement' ? L('План: место для дома — дороги добавлю', 'Жоспар: үй үшін орын — жолдарды өзім қосамын', 'Plan: pick a spot for the house — I will add the roads') : L('План: выбери место — {s}', 'Жоспар: орынды таңда — {s}', 'Plan: pick a spot — {s}', { s: STEP_LABEL[planPick].toLowerCase() })) : targets!.hint}
          {planPick && (
            <button className="btn ghost small-btn" onClick={() => setPlanPick(null)}>
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      )}

      {targets && selected && !planPick && targets.kind === 'hex' && (
        <RobberPick
          pub={pub}
          me={me}
          hex={selected}
          busy={busy}
          onCancel={() => setSelected(undefined)}
          onGo={async (victim) => {
            haptic('success');
            const ok = await send(targets.action(selected, victim));
            if (ok) setSelected(undefined);
          }}
        />
      )}
      {targets && selected && !planPick && targets.kind !== 'hex' && (
        <div className="confirm glass strong">
          <span className="q">{targets.confirm}</span>
          <button className="btn ghost" onClick={() => setSelected(undefined)}>
            {L('Отмена', 'Бас тарту', 'Cancel')}
          </button>
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              haptic('success');
              const ok = await send(targets.action(selected));
              if (ok) setSelected(undefined);
            }}
          >
            {L('Да', 'Иә', 'Yes')}
          </button>
        </div>
      )}

      {planHead && !build && !planPick && !selected ? (
        <button key="ph" className={`board-hint glass turn-hint plan-hint ${planHead.status}`} onClick={() => setSheet('plan')}>
          <Icon name="plan" size={18} />
          {planHead.status === 'short' ? (
            <>
              {L('План', 'Жоспар', 'Plan')} · {STEP_SHORT[planHead.step.kind]}: {L('нужно', 'керек', 'needs')} <ResChips value={planHead.missing ?? {}} />
            </>
          ) : (
            <>{L('План', 'Жоспар', 'Plan')} · {STEP_SHORT[planHead.step.kind]}: {L('место занято', 'орын бос емес', 'spot taken')}</>
          )}
          <span className="ph-go">›</span>
        </button>
      ) : readyCard && !build && !planPick && !selected ? (
        <button key="rc" className="board-hint glass turn-hint card-hint" onClick={() => setSheet('dev')}>
          <ArtIcon src={eraIcon(pack.id, `dev-${readyCard}`)} size={26} /> {L('Можно сыграть:', 'Ойнауға болады:', 'Can play:')} {pack.devCards[readyCard].name} ›
        </button>
      ) : myTurn && pub.phase === 'main' && !build && !planPick && !selected && hints[0] && (
        <div key={hints[0]} className="board-hint glass turn-hint">
          <Icon name="bulb" size={18} /> {hints[0]}
        </div>
      )}

      {room.canUndo && myTurn && !selected && !build && !planPick && (
        <button
          key={`undo${pub.turn}`}
          className="undo-chip glass strong"
          onClick={() => {
            sfx.play('tick');
            haptic('tap');
            conn.send({ t: 'undo' });
          }}
        >
          <Icon name="undo" size={18} /> {L('Отменить:', 'Болдырмау:', 'Undo:')} {room.canUndo === 'road' ? L('дорогу', 'жолды', 'road') : room.canUndo === 'settlement' ? L('поселение', 'қонысты', 'settlement') : L('город', 'қаланы', 'city')}
        </button>
      )}

      {notice && !placing && (
        <div key={notice.key} className="fact-pop notice-card glass strong" role="alert">
          <span className="nc-ic" style={{ ['--pc' as string]: notice.who && pub.players[notice.who] ? PLAYER_HEX[pub.players[notice.who].color] : 'var(--accent)' }}>
            <Icon name={notice.icon ?? 'crown'} size={20} />
          </span>
          <div className="fp-body">
            <b className="nc-title">{notice.title}</b>
            <p className="nc-text">{notice.text}</p>
            <div className="fp-actions">
              <button className="btn primary small-act" onClick={() => markSeen(notice.key)}>
                {L('Понятно', 'Түсінікті', 'Got it')}
              </button>
              <button className="btn ghost small-act" onClick={() => { markSeen(notice.key); setInfoTab('log'); setSheet('info'); }}>
                <Icon name="book" size={16} /> {L('Журнал', 'Журнал', 'Log')}
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
      <FactPopup pack={pack} allowed={factsShown && showFact && !sheet && !showNudge && !notice && !placing} onRead={(f) => { setOpenFact(f); setSheet('fact'); }} />

      {planReady && !build && !selected && !planPick && (
        <button className="plan-run glass" disabled={busy} onClick={() => void runPlan()}>
          <Icon name="play" size={18} /> {L('Выполнить план · {a} из {b}', 'Жоспарды орындау · {a} / {b}', 'Run plan · {a} of {b}', { a: checked.filter((c) => c.status === 'ready').length, b: checked.length })}
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
          serverRoll={(!!room.settings.autoRoll || autoRoll) && !physical}
          planCount={plan.length}
          planBroken={broken}
        />
      </section>

      {/* ─── шторки ─── */}
      <Sheet open={sheet === 'trade'} onClose={() => setSheet(null)} title={L('Обмен', 'Алмасу', 'Trade')}>
        {myTurn && pub.phase === 'main' ? (
          <TradeSheet pub={pub} priv={priv} me={me} send={sendVoid} busy={busy} bans={bans} />
        ) : (
          <p className="muted">{L('Торговать можно в свой ход после броска. А пока — заготовь обмен в «Плане»', 'Сауданы өз жүрісіңде, кубик тасталғаннан кейін жасауға болады. Әзірге — «Жоспарда» алмасуды дайында', 'You can trade on your turn after the roll. Until then, prepare a trade in the "Plan"')}</p>
        )}
      </Sheet>

      <Sheet open={sheet === 'incoming' && !!pub.trade && !myTurn && offerForMe} onClose={() => setSheet(null)} title={L('{n} предлагает обмен', '{n} алмасу ұсынады', '{n} offers a trade', { n: pub.players[current]?.name ?? L('Игрок', 'Ойыншы', 'Player') })}>
        {incomingOffer && <IncomingTrade key={incomingOffer.id} pub={pubIn} priv={priv} me={me} send={sendVoid} busy={busy} />}
        {pub.trade && (
          <button
            className="btn ghost wide ban-btn"
            onClick={() => {
              conn.send({ t: 'ban', player: current, on: true });
              setSheet(null);
              setGameToast({ text: L('Ты больше не торгуешь с игроком {n}. Он об этом не узнает. Снять — в «Игроки».', 'Енді {n} ойыншымен сауда жасамайсың. Ол бұл туралы білмейді. Қайтару — «Ойыншылар» бөлімінде.', 'You no longer trade with {n}. They won\'t know. Undo it in "Players".', { n: pub.players[current]?.name }), key: Date.now() });
            }}
          >
            <Icon name="ban" size={16} /> {L('Не торговать с {n}', '{n} ойыншымен сауда жасамау', "Don't trade with {n}", { n: pub.players[current]?.name })}
          </button>
        )}
      </Sheet>

      <Sheet open={sheet === 'dev'} onClose={() => setSheet(null)} title={L('Карты развития', 'Даму карталары', 'Development cards')}>
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

      <Sheet open={sheet === 'plenty'} onClose={() => setSheet(null)} title={DEV_CARD_NAME.yearOfPlenty} description={L('Выбери два ресурса из банка', 'Банктен екі ресурс таңда', 'Pick two resources from the bank')}>
        <Plenty
          busy={busy}
          onDone={(r) => {
            setSheet(null);
            void send({ type: 'playYearOfPlenty', resources: r });
          }}
        />
      </Sheet>

      <Sheet open={sheet === 'monopoly'} onClose={() => setSheet(null)} title={DEV_CARD_NAME.monopoly} description={L('Какой ресурс забрать у всех?', 'Барлығынан қай ресурсты аласың?', 'Which resource to take from everyone?')}>
        <ResourcePicker
          onPick={(r) => {
            setSheet(null);
            void send({ type: 'playMonopoly', resource: r });
          }}
        />
      </Sheet>

      <Sheet open={mustDiscard} onClose={() => undefined} dismissible={false} title={L('Сбрось {n} {w}', '{n} карта таста', 'Discard {n} {w}', { n: priv.mustDiscard, w: pick(plural(priv.mustDiscard, 'карту', 'карты', 'карт'), 'карта', priv.mustDiscard === 1 ? 'card' : 'cards') })} description={L('Выпала 7 — сбрось половину карт', '7 түсті — карталардың жартысын таста', 'A 7 was rolled — discard half your cards')}>
        <Discard priv={priv} busy={busy} send={sendVoid} />
      </Sheet>

      <Sheet open={sheet === 'dice'} onClose={() => setSheet(null)} title={L('Что выпало на кубиках?', 'Кубиктерде не түсті?', 'What did the dice show?')} description={L('Отметь, что выпало', 'Түскенін белгіле', 'Mark what was rolled')}>
        <PhysicalDice
          busy={busy}
          canRoll={myTurn && pub.phase === 'roll'}
          onDone={async (d) => {
            const ok = await send({ type: 'rollDice' }, d);
            if (ok) setSheet(null);
          }}
        />
      </Sheet>

      <Sheet open={sheet === 'status'} onClose={() => setSheet(null)} title={L('Сейчас', 'Қазір', 'Now')}>
        <div className="stack">
          <p className="status-full">{status}</p>
          <button
            className="btn wide"
            onClick={() => {
              setInfoTab('log');
              setSheet('info');
            }}
          >
            <Icon name="book" /> {L('История ходов', 'Жүрістер тарихы', 'Move history')}
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'info'} onClose={() => setSheet(null)} title={L('Сводка стола', 'Үстел жиынтығы', 'Table summary')}>
        <div className="seg ti-tabs" role="tablist">
          {(
            [
              ['market', L('Рынок', 'Нарық', 'Market'), 'bank'],
              ['nums', L('Числа', 'Сандар', 'Numbers'), 'dice'],
              ['log', L('Журнал', 'Журнал', 'Log'), 'book'],
              ['me', L('Я', 'Мен', 'Me'), 'hand'],
              ['goal', L('Цель', 'Мақсат', 'Goal'), 'house'],
            ] as const
          ).map(([id, label, icon]) => (
            // Пять вкладок не влезают словами — у неактивных только иконка, у активной иконка и подпись
            <button key={id} role="tab" aria-label={label} aria-pressed={infoTab === id} aria-selected={infoTab === id} onClick={() => setInfoTab(id)}>
              <Icon name={icon} size={18} />
              <span className="ti-tab-l">{label}</span>
            </button>
          ))}
        </div>
        {infoTab === 'market' && (
          <>
            <ArmyRace pub={pub} me={me} title={pack.bonuses.largestArmy} />
            <MarketTab pub={pub} me={me} />
          </>
        )}
        {infoTab === 'nums' && <NumbersTab pub={pub} me={me} />}
        {infoTab === 'log' && <GameLogList log={fx.log} pub={pub} />}
        {infoTab === 'me' && <MeTab pub={pub} priv={priv} me={me} />}
        {infoTab === 'goal' && <GoalTab pub={pub} priv={priv} me={me} vpToWin={room.settings.vpToWin} />}
      </Sheet>

      <Sheet open={sheet === 'plan'} onClose={() => setSheet(null)} title={L('План хода', 'Жүріс жоспары', 'Turn plan')} description={L('Ходы заранее — в свой ход одной кнопкой', 'Жүрістерді алдын ала жоспарла — өз кезегіңде бір батырмамен', 'Plan ahead — run it with one button on your turn')}>
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
          onLog={() => { setInfoTab('log'); setSheet('info'); }}
          me={me}
          logCount={fx.log.length}
        />
      </Sheet>

      <Sheet open={sheet === 'players'} onClose={() => setSheet(null)} title={L('Игроки', 'Ойыншылар', 'Players')} description={L('До победы — {n} очков', 'Жеңіске дейін — {n} ұпай', '{n} points to win', { n: room.settings.vpToWin })}>
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

      <Sheet open={blockInfo && !!blocked} onClose={() => setBlockInfo(false)} title={L('{n} на твоём гексе', '{n} сенің гексіңде', '{n} is on your hex', { n: pack.robber.name })}>
        {blocked && (
          <div className="stack">
            <div className="hint-card">
              <ResIcon r={blocked.res} size={28} />
              <span>
                {L('Пока он там, на число', 'Ол сонда тұрғанда,', 'While it is there, on number')} <b>{blocked.number}</b> {L('ты не получаешь', 'саны түскенде ресурс алмайсың:', 'you get no')} {RESOURCE_NAME[blocked.res]}
                {blocked.loss > 1 ? L(' (теряешь {n} шт. за бросок)', ' (әр лақтыруда {n} дана жоғалтасың)', ' (you lose {n} per roll)', { n: blocked.loss }) : ''}.
              </span>
            </div>
            <div className="label">{L('Как убрать', 'Қалай алып тастауға болады', 'How to remove it')}</div>
            <div className="item">
              <ArtIcon src={eraIcon(pack.id, 'dev-knight')} size={40} />
              <span className="grow">
                <span className="t">{L('Сыграй карту «{n}»', '«{n}» картасын ойна', 'Play the "{n}" card', { n: pack.devCards.knight.name })}</span>
                <span className="s" style={{ display: 'block' }}>
                  {L('Переставишь его на чужой гекс и заберёшь карту у соседа.', 'Оны басқаның гексіне ауыстырып, көршіңнен карта аласың.', 'Move it to another hex and take a card from a neighbor.')} {priv.devCards.some((c) => c.type === 'knight') ? L('У тебя она есть!', 'Сенде бар!', 'You have it!') : L('Купить: овцы, зерно, руда.', 'Сатып ал: қой, астық, кен.', 'Buy it with: sheep, grain, ore.')}
                </span>
              </span>
            </div>
            <div className="item">
              <Icon name="dice" />
              <span className="grow">
                <span className="t">{L('Выброси 7 в свой ход', 'Өз жүрісіңде 7 түсір', 'Roll a 7 on your turn')}</span>
                <span className="s" style={{ display: 'block' }}>
                  {L('Тогда переставляешь его ты.', 'Сонда оны өзің ауыстырасың.', 'Then you move it.')}
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
                {L('Сыграть «{n}»', '«{n}» ойнау', 'Play "{n}"', { n: pack.devCards.knight.name })}
              </button>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={sheet === 'pprofile' && !!profileOf} onClose={() => setSheet(null)} title={L('Профиль игрока', 'Ойыншы профилі', 'Player profile')}>
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
            <Icon name="book" /> {L('Все факты и словарь эпохи', 'Барлық деректер мен дәуір сөздігі', 'All facts and era glossary')}
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'lore'} onClose={() => setSheet(null)} title={pack.title} description={pack.years}>
        <FactsList pack={pack} />
      </Sheet>

      <Sheet open={sheet === 'react'} onClose={() => setSheet(null)} title={L('Реакция', 'Реакция', 'Reaction')} description={room.watchers ? L('Смотрят партию: {n}', 'Ойынды қарап отырғандар: {n}', 'Watching: {n}', { n: room.watchers }) : undefined}>
        <ReactionBar
          emojis={REACTIONS}
          onReact={(e) => {
            conn.send({ t: 'react', emoji: e });
            setSheet(null);
          }}
        />
      </Sheet>

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title={L('Меню', 'Мәзір', 'Menu')}>
        <div className="stack">
          <button className="item" onClick={() => setSheet('lore')}>
            <ArtIcon src={eraIcon(pack.id, 'emblem')} size={34} />
            <span className="grow">
              <span className="t">{pack.title}</span>
              <span className="s" style={{ display: 'block' }}>{L('История, словарь эпохи, факты', 'Тарих, дәуір сөздігі, деректер', 'History, era glossary, facts')}</span>
            </span>
          </button>
          <button className="item" onClick={() => setSheet('players')}>
            <Icon name="crown" />
            <span className="grow t">{L('Игроки и очки', 'Ойыншылар мен ұпайлар', 'Players and points')}</span>
          </button>
          {room.isHost && pub.phase !== 'finished' && (
            <button className="item" onClick={() => setSub('host')}>
              <Icon name="crown" />
              <span className="grow">
                <span className="t">{L('Ведущий', 'Жүргізуші', 'Host')}</span>
                <span className="s" style={{ display: 'block' }}>{L('Темп, таймер хода, пропуск хода, замена ботом', 'Қарқын, жүріс таймері, жүрісті өткізу, ботпен ауыстыру', 'Pace, turn timer, skip turn, bot replacement')}</span>
              </span>
              <Icon name="next" size={16} />
            </button>
          )}
          {pub.phase !== 'finished' && (
            <button
              className="item"
              onClick={() => {
                conn.send({ t: 'pause', on: !room.paused });
                setSheet(null);
              }}
            >
              <Icon name={room.paused ? 'play' : 'pause'} />
              <span className="grow">
                <span className="t">{room.paused ? L('Продолжить партию', 'Ойынды жалғастыру', 'Resume the game') : L('Поставить на паузу', 'Үзіліске қою', 'Pause the game')}</span>
                <span className="s" style={{ display: 'block' }}>
                  {room.paused ? L('Паузу поставил {n}', 'Үзіліске {n} қойды', 'Paused by {n}', { n: room.paused.name }) : L('Таймеры и боты стоят — хоть до завтра, хоть неделю', 'Таймерлер мен боттар тоқтап тұр — ертеңге дейін, тіпті бір аптаға', 'Timers and bots are stopped — for a day or a week')}
                </span>
              </span>
            </button>
          )}
          <button className="item" onClick={() => { setSheet(null); learn.openRules(); }}>
            <Icon name="book" />
            <span className="grow">
              <span className="t">{L('Правила', 'Ережелер', 'Rules')}</span>
              <span className="s" style={{ display: 'block' }}>{L('Все правила с поиском · RU / KZ / EN', 'Барлық ережелер іздеумен · RU / KZ / EN', 'All rules with search · RU / KZ / EN')}</span>
            </span>
          </button>
          <button className="item" onClick={() => { setSheet(null); learn.openTutorial(); }}>
            <Icon name="bulb" />
            <span className="grow">
              <span className="t">{L('Обучение', 'Оқыту', 'Tutorial')}</span>
              <span className="s" style={{ display: 'block' }}>{L('Учебный ход за 3 минуты', '3 минуттық оқу жүрісі', 'A practice turn in 3 minutes')}</span>
            </span>
          </button>
          <button className="item" onClick={() => setSub('look')}>
            <Icon name="map" />
            <span className="grow">
              <span className="t">{L('Вид и подсказки', 'Көрініс және кеңестер', 'View and hints')}</span>
              <span className="s" style={{ display: 'block' }}>{L('2D / 3D, графика, заставки, обмен, факты', '2D / 3D, графика, заставкалар, алмасу, деректер', '2D / 3D, graphics, intros, trade, facts')}</span>
            </span>
            <Icon name="next" size={16} />
          </button>
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
              <span className="t">{L('Уведомлять о моём ходе', 'Жүрісім туралы хабарлау', 'Notify me on my turn')}</span>
              <span className="s" style={{ display: 'block' }}>
                {pushSupport() === 'install' ? L('На iPhone — после установки на экран «Домой»', 'iPhone-да — «Басты экранға» орнатқаннан кейін', 'On iPhone — after adding to the Home Screen') : L('Когда игра свёрнута или телефон спит', 'Ойын жиналғанда немесе телефон ұйықтағанда', 'When the game is minimized or the phone is asleep')}
              </span>
            </span>
            <span className={`switch ${pushOn ? 'on' : ''}`} aria-hidden />
          </button>
          <button className="item" onClick={() => setMusic(!music)}>
            <Icon name="music" />
            <span className="grow t">{L('Музыка эпохи', 'Дәуір музыкасы', 'Era music')}</span>
            <span className={`switch ${music ? 'on' : ''}`} aria-hidden />
          </button>
          <button className="item" onClick={() => setMuted(!muted)}>
            <Icon name={muted ? 'mute' : 'sound'} />
            <span className="grow t">{muted ? L('Звук выключен', 'Дыбыс өшірулі', 'Sound off') : L('Звук включён', 'Дыбыс қосулы', 'Sound on')}</span>
          </button>
          {pub.phase !== 'finished' ? (
            <button className="btn danger wide" onClick={() => setSheet('leave')}>
              <Icon name="door" /> {L('Выйти — за меня доиграет бот', 'Шығу — менің орныма бот ойнайды', 'Leave — a bot will finish for me')}
            </button>
          ) : (
            <button className="btn wide" onClick={() => conn.forget()}>
              {L('На главную', 'Басты бетке', 'Home')}
            </button>
          )}
        </div>
      </Sheet>

      {/* Вложенная шторка: открывается поверх меню (меню остаётся под ней стопкой), свайп вниз — обратно в меню */}
      <Sheet open={(sub === 'host' || sub === 'kick') && sheet === 'menu'} onClose={() => setSub(null)} title={L('Ведущий', 'Жүргізуші', 'Host')} description={L('Настройки партии для всех игроков', 'Барлық ойыншыларға арналған ойын баптаулары', 'Game settings for all players')}>
        <HostTools room={room} pub={pub} onKick={() => setSub('kick')} />
      </Sheet>
      <Sheet open={sub === 'kick' && sheet === 'menu'} onClose={() => setSub('host')} title={L('Заменить ботом', 'Ботпен ауыстыру', 'Replace with a bot')} description={L('Игрок выбывает, его место навсегда занимает бот', 'Ойыншы шығады, оның орнын бот мәңгілікке алады', 'The player drops out and a bot takes their seat for good')}>
        <div className="list">
          {pub.order
            .filter((id) => id !== room.me && !pub.players[id].kicked && !pub.players[id].bot)
            .map((id) => (
              <button
                key={id}
                className="item"
                onClick={() => {
                  conn.send({ t: 'kick', player: id, level: 'medium' });
                  setSub('host');
                }}
              >
                <span style={{ width: 12, height: 12, borderRadius: 6, flex: 'none', background: PLAYER_HEX[pub.players[id].color] }} />
                <span className="grow t">{pub.players[id].name}</span>
                <Icon name="bot" size={18} />
              </button>
            ))}
          {pub.order.every((id) => id === room.me || pub.players[id].kicked || pub.players[id].bot) && <p className="faint small">{L('Кроме тебя за столом только боты', 'Сенен басқа үстелде боттар ғана', 'Only bots besides you at the table')}</p>}
        </div>
      </Sheet>
      <Sheet open={sub === 'look' && sheet === 'menu'} onClose={() => setSub(null)} title={L('Вид и подсказки', 'Көрініс және кеңестер', 'View and hints')} description={L('Сохраняется на этом телефоне', 'Осы телефонда сақталады', 'Saved on this phone')}>
        <div className="stack">
          <div className="label">{L('Тема', 'Тақырып', 'Theme')}</div>
          <ThemeToggle />
          {
            <>
              <div className="label">{L('Вид карты', 'Карта көрінісі', 'Map view')}</div>
              <div className="seg">
                {(['2d', '3d'] as const).map((m) => (
                  <button key={m} aria-pressed={shownMode === m} onClick={() => setMode(m)}>
                    {m === '2d' ? L('2D — рисованная', '2D — сызылған', '2D — hand-drawn') : L('3D — объёмная', '3D — көлемді', '3D — with depth')}
                  </button>
                ))}
              </div>
              {liteOn && <p className="faint small">{L('Включён лёгкий режим: 3D может подтормаживать на этом телефоне.', 'Жеңіл режим қосулы: 3D осы телефонда баяулауы мүмкін.', 'Lite mode is on: 3D may lag on this phone.')}</p>}
            </>
          }
          <div className="label">{L('Вид предложения обмена', 'Алмасу ұсынысының көрінісі', 'Trade offer view')}</div>
          <div className="seg">
            {(['card', 'caravan'] as TradeUi[]).map((v) => (
              <button key={v} aria-pressed={tradeUi === v} onClick={() => setTradeUi(v)}>
                {TRADE_UI_LABEL[v]}
              </button>
            ))}
          </div>
          <div className="label">{L('Заставки событий (семёрка, рыцарь, бонусы)', 'Оқиға заставкалары (жеті, рыцарь, бонустар)', 'Event intros (seven, knight, bonuses)')}</div>
          <div className="seg">
            {(['auto', 'full', 'mini'] as FxStyle[]).map((v) => (
              <button key={v} aria-pressed={fxStyle === v} onClick={() => setFxStyle(v)}>
                {v === 'auto' ? `${L('Авто', 'Авто', 'Auto')}${miniFx ? ` · ${L('мини', 'шағын', 'mini')}` : ''}` : v === 'full' ? L('Крупно', 'Ірі', 'Large') : L('Мини-плашки', 'Шағын тақтайшалар', 'Mini badges')}
              </button>
            ))}
          </div>
          <div className="label">{L('Подсказка «Пока ждёшь — наметь ход»', '«Күтіп тұрғанда — жүрісті жоспарла» кеңесі', 'Hint "While you wait — plan a move"')}</div>
          <div className="seg">
            <button aria-pressed={nudgeOn} onClick={() => setPlanNudge(true)}>
              {L('Показывать', 'Көрсету', 'Show')}
            </button>
            <button aria-pressed={!nudgeOn} onClick={() => setPlanNudge(false)}>
              {L('Скрыть', 'Жасыру', 'Hide')}
            </button>
          </div>
          <div className="label">{L('Факты истории', 'Тарих деректері', 'History facts')}</div>
          <div className="seg">
            <button aria-pressed={factsShown} onClick={() => setFacts(true)}>
              {L('Показывать', 'Көрсету', 'Show')}
            </button>
            <button aria-pressed={!factsShown} onClick={() => setFacts(false)}>
              {L('Скрыть', 'Жасыру', 'Hide')}
            </button>
          </div>
          <div className="label">{L('Объекты на карте — на твой вкус', 'Картадағы нысандар — өз талғамыңа сай', 'Map objects — your way')}</div>
          <LookSliders />
          <div className="label">{L('Графика карты', 'Карта графикасы', 'Map graphics')}</div>
          <div className="seg">
            {(['auto', 'hi', 'normal'] as GfxPref[]).map((v) => (
              <button key={v} aria-pressed={gfxPref === v} onClick={() => setGfxPref(v)}>
                {v === 'auto' ? `${L('Авто', 'Авто', 'Auto')}${gfxAuto ? ` · ${L('детальная', 'егжей-тегжейлі', 'detailed')}` : ''}` : v === 'hi' ? L('Детальная', 'Егжей-тегжейлі', 'Detailed') : L('Обычная', 'Қарапайым', 'Standard')}
              </button>
            ))}
          </div>
          <div className="label">{L('Лёгкий режим (старые телефоны)', 'Жеңіл режим (ескі телефондар)', 'Lite mode (old phones)')}</div>
          <div className="seg">
            {(['auto', 'on', 'off'] as const).map((v) => (
              <button key={v} aria-pressed={litePref === v} onClick={() => setLitePref(v)}>
                {v === 'auto' ? `${L('Авто', 'Авто', 'Auto')}${liteAuto ? ` · ${L('вкл', 'қос.', 'on')}` : ''}` : v === 'on' ? L('Вкл', 'Қос.', 'On') : L('Выкл', 'Өш.', 'Off')}
              </button>
            ))}
          </div>
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
              <span className="grow t">{L('Авто-бросок в свой ход', 'Өз жүрісінде авто-лақтыру', 'Auto-roll on my turn')}</span>
              <span className="faint">{autoRoll ? L('вкл', 'қос.', 'on') : L('выкл', 'өш.', 'off')}</span>
            </button>
          )}
        </div>
      </Sheet>

      <Sheet open={sheet === 'leave'} onClose={() => setSheet(null)} title={L('Кто доиграет за тебя?', 'Сенің орныңа кім ойнайды?', 'Who will finish for you?')} description={L('Вернёшься — место снова твоё', 'Қайтып келсең — орның өзіңде', 'Come back and the seat is yours again')}>
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
              <Icon name="bot" /> {l === 'easy' ? L('Лёгкий — играет наугад', 'Жеңіл — кездейсоқ ойнайды', 'Easy — plays randomly') : l === 'medium' ? L('Средний — с умом', 'Орташа — ақылмен ойнайды', 'Medium — plays smart') : L('Сложный — на победу', 'Қиын — жеңіс үшін ойнайды', 'Hard — plays to win')}
            </button>
          ))}
        </div>
      </Sheet>

      <DiceOverlay roll={fx.roll} />
      <NewCard cards={priv.devCards} pack={pack} />
      <Threat t={threatInfo(fx, pub, pack, me)} />
      <Raid event={fx.raid} skipBomber={shownMode === '3d'} />
      <Cinematic event={fx.cinematic} mini={miniFx} />
      <StealReveal ev={fx.steal} pub={pub} me={me} />
      <DevCardReveal cards={priv.devCards} pack={pack} />
      <GainToast gains={fx.gains.list} keyId={fx.gains.key} />
      <ReactionsLayer items={fx.reactions} />
      {pub.phase === 'finished' && <Finished pub={pub} me={me} pack={pack} />}
      {learn.ui}
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
    <div className={`pbar glass ${compact ? 'compact' : ''}`} role="list" aria-label={L('Игроки', 'Ойыншылар', 'Players')}>
      {pub.order.map((id) => {
        const p = pub.players[id];
        const turn = id === current && pub.phase !== 'finished';
        const bot = p.bot || p.away || p.kicked;
        return (
          <button
            key={id}
            role="listitem"
            className={`pcell ${turn ? 'turn' : ''} ${turn && deadline ? 'timed' : ''} ${focused === id ? 'focused' : ''} ${!room.online[id] && !p.bot ? 'off' : ''}`}
            style={{ ['--pc' as string]: PLAYER_HEX[p.color], ['--pc-ink' as string]: inkOn(PLAYER_HEX[p.color]) }}
            onClick={() => onFocus?.(id)}
            aria-label={L('{name}: {n} очков{aw}. Показать постройки', '{name}: {n} ұпай{aw}. Құрылыстарды көрсету', '{name}: {n} points{aw}. Show buildings', { name: p.name, n: p.points, aw: awardsOf(pub, id).map((a) => `, ${a === 'road' ? pack?.bonuses.longestRoad ?? L('самая длинная дорога', 'ең ұзын жол', 'longest road') : pack?.bonuses.largestArmy ?? L('самая большая армия', 'ең үлкен әскер', 'largest army')}`).join('') })}
          >
            <span className="pc-ava">
              {turn && deadline && <TimerRing until={deadline} />}
              <span className="pc-face">{p.name.charAt(0).toUpperCase()}</span>
              {!compact && (
                <span className="pc-pts" title={L('Очки', 'Ұпай', 'Points')}>
                  {p.points}
                </span>
              )}
              {!compact && p.knightsPlayed > 0 && (
                <span className="pc-kn" title={L('Сыграно воинов', 'Ойналған жауынгерлер', 'Warriors played')}>
                  <Icon name="army" size={8} />
                  {p.knightsPlayed}
                </span>
              )}
              {bot && !compact && (
                <span className="pc-bot" aria-label={L('бот', 'бот', 'bot')}>
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
                  <span className="pc-name">{id === room.me ? L('Ты', 'Сен', 'You') : p.name}</span>
                </span>
                <span className="pc-stats">
                  <span className="pc-st" title={L('Карт на руке', 'Қолдағы карталар', 'Cards in hand')}>
                    <Icon name="hand" size={10} />
                    {p.resourceCount}
                  </span>
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
  const st = useRef({ seen: 0, nextAt: Date.now() + 45000 });
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const next = () => {
    setShown(false);
    setI((x) => (x + 1 + Math.floor(Math.random() * 3)) % Math.max(1, pack.facts.length));
    st.current.nextAt = Date.now() + 120000;
  };
  useEffect(() => {
    const id = setInterval(() => {
      if (!allowedRef.current || document.hidden) return; // пауза: свой ход / вкладка скрыта
      const s = st.current;
      if (shownRef.current) {
        s.seen += 1000;
        if (s.seen >= 14000) next();
      } else if (Date.now() >= s.nextAt) {
        s.seen = 0;
        setShown(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [pack]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = pack.facts[i % pack.facts.length];
  if (!shown || !allowed || !f) return null;
  return (
    <div key={i} className="fact-chip glass" role="status">
      <button className="fchip-main" onClick={() => { onRead(f); next(); }} aria-label={L('Читать факт эпохи', 'Дәуір деректерін оқу', 'Read an era fact')}>
        <ArtIcon src={eraIcon(pack.id, 'emblem')} size={30} />
        <span className="fchip-txt">
          {f.year && <b>{f.year}</b>}
          {firstSentence(f.text)}
        </span>
      </button>
      <button className="fchip-x" onClick={next} aria-label={L('Скрыть', 'Жасыру', 'Hide')}>
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

/** Первое предложение факта — для короткой строки. */
function firstSentence(t: string): string {
  const m = t.match(/^.+?[.!?»](?=\s|$)/);
  return m ? m[0] : t;
}

/** Карточка игрока под полосой, пока его постройки подсвечены. */
function FocusCard({
  pub,
  id,
  pack,
  me,
  onMore,
  part,
  banned,
  onBan,
}: {
  pub: PublicState;
  id: PlayerId;
  pack: LorePack;
  me: PlayerId;
  onMore: () => void;
  part?: { idx: number; total: number; step: (d: number) => void };
  /** Тайный бан в обмене: только для чужих игроков. */
  banned?: boolean;
  onBan?: () => void;
}) {
  const p = pub.players[id];
  const b = Object.values(pub.buildings).filter((x) => x.owner === id);
  const towns = b.filter((x) => x.kind === 'settlement').length;
  const cities = b.filter((x) => x.kind === 'city').length;
  return (
    <div className="focus-card glass strong" style={{ ['--pc' as string]: PLAYER_HEX[p.color] }}>
      {/* строка 1: кто и сколько; справа — тайный бан в обмене */}
      <div className="fc-row">
      <button className="fc-open" onClick={onMore}>
      <span className="fc-ava">{p.name.charAt(0).toUpperCase()}</span>
      <span className="fc-main">
        <b>
          {id === me ? L('Ты', 'Сен', 'You') : p.name} · <Icon name="star" size={13} /> {p.points}
        </b>
        <small>
          <span><Icon name="house" size={12} /> {towns}</span>
          <span><Icon name="castle" size={12} /> {cities}</span>
          <span><Icon name="road" size={12} /> {p.roadLength}</span>
          <span><Icon name="hand" size={12} /> {p.resourceCount}</span>
          <span><Icon name="cards" size={12} /> {p.devCardCount}</span>
          <span title={L('Сыграно воинов', 'Ойналған жауынгерлер', 'Warriors played')}><Icon name="army" size={12} /> {p.knightsPlayed}</span>
          {pub.longestRoad === id && <span className="bonus">{pack.bonuses.longestRoad}</span>}
          {pub.largestArmy === id && <span className="bonus">{pack.bonuses.largestArmy}</span>}
        </small>
      </span>
      </button>
      {onBan && id !== me && (
        <button className={`fc-ban ${banned ? 'on' : ''}`} onClick={onBan} aria-label={banned ? L('Снова торговать', 'Қайта сауда жасау', 'Trade again') : L('Не торговать', 'Сауда жасамау', "Don't trade")} title={banned ? L('Ты с ним не торгуешь — нажми, чтобы снять', 'Онымен сауда жасамайсың — алып тастау үшін бас', "You don't trade with them — tap to undo") : L('Не торговать с ним', 'Онымен сауда жасамау', "Don't trade with them")}>
          <Icon name="ban" size={16} />
          <span>{banned ? L('Бан', 'Бан', 'Ban') : L('Обмен', 'Алмасу', 'Trade')}</span>
        </button>
      )}
      </div>
      <IncomeStrip pub={pub} pid={id} />
      {/* районы игрока по очереди — отдельной строкой внизу, ничего не выталкивает за край */}
      {part && part.total > 1 && (
        <div className="fc-pager">
          <button className="fc-nav" onClick={() => part.step(-1)} aria-label={L('Предыдущий район', 'Алдыңғы аудан', 'Previous district')}>
            <Icon name="next" size={16} style={{ transform: 'scaleX(-1)' }} />
          </button>
          <span className="fc-count">
            {L('Район {a} из {b}', 'Аудан {a} / {b}', 'District {a} of {b}', { a: part.idx + 1, b: part.total })}
          </span>
          <button className="fc-nav" onClick={() => part.step(1)} aria-label={L('Следующий район', 'Келесі аудан', 'Next district')}>
            <Icon name="next" size={16} />
          </button>
        </div>
      )}
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
          <span key={r.n} className={`in-chip ${Object.keys(r.res).length === 0 ? 'off' : ''}`} title={L('{n}: шанс {w} из 36', '{n}: 36-дан {w} мүмкіндік', '{n}: {w} in 36 chance', { n: r.n, w: r.ways })}>
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
              <span key={`b${res}`} className="in-r blocked" aria-label={L('захвачено', 'басып алынған', 'captured')}>
                <ResIcon r={res} size={16} />
                {c > 1 && <small>×{c}</small>}
              </span>
            ))}
          </span>
        ))}
      </div>
      <span className="in-avg">{L('≈{x} карт за бросок', 'бір лақтыруға ≈{x} карта', '≈{x} cards per roll', { x: perRoll.toFixed(1) })}</span>
    </div>
  );
}

/** Пока ждёшь чужой ход — карточка снизу: наметь ход заранее, одной кнопкой. */
function PlanNudge({ hint, onPick, onOpen, onClose }: { hint?: string; onPick: (k: Exclude<PlanPick, null>) => void; onOpen: () => void; onClose: () => void }) {
  return (
    <div className="fact-pop plan-nudge glass strong" role="status">
      <div className="pn-top">
        <span className="pn-ic">
          <Icon name="plan" size={20} />
        </span>
        <span className="pn-tt">
          <b>{L('Пока ждёшь — наметь ход', 'Күтіп тұрғанда — жүрісті жоспарла', 'While you wait — plan a move')}</b>
          <small className="pn-sub">{hint ?? L('В свой ход выполнишь одной кнопкой', 'Өз жүрісіңде бір батырмамен орындайсың', 'Run it with one button on your turn')}</small>
        </span>
        <button className="btn ghost icon-only pn-x" onClick={onClose} aria-label={L('Не сейчас', 'Қазір емес', 'Not now')}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="pn-acts">
        <button className="btn small-act" onClick={() => onPick('road')}>
          <Icon name="road" size={16} /> {L('Дорога', 'Жол', 'Road')}
        </button>
        <button className="btn small-act" onClick={() => onPick('settlement')}>
          <Icon name="house" size={16} /> {L('Дом', 'Үй', 'House')}
        </button>
        <button className="btn small-act" onClick={() => onPick('city')}>
          <Icon name="castle" size={16} /> {L('Город', 'Қала', 'City')}
        </button>
        <button className="btn ghost small-act icon-only" onClick={onOpen} aria-label={L('Весь план', 'Бүкіл жоспар', 'Whole plan')}>
          <Icon name="next" size={16} />
        </button>
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
    <span className={`tclock ${left <= 30 ? 'low' : ''}`} aria-label={L('Осталось {m} мин {s} с', 'Қалды {m} мин {s} с', '{m} min {s} s left', { m, s: left % 60 })}>
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
                {id === room.me && <span className="faint"> · {L('ты', 'сен', 'you')}</span>}
                {!room.online[id] && !p.bot && <span className="faint"> · {L('не в сети', 'желіде емес', 'offline')}</span>}
              </div>
              <div className="pl-stats">
                <span title={L('Карт на руке', 'Қолдағы карталар', 'Cards in hand')}><Icon name="hand" size={14} /> {L('{n} карт', '{n} карта', p.resourceCount === 1 ? '{n} card' : '{n} cards', { n: p.resourceCount })}</span>
                <span title={L('Карт развития', 'Даму карталары', 'Development cards')}><Icon name="cards" size={14} /> {L('{n} разв.', '{n} даму', '{n} dev', { n: p.devCardCount })}</span>
                <span title={L('Самая длинная дорога', 'Ең ұзын жол', 'Longest road')}><Icon name="road" size={14} /> {L('{n} дор.', '{n} жол', p.roadLength === 1 ? '{n} road' : '{n} roads', { n: p.roadLength })}</span>
                <span title={L('Сыграно рыцарей', 'Ойналған рыцарьлар', 'Knights played')}><ArtIcon src={eraIcon(pack.id, 'dev-knight')} size={16} /> {p.knightsPlayed}</span>
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
        <small>{L('Новая карта', 'Жаңа карта', 'New card')}</small>
        <b>{info.name}</b>
        <span>{devRule(shown.type)}</span>
      </div>
    </div>
  );
}

/** «Твой ход»: короткая вспышка цвета игрока по краям экрана и плашка. */
/** Цвет надписи на цвете игрока: тёмная на светлых (белый, жёлтый), белая на остальных. */
function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return '#fff';
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#111' : '#fff';
}

function TurnBanner({ color }: { color: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 1700);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  return (
    <div className="turn-banner" style={{ ['--me' as string]: color, ['--me-ink' as string]: inkOn(color) }} aria-hidden>
      <div className="tb-edge" />
      <div className="tb-plate display">{L('Твой ход', 'Сенің жүрісің', 'Your turn')}</div>
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
          <small>{L('{n} предлагает', '{n} ұсынады', '{n} offers', { n: from.name })}</small>
          <span className="counter-line">
            <ResChips value={t.want} /> → <ResChips value={t.give} />
          </span>
        </span>
      </button>
      {mine ? (
        <span className="ib-answer faint">{mine.kind === 'accept' ? L('Ты согласен', 'Келістің', 'You agreed') : mine.kind === 'decline' ? L('Отказ', 'Бас тарттың', 'Declined') : L('Встречное', 'Қарсы ұсыныс', 'Counteroffer')}</span>
      ) : (
        <>
          <button className="btn small-act" disabled={busy} onClick={() => void send({ type: 'respondTrade', tradeId: t.id, kind: 'decline' })}>
            {L('Нет', 'Жоқ', 'No')}
          </button>
          <button className="btn primary small-act" disabled={busy || !can} onClick={() => void send({ type: 'respondTrade', tradeId: t.id, kind: 'accept' })}>
            {L('Да', 'Иә', 'Yes')}
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
  serverRoll: boolean;
  planCount: number;
  planBroken: number;
}) {
  const { pub, priv, me, myTurn, build, setBuild, busy, send, openSheet, countdown, attacking, cancelCountdown, physical } = props;
  const meP = pub.players[me];
  // После броска «Конец хода» встаёт на место кнопки броска: короткая пауза, чтобы случайное
  // второе касание не закончило ход.
  const [armed, setArmed] = useState(true);
  useEffect(() => {
    if (!myTurn || pub.phase !== 'main') return;
    setArmed(false);
    const t = setTimeout(() => setArmed(true), 900);
    return () => clearTimeout(t);
  }, [myTurn, pub.phase, pub.turn]);
  const playable = priv.devCards.filter((c) => c.playable && c.type !== 'victoryPoint').length;
  const canPlayNow = myTurn && (pub.phase === 'roll' || pub.phase === 'main') && !pub.devCardPlayed && playable > 0;
  const cardsBtn = (
    <button className={`btn ${canPlayNow ? 'glow' : ''}`} onClick={() => openSheet('dev')}>
      <Icon name="cards" /> {L('Карты', 'Карталар', 'Cards')}
      {priv.devCards.length > 0 && <span className={`cnt ${canPlayNow ? 'hot' : ''}`}>{priv.devCards.length}</span>}
    </button>
  );
  if (!myTurn || pub.phase === 'discard') {
    return (
      <div className="actions tools">
        <button className="tool" onClick={() => openSheet('plan')}>
          <Icon name="plan" />
          <small>{L('План', 'Жоспар', 'Plan')}</small>
          {props.planCount > 0 && <span className={`cnt dot ${props.planBroken ? 'bad' : ''}`}>{props.planBroken || props.planCount}</span>}
        </button>
        <button className="tool" onClick={() => openSheet(pub.trade && !myTurn ? 'incoming' : 'trade')}>
          <Icon name="trade" />
          <small>{L('Обмен', 'Алмасу', 'Trade')}</small>
          {pub.trade && <span className="cnt dot hot">1</span>}
        </button>
        <button className="tool" onClick={() => openSheet('dev')}>
          <Icon name="cards" />
          <small>{L('Карты', 'Карталар', 'Cards')}</small>
          {priv.devCards.length > 0 && <span className="cnt dot">{priv.devCards.length}</span>}
        </button>
        <button className="tool" onClick={() => openSheet('react')}>
          <Icon name="smile" />
          <small>{L('Реакция', 'Реакция', 'Reaction')}</small>
        </button>
      </div>
    );
  }

  switch (pub.phase) {
    case 'moveRobber':
      return <RobberHands pub={pub} me={me} />;
    case 'setup':
    case 'roadBuilding':
      return <p className="dock-note">{L('Нажми на светящееся место на карте', 'Картадағы жарқыраған орынды бас', 'Tap the glowing spot on the map')}</p>;
    case 'roll':
      // Автобросок у ведущего: кубики бросает сервер, кнопки нет совсем
      if (props.serverRoll) return <p className="dock-note">{attacking ? L('Идёт атака…', 'Шабуыл жүріп жатыр…', 'Attack in progress…') : L('Бросаем кубики…', 'Кубиктер лақтырылуда…', 'Rolling the dice…')}</p>;
      return (
        <div className="actions">
          {countdown !== null ? (
            <button className="btn primary big grow2" onClick={cancelCountdown}>
              <Icon name="dice" /> {L('Бросаю через {n}…', 'Лақтырамын: {n}…', 'Rolling in {n}…', { n: countdown })} <small>{L('стоп', 'тоқта', 'stop')}</small>
            </button>
          ) : (
            <button className="btn primary big grow2" disabled={busy || attacking} onClick={() => (physical ? openSheet('dice') : void send({ type: 'rollDice' }))}>
              <Icon name={attacking ? 'army' : 'dice'} /> {attacking ? L('Идёт атака…', 'Шабуыл жүріп жатыр…', 'Attack in progress…') : physical ? L('Ввести бросок', 'Лақтыруды енгізу', 'Enter the roll') : L('Бросить кубики', 'Кубиктерді лақтыру', 'Roll the dice')}
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
            <button className={`act ${build === 'road' ? 'on' : ''}`} disabled={!road && build !== 'road'} onClick={() => t('road')} aria-label={L('Дорога', 'Жол', 'Road')} title={L('Дорога', 'Жол', 'Road')}>
              <Icon name="road" className="i" size={24} />
              <Cost cost={COSTS.road} />
            </button>
            <button className={`act ${build === 'settlement' ? 'on' : ''}`} disabled={!settl && build !== 'settlement'} onClick={() => t('settlement')} aria-label={L('Поселение', 'Қоныс', 'Settlement')} title={L('Поселение', 'Қоныс', 'Settlement')}>
              <Icon name="house" className="i" size={24} />
              <Cost cost={COSTS.settlement} />
            </button>
            <button className={`act ${build === 'city' ? 'on' : ''}`} disabled={!city && build !== 'city'} onClick={() => t('city')} aria-label={L('Город', 'Қала', 'City')} title={L('Город', 'Қала', 'City')}>
              <Icon name="castle" className="i" size={24} />
              <Cost cost={COSTS.city} />
            </button>
            <button className="act" disabled={!dev || busy} onClick={() => void send({ type: 'buyDevCard' })} aria-label={L('Купить карту развития', 'Даму картасын сатып алу', 'Buy a development card')} title={L('Карта развития', 'Даму картасы', 'Development card')}>
              <Icon name="cards" className="i" size={24} />
              <Cost cost={COSTS.devCard} />
            </button>
          </div>
          <div className="actions">
            <button className="btn icon-only" onClick={() => openSheet('plan')} aria-label={L('План', 'Жоспар', 'Plan')}>
              <Icon name="plan" />
              {props.planCount > 0 && <span className={`cnt dot ${props.planBroken ? 'bad' : ''}`}>{props.planBroken || props.planCount}</span>}
            </button>
            <button className={`btn icon-only ${canPlayNow ? 'glow' : ''}`} onClick={() => openSheet('dev')} aria-label={L('Карты развития', 'Даму карталары', 'Development cards')}>
              <Icon name="cards" />
              {priv.devCards.length > 0 && <span className={`cnt dot ${canPlayNow ? 'hot' : ''}`}>{priv.devCards.length}</span>}
            </button>
            <button className="btn" onClick={() => openSheet('trade')}>
              <Icon name="trade" /> {L('Обмен', 'Алмасу', 'Trade')}{(pub.trades?.length ?? (pub.trade ? 1 : 0)) > 0 ? ` · ${pub.trades?.length ?? 1}` : ''}
            </button>
            <button className="btn primary" disabled={busy || !armed} onClick={() => void send({ type: 'endTurn' })}>
              {L('Конец хода', 'Жүрісті аяқтау', 'End turn')} <Icon name="next" />
            </button>
          </div>
        </>
      );
    }
    default:
      return null;
  }
}

const pieceNames = (): { road: string; settlement: string; city: string } => ({ road: L('дорога', 'жол', 'road'), settlement: L('поселение', 'қоныс', 'settlement'), city: L('город', 'қала', 'city') });
const shortName = (k: 'road' | 'settlement' | 'city') => pieceNames()[k];
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
          hint: L('Поставь дорогу к своему поселению', 'Өз қонысыңа жол сал', 'Build a road next to your settlement'),
          confirm: L('Поставить сюда?', 'Осында орнатамыз ба?', 'Place it here?'),
          action: (edge) => ({ type: 'buildRoad', edge }),
        };
      }
      return {
        kind: 'vertex',
        ids: legalSettlementVertices(pub, me, true),
        hint: pub.setup?.round === 2 ? L('Второе поселение — за него дадут ресурсы', 'Екінші қоныс — ол үшін ресурс береді', 'Second settlement — it gives you resources') : L('Поставь первое поселение', 'Бірінші қонысты орнат', 'Place your first settlement'),
        confirm: L('Поставить поселение сюда?', 'Қонысты осында орнатамыз ба?', 'Place the settlement here?'),
        action: (vertex) => ({ type: 'buildSettlement', vertex }),
      };
    case 'roadBuilding':
      return {
        kind: 'edge',
        ids: legalRoadEdges(pub, me),
        hint: L('Бесплатная дорога (осталось {n})', 'Тегін жол (қалды: {n})', 'Free road ({n} left)', { n: pub.roadBuildingLeft ?? 1 }),
        confirm: L('Поставить сюда?', 'Осында орнатамыз ба?', 'Place it here?'),
        action: (edge) => ({ type: 'buildRoad', edge }),
      };
    case 'moveRobber':
      return {
        kind: 'hex',
        ids: pub.board.hexes.filter((h) => h.id !== pub.robberHex).map((h) => h.id),
        hint: L('Куда отправить: {n}?', 'Қайда жібереміз: {n}?', 'Where to send: {n}?', { n: ROBBER.name }),
        confirm: L('Сюда?', 'Осында ма?', 'Here?'),
        action: (hex, victim) => ({ type: 'moveRobber', hex, ...(victim ? { victim } : {}) }),
      };
    case 'main':
      if (mode === 'road')
        return { kind: 'edge', ids: legalRoadEdges(pub, me), hint: L('Где строим дорогу?', 'Жолды қайда саламыз?', 'Where to build the road?'), confirm: L('Построить дорогу?', 'Жол саламыз ба?', 'Build the road?'), action: (edge) => ({ type: 'buildRoad', edge }) };
      if (mode === 'settlement')
        return {
          kind: 'vertex',
          ids: legalSettlementVertices(pub, me),
          hint: L('Где строим поселение?', 'Қонысты қайда саламыз?', 'Where to build the settlement?'),
          confirm: L('Построить поселение?', 'Қоныс саламыз ба?', 'Build the settlement?'),
          action: (vertex) => ({ type: 'buildSettlement', vertex }),
        };
      if (mode === 'city')
        return {
          kind: 'vertex',
          ids: legalCityVertices(pub, me),
          hint: L('Какое поселение станет городом?', 'Қай қоныс қалаға айналады?', 'Which settlement becomes a city?'),
          confirm: L('Построить город?', 'Қала саламыз ба?', 'Build the city?'),
          action: (vertex) => ({ type: 'buildCity', vertex }),
        };
      return null;
    default:
      return null;
  }
}

/** Фаза разбойника: кому есть что терять — карты на руках у соперников. */
function RobberHands({ pub, me }: { pub: PublicState; me: PlayerId }) {
  const others = pub.order.filter((id) => id !== me);
  return (
    <div className="rob-dock">
      <p className="dock-note">{L('Выбери гекс соседа — заберёшь у него случайную карту', 'Көршінің гексін таңда — одан кездейсоқ карта аласың', "Pick a neighbor's hex — you will take a random card from them")}</p>
      <div className="rob-hands">
        {others.map((id) => {
          const p = pub.players[id];
          return (
            <span key={id} className={`rob-h ${p.resourceCount === 0 ? 'empty' : ''}`}>
              <i style={{ background: PLAYER_HEX[p.color] }}>{p.name.charAt(0).toUpperCase()}</i>
              <b>{p.name}</b>
              <small>
                <Icon name="hand" size={13} /> {p.resourceCount}
              </small>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Выбран гекс: у кого забрать карту (видно, сколько карт на руке; у кого пусто — нельзя). */
function RobberPick({ pub, me, hex, busy, onCancel, onGo }: { pub: PublicState; me: PlayerId; hex: string; busy: boolean; onCancel: () => void; onGo: (victim?: PlayerId) => void }) {
  const near = playersAtHex(pub, hex, me);
  const withCards = near.filter((id) => pub.players[id].resourceCount > 0);
  return (
    <div className="rob-pick glass strong" role="dialog" aria-label={L('Кого грабить', 'Кімді тонау', 'Who to rob')}>
      <b className="rp-title">{withCards.length ? L('У кого забрать карту?', 'Кімнен карта аласың?', 'Take a card from whom?') : near.length ? L('Здесь у соседей пусто на руках', 'Мұндағы көршілердің қолы бос', 'The neighbors here have empty hands') : L('Рядом никого — украсть не у кого', 'Маңайда ешкім жоқ — ұрлайтын адам жоқ', 'No one nearby — nobody to steal from')}</b>
      {near.length > 0 && (
        <div className="rp-list">
          {near.map((id) => {
            const p = pub.players[id];
            const n = p.resourceCount;
            return (
              <button key={id} className="rp-v" disabled={busy || n === 0} onClick={() => onGo(id)}>
                <i style={{ background: PLAYER_HEX[p.color] }}>{p.name.charAt(0).toUpperCase()}</i>
                <span className="rp-name">{p.name}</span>
                <span className="rp-n">{n === 0 ? L('нет карт', 'карта жоқ', 'no cards') : pick(`${n} ${plural(n, 'карта', 'карты', 'карт')}`, `${n} карта`, `${n} ${n === 1 ? 'card' : 'cards'}`)}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="rp-btns">
        <button className="btn" onClick={onCancel}>
          {L('Другой гекс', 'Басқа гекс', 'Another hex')}
        </button>
        {withCards.length === 0 && (
          <button className="btn primary" disabled={busy} onClick={() => onGo(undefined)}>
            {L('Всё равно сюда', 'Бәрібір осында', 'Here anyway')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Итог кражи крупно: вор — что взял, жертва — что потеряла, остальные — кто у кого. Касание закрывает. */
function StealReveal({ ev, pub, me }: { ev?: { thief: PlayerId; victim: PlayerId; resource?: Resource; key: number }; pub: PublicState; me: PlayerId }) {
  const [shown, setShown] = useState<typeof ev>(undefined);
  useEffect(() => {
    if (!ev) return;
    setShown(ev);
    const t = setTimeout(() => setShown(undefined), 4500);
    return () => clearTimeout(t);
  }, [ev?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null;
  const thief = pub.players[shown.thief]?.name ?? '?';
  const victim = pub.players[shown.victim]?.name ?? '?';
  const res = shown.resource;
  const role = me === shown.thief ? 'won' : me === shown.victim ? 'lost' : 'saw';
  const resName = res ? RESOURCE_NAME[res].charAt(0).toUpperCase() + RESOURCE_NAME[res].slice(1) : '';
  return (
    <div key={shown.key} className={`steal-pop dock-pop ${role}`} role="alert">
      <button className="sp-card glass strong" onClick={() => setShown(undefined)} aria-label={L('Закрыть', 'Жабу', 'Close')}>
        <span className="sp-art">{role !== 'saw' && res ? <ResIcon r={res} size={60} /> : <Icon name="cards" size={34} />}</span>
        <span className="sp-txt">
          <span className="sp-kicker">{role === 'won' ? L('Добыча', 'Олжа', 'Loot') : role === 'lost' ? L('У тебя забрали', 'Сенен алды', 'Taken from you') : L('Кража', 'Ұрлық', 'Theft')}</span>
          <b className="sp-title">{role === 'won' ? `+1 ${resName}` : role === 'lost' ? `−1 ${resName}` : L('{n} забирает карту', '{n} карта алады', '{n} takes a card', { n: thief })}</b>
          <small className="sp-sub">{role === 'won' ? L('у игрока {n}', '{n} ойыншыдан', 'from {n}', { n: victim }) : role === 'lost' ? L('забрал {n}', '{n} алды', 'taken by {n}', { n: thief }) : L('у игрока {n}', '{n} ойыншыдан', 'from {n}', { n: victim })}</small>
        </span>
      </button>
    </div>
  );
}

/** Купил карту развития — показать, какая выпала и что она делает (раньше было не видно). */
function DevCardReveal({ cards, pack }: { cards: PrivateView['devCards']; pack: LorePack }) {
  const prev = useRef(cards.length);
  const [shown, setShown] = useState<{ type: DevCardType; key: number } | null>(null);
  useEffect(() => {
    const was = prev.current;
    prev.current = cards.length;
    if (cards.length <= was) return;
    const fresh = [...cards].reverse().find((c) => c.isNew) ?? cards[cards.length - 1];
    if (!fresh) return;
    sfx.play('chime');
    setShown({ type: fresh.type, key: Date.now() });
    const t = setTimeout(() => setShown(null), 5000);
    return () => clearTimeout(t);
  }, [cards.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null;
  return (
    <div key={shown.key} className="steal-pop won dev" role="alert" onClick={() => setShown(null)}>
      <div className="sp-card glass strong">
        <span className="sp-kicker">{L('Новая карта', 'Жаңа карта', 'New card')}</span>
        <span className="sp-art">
          <ArtIcon src={eraIcon(pack.id, `dev-${shown.type}`)} size={104} />
        </span>
        <b className="sp-title">{pack.devCards[shown.type].name}</b>
        <small className="sp-sub">{devRule(shown.type)}</small>
        {shown.type !== 'victoryPoint' && <small className="sp-sub faint">{L('Сыграть можно со следующего хода — «Карты» в доке', 'Келесі жүрістен бастап ойнауға болады — доктағы «Карталар»', 'Playable from the next turn — "Cards" in the dock')}</small>}
      </div>
    </div>
  );
}

const devRule = (t: DevCardType): string =>
  ({
    knight: L('Переставь разбойника и забери карту у соседа. Три сыгранные — бонус +2 очка.', 'Қарақшыны ауыстырып, көршіңнен карта ал. Үш ойналған карта — +2 ұпай бонус.', 'Move the robber and take a card from a neighbor. Three played — a +2 point bonus.'),
    roadBuilding: L('Две дороги бесплатно.', 'Екі жол тегін.', 'Two roads for free.'),
    yearOfPlenty: L('Возьми из банка любые два ресурса.', 'Банктен кез келген екі ресурс ал.', 'Take any two resources from the bank.'),
    monopoly: L('Назови ресурс — все отдают тебе его целиком.', 'Ресурсты ата — бәрі оны толықтай саған береді.', 'Name a resource — everyone gives you all of it.'),
    victoryPoint: L('Тайное +1 очко. Играть не нужно — считается само.', 'Құпия +1 ұпай. Ойнаудың қажеті жоқ — өзі есептеледі.', 'A secret +1 point. No need to play it — it counts on its own.'),
  })[t];
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
        <p className="muted">{L('Карт пока нет.', 'Әзірге карта жоқ.', 'No cards yet.')}</p>
        <p className="faint small row" style={{ justifyContent: 'center' }}>
          {L('Купить в свой ход:', 'Өз жүрісіңде сатып ал:', 'Buy on your turn:')} <Cost cost={COSTS.devCard} />
        </p>
      </div>
    );
  const groups = DEV_ORDER.map((t) => {
    const cards = priv.devCards.filter((c) => c.type === t);
    return { t, n: cards.length, ready: cards.some((c) => c.playable) };
  }).filter((g) => g.n > 0);
  return (
    <div className="list">
      {played && <p className="faint small center">{L('В этот ход карта уже сыграна — следующая в следующий ход.', 'Бұл жүрісте карта ойналып қойды — келесісі келесі жүрісте.', 'A card was already played this turn — the next one next turn.')}</p>}
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
              <div className="dc-rule">{devRule(t)}</div>
              <div className="dc-flavor">{info.flavor}</div>
              {t !== 'victoryPoint' && (
                <button className="btn primary dc-btn" disabled={!usable || busy} onClick={() => onPlay(t)}>
                  {ready ? (canPlay ? L('Сыграть', 'Ойнау', 'Play') : L('Сыграть можно в свой ход', 'Өз жүрісіңде ойнауға болады', 'Playable on your turn')) : L('Куплена в этот ход — со следующего', 'Осы жүрісте сатып алынған — келесіден бастап', 'Bought this turn — playable from the next')}
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
      <div className="picked-row">{picked.length ? picked.map((r, i) => <ResIcon key={i} r={r} size={48} />) : <span className="faint">{L('выбери два', 'екеуін таңда', 'pick two')}</span>}</div>
      <button className="btn primary wide" disabled={picked.length !== 2 || busy} onClick={() => onDone(picked as [Resource, Resource])}>
        {L('Взять', 'Алу', 'Take')}
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
        {L('Сбросить {n}/{m}', 'Тастау {n}/{m}', 'Discard {n}/{m}', { n, m: priv.mustDiscard })}
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
      <div className="label">{L('Первый кубик', 'Бірінші кубик', 'First die')}</div>
      {row('a', a)}
      <div className="label">{L('Второй кубик', 'Екінші кубик', 'Second die')}</div>
      {row('b', b)}
      <div className={`dice-total display ${a && b && a + b === 7 ? 'seven' : ''}`}>{a && b ? a + b : '—'}</div>
      <button className="btn primary big wide" disabled={!a || !b || busy || !canRoll} onClick={() => onDone([a!, b!])}>
        {L('Готово', 'Дайын', 'Done')}
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
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [give, setGive] = useState<Resource | null>(null);
  const [offerGive, setOfferGive] = useState<ResourceMap>(emptyResources());
  const [offerWant, setOfferWant] = useState<ResourceMap>(emptyResources());

  if (adding === 'bank') {
    return (
      <div className="stack">
        <HandMini hand={priv.resources} />
        <div className="label">{L('Отдаю банку', 'Банкке беремін', 'I give the bank')}</div>
        <ResourcePicker selected={give} sub={(r) => `${priv.tradeRatios[r]}:1`} onPick={setGive} />
        <div className="label">{L('Получаю', 'Аламын', 'I get')}</div>
        <ResourcePicker
          disabled={(r) => !give || r === give}
          onPick={(r) => {
            setPlan([...plan, { id: newStepId(), kind: 'bank', give: give!, receive: r }]);
            setAdding(null);
            setGive(null);
          }}
        />
        <button className="btn ghost wide" onClick={() => setAdding(null)}>
          {L('Назад', 'Артқа', 'Back')}
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
            {L('Назад', 'Артқа', 'Back')}
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
            {L('В план', 'Жоспарға', 'To plan')}
          </button>
        </div>
      </div>
    );
  }

  const units = planUnits(checked);
  const sorted = units.length > 1 ? smartOrder(plan, pub, priv, me ?? '') : null;
  const ready = units.filter((u) => u.status === 'ready').length;
  const missing: Partial<ResourceMap> = {};
  for (const c of checked) if (c.status === 'short' && c.missing) for (const r of RESOURCES) missing[r] = (missing[r] ?? 0) + (c.missing[r] ?? 0);
  const points = plan.filter((s) => s.kind === 'settlement' || s.kind === 'city').length;
  const brokenN = units.filter((u) => u.status === 'broken').length;

  return (
    <div className="stack">
      {me && <IncomeStrip pub={pub} pid={me} label={L('Твой доход по числам', 'Сандар бойынша табысың', 'Your income by number')} />}
      {checked.length > 0 ? (
        <div className={`plan-sum ${brokenN ? 'bad' : ready === checked.length ? 'good' : ''}`}>
          <div className="ps-main">
            <b>
              {L('Готово {a} из {b}', 'Дайын: {a} / {b}', '{a} of {b} ready', { a: ready, b: units.length })}
            </b>
            {points > 0 && <span className="ps-vp">{L('+{n} очк.', '+{n} ұпай', '+{n} pts', { n: points })}</span>}
          </div>
          {brokenN > 0 && <div className="ps-line">{L('Сломалось шагов: {n} — кто-то занял место. Убери или замени.', 'Бұзылған қадамдар: {n} — біреу орынды басып алды. Алып таста немесе ауыстыр.', 'Broken steps: {n} — someone took the spot. Remove or replace.', { n: brokenN })}</div>}
          {Object.keys(missing).length > 0 && (
            <div className="ps-line">
              {L('Не хватает:', 'Жетіспейді:', 'Missing:')} <ResChips value={missing} />
            </div>
          )}
        </div>
      ) : (
        <p className="muted small">{L('Пусто. Добавь стройку — план перепроверяется после каждого чужого хода.', 'Бос. Құрылыс қос — жоспар әр басқа ойыншының жүрісінен кейін қайта тексеріледі.', "Empty. Add a build — the plan is rechecked after every other player's move.")}</p>
      )}

      {units.length > 0 && (
        <ol className="plan-steps">
          {units.map((u, i) => {
            const c = u.main;
            const at = 'at' in c.step ? (c.step as { at: string }).at : undefined;
            const open = openUnit === c.step.id;
            return (
              <li key={c.step.id} className={`pstep ${u.status}`}>
                <div className="pstep-row">
                  <span className="pstep-ic">
                    <Icon name={STEP_ICON[c.step.kind]} size={20} />
                  </span>
                  <div
                    className={`pstep-body ${at && onShow ? 'tappable' : ''}`}
                    role={at && onShow ? 'button' : undefined}
                    onClick={at && onShow ? () => onShow(at) : undefined}
                  >
                    <b>
                      <span className="pstep-n">{i + 1}</span>
                      {STEP_LABEL[c.step.kind]}
                    </b>
                    <span className="pstep-st">
                      {u.status === 'ready' && (c.step.kind === 'bank' || c.step.kind === 'offer' ? <StepTerms step={c.step} /> : L('готово', 'дайын', 'ready'))}
                      {u.status === 'short' && (
                        <>
                          {L('не хватает', 'жетіспейді', 'missing')} <ResChips value={u.missing} />
                        </>
                      )}
                      {u.status === 'broken' && (u.reason ?? L('место занято', 'орын бос емес', 'spot taken'))}
                    </span>
                  </div>
                  <div className="pstep-ctl">
                    <button className="pstep-btn" aria-label={L('Выше', 'Жоғары', 'Move up')} disabled={i === 0} onClick={() => setPlan(moveUnit(units, i, i - 1))}>
                      <Icon name="up" size={16} />
                    </button>
                    <button className="pstep-btn" aria-label={L('Убрать', 'Алып тастау', 'Remove')} onClick={() => setPlan(removeUnit(plan, u))}>
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                </div>
                {u.roads.length > 0 && (
                  <button className="pstep-sub-toggle" aria-expanded={open} onClick={() => setOpenUnit(open ? null : c.step.id)}>
                    <Icon name="road" size={14} />
                    <span className="grow">
                      {pick(u.roads.length === 1 ? '+1 дорога к нему' : `+${u.roads.length} дороги к нему`, `+${u.roads.length} жол оған`, `+${u.roads.length} ${u.roads.length === 1 ? 'road' : 'roads'} to it`)}
                    </span>
                    <Icon name={open ? 'less' : 'down'} size={14} />
                  </button>
                )}
                {open && u.roads.length > 0 && (
                  <ul className="pstep-sub">
                    {u.roads.map((rd, k) => (
                      <li
                        key={rd.step.id}
                        className={`pstep-subrow ${rd.status}`}
                        role={onShow ? 'button' : undefined}
                        onClick={onShow ? () => onShow((rd.step as { at: string }).at) : undefined}
                      >
                        <span>{L('Дорога {n}', 'Жол {n}', 'Road {n}', { n: k + 1 })}</span>
                        <span className="pstep-st">
                          {rd.status === 'ready' && L('готово', 'дайын', 'ready')}
                          {rd.status === 'short' && (
                            <>
                              {L('не хватает', 'жетіспейді', 'missing')} <ResChips value={rd.missing ?? {}} />
                            </>
                          )}
                          {rd.status === 'broken' && (rd.reason ?? L('место занято', 'орын бос емес', 'spot taken'))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {sorted && (
        <button className="btn ghost wide" onClick={() => setPlan(sorted)}>
          <Icon name="sort" size={18} /> {L('Упорядочить: сначала то, на что хватает', 'Реттеу: алдымен жететіндері', 'Sort: affordable first')}
        </button>
      )}

      <div className="label">{L('Добавить шаг', 'Қадам қосу', 'Add a step')}</div>
      <div className="plan-add">
        <button className="act" onClick={() => onPick('road')}>
          <span className="act-top"><Icon name="road" size={18} /> {L('Дорога', 'Жол', 'Road')}</span>
          <Cost cost={COSTS.road} />
        </button>
        <button className="act" onClick={() => onPick('settlement')}>
          <span className="act-top"><Icon name="house" size={18} /> {L('Поселение', 'Қоныс', 'Settlement')}</span>
          <Cost cost={COSTS.settlement} />
        </button>
        <button className="act" onClick={() => onPick('city')}>
          <span className="act-top"><Icon name="castle" size={18} /> {L('Город', 'Қала', 'City')}</span>
          <Cost cost={COSTS.city} />
        </button>
        <button className="act" disabled={pub.devDeckCount <= 0} onClick={() => setPlan([...plan, { id: newStepId(), kind: 'devCard' }])}>
          <span className="act-top"><Icon name="cards" size={18} /> {L('Карта', 'Карта', 'Card')}</span>
          <Cost cost={COSTS.devCard} />
        </button>
        <button className="act" onClick={() => setAdding('bank')}>
          <span className="act-top"><Icon name="bank" size={18} /> {L('Банк', 'Банк', 'Bank')}</span>
          <small className="faint">{L('курс {n}:1', 'бағам {n}:1', 'rate {n}:1', { n: Math.min(...RESOURCES.map((r) => priv.tradeRatios[r])) })}</small>
        </button>
        <button className="act" onClick={() => setAdding('offer')}>
          <span className="act-top"><Icon name="trade" size={18} /> {L('Обмен', 'Алмасу', 'Trade')}</span>
          <small className="faint">{L('игрокам', 'ойыншыларға', 'players')}</small>
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
            {L('Очистить', 'Тазалау', 'Clear')}
          </button>
          <button className="btn primary grow" disabled={!canRun || busy || checked[0].status !== 'ready'} onClick={onRun}>
            <Icon name="play" /> {L('Выполнить', 'Орындау', 'Run')}
          </button>
        </div>
      )}
      {!canRun && checked.length > 0 && <p className="faint small center">{L('Выполнить можно в свой ход после броска', 'Өз жүрісіңде кубик тасталған соң орындауға болады', 'You can run it on your turn after the roll')}</p>}

      {onLog && (
        <button className="log-open" onClick={onLog}>
          <Icon name="book" size={18} />
          <span className="grow">{L('Журнал партии', 'Ойын журналы', 'Game log')}</span>
          <small>{logCount}</small>
          <Icon name="next" size={16} />
        </button>
      )}
    </div>
  );
}

/** Журнал партии: кто что сделал, с разделителями по ходам; новое — сверху. */
function GameLogList({ log, pub }: { log: LogEntry[]; pub: PublicState }) {
  if (log.length === 0) return <p className="muted small">{L('Пока пусто — события появятся по ходу партии.', 'Әзірге бос — оқиғалар ойын барысында пайда болады.', 'Empty for now — events will appear as the game goes on.')}</p>;
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


function HostTools({ room, pub, onKick }: { room: RoomView; pub: PublicState; onKick: () => void }) {
  if (pub.phase === 'finished') return null;
  return (
    <div className="stack">
      <TurnSettings settings={room.settings} editable />
      <button className="btn wide" disabled={!!room.paused} onClick={() => void conn.host({ type: 'skipTurn' })}>
        <Icon name="skip" /> {L('Пропустить ход {n}', '{n} жүрісін өткізу', "Skip {n}'s turn", { n: pub.players[pub.order[pub.current]].name })}
      </button>
      <button className="item" onClick={onKick}>
        <Icon name="ban" />
        <span className="grow t">{L('Заменить игрока ботом', 'Ойыншыны ботпен ауыстыру', 'Replace a player with a bot')}</span>
        <Icon name="next" size={16} />
      </button>
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
        <h2 className="display">{winner === me ? L('Ты победил!', 'Сен жеңдің!', 'You won!') : L('Победа: {n}', 'Жеңімпаз: {n}', 'Winner: {n}', { n: pub.players[winner].name })}</h2>
        <p className="muted">{pack.victory.replace('{player}', pub.players[winner].name)}</p>
        {prof && (
          <div className="fin-prof">
            <span>
              <b>{prof.rating}</b> {L('рейтинг', 'рейтинг', 'rating')}
            </span>
            <span>
              <b>{prof.streak}</b> {L('дн. подряд', 'күн қатарынан', 'day streak')}
            </span>
            <span>
              <b>{prof.games}</b> {L('партий', 'ойын', 'games')}
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
        <button className="btn primary wide fin-home" onClick={() => conn.forget()}>
          {L('На главную', 'Басты бетке', 'Home')}
        </button>
      </div>
    </div>
  );
}

/** Ползунки вида карты: размер и густота объектов на гексах, размер жетонов. Сохраняются на этом устройстве. */
function LookSliders() {
  const look = useBoardLook();
  const rows: { key: 'decor' | 'density' | 'tokens'; label: string; min: number; max: number }[] = [
    { key: 'decor', label: L('Размер деревьев, гор, овец', 'Ағаштар, таулар, қойлар өлшемі', 'Size of trees, mountains, sheep'), min: 0.5, max: 1.3 },
    { key: 'density', label: L('Сколько объектов на гексах', 'Гекстегі нысандар саны', 'Objects per hex'), min: 0.3, max: 1 },
    { key: 'tokens', label: L('Размер жетонов с числами', 'Сан жетондарының өлшемі', 'Number token size'), min: 0.6, max: 1.4 },
  ];
  const changed = rows.some((r) => look[r.key] !== LOOK_DEFAULT[r.key]);
  return (
    <div className="look-sliders">
      {rows.map((r) => (
        <label key={r.key} className="look-row">
          <span className="look-l">
            {r.label} <b>{Math.round(look[r.key] * 100)}%</b>
          </span>
          <input type="range" min={r.min} max={r.max} step={0.05} value={look[r.key]} onChange={(e) => setBoardLook({ [r.key]: Number(e.target.value) })} />
        </label>
      ))}
      {changed && (
        <button className="btn ghost small-act" onClick={() => setBoardLook(LOOK_DEFAULT)}>
          {L('Как было', 'Бастапқыдай', 'Reset')}
        </button>
      )}
    </div>
  );
}
