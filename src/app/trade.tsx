// Обмен: свой (с игроками и банком) и входящие предложения от активного игрока.

import { useState } from 'react';
import type { Action, PrivateView, PublicState, Resource, ResourceMap } from '../engine';
import { RESOURCES, emptyResources, hasResources } from '../engine';
import { RESOURCE_NAME, namesFrom, resourcesText } from '../i18n/ru';
import { RESOURCE_ICON } from '../ui/theme';
import { RESOURCE_BG, ResourcePicker, ResourceStepper, sum } from './widgets';
import { ResIcon } from './ResIcon';
import { incomingTradeHint } from './planner';

type Send = (a: Action) => Promise<void>;

export function TradeSheet({ pub, priv, me, send, busy }: { pub: PublicState; priv: PrivateView; me: string; send: Send; busy: boolean }) {
  const [tab, setTab] = useState<'players' | 'bank'>('players');
  return (
    <div className="trade-sheet">
      <div className="tabs">
        <button className={tab === 'players' ? 'on' : ''} onClick={() => setTab('players')}>
          С игроками
        </button>
        <button className={tab === 'bank' ? 'on' : ''} onClick={() => setTab('bank')}>
          С банком
        </button>
      </div>
      {tab === 'players' ? (
        <PlayersTrade pub={pub} priv={priv} me={me} send={send} busy={busy} />
      ) : (
        <BankTrade pub={pub} priv={priv} send={send} busy={busy} />
      )}
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
      <div className="trade-active">
        <p className="terms">
          Ты отдаёшь <b>{resourcesText(trade.give)}</b>, хочешь <b>{resourcesText(trade.want)}</b>
        </p>
        <ul className="responses">
          {others.map((id) => {
            const r = trade.responses?.[id];
            const terms = r?.kind === 'counter' ? r : trade;
            const canDo = (r?.kind === 'accept' || r?.kind === 'counter') && hasResources(priv.resources, terms.give);
            return (
              <li key={id}>
                <span className="who">{name(id)}</span>
                <span className="what">
                  {!r && 'думает…'}
                  {r?.kind === 'accept' && '✅ согласен'}
                  {r?.kind === 'decline' && '❌ отказ'}
                  {r?.kind === 'counter' && (
                    <>
                      🔁 хочет {resourcesText(r.give)} за {resourcesText(r.want)}
                    </>
                  )}
                </span>
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
            className="btn"
            onClick={() => {
              setGive({ ...trade.give });
              setWant({ ...trade.want });
              setEditing(true);
            }}
          >
            Изменить
          </button>
          <button className="btn ghost" disabled={busy} onClick={() => send({ type: 'cancelTrade' })}>
            Отменить предложение
          </button>
        </div>
      </div>
    );
  }

  const valid = sum(give) > 0 && sum(want) > 0 && !RESOURCES.some((r) => give[r] > 0 && want[r] > 0);
  return (
    <div className="trade-builder">
      <h4>Отдаю</h4>
      <ResourceStepper value={give} onChange={setGive} max={priv.resources} />
      <h4>Хочу получить</h4>
      <ResourceStepper value={want} onChange={setWant} />
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
      {!valid && (sum(give) > 0 || sum(want) > 0) && (
        <p className="muted small">Нужно и отдать, и получить; один ресурс не может быть с обеих сторон.</p>
      )}
    </div>
  );
}

function BankTrade({ pub, priv, send, busy }: { pub: PublicState; priv: PrivateView; send: Send; busy: boolean }) {
  const [give, setGive] = useState<Resource | null>(null);
  const ratio = (r: Resource) => priv.tradeRatios?.[r] ?? 4;
  return (
    <div className="bank-trade">
      <h4>Что отдаёшь</h4>
      <div className="res-picker">
        {RESOURCES.map((r) => (
          <button
            key={r}
            className={give === r ? 'on' : ''}
            style={{ background: RESOURCE_BG[r] }}
            disabled={priv.resources[r] < ratio(r)}
            onClick={() => setGive(r)}
          >
            <ResIcon r={r} className="pick-icon" />
            <small>
              {ratio(r)}:1 · у тебя {priv.resources[r]}
            </small>
          </button>
        ))}
      </div>
      {give && (
        <>
          <h4>
            Что получаешь за {ratio(give)} {RESOURCE_ICON[give]}
          </h4>
          <ResourcePicker
            disabled={(r) => r === give || pub.bank[r] <= 0 || busy}
            onPick={async (receive) => {
              await send({ type: 'bankTrade', give, receive });
              setGive(null);
            }}
          />
        </>
      )}
      <p className="muted small">Курс 4:1, у гаваней 3:1 или 2:1 — гавань работает, если у неё стоит твоё поселение или город.</p>
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
  const [myGive, setMyGive] = useState<ResourceMap>({ ...trade.want });
  const [myGet, setMyGet] = useState<ResourceMap>({ ...trade.give });
  const canAccept = hasResources(priv.resources, trade.want);
  const hint = incomingTradeHint(trade.want, trade.give, priv.resources);

  if (counter) {
    const valid = sum(myGive) > 0 && sum(myGet) > 0 && !RESOURCES.some((r) => myGive[r] > 0 && myGet[r] > 0);
    return (
      <div className="card incoming">
        <h3>Встречное предложение для {from}</h3>
        <h4>Ты отдаёшь</h4>
        <ResourceStepper value={myGive} onChange={setMyGive} max={priv.resources} />
        <h4>Ты получаешь</h4>
        <ResourceStepper value={myGet} onChange={setMyGet} />
        <div className="row">
          <button
            className="btn primary"
            disabled={!valid || busy}
            onClick={async () => {
              await send({ type: 'respondTrade', tradeId: trade.id, kind: 'counter', give: myGet, want: myGive });
              setCounter(false);
            }}
          >
            Отправить
          </button>
          <button className="btn ghost" onClick={() => setCounter(false)}>
            Назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card incoming">
      <h3>{from} предлагает обмен</h3>
      <div className={`hint-card ${hint.canAccept ? 'good' : ''}`}>{hint.text}</div>
      <p className="terms">
        Ты отдаёшь <b>{resourcesText(trade.want)}</b>
        <br />
        Ты получаешь <b>{resourcesText(trade.give)}</b>
      </p>
      {mine && (
        <p className="muted">
          Твой ответ: {mine.kind === 'accept' ? 'согласен' : mine.kind === 'decline' ? 'отказ' : 'встречное предложение'}
        </p>
      )}
      <div className="row">
        <button
          className="btn primary"
          disabled={!canAccept || busy}
          onClick={() => send({ type: 'respondTrade', tradeId: trade.id, kind: 'accept' })}
        >
          Согласен
        </button>
        <button className="btn" disabled={busy} onClick={() => send({ type: 'respondTrade', tradeId: trade.id, kind: 'decline' })}>
          Отказ
        </button>
        <button className="btn ghost" onClick={() => setCounter(true)}>
          Встречное
        </button>
      </div>
    </div>
  );
}
