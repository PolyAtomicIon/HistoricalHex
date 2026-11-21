// События партии → анимации, звуки, рассказчик, полёт камеры. Общее для телефона и телевизора.

import { useEffect, useRef, useState } from 'react';
import type { GameEvent, HarborType, PlayerId, PublicState, Resource } from '../engine';
import { RESOURCES } from '../engine';
import type { LorePack } from '../lore';
import { narrate } from '../lore';
import { conn } from '../client/conn';
import type { CinematicEvent, DiceRoll, Gain, RaidEvent, ReactionItem } from '../fx';
import { haptic, rollDurationMs, sfx } from '../fx';
import { PLAYER_HEX } from '../ui/theme';
import { eraIcon } from './era';
import { RESOURCE_NAME } from '../i18n/ru';

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
  focus?: { hex?: string; vertex?: string; edge?: string; key: number };
  flash?: { hexes: string[]; key: number };
  recent: string[];
  shake: number;
  /** Обмен через гавань — кораблик уходит в рейс. */
  sail?: { type: HarborType; key: number };
  reactions: ReactionItem[];
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
  });
  const pubRef = useRef(pub);
  pubRef.current = pub;
  const packRef = useRef(pack);
  packRef.current = pack;
  const k = useRef(1);

  useEffect(() => {
    const tv = me === undefined;
    const name = (id?: PlayerId) => (id && pubRef.current?.players[id]?.name) || 'Кто-то';
    const color = (id?: PlayerId) => {
      const c = id && pubRef.current?.players[id]?.color;
      return c ? PLAYER_HEX[c] : undefined;
    };

    const say = (text: string, who?: PlayerId) => {
      if (!text) return;
      setFx((f) => ({ ...f, narration: { text, key: k.current++, color: color(who) } }));
    };
    const cine = (e: Omit<CinematicEvent, 'key'>) => setFx((f) => ({ ...f, cinematic: { ...e, key: k.current++ } }));
    const raid = (kind: 'robber' | 'knight') => {
      const era = packRef.current.id;
      const sprite = kind === 'robber' ? eraIcon(era, 'attack') : era === 'ww2' ? eraIcon(era, 'tank') : eraIcon(era, 'dev-knight');
      setFx((f) => ({ ...f, raid: { kind, era, sprite, key: k.current++ }, shake: f.shake + 1 }));
    };
    if (import.meta.env.DEV) (window as unknown as { __raid: typeof raid }).__raid = raid;

    const offEvents = conn.onEvents((events: GameEvent[], source) => {
      const p = packRef.current;
      let delay = 0;
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
                cine({ kind: 'seven', title: `Семь! ${p.robber.name}`, subtitle: narrate(p, 'seven', { player: name(e.player) }), emoji: '', img: eraIcon(p.id, 'robber') });
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
          case 'robberMoved':
            setFx((f) => ({ ...f, focus: { hex: e.hex, key: k.current++ } }));
            raid('robber');
            say(narrate(p, 'robberMoved', { player: name(e.player) }), e.player);
            break;
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
              raid('knight');
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
    };
  }, [me]);

  return fx;
}
