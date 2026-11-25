// Обмен: свой (с игроками и банком) и входящие предложения от активного игрока.
// Своя рука всегда видна сверху; условия — иконками, а не словами.

import { useMemo, useState } from 'react';
import { conn } from '../client/conn';
import { tableHarvest } from './income';
import type { Action, PrivateView, PublicState, Resource, ResourceMap } from '../engine';
import { RESOURCES, emptyResources, hasResources } from '../engine';
import { RESOURCE_NAME, namesFrom } from '../i18n/ru';
import { HandMini, ResChips, ResourcePicker, TradeGrid, sum } from './widgets';
import { ResIcon } from './ResIcon';
import { incomingTradeHint } from './planner';
import { Icon } from './icons';

type Send = (a: Action) => Promise<void>;

export function TradeSheet({ pub, priv, me, send, busy, bans = [] }: { pub: PublicState; priv: PrivateView; me: string; send: Send; busy: boolean; bans?: string[] }) {
  const [tab, setTab] = useState<'players' | 'bank'>(pub.trade ? 'players' : 'players');
  return (
    <div className="trade-sheet stack">
      <HandMini hand={priv.resources} />
      <div className="seg">
        <button aria-pressed={tab === 'players'} onClick={() => setTab('players')}>
          С игроками
        </button>
        <button aria-pressed={tab === 'bank'} onClick={() => setTab('bank')}>
          С банком
        </button>
      </div>
      {tab === 'players' ? <PlayersTrade pub={pub} priv={priv} me={me} send={send} busy={busy} bans={bans} /> : <BankTrade pub={pub} priv={priv} send={send} busy={busy} />}
    </div>
  );
}

