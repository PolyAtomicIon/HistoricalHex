// Входящее предложение обмена — три вида на выбор игрока (меню → «Вид обмена»):
//   card    — «Карточка сделки» (по умолчанию): снизу, «Ты отдаёшь → Получаешь», подсказка, большие кнопки;
//   caravan — «Караван у берега»: компактная полоса сверху, карта остаётся видна, ✕ / ✓;
//   scales  — «Весы сделки»: во весь экран, весы с ресурсами, шкала выгоды, что будет после.

import { useSyncExternalStore } from 'react';
import type { Action, PlayerId, PrivateView, PublicState, Resource, ResourceMap } from '../engine';
import { RESOURCES } from '../engine';
import type { LorePack } from '../lore';
import { PLAYER_HEX } from '../ui/theme';
import { RESOURCE_NAME } from '../i18n/ru';
import { ArtIcon, Icon } from './icons';
import { eraIcon } from './era';
import { ResIcon } from './ResIcon';
import { tradeVerdict } from './planner';

export type TradeUi = 'card' | 'caravan' | 'scales';
export const TRADE_UI_LABEL: Record<TradeUi, string> = { card: 'Карточка', caravan: 'Караван', scales: 'Весы' };

const KEY = 'hh.tradeUi';
const subs = new Set<() => void>();
const read = (): TradeUi => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'caravan' || v === 'scales' ? v : 'card';
  } catch {
    return 'card';
  }
};
export function setTradeUi(v: TradeUi) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* ok */
  }
  subs.forEach((f) => f());
}
export function useTradeUi(): TradeUi {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    read,
  );
}

interface Props {
  pub: PublicState;
  priv: PrivateView;
  me: PlayerId;
  pack: LorePack;
  busy: boolean;
  send: (a: Action) => Promise<void>;
  /** Встречное предложение — шторка обмена. */
  counter: () => void;
}

const list = (m: ResourceMap) => RESOURCES.filter((r) => (m[r] ?? 0) > 0) as Resource[];

function useOffer({ pub, priv, me }: Pick<Props, 'pub' | 'priv' | 'me'>) {
  const t = pub.trade!;
  const fromId = pub.order[pub.current];
  const from = pub.players[fromId];
  // с моей стороны: отдаю то, что он хочет (want), получаю то, что он даёт (give)
  const v = tradeVerdict(t.want, t.give, priv.resources);
  const answered = t.responses?.[me];
  return { t, from, v, answered };
}

const answerText = (k: string) => (k === 'accept' ? 'Ты согласился — ждём решения' : k === 'decline' ? 'Ты отказал' : 'Ты предложил встречное');

/** A · Карточка сделки */
export function TradeCard(p: Props) {
  const { t, from, v, answered } = useOffer(p);
  return (
    <section key={t.id} className="tro-card glass strong" style={{ ['--pc' as string]: PLAYER_HEX[from.color] }} aria-label="Входящее предложение">
      <div className="tro-head">
        <span className="tro-ava">{from.name.charAt(0).toUpperCase()}</span>
        <span className="tro-who">
          <b>{from.name} предлагает обмен</b>
          <small>{answered ? answerText(answered.kind) : 'Ответь, пока идёт его ход'}</small>
        </span>
      </div>
      <div className="tro-swap">
        <div className="tro-side">
          <span className="tro-cap">Ты отдаёшь</span>
          <ResPile res={t.want} />
          <small>{list(t.want).map((r) => (v.canAccept ? `${RESOURCE_NAME[r]}: ${p.priv.resources[r]} → ${v.after[r]}` : `у тебя ${RESOURCE_NAME[r]}: ${p.priv.resources[r]}`)).join(' · ')}</small>
        </div>
        <span className="tro-arrow" aria-hidden>
          <Icon name="next" size={18} />
        </span>
        <div className="tro-side get">
          <span className="tro-cap">Получаешь</span>
          <ResPile res={t.give} />
          <small>{list(t.give).map((r) => RESOURCE_NAME[r]).join(', ')}</small>
        </div>
      </div>
      <div className={`tro-hint ${v.canAccept ? (v.fair >= 0 ? 'good' : 'warn') : 'bad'}`}>
        <Icon name="bulb" size={16} />
        <span>{v.text}</span>
      </div>
      {!answered && (
        <>
          <div className="tro-btns">
            <button className="btn" disabled={p.busy} onClick={() => void p.send({ type: 'respondTrade', tradeId: t.id, kind: 'decline' })}>
              Отказать
            </button>
            <button className="btn primary" disabled={p.busy || !v.canAccept} onClick={() => void p.send({ type: 'respondTrade', tradeId: t.id, kind: 'accept' })}>
              Принять обмен
            </button>
          </div>
          <button className="tro-link" onClick={p.counter}>
            Предложить своё
          </button>
        </>
      )}
    </section>
  );
}

