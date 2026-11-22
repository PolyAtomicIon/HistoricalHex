// Интерактивное обучение для новичков: настоящая карта и кнопки как в партии, учебный ход по шагам.
// Каждый шаг ждёт действия игрока (нажать гекс, угол, кнопку) — как обучение в онлайн-играх.
// Партия локальная: сервер не нужен, проверки ходов — те же функции движка, что и в игре.

import { useMemo, useRef, useState } from 'react';
import type { EdgeId, HexId, PlayerColor, PlayerId, Resource, ResourceMap, VertexId } from '../../engine';
import {
  COSTS,
  RESOURCES,
  TERRAIN_RESOURCE,
  canBuildSettlement,
  generateBoard,
  legalCityVertices,
  legalRoadEdges,
  legalSettlementVertices,
  seededRng,
  topologyFor,
} from '../../engine';
import type { Building } from '../../engine';
import { Board2D } from '../../board2d/Board2D';
import { currentEra } from '../era';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { ResIcon } from '../ResIcon';
import { RES_COLOR } from '../widgets';
import { haptic, sfx } from '../../fx';
import { LANGS, markTutorialDone, t3, useLang } from './lang';
import { RES_NAME, STEPS, STEP_ORDER, TERRAIN_NAME, UI, WRONG, fill, type StepId } from './tutorialText';
import './tutorial.css';

type Pid = 'me' | 'bot';
type Btn = 'roll' | 'road' | 'house' | 'city' | 'trade' | 'card' | 'end';
const COLORS: Record<PlayerId, PlayerColor> = { me: 'red', bot: 'blue' };
const pips = (n?: number) => (n ? 6 - Math.abs(7 - n) : 0);
const empty = (): ResourceMap => ({ brick: 0, wood: 0, sheep: 0, wheat: 0, ore: 0 });

interface World {
  buildings: Record<VertexId, Building>;
  roads: Record<EdgeId, PlayerId>;
  robberHex: HexId;
  hand: ResourceMap;
}

/** Какая кнопка нужна на шаге. */
const NEED_BTN: Partial<Record<StepId, Btn>> = {
  roll: 'roll',
  buildRoad: 'road',
  buildHouse: 'house',
  buildCity: 'city',
  seven: 'roll',
  trade: 'trade',
  dev: 'card',
  end: 'end',
};

