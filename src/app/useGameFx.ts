// События партии → анимации, звуки, рассказчик, полёт камеры. Общее для телефона и телевизора.

import { useEffect, useRef, useState } from 'react';
import type { GameEvent, HarborType, PlayerId, PublicState, Resource } from '../engine';
import { RESOURCES } from '../engine';
import type { LorePack } from '../lore';
import { narrate } from '../lore';
import { conn } from '../client/conn';
import type { CinematicEvent, DiceRoll, Gain, RaidEvent, ReactionItem, ThreatInfo } from '../fx';
import { haptic, rollDurationMs, sfx } from '../fx';
import { PLAYER_HEX } from '../ui/theme';
import { eraIcon } from './era';
import { RESOURCE_NAME } from '../i18n/ru';
import type { LogEntry, Notice } from './gameLog';
import { hexResource, logText, noticeFor } from './gameLog';

function loadLog(): LogEntry[] {
  try {
    const pin = conn.lastPin();
    const raw = pin && localStorage.getItem(`hh.log.${pin}`);
    return raw ? (JSON.parse(raw) as LogEntry[]) : [];
  } catch {
    return [];
  }
}

/** Камера на атаке: держим кадр всю сцену (в 3D), налёт ВОВ — шире, чтобы видеть звено. */
const SHOT: Record<string, { hold: number; zoom: number }> = {
  'ww2:robber': { hold: 7200, zoom: 1.7 },
  'ww2:knight': { hold: 6600, zoom: 2.1 },
  'genghis:robber': { hold: 6300, zoom: 2.0 },
  'genghis:knight': { hold: 5000, zoom: 2.1 },
  'japan:robber': { hold: 5400, zoom: 2.3 },
  'japan:knight': { hold: 5000, zoom: 2.3 },
};
function attackShot(era: string, kind: 'robber' | 'knight'): { hold?: number; zoom?: number } {
  let is3d = false;
  try {
    is3d = localStorage.getItem('hh.boardMode') === '3d';
  } catch {
    /* ok */
  }
  return is3d ? (SHOT[`${era}:${kind}`] ?? {}) : {};
}

export interface Narration {
  text: string;
  key: number;
  color?: string;
}

export interface GameFx {
  roll: DiceRoll | null;
  cinematic: CinematicEvent | null;
  raid: RaidEvent | null;
  gains: { list: Gain[]; key: number };
  narration: Narration | null;
  focus?: { hex?: string; vertex?: string; edge?: string; key: number; hold?: number; zoom?: number };
  flash?: { hexes: string[]; key: number };
  recent: string[];
  shake: number;
  /** Обмен через гавань — кораблик уходит в рейс. */
  sail?: { type: HarborType; key: number };
  reactions: ReactionItem[];
  /** Журнал партии (с момента входа), до 200 строк. */
  log: LogEntry[];
  /** Важные события с объяснением — по одному, каждое висит, пока не нажали «Понятно». */
  notices: Notice[];
  /** До какого момента (Date.now) идёт сцена атаки — до конца бросать кубики нельзя. */
  attackUntil: number;
  /** Кто сейчас выбирает цель атаки (фаза разбойника) — зловещее предупреждение всем. */
  threat?: { player: PlayerId; key: number };
}

/**
 * @param me — чей это телефон (undefined — телевизор: озвучивает всё общее).
 */
