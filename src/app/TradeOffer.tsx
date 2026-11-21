// Входящее предложение обмена — два вида на выбор игрока (меню → «Вид предложения обмена»):
//   card    — «Сделка» (по умолчанию): стеклянная карточка над доком, две плитки «Отдаёшь ⇄ Получаешь»,
//             вердикт одной строкой, «Отказать» / «Принять»; после согласия плитки меняются местами;
//   caravan — «Караван у берега»: компактная полоса сверху, карта остаётся видна, ✕ / ✓.
// Прежний вид «Весы» убран: сохранённый выбор 'scales' показывает «Сделку».

import { useSyncExternalStore } from 'react';
import type { Action, PlayerId, PrivateView, PublicState, Resource, ResourceMap } from '../engine';
import { RESOURCES } from '../engine';
import type { LorePack } from '../lore';
import { PLAYER_HEX } from '../ui/theme';
import { Icon } from './icons';
import { ResIcon } from './ResIcon';
import { tradeVerdict } from './planner';

export type TradeUi = 'card' | 'caravan';
export const TRADE_UI_LABEL: Record<TradeUi, string> = { card: 'Сделка', caravan: 'Караван' };

const KEY = 'hh.tradeUi';
const subs = new Set<() => void>();
const read = (): TradeUi => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'caravan' ? v : 'card';
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

/** A · Сделка — стеклянная карточка над доком */
export function TradeCard(p: Props) {
  const { t, from, v, answered } = useOffer(p);
  const tone = v.canAccept ? (v.fair >= 0 ? 'good' : 'warn') : 'bad';
  const agreed = answered?.kind === 'accept';
  return (
    <section key={t.id} className={`deal glass strong ${agreed ? 'agreed' : ''}`} aria-label={`Предложение от ${from.name}`}>
      <header className="deal-head">
        <span className="deal-ava" style={{ background: PLAYER_HEX[from.color] }}>
          {from.name.charAt(0).toUpperCase()}
        </span>
        <span className="deal-who">
          <b>{from.name}</b>
          <small>{answered ? answerText(answered.kind) : 'предлагает сделку'}</small>
        </span>
      </header>
      <div className="deal-swap">
        <div className="deal-tile give">
          <DealPile res={t.want} />
          <span>Отдаёшь</span>
        </div>
        <span className="deal-x" aria-hidden>
          <Icon name="trade" size={18} />
        </span>
        <div className="deal-tile get">
          <DealPile res={t.give} />
          <span>Получаешь</span>
        </div>
      </div>
      <p className={`deal-verdict ${tone}`}>{v.text}</p>
      {!answered && (
        <div className="deal-btns">
          <button className="btn" disabled={p.busy} onClick={() => void p.send({ type: 'respondTrade', tradeId: t.id, kind: 'decline' })}>
            Отказать
          </button>
          <button className="btn deal-yes" disabled={p.busy || !v.canAccept} onClick={() => void p.send({ type: 'respondTrade', tradeId: t.id, kind: 'accept' })}>
            Принять
          </button>
          <button className="deal-more" onClick={p.counter}>
            Предложить своё
          </button>
        </div>
      )}
      {agreed && <span className="deal-wait" aria-hidden><i /><i /><i /></span>}
    </section>
  );
}

function DealPile({ res }: { res: ResourceMap }) {
  const rs = list(res);
  return (
    <span className="deal-pile">
      {rs.map((r, i) => (
        <span key={r} className="deal-res" style={{ ['--i' as string]: i }}>
          <ResIcon r={r} size={rs.length > 2 ? 40 : 54} />
          {(res[r] ?? 0) > 1 && <b>×{res[r]}</b>}
        </span>
      ))}
    </span>
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