export function Tutorial({ onClose, onRules }: { onClose: () => void; onRules?: () => void }) {
  const [lang, setLang] = useLang();
  const L = (t: Parameters<typeof t3>[0]) => t3(t, lang);
  const board = useMemo(() => generateBoard('standard', seededRng(20261122)), []);
  const topo = topologyFor('standard');
  const hexOf = useMemo(() => new Map(board.board.hexes.map((h) => [h.id, h])), [board]);
  const score = (v: VertexId) => (topo.vertices.get(v)?.hexes ?? []).reduce((a, h) => a + pips(hexOf.get(h)?.number), 0);

  // Соперник заранее ставит два дома с дорогами — чтобы на карте было с кем соседствовать.
  const [w, setW] = useState<World>(() => {
    const buildings: World['buildings'] = {};
    const roads: World['roads'] = {};
    const view = { board: board.board, buildings, roads, robberHex: board.robberHex };
    for (let i = 0; i < 2; i++) {
      const spots = legalSettlementVertices(view, 'bot', true).sort((a, b) => score(b) - score(a));
      const v = spots[i * 3] ?? spots[0];
      buildings[v] = { owner: 'bot', kind: 'settlement' };
      roads[topo.vertices.get(v)!.edges[0]] = 'bot';
    }
    return { buildings, roads, robberHex: board.robberHex, hand: empty() };
  });
  const view = { board: board.board, buildings: w.buildings, roads: w.roads, robberHex: w.robberHex };

  const [step, setStep] = useState<StepId>('intro');
  const idx = STEP_ORDER.indexOf(step);
  const [armed, setArmed] = useState<Btn | null>(null); // нажата кнопка стройки — ждём место на карте
  const [note, setNote] = useState<{ text: string; ok: boolean; key: number } | null>(null);
  const [doneStep, setDoneStep] = useState<StepId | null>(null); // шаг выполнен, ждём «Дальше»
  const [flash, setFlash] = useState<{ hexes: HexId[]; key: number } | undefined>();
  const [dice, setDice] = useState<{ a: number; b: number; key: number } | null>(null);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const firstHome = useRef<VertexId | null>(null);
  const [hint, setHint] = useState(false); // после ошибки подсвечиваем правильные гексы
  const k = useRef(1);

  const say = (text: string, ok: boolean) => {
    setNote({ text, ok, key: k.current++ });
    haptic(ok ? 'success' : 'tap');
    if (ok) sfx.play('pop');
  };
  const complete = (text?: string) => {
    setDoneStep(step);
    setArmed(null);
    if (text) say(text, true);
    else setNote(null);
  };
  const go = (next?: StepId) => {
    const n = next ?? STEP_ORDER[idx + 1];
    if (!n) return;
    setStep(n);
    setDoneStep(null);
    setNote(null);
    setArmed(null);
    setHint(false);
    if (n !== 'robber') setDice(null); // кубики с семёркой остаются на шаге с захватчиками
    sfx.play('tick');
    if (n === 'setupRest') finishSetup();
    if (n === 'buildRoad') topUp(COSTS.road);
    if (n === 'buildHouse') {
      topUp(COSTS.settlement);
      ensureHouseSpot();
    }
    if (n === 'buildCity') topUp(COSTS.city);
    if (n === 'trade') topUp({ ...empty(), wood: 4 });
    if (n === 'dev') topUp(COSTS.devCard);
  };

  /** Перечень ресурсов словами: «1 кирпич, 2 зерно». */
  const list = (m: Partial<ResourceMap>) =>
    RESOURCES.filter((r) => (m[r] ?? 0) > 0)
      .map((r) => `${m[r]} ${RES_NAME[lang][r]}`)
      .join(', ');
  /** Для урока подкладываем недостающие ресурсы — новичок не должен застрять. И честно говорим об этом. */
  const topUp = (cost: ResourceMap) => {
    const add: Partial<ResourceMap> = {};
    for (const r of RESOURCES) if (cost[r] > w.hand[r]) add[r] = cost[r] - w.hand[r];
    setW((s) => {
      const hand = { ...s.hand };
      for (const r of RESOURCES) hand[r] = Math.max(hand[r], cost[r]);
      return { ...s, hand };
    });
    if (Object.keys(add).length) setTimeout(() => setNote({ text: `${L(UI.gift)}: ${list(add)}`, ok: true, key: k.current++ }), 0);
  };
  const spent = (cost: ResourceMap) => `${L(UI.spent)}: ${list(cost)}.`;
  const pay = (s: World, cost: ResourceMap): ResourceMap => {
    const hand = { ...s.hand };
    for (const r of RESOURCES) hand[r] = Math.max(0, hand[r] - cost[r]);
    return hand;
  };

  /** Второй дом и дорога ставятся за игрока; за второй дом — стартовые ресурсы. */
  function finishSetup() {
    setW((s) => {
      const v0 = { board: board.board, buildings: s.buildings, roads: s.roads, robberHex: s.robberHex };
      const spot = legalSettlementVertices(v0, 'me', true).sort((a, b) => score(b) - score(a))[2];
      if (!spot) return s;
      const buildings = { ...s.buildings, [spot]: { owner: 'me', kind: 'settlement' } as Building };
      const free = topo.vertices.get(spot)!.edges.find((e) => !s.roads[e]);
      const roads = free ? { ...s.roads, [free]: 'me' } : s.roads;
      const hand = { ...s.hand };
      for (const h of topo.vertices.get(spot)!.hexes) {
        const t = hexOf.get(h)?.terrain;
        if (t && t !== 'desert') hand[TERRAIN_RESOURCE[t]]++;
      }
      return { ...s, buildings, roads, hand };
    });
    setDoneStep('setupRest');
  }

  /** Если у своей дороги нет места под дом — достраиваем дорогу (правило расстояния). */
  function ensureHouseSpot() {
    setW((s) => {
      const v0 = { board: board.board, buildings: s.buildings, roads: s.roads, robberHex: s.robberHex };
      if (legalSettlementVertices(v0, 'me').length) return s;
      const roads = { ...s.roads };
      for (let depth = 0; depth < 3; depth++) {
        for (const [eid, owner] of Object.entries(roads)) {
          if (owner !== 'me') continue;
          for (const u of topo.edges.get(eid)!.vertices) {
            if (s.buildings[u] && s.buildings[u].owner !== 'me') continue;
            for (const e of topo.vertices.get(u)!.edges) {
              if (roads[e]) continue;
              const test = { ...roads, [e]: 'me' };
              const other = topo.edges.get(e)!.vertices.find((x) => x !== u)!;
              if (canBuildSettlement({ board: board.board, buildings: s.buildings, roads: test }, 'me', other)) return { ...s, roads: test };
            }
          }
        }
        // ни одна дорога в один шаг не помогла — удлиняем на один отрезок и пробуем снова
        const grow = Object.entries(roads).find(([, o]) => o === 'me');
        if (!grow) break;
        const u = topo.edges.get(grow[0])!.vertices.find((x) => !s.buildings[x]);
        const e = u && topo.vertices.get(u)!.edges.find((x) => !roads[x]);
        if (e) roads[e] = 'me';
      }
      return { ...s, roads };
    });
  }

  // ─── что подсвечено на карте ───
  const highlight = useMemo(() => {
    const land = board.board.hexes.filter((h) => h.terrain !== 'desert').map((h) => h.id);
    if (doneStep === step) return undefined;
    switch (step) {
      case 'hexes':
        return { hexes: hint ? board.board.hexes.filter((h) => h.terrain === 'forest').map((h) => h.id) : land };
      case 'numbers':
        return { hexes: hint ? board.board.hexes.filter((h) => h.number === 6 || h.number === 8).map((h) => h.id) : land };
      case 'settle':
        // новичку — не 25 кружков, а 4 лучших места
        return { vertices: legalSettlementVertices(view, 'me', true).sort((a, b) => score(b) - score(a)).slice(0, 4) };
      case 'road':
        return { edges: firstHome.current ? legalRoadEdges(view, 'me', firstHome.current) : [] };
      case 'buildRoad':
        return armed === 'road' ? { edges: legalRoadEdges(view, 'me') } : undefined;
      case 'buildHouse':
        return armed === 'house' ? { vertices: legalSettlementVertices(view, 'me') } : undefined;
      case 'buildCity':
        return armed === 'city' ? { vertices: legalCityVertices(view, 'me') } : undefined;
      case 'robber': {
        const near = new Set<HexId>();
        for (const [v, b] of Object.entries(w.buildings)) if (b.owner === 'bot') for (const h of topo.vertices.get(v)!.hexes) near.add(h);
        return { hexes: [...near].filter((h) => h !== w.robberHex && hexOf.get(h)?.terrain !== 'desert') };
      }
      default:
        return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, doneStep, armed, w, hint]);

  // ─── нажатия на карту ───
  const onHex = (h: HexId) => {
    const hex = hexOf.get(h);
    if (!hex || doneStep === step) return;
    if (step === 'hexes') {
      if (hex.terrain === 'forest') return complete(L(STEPS.hexes.done!));
      const res = hex.terrain === 'desert' ? '—' : RES_NAME[lang][TERRAIN_RESOURCE[hex.terrain]];
      setHint(true);
      return say(fill(L(WRONG.hex), { terrain: TERRAIN_NAME[lang][hex.terrain], res }), false);
    }
    if (step === 'numbers') {
      if (hex.number === 6 || hex.number === 8) return complete(L(STEPS.numbers.done!));
      setHint(true);
      return say(fill(L(WRONG.number), { n: hex.number ?? '—' }), false);
    }
    if (step === 'robber') {
      const res = RESOURCES[(h.length + w.hand.ore) % RESOURCES.length] as Resource;
      setW((s) => ({ ...s, robberHex: h, hand: { ...s.hand, [res]: s.hand[res] + 1 } }));
      sfx.play('steal');
      return complete(fill(L(STEPS.robber.done!), { name: L(UI.bot), res: RES_NAME[lang][res] }));
    }
  };
  const onVertex = (v: VertexId) => {
    if (doneStep === step) return;
    if (step === 'settle') {
      firstHome.current = v;
      setW((s) => ({ ...s, buildings: { ...s.buildings, [v]: { owner: 'me', kind: 'settlement' } } }));
      sfx.play('coin');
      return complete(L(STEPS.settle.done!));
    }
    if (step === 'buildHouse' && armed === 'house') {
      setW((s) => ({ ...s, buildings: { ...s.buildings, [v]: { owner: 'me', kind: 'settlement' } }, hand: pay(s, COSTS.settlement) }));
      sfx.play('coin');
      return complete(`${L(STEPS.buildHouse.done!)} ${spent(COSTS.settlement)}`);
    }
    if (step === 'buildCity' && armed === 'city') {
      setW((s) => ({ ...s, buildings: { ...s.buildings, [v]: { owner: 'me', kind: 'city' } }, hand: pay(s, COSTS.city) }));
      sfx.play('coin');
      return complete(`${L(STEPS.buildCity.done!)} ${spent(COSTS.city)}`);
    }
  };
  const onEdge = (e: EdgeId) => {
    if (doneStep === step) return;
    if (step === 'road') {
      setW((s) => ({ ...s, roads: { ...s.roads, [e]: 'me' } }));
      sfx.play('coin');
      return complete(L(STEPS.road.done!));
    }
    if (step === 'buildRoad' && armed === 'road') {
      setW((s) => ({ ...s, roads: { ...s.roads, [e]: 'me' }, hand: pay(s, COSTS.road) }));
      sfx.play('coin');
      return complete(L(STEPS.buildRoad.done!));
    }
  };

  // ─── кнопки внизу ───
  const need = doneStep === step ? null : NEED_BTN[step];
  const press = (b: Btn) => {
    if (!need) return say(L(WRONG.map), false);
    if (b !== need) return say(L(WRONG.button), false);
    haptic('tap');
    if (b === 'roll') return rollDice();
    if (b === 'road' || b === 'house' || b === 'city') return setArmed(b);
    if (b === 'trade') return setTradeOpen(true);
    if (b === 'card') {
      setW((s) => ({ ...s, hand: pay(s, COSTS.devCard) }));
      setCardOpen(true);
      return;
    }
    if (b === 'end') return go('finish');
  };

  function rollDice() {
    sfx.play('diceShake');
    if (step === 'seven') {
      setDice({ a: 3, b: 4, key: k.current++ });
      setTimeout(() => go('robber'), 1300);
      return;
    }
    // Подбираем число, которое точно принесёт игроку ресурс
    const mine = Object.entries(w.buildings).filter(([, b]) => b.owner === 'me');
    const nums = mine.flatMap(([v]) => topo.vertices.get(v)!.hexes.map((h) => hexOf.get(h)).filter((h) => h?.number && h.id !== w.robberHex && h.number !== 7));
    nums.sort((a, b) => pips(b!.number) - pips(a!.number));
    const n = nums[0]?.number ?? 8;
    const a = Math.max(1, Math.min(6, n - 3));
    setDice({ a, b: n - a, key: k.current++ });
    setTimeout(() => {
      const hexes = board.board.hexes.filter((h) => h.number === n && h.id !== w.robberHex);
      const got: Resource[] = [];
      setW((s) => {
        const hand = { ...s.hand };
        for (const h of hexes) {
          if (h.terrain === 'desert') continue;
          const r = TERRAIN_RESOURCE[h.terrain];
          for (const v of topo.hexes.get(h.id)!.vertices) {
            const b = s.buildings[v];
            if (b?.owner === 'me') {
              hand[r] += b.kind === 'city' ? 2 : 1;
              got.push(r);
            }
          }
        }
        return { ...s, hand };
      });
      setFlash({ hexes: hexes.map((h) => h.id), key: k.current++ });
      const first = hexes.find((h) => h.terrain !== 'desert');
      const fallback: Resource[] = first && first.terrain !== 'desert' ? [TERRAIN_RESOURCE[first.terrain]] : [];
      const res = [...new Set(got.length ? got : fallback)].map((r) => RES_NAME[lang][r]).join(', ');
      sfx.play('diceLand');
      complete(fill(L(STEPS.roll.done!), { n, res }));
    }, 1100);
  }

  const points = Object.values(w.buildings).reduce((a, b) => a + (b.owner === 'me' ? (b.kind === 'city' ? 2 : 1) : 0), 0);
  const text = STEPS[step];
  const readOnly = !NEED_BTN[step] && !['hexes', 'numbers', 'settle', 'road', 'robber'].includes(step);
  const canNext = readOnly || doneStep === step;
  // Пока учимся на карте — внизу ничего нет, карта на весь экран. Рука ресурсов — с начала партии,
  // кнопки — только когда нужно нажать одну из них.
  const showHand = idx >= STEP_ORDER.indexOf('setupRest');
  const showActions = !!need;

  const close = () => {
    markTutorialDone();
    onClose();
  };

  const buttons: { id: Btn; icon: IconName; label: string }[] = [
    { id: 'road', icon: 'road', label: L(UI.road) },
    { id: 'house', icon: 'house', label: L(UI.house) },
    { id: 'city', icon: 'castle', label: L(UI.city) },
    { id: 'card', icon: 'cards', label: L(UI.card) },
  ];

  return (
    <div className="tut" role="dialog" aria-label={L(UI.title)}>
      <header className="tut-top">
        <div className="tut-prog" aria-label={`${L(UI.lesson)} ${idx + 1}/${STEP_ORDER.length}`}>
          {STEP_ORDER.map((s, i) => (
            <i key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''} />
          ))}
        </div>
        <div className="tut-bar">
          <div className="tut-seg" role="group">
            {LANGS.map((l) => (
              <button key={l.id} className={l.id === lang ? 'on' : ''} onClick={() => setLang(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          <span className="tut-pts" title={L(UI.pointsLbl)}>
            <Icon name="star" size={15} /> {L(UI.pointsLbl)} {points}/10
          </span>
          <button className="tut-x" onClick={close} aria-label={L(UI.skip)}>
            {L(UI.skip)}
          </button>
        </div>
      </header>

      <section key={step} className="tut-coach">
        <b>
          <small>{idx + 1}/{STEP_ORDER.length}</small> {L(text.title)}
        </b>
        <p>{fill(L(text.text), { name: L(UI.bot) })}</p>
        {note && (
          <p key={note.key} className={`tut-note ${note.ok ? 'ok' : 'bad'}`}>
            <Icon name={note.ok ? 'check' : 'bulb'} size={16} /> {note.text}
          </p>
        )}
      </section>

      <div className={`tut-board ${(step === 'hexes' || step === 'numbers') && !hint ? 'tut-find' : ''}`}>
        <Board2D
          view={view}
          era={currentEra}
          colors={COLORS}
          me="me"
          highlight={highlight}
          onHex={onHex}
          onVertex={onVertex}
          onEdge={onEdge}
          flash={flash}
          static
        />
        {dice && (
          <div key={dice.key} className="tut-dice" aria-live="polite">
            <Die n={dice.a} />
            <Die n={dice.b} />
          </div>
        )}
      </div>

      <footer className="tut-dock">
        {showHand && (
          <div className="tut-hand">
            {RESOURCES.map((r) => (
              <div key={r} className={`tut-card ${w.hand[r] ? '' : 'zero'}`} style={{ ['--rc' as string]: RES_COLOR[r] }}>
                <ResIcon r={r} size={28} />
                <span className="n">{w.hand[r]}</span>
                <span className="lbl">{RES_NAME[lang][r]}</span>
              </div>
            ))}
          </div>
        )}
        {showActions && (
          <div className="tut-actions">
            <button className={`tut-btn wide ${need === 'roll' ? 'glow' : 'off'}`} onClick={() => press('roll')} aria-disabled={need !== 'roll'}>
              <Icon name="dice" size={20} /> {L(UI.roll)}
            </button>
            {buttons.map((b) => (
              <button key={b.id} className={`tut-btn ${need === b.id && armed !== b.id ? 'glow' : need !== b.id ? 'off' : ''} ${armed === b.id ? 'armed' : ''}`} onClick={() => press(b.id)} aria-disabled={need !== b.id}>
                <Icon name={b.icon} size={20} />
                <span>{b.label}</span>
              </button>
            ))}
            <button className={`tut-btn ${need === 'trade' ? 'glow' : 'off'}`} onClick={() => press('trade')} aria-disabled={need !== 'trade'}>
              <Icon name="trade" size={20} />
              <span>{L(UI.trade)}</span>
            </button>
            <button className={`tut-btn wide end ${need === 'end' ? 'glow' : 'off'}`} onClick={() => press('end')} aria-disabled={need !== 'end'}>
              {L(UI.endTurn)} <Icon name="next" size={18} />
            </button>
          </div>
        )}
        {step === 'finish' ? (
          <div className="tut-next two">
            <button className="btn primary big" onClick={close}>
              <Icon name="play" size={20} /> {L(UI.play)}
            </button>
            {onRules && (
              <button className="btn big" onClick={onRules}>
                <Icon name="book" size={20} /> {L(UI.rules)}
              </button>
            )}
          </div>
        ) : (
          canNext && (
            <div className="tut-next">
              <button className="btn primary big" onClick={() => go()}>
                {L(UI.next)} <Icon name="next" size={20} />
              </button>
            </div>
          )
        )}
      </footer>

      {tradeOpen && (
        <div className="tut-pop" role="dialog">
          <div className="tut-pop-card">
            <b>{L(UI.trade)} · 4 : 1</b>
            <div className="tut-trade">
              <div>
                <small>{L(UI.tradeGive)}</small>
                <span className="tut-chip">
                  <ResIcon r="wood" size={26} /> ×4
                </span>
              </div>
              <Icon name="trade" size={22} />
              <div>
                <small>{L(UI.tradeGet)}</small>
                <span className="tut-chip">
                  <ResIcon r="ore" size={26} /> ×1
                </span>
              </div>
            </div>
            <button
              className="btn primary glow"
              onClick={() => {
                setW((s) => ({ ...s, hand: { ...s.hand, wood: s.hand.wood - 4, ore: s.hand.ore + 1 } }));
                setTradeOpen(false);
                complete(L(STEPS.trade.done!));
              }}
            >
              {L(UI.tradeDo)}
            </button>
          </div>
        </div>
      )}

      {cardOpen && (
        <div className="tut-pop" role="dialog">
          <div className="tut-pop-card">
            <span className="tut-dev">
              <Icon name="army" size={34} />
            </span>
            <small className="tut-drew">{L(UI.drew)}</small>
            <b>{L(UI.knight)}</b>
            <p>{L(UI.knightText)}</p>
            <button
              className="btn primary"
              onClick={() => {
                setCardOpen(false);
                complete();
              }}
            >
              {L(UI.next)} <Icon name="next" size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Die({ n }: { n: number }) {
  const P: Record<number, [number, number][]> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  };
  return (
    <span className="tut-die">
      {(P[n] ?? []).map(([x, y], i) => (
        <i key={i} style={{ gridColumn: x + 1, gridRow: y + 1 }} />
      ))}
    </span>
  );
}