/** B · Караван у берега — компактная полоса (в колонке сверху) */
export function TradeCaravan(p: Props) {
  const { t, from, v, answered } = useOffer(p);
  return (
    <section key={t.id} className="tro-caravan glass strong" style={{ ['--pc' as string]: PLAYER_HEX[from.color] }} aria-label="Входящее предложение">
      <div className="trc-row">
        <button className="trc-ava" onClick={p.counter} aria-label={`${from.name}: подробнее и встречное`}>
          {from.name.charAt(0).toUpperCase()}
        </button>
        <span className="trc-terms">
          <Chips res={t.want} />
          <Icon name="trade" size={16} />
          <Chips res={t.give} get />
        </span>
        {answered ? (
          <small className="trc-ans">{answered.kind === 'accept' ? 'Да' : answered.kind === 'decline' ? 'Нет' : 'Встречное'}</small>
        ) : (
          <>
            <button className="trc-btn no" aria-label="Отказать" disabled={p.busy} onClick={() => void p.send({ type: 'respondTrade', tradeId: t.id, kind: 'decline' })}>
              <Icon name="close" size={18} />
            </button>
            <button className="trc-btn yes" aria-label="Принять" disabled={p.busy || !v.canAccept} onClick={() => void p.send({ type: 'respondTrade', tradeId: t.id, kind: 'accept' })}>
              <Icon name="check" size={20} />
            </button>
          </>
        )}
      </div>
      <small className={`trc-verdict ${v.canAccept ? (v.fair >= 0 ? 'good' : 'warn') : 'bad'}`}>
        {from.name}: {v.text}
      </small>
    </section>
  );
}

/** C · Весы сделки — во весь экран */
export function TradeScales(p: Props) {
  const { t, from, v, answered } = useOffer(p);
  const tilt = Math.max(-12, Math.min(12, v.fair * 12)); // перевешивает (опускается) то, чего больше
  const knob = Math.round(50 + v.fair * 45);
  return (
    <div key={t.id} className="tro-scales" role="dialog" aria-label={`Предложение от ${from.name}`}>
      <div className="trs-glow" aria-hidden />
      <header className="trs-head">
        <ArtIcon src={eraIcon(p.pack.id, 'emblem')} size={56} />
        <span className="trs-eyebrow">Предложение</span>
        <h2>Караван: {from.name}</h2>
        <p>
          Просит {list(t.want).map((r) => RESOURCE_NAME[r]).join(', ')} — даёт {list(t.give).map((r) => RESOURCE_NAME[r]).join(', ')}
        </p>
      </header>
      <div className="trs-scale" aria-hidden>
        <div className="trs-beam" style={{ transform: `rotate(${tilt}deg)` }}>
          <div className="trs-pan left" style={{ transform: `rotate(${-tilt}deg)` }}>
            <ResPile res={t.want} big />
          </div>
          <div className="trs-pan right" style={{ transform: `rotate(${-tilt}deg)` }}>
            <ResPile res={t.give} big />
          </div>
        </div>
        <div className="trs-post" />
      </div>
      <div className="trs-labels">
        <span>Отдаёшь · {v.out}</span>
        <span className="get">Получаешь · {v.inn}</span>
      </div>
      <div className="trs-meter" aria-label={v.text}>
        <div className="trs-meter-ends">
          <span>невыгодно</span>
          <span>выгодно</span>
        </div>
        <div className="trs-bar">
          <i style={{ left: `${knob}%` }} />
        </div>
        <p className="trs-after">{v.text}</p>
      </div>
      <div className="trs-btns">
        {answered ? (
          <p className="trs-ans">{answerText(answered.kind)}</p>
        ) : (
          <>
            <button className="btn primary big" disabled={p.busy || !v.canAccept} onClick={() => void p.send({ type: 'respondTrade', tradeId: t.id, kind: 'accept' })}>
              Ударить по рукам
            </button>
            <div className="trs-row">
              <button className="btn" onClick={p.counter}>
                Встречное
              </button>
              <button className="btn" disabled={p.busy} onClick={() => void p.send({ type: 'respondTrade', tradeId: t.id, kind: 'decline' })}>
                Отказать
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ResPile({ res, big }: { res: ResourceMap; big?: boolean }) {
  return (
    <span className={`tro-pile ${big ? 'big' : ''}`}>
      {list(res).map((r) => (
        <span key={r} className="tro-res">
          <ResIcon r={r} size={big ? 46 : 52} />
          {(res[r] ?? 0) > 1 && <b>×{res[r]}</b>}
        </span>
      ))}
    </span>
  );
}

function Chips({ res, get }: { res: ResourceMap; get?: boolean }) {
  return (
    <span className={`trc-chips ${get ? 'get' : ''}`}>
      {list(res).map((r) => (
        <span key={r} className="trc-chip">
          <ResIcon r={r} size={24} />
          <b>{res[r]}</b>
        </span>
      ))}
    </span>
  );
}