function PlayersTrade({ pub, priv, me, send, busy, bans }: { pub: PublicState; priv: PrivateView; me: string; send: Send; busy: boolean; bans: string[] }) {
  const opponents = pub.order.filter((id) => id !== me && !pub.players[id].kicked);
  // Кому предложить: по умолчанию всем, кроме тех, с кем ты не торгуешь
  const [to, setTo] = useState<string[]>(() => opponents.filter((id) => !bans.includes(id)));
  const [give, setGive] = useState<ResourceMap>(emptyResources());
  const [want, setWant] = useState<ResourceMap>(emptyResources());
  const name = namesFrom(pub);
  const mine = pub.order[pub.current] === me ? (pub.trades ?? (pub.trade ? [pub.trade] : [])) : [];

  // Подсказка: кто добывает то, что ты хочешь, — им и стоит предлагать
  const wanted = RESOURCES.filter((r) => want[r] > 0);
  const producers = useMemo(() => {
    if (!wanted.length) return [];
    const { supply } = tableHarvest(pub);
    const who = new Set<string>();
    for (const r of wanted) for (const b of supply.find((x) => x.r === r)?.by ?? []) if (b.who !== me && opponents.includes(b.who)) who.add(b.who);
    return [...who];
  }, [wanted.join(','), pub.buildings, pub.robberHex]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = sum(give) > 0 && sum(want) > 0 && to.length > 0;
  const all = to.length === opponents.length;
  return (
    <div className="stack">
      {mine.length > 0 && (
        <section className="my-offers">
          <div className="label">Твои предложения · {mine.length}</div>
          {[...mine].reverse().map((trade) => {
            const others = pub.order.filter((id) => id !== me && (!trade.to || trade.to.includes(id)) && !bans.includes(id));
            return (
              <div key={trade.id} className="offer-card">
                <div className="offer-head">
                  <ResChips value={trade.give} />
                  <Icon name="trade" size={16} className="tc-arrow" />
                  <ResChips value={trade.want} />
                  <button className="offer-x" disabled={busy} onClick={() => send({ type: 'cancelTrade', tradeId: trade.id })} aria-label="Отменить предложение">
                    <Icon name="close" size={16} />
                  </button>
                </div>
                <ul className="offer-resp">
                  {others.map((id) => {
                    const r = trade.responses?.[id];
                    const terms = r?.kind === 'counter' ? r : trade;
                    const canDo = (r?.kind === 'accept' || r?.kind === 'counter') && hasResources(priv.resources, terms.give);
                    return (
                      <li key={id} className={`resp ${r?.kind ?? 'wait'}`}>
                        <span className="grow">
                          <b>{name(id)}</b>{' '}
                          <small>
                            {!r && 'думает…'}
                            {r?.kind === 'accept' && 'согласен'}
                            {r?.kind === 'decline' && 'отказ'}
                            {r?.kind === 'counter' && (
                              <span className="counter-line">
                                встречное: <ResChips value={r.give} /> → <ResChips value={r.want} />
                              </span>
                            )}
                          </small>
                        </span>
                        {canDo && (
                          <button className="btn primary small-act" disabled={busy} onClick={() => send({ type: 'confirmTrade', tradeId: trade.id, with: id })}>
                            Обменяться
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          <div className="label">Новое предложение</div>
        </section>
      )}
      <div className="trade-to" role="group" aria-label="Кому предложить">
        <span className="trade-to-l">Кому</span>
        {opponents.map((id) => {
          const on = to.includes(id);
          const banned = bans.includes(id);
          return (
            <span key={id} className={`trade-to-item ${banned ? 'banned' : ''}`}>
              <button className={`trade-to-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setTo((t) => (on ? t.filter((x) => x !== id) : [...t, id]))}>
                {name(id)}
              </button>
              <button
                className={`trade-ban ${banned ? 'on' : ''}`}
                aria-label={banned ? `Снова торговать с ${name(id)}` : `Не торговать с ${name(id)}`}
                title={banned ? 'Ты с ним не торгуешь — нажми, чтобы снять' : 'Не торговать с ним'}
                onClick={() => {
                  conn.send({ t: 'ban', player: id, on: !banned });
                  if (!banned) setTo((t) => t.filter((x) => x !== id));
                }}
              >
                <Icon name="ban" size={15} />
              </button>
            </span>
          );
        })}
      </div>
      <TradeGrid
        give={give}
        want={want}
        hand={priv.resources}
        onChange={(g, w) => {
          setGive(g);
          setWant(w);
        }}
      />
      {wanted.length > 0 && (
        <div className="trade-hint">
          <Icon name="bulb" size={16} />
          <span className="grow">
            {producers.length
              ? `${wanted.map((r) => RESOURCE_NAME[r]).join(', ')} добывают: ${producers.map((id) => name(id)).join(', ')}`
              : `Сейчас никто не добывает: ${wanted.map((r) => RESOURCE_NAME[r]).join(', ')} — попробуй банк`}
          </span>
          {producers.length > 0 && producers.join() !== to.join() && (
            <button className="btn ghost small-act" onClick={() => setTo(producers.filter((id) => !bans.includes(id)))}>
              Предложить им
            </button>
          )}
        </div>
      )}
      <button
        className="btn primary big wide"
        disabled={!valid || busy}
        onClick={async () => {
          await send({ type: 'offerTrade', give, want, ...(all ? {} : { to }) });
          // предложение ушло в стопку — форма чистая для следующего
          setGive(emptyResources());
          setWant(emptyResources());
        }}
      >
        {all ? 'Предложить всем' : to.length ? `Предложить: ${to.map((id) => name(id)).join(', ')}` : 'Выбери, кому предложить'}
      </button>
      {!valid && to.length > 0 && <p className="faint small center">Выбери, что отдаёшь и что хочешь получить</p>}
    </div>
  );
}

function BankTrade({ pub, priv, send, busy }: { pub: PublicState; priv: PrivateView; send: Send; busy: boolean }) {
  const [give, setGive] = useState<Resource | null>(null);
  const [receive, setReceive] = useState<Resource | null>(null);
  const ratio = (r: Resource) => priv.tradeRatios?.[r] ?? 4;
  const can = give && receive && give !== receive && priv.resources[give] >= ratio(give) && pub.bank[receive] > 0;
  return (
    <div className="stack">
      <div className="label">Отдаю банку</div>
      <ResourcePicker
        selected={give}
        sub={(r) => `${ratio(r)}:1`}
        disabled={(r) => priv.resources[r] < ratio(r)}
        onPick={(r) => {
          setGive(r);
          if (receive === r) setReceive(null);
        }}
      />
      <div className="label">Получаю</div>
      <ResourcePicker selected={receive} disabled={(r) => r === give || pub.bank[r] <= 0} onPick={setReceive} />
      <button
        className="btn primary big wide"
        disabled={!can || busy}
        onClick={async () => {
          await send({ type: 'bankTrade', give: give!, receive: receive! });
          setReceive(null);
          if (give && priv.resources[give] - ratio(give) < ratio(give)) setGive(null);
        }}
      >
        {give && receive ? (
          <>
            {ratio(give)} <ResIcon r={give} size={24} /> → 1 <ResIcon r={receive} size={24} />
          </>
        ) : (
          'Обменять'
        )}
      </button>
      <p className="faint small">Курс 4:1. Гавань даёт 3:1 или 2:1, если у неё стоит твоё поселение или город.</p>
    </div>
  );
}

/** Предложение от активного игрока — для остальных. */
export function IncomingTrade({ pub, priv, me, send, busy }: { pub: PublicState; priv: PrivateView; me: string; send: Send; busy: boolean }) {
  const trade = pub.trade!;
  const from = namesFrom(pub)(pub.order[pub.current]);
  const mine = trade.responses?.[me];
  const [counter, setCounter] = useState(false);
  // С точки зрения отвечающего: «отдаю» = то, что хочет активный; «получаю» = то, что он отдаёт
  const [myGive, setMyGive] = useState<ResourceMap>(() => clampTo({ ...trade.want }, priv.resources));
  const [myGet, setMyGet] = useState<ResourceMap>({ ...trade.give });
  const canAccept = hasResources(priv.resources, trade.want);
  const hint = incomingTradeHint(trade.want, trade.give, priv.resources);

  if (counter) {
    const valid = sum(myGive) > 0 && sum(myGet) > 0;
    return (
      <div className="stack">
        <HandMini hand={priv.resources} />
        <TradeGrid
          give={myGive}
          want={myGet}
          hand={priv.resources}
          wantLabel="Получаю"
          onChange={(g, w) => {
            setMyGive(g);
            setMyGet(w);
          }}
        />
        <div className="row">
          <button className="btn ghost grow" onClick={() => setCounter(false)}>
            Назад
          </button>
          <button
            className="btn primary grow"
            disabled={!valid || busy}
            onClick={async () => {
              await send({ type: 'respondTrade', tradeId: trade.id, kind: 'counter', give: myGet, want: myGive });
              setCounter(false);
            }}
          >
            Предложить {from}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <HandMini hand={priv.resources} />
      <div className="terms-card">
        <div className="tc-side">
          <span className="tc-l">Ты отдаёшь</span>
          <ResChips value={trade.want} />
        </div>
        <Icon name="trade" size={20} className="tc-arrow" />
        <div className="tc-side">
          <span className="tc-l">Ты получаешь</span>
          <ResChips value={trade.give} />
        </div>
      </div>
      <div className={`hint-card ${hint.canAccept ? 'good' : ''}`}>
        <Icon name="bulb" size={18} /> {hint.text}
      </div>
      {mine && <p className="faint small center">Твой ответ: {mine.kind === 'accept' ? 'согласен' : mine.kind === 'decline' ? 'отказ' : 'встречное'}</p>}
      <div className="row">
        <button className="btn grow" disabled={busy} onClick={() => send({ type: 'respondTrade', tradeId: trade.id, kind: 'decline' })}>
          Отказ
        </button>
        <button className="btn grow" onClick={() => setCounter(true)}>
          Встречное
        </button>
        <button className="btn primary grow" disabled={!canAccept || busy} onClick={() => send({ type: 'respondTrade', tradeId: trade.id, kind: 'accept' })}>
          Согласен
        </button>
      </div>
    </div>
  );
}

function clampTo(m: ResourceMap, hand: ResourceMap): ResourceMap {
  const out = { ...m };
  for (const r of RESOURCES) out[r] = Math.min(out[r], hand[r]);
  return out;
}

export { RESOURCE_NAME };