export function useGameFx(pub: PublicState | undefined, pack: LorePack, me?: PlayerId): GameFx {
  const [fx, setFx] = useState<GameFx>({
    roll: null,
    cinematic: null,
    raid: null,
    gains: { list: [], key: 0 },
    narration: null,
    recent: [],
    shake: 0,
    reactions: [],
    log: loadLog(),
    notices: [],
    attackUntil: 0,
  });
  // журнал живёт и после перезагрузки страницы (по PIN комнаты)
  useEffect(() => {
    try {
      const pin = conn.lastPin();
      if (pin) localStorage.setItem(`hh.log.${pin}`, JSON.stringify(fx.log.slice(-200)));
    } catch {
      /* ok */
    }
  }, [fx.log]);
  const pubRef = useRef(pub);
  pubRef.current = pub;
  const packRef = useRef(pack);
  packRef.current = pack;
  const k = useRef(Date.now());
  const knightBy = useRef<PlayerId | undefined>(undefined);

  useEffect(() => {
    const tv = me === undefined;
    const name = (id?: PlayerId) => (id && pubRef.current?.players[id]?.name) || 'Кто-то';
    const color = (id?: PlayerId) => {
      const c = id && pubRef.current?.players[id]?.color;
      return c ? PLAYER_HEX[c] : undefined;
    };

    // Очередь: реплики рассказчика и кино-вставки идут строго по одной, каждая — свои секунды
    const sayQ: { text: string; color?: string }[] = [];
    let sayBusy = false;
    const pumpSay = () => {
      const n = sayQ.shift();
      if (!n) {
        sayBusy = false;
        return;
      }
      sayBusy = true;
      setFx((f) => ({ ...f, narration: { text: n.text, key: k.current++, color: n.color } }));
      timers.push(setTimeout(pumpSay, Math.min(4200, 1800 + n.text.length * 28)));
    };
    const say = (text: string, who?: PlayerId) => {
      if (!text) return;
      if (sayQ.length >= 4) sayQ.shift(); // не копим хвост — старое уже неактуально
      sayQ.push({ text, color: color(who) });
      if (!sayBusy) pumpSay();
    };
    const cineQ: Omit<CinematicEvent, 'key'>[] = [];
    let cineBusy = false;
    const pumpCine = () => {
      const e = cineQ.shift();
      if (!e) {
        cineBusy = false;
        return;
      }
      cineBusy = true;
      setFx((f) => ({ ...f, cinematic: { ...e, key: k.current++ } }));
      timers.push(setTimeout(pumpCine, 2000));
    };
    const cine = (e: Omit<CinematicEvent, 'key'>) => {
      cineQ.push(e);
      if (!cineBusy) pumpCine();
    };
    const timers: ReturnType<typeof setTimeout>[] = [];
    const raid = (kind: 'robber' | 'knight', target?: string, eraOverride?: string) => {
      const era = eraOverride ?? packRef.current.id;
      const sprite = kind === 'robber' ? eraIcon(era, 'attack') : era === 'ww2' ? eraIcon(era, 'tank') : eraIcon(era, 'dev-knight');
      const hex = target ? pubRef.current?.board.hexes.find((h) => h.id === target) : undefined;
      const len = attackShot(era, kind).hold ?? 4500;
      setFx((f) => ({ ...f, raid: { kind, era, sprite, target, key: k.current++ }, attackUntil: Date.now() + len, threat: undefined }));
      // тряска — в момент удара, а не в начале
      // в 3D во ВОВ удар позже: звено заходит медленно (≈3.6 с), танки стреляют с 3.2 с
      let is3d = false;
      try {
        is3d = localStorage.getItem('hh.boardMode') === '3d';
      } catch {
        /* ok */
      }
      // момент удара в 3D-сценах: ВОВ — бомбы/залп; Чингисхан — стрелы/таран; Япония — сюрикены/катаны
      const HIT3D: Record<string, number> = { 'ww2:robber': 3650, 'ww2:knight': 3250, 'genghis:robber': 3200, 'genghis:knight': 2400, 'japan:robber': 2400, 'japan:knight': 3000 };
      const late = is3d && !!target ? HIT3D[`${era}:${kind}`] : undefined;
      setTimeout(() => setFx((f) => ({ ...f, shake: f.shake + 1 })), late ?? (kind === 'robber' ? 1450 : 1000));
    };
    if (import.meta.env.DEV) {
      const w = window as unknown as { __raid: typeof raid; __robber: () => string | undefined; __focus: (id: string) => void };
      w.__raid = (kind, target, era) => {
        raid(kind, target, era);
        if (target) setFx((f) => ({ ...f, focus: { hex: target, key: k.current++, ...attackShot(era ?? packRef.current.id, kind) } }));
      };
      w.__robber = () => pubRef.current?.robberHex;
      w.__focus = (id) => setFx((f) => ({ ...f, focus: id.startsWith('h') ? { hex: id, key: k.current++ } : { vertex: id, key: k.current++ } }));
      (window as unknown as { __pub: () => unknown }).__pub = () => pubRef.current;
      (window as unknown as { __notice: (t: string, x: string) => void }).__notice = (title, text) => setFx((f) => ({ ...f, notices: [...f.notices, { title, text, key: k.current++ }] }));
      (window as unknown as { __say: (t: string) => void }).__say = (t) => say(t);
    }

    const offEvents = conn.onEvents((events: GameEvent[], source) => {
      const p = packRef.current;
      let delay = 0;
      // журнал и закреплённые уведомления
      const lctx = {
        pack: p,
        name,
        me,
        hexInfo: (hex: string) => {
          const h = pubRef.current?.board.hexes.find((x) => x.id === hex);
          return h ? { res: hexResource(h.terrain), number: h.number } : undefined;
        },
      };
      const lines = events.map((e) => logText(e, lctx)).filter((x): x is NonNullable<typeof x> => !!x);
      const note = events.map((e) => noticeFor(e, lctx)).find((x) => !!x);
      if (lines.length || note)
        setFx((f) => ({
          ...f,
          log: [...f.log, ...lines.map((l) => ({ ...l, key: k.current++ }))].slice(-200),
          notices: note ? [...f.notices, { ...note, key: k.current++ }].slice(-6) : f.notices,
        }));
      for (const e of events) {
        switch (e.type) {
          case 'diceRolled': {
            delay = rollDurationMs;
            setFx((f) => ({
              ...f,
              roll: { dice: e.dice, key: k.current++, source, player: name(e.player), color: color(e.player) },
            }));
            if (e.total === 7) {
              setTimeout(() => {
                cine({ kind: 'seven', title: `Семь! ${p.robber.name}`, subtitle: narrate(p, 'seven', { player: name(e.player) }), emoji: '', img: eraIcon(p.id, 'robber-unit') });
                setFx((f) => ({ ...f, shake: f.shake + 1 }));
              }, rollDurationMs);
            }
            break;
          }
          case 'produced': {
            const hexes = pubRef.current?.board.hexes.filter((h) => h.number === e.total && h.id !== pubRef.current?.robberHex).map((h) => h.id) ?? [];
            setTimeout(() => setFx((f) => ({ ...f, flash: { hexes, key: k.current++ } })), delay);
            if (me && e.gains?.[me]) {
              const g = e.gains[me];
              const list: Gain[] = RESOURCES.filter((r) => (g[r] ?? 0) > 0).map((r) => ({ res: RESOURCE_NAME[r], emoji: '', count: g[r]!, img: eraIcon(packRef.current.id, `res-${r}`) }));
              setTimeout(() => {
                setFx((f) => ({ ...f, gains: { list, key: k.current++ } }));
                haptic('success');
              }, delay);
            }
            const total = Object.values(e.gains ?? {}).reduce((a, g) => a + RESOURCES.reduce((s, r) => s + (g[r] ?? 0), 0), 0);
            const best = Object.entries(e.gains ?? {}).sort(
              (a, b) => RESOURCES.reduce((s, r) => s + (b[1][r] ?? 0), 0) - RESOURCES.reduce((s, r) => s + (a[1][r] ?? 0), 0),
            )[0];
            if (tv && best && total >= 4) setTimeout(() => say(narrate(p, 'bigHarvest', { player: name(best[0]), n: total }), best[0]), delay);
            break;
          }
          case 'built': {
            setFx((f) => ({
              ...f,
              recent: [e.at],
              focus: e.kind === 'road' ? f.focus : { vertex: e.at, key: k.current++ },
            }));
            sfx.play('pop');
            if (e.kind === 'city') {
              cine({ kind: 'built-city', title: `${p.pieces.city}!`, subtitle: narrate(p, 'city', { player: name(e.player) }), emoji: '', img: eraIcon(p.id, 'emblem'), color: color(e.player) });
            } else if (tv) say(narrate(p, e.kind === 'road' ? 'road' : 'settlement', { player: name(e.player) }), e.player);
            break;
          }
          case 'robberMoved': {
            // после карты-воина сцена воина играет, когда цель уже выбрана (а не в момент розыгрыша карты)
            const kind = knightBy.current === e.player ? 'knight' : 'robber';
            knightBy.current = undefined;
            setFx((f) => ({ ...f, focus: { hex: e.hex, key: k.current++, ...attackShot(p.id, kind) } }));
            raid(kind, e.hex);
            say(narrate(p, 'robberMoved', { player: name(e.player) }), e.player);
            break;
          }
          case 'stole':
            sfx.play('steal');
            if (me === e.victim) haptic('error');
            say(
              narrate(p, 'stole', { player: name(e.thief), victim: name(e.victim) }) +
                (e.resource && (me === e.thief || me === e.victim) ? ` (${RESOURCE_NAME[e.resource as Resource]})` : ''),
              e.thief,
            );
            break;
          case 'devCardPlayed': {
            const card = p.devCards[e.card];
            if (e.card === 'knight') {
              knightBy.current = e.player; // сама сцена — после выбора цели (robberMoved)
              say(`${card.name}: ${narrate(p, 'knight', { player: name(e.player) })}`, e.player);
            } else if (e.card === 'roadBuilding') {
              cine({ kind: 'roadBuilding', title: card.name, subtitle: narrate(p, 'roadBuilding', { player: name(e.player) }), emoji: '', img: eraIcon(p.id, 'dev-roadBuilding'), color: color(e.player) });
            }
            break;
          }
          case 'monopoly':
            cine({
              kind: 'monopoly',
              title: p.devCards.monopoly.name,
              subtitle: narrate(p, 'monopoly', { player: name(e.player), res: RESOURCE_NAME[e.resource], count: e.total }),
              emoji: '', img: eraIcon(p.id, `res-${e.resource}`), rain: eraIcon(p.id, 'dev-monopoly'),
              color: color(e.player),
            });
            if (me && me !== e.player) haptic('error');
            break;
          case 'yearOfPlenty':
            cine({
              kind: 'yearOfPlenty',
              title: p.devCards.yearOfPlenty.name,
              subtitle: narrate(p, 'yearOfPlenty', { player: name(e.player) }),
              emoji: '', img: eraIcon(p.id, 'dev-yearOfPlenty'), rain: eraIcon(p.id, `res-${(e.resources ?? ['wheat'])[0]}`),
              color: color(e.player),
            });
            break;
          case 'longestRoad':
            if (e.player)
              cine({ kind: 'longestRoad', title: p.bonuses.longestRoad, subtitle: narrate(p, 'longestRoad', { player: name(e.player), n: e.length }), emoji: '', img: eraIcon(p.id, 'dev-roadBuilding'), color: color(e.player) });
            break;
          case 'largestArmy':
            cine({ kind: 'largestArmy', title: p.bonuses.largestArmy, subtitle: narrate(p, 'largestArmy', { player: name(e.player), n: e.knights }), emoji: '', img: eraIcon(p.id, 'dev-knight'), color: color(e.player) });
            break;
          case 'tradeCompleted':
            sfx.play('chime');
            say(narrate(p, 'tradeCompleted', { player: name(e.from), victim: name(e.to) }), e.from);
            break;
          case 'bankTrade': {
            sfx.play('coin');
            const ratio = e.giveCount / Math.max(1, e.receiveCount);
            const type: HarborType | undefined = ratio === 2 ? (e.give as HarborType) : ratio === 3 ? 'any' : undefined;
            if (type) setFx((f) => ({ ...f, sail: { type, key: k.current++ } }));
            break;
          }
          case 'tradeOffered':
            if (me && me !== e.player) {
              sfx.play('react');
              haptic('tap');
            }
            break;
          case 'turnStarted':
            if (me && e.player === me) {
              setTimeout(() => {
                sfx.play('yourTurn');
                haptic('heavy');
              }, 300);
            }
            break;
          case 'gameStarted':
            say(narrate(p, 'gameStarted', {}));
            break;
          case 'gameWon':
            cine({ kind: 'victory', title: name(e.player), subtitle: p.victory.replace('{player}', name(e.player)), emoji: '', img: eraIcon(p.id, 'dev-victoryPoint'), color: color(e.player) });
            break;
        }
      }
    });

    const offReact = conn.onReact((r) => {
      const item: ReactionItem = { id: `${r.from}-${r.at}`, emoji: r.emoji, from: name(r.from), color: color(r.from) };
      setFx((f) => ({ ...f, reactions: [...f.reactions.slice(-12), item] }));
    });

    return () => {
      offEvents();
      offReact();
      timers.forEach(clearTimeout);
    };
  }, [me]);

  // Затишье перед ударом: кто-то выбирает цель (после семёрки или карты-воина)
  const threatPid = pub?.phase === 'moveRobber' ? pub.order[pub.current] : undefined;
  useEffect(() => {
    if (!threatPid) {
      setFx((f) => (f.threat ? { ...f, threat: undefined } : f));
      return;
    }
    // после семёрки — сначала досмотреть кубики
    const t = setTimeout(() => setFx((f) => ({ ...f, threat: { player: threatPid, key: k.current++ } })), 1600);
    return () => clearTimeout(t);
  }, [threatPid, pub?.turn]); // eslint-disable-line react-hooks/exhaustive-deps

  return fx;
}

/** Сцена «выбирает цель» для экрана: имя, цвет, чей удар. */
export function threatInfo(fx: GameFx, pub: PublicState, pack: LorePack, me?: PlayerId): ThreatInfo | null {
  if (!fx.threat || pub.phase !== 'moveRobber') return null;
  const p = pub.players[fx.threat.player];
  if (!p) return null;
  return {
    key: fx.threat.key,
    name: p.name,
    color: PLAYER_HEX[p.color],
    mine: me === fx.threat.player,
    attack: pack.robber.name,
    img: eraIcon(pack.id, 'attack'),
  };
}

/** Идёт ли сейчас сцена атаки (до fx.attackUntil); пока идёт — кубики не бросаем. */
export function useAttacking(until: number): boolean {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const left = until - Date.now();
    if (left <= 0) return;
    setNow(Date.now());
    const t = setTimeout(() => setNow(Date.now()), left + 50);
    return () => clearTimeout(t);
  }, [until]);
  return until > now;
}
