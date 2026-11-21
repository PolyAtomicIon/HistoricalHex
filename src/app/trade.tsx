// Обмен: свой (с игроками и банком) и входящие предложения от активного игрока.
// Своя рука всегда видна сверху; условия — иконками, а не словами.

import { useState } from 'react';
import type { Action, PrivateView, PublicState, Resource, ResourceMap } from '../engine';
import { RESOURCES, emptyResources, hasResources } from '../engine';
import { RESOURCE_NAME, namesFrom } from '../i18n/ru';
import { HandMini, ResChips, ResourcePicker, TradeGrid, sum } from './widgets';
import { ResIcon } from './ResIcon';
import { incomingTradeHint } from './planner';
import { Icon } from './icons';

type Send = (a: Action) => Promise<void>;

export function TradeSheet({ pub, priv, me, send, busy }: { pub: PublicState; priv: PrivateView; me: string; send: Send; busy: boolean }) {
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
      {tab === 'players' ? <PlayersTrade pub={pub} priv={priv} me={me} send={send} busy={busy} /> : <BankTrade pub={pub} priv={priv} send={send} busy={busy} />}
    </div>
  );
}

function PlayersTrade({ pub, priv, me, send, busy }: { pub: PublicState; priv: PrivateView; me: string; send: Send; busy: boolean }) {
  const [give, setGive] = useState<ResourceMap>(emptyResources());
  const [want, setWant] = useState<ResourceMap>(emptyResources());
  const [editing, setEditing] = useState(false);
  const name = namesFrom(pub);
  const trade = pub.trade;

  if (trade && !editing) {
    const others = pub.order.filter((id) => id !== me);
    return (
      <div className="stack">
        <div className="terms-card">
          <div className="tc-side">
            <span className="tc-l">Отдаёшь</span>
            <ResChips value={trade.give} />
          </div>
          <Icon name="trade" size={20} className="tc-arrow" />
          <div className="tc-side">
            <span className="tc-l">Получаешь</span>
            <ResChips value={trade.want} />
          </div>
        </div>
        <ul className="list responses">
          {others.map((id) => {
            const r = trade.responses?.[id];
            const terms = r?.kind === 'counter' ? r : trade;
            const canDo = (r?.kind === 'accept' || r?.kind === 'counter') && hasResources(priv.resources, terms.give);
            return (
              <li key={id} className={`item resp ${r?.kind ?? 'wait'}`}>
                <div className="grow">
                  <div className="t">{name(id)}</div>
                  <div className="s">
                    {!r && <span className="thinking">думает…</span>}
                    {r?.kind === 'accept' && 'согласен'}
                    {r?.kind === 'decline' && 'отказ'}
                    {r?.kind === 'counter' && (
                      <span className="counter-line">
                        встречное: ты <ResChips value={r.give} /> → <ResChips value={r.want} />
                      </span>
                    )}
                  </div>
                </div>
                {canDo && (
                  <button className="btn primary" disabled={busy} onClick={() => send({ type: 'confirmTrade', tradeId: trade.id, with: id })}>
                    Обменяться
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="row">
          <button
            className="btn grow"
            onClick={() => {
              setGive({ ...trade.give });
              setWant({ ...trade.want });
              setEditing(true);
            }}
          >
            Изменить
          </button>
          <button className="btn ghost grow" disabled={busy} onClick={() => send({ type: 'cancelTrade' })}>
            Отменить
          </button>
        </div>
      </div>
    );
  }

  const valid = sum(give) > 0 && sum(want) > 0;
  return (
    <div className="stack">
      <TradeGrid
        give={give}
        want={want}
        hand={priv.resources}
        onChange={(g, w) => {
          setGive(g);
          setWant(w);
        }}
      />
      <button
        className="btn primary big wide"
        disabled={!valid || busy}
        onClick={async () => {
          await send({ type: 'offerTrade', give, want });
          setEditing(false);
        }}
      >
        Предложить всем
      </button>
      {!valid && <p className="faint small center">Выбери, что отдаёшь и что хочешь получить</p>}
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
