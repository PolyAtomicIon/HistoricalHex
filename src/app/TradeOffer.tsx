// Входящее предложение обмена — два вида на выбор игрока (меню → «Вид предложения обмена»):
//   card    — «Сделка» (по умолчанию): стеклянная карточка над доком, две плитки «Отдаёшь ⇄ Получаешь»,
//             вердикт одной строкой, «Отказать» / «Принять»; после согласия плитки меняются местами;
//   caravan — «Караван у берега»: компактная полоса сверху, карта остаётся видна, ✕ / ✓.
// Прежний вид «Весы» убран: сохранённый выбор 'scales' показывает «Сделку».

import type { ReactNode } from 'react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Action, PlayerId, PrivateView, PublicState, Resource, ResourceMap } from '../engine';
import { RESOURCES } from '../engine';
import type { LorePack } from '../lore';
import { PLAYER_HEX } from '../ui/theme';
import { Icon } from './icons';
import { ResIcon } from './ResIcon';
import { counterIdeas, tradeVerdict } from './planner';
import type { CounterIdea } from './planner';
import { Sheet } from './Sheet';
import { RESOURCE_NAME } from '../i18n/ru';
import { L } from '../i18n/l';

export type TradeUi = 'card' | 'caravan';
// Геттеры — подпись берётся на текущем языке в момент обращения
export const TRADE_UI_LABEL: Record<TradeUi, string> = {
  get card() {
    return L('Сделка', 'Мәміле', 'Deal');
  },
  get caravan() {
    return L('Караван', 'Керуен', 'Caravan');
  },
};

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
  const ideas = answered ? [] : counterIdeas(t.want, t.give, priv.resources);
  return { t, from, v, answered, ideas };
}

/** Высота карточки сделки → --deal-h: плашки над доком поднимаются над ней, а не ложатся сверху. */
function useDealHeight(dep: unknown) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!el) return;
    const set = () => root.style.setProperty('--deal-h', `${Math.ceil(el.getBoundingClientRect().height) + 10}px`);
    set();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--deal-h');
    };
  }, [dep]);
  return ref;
}

/** Встречное в одно касание: одно — сразу кнопкой, несколько — шторка со списком. */
function CounterButton({ p, ideas, className, children }: { p: Props; ideas: CounterIdea[]; className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const t = p.pub.trade!;
  const from = p.pub.players[p.pub.order[p.pub.current]];
  const send = (c: CounterIdea) => {
    setOpen(false);
    void p.send({ type: 'respondTrade', tradeId: t.id, kind: 'counter', give: c.get, want: c.give });
  };
  // Лучшее встречное — одним касанием; остальные варианты и «своё» — в шторке (кнопка «ещё»)
  return (
    <>
      <button className={className ?? 'btn deal-yes'} disabled={p.busy} onClick={() => send(ideas[0])} aria-label={L('Предложить: {label}', 'Ұсыну: {label}', 'Offer: {label}', { label: ideas[0].label })}>
        {children ?? (
          <span className="dm-counter">
            <small>{L('Предложить', 'Ұсыну', 'Offer')}</small>
            <MiniRes res={ideas[0].give} />
            <Icon name="next" size={12} />
            <MiniRes res={ideas[0].get} get />
          </span>
        )}
      </button>
      {!children && (
        <button className="btn dm-more" onClick={() => setOpen(true)} aria-label={L('Другие варианты', 'Басқа нұсқалар', 'Other options')}>
          <Icon name="menu" size={18} />
        </button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={L('Встречное предложение', 'Қарсы ұсыныс', 'Counteroffer')} description={L('{name} просит то, чего у тебя нет. Предложи иначе:', '{name} сенде жоқ нәрсені сұрайды. Басқаша ұсын:', "{name} asks for something you don't have. Offer something else:", { name: from.name })}>
        <div className="list counter-list">
          {ideas.map((c, i) => (
            <button key={i} className="item" disabled={p.busy} onClick={() => send(c)}>
              <span className="grow">
                <span className="t">{c.label}</span>
                <span className="counter-terms">
                  <span className="faint">{L('отдаёшь', 'бересің', 'you give')}</span> <MiniRes res={c.give} />
                  <Icon name="next" size={14} />
                  <span className="faint">{L('получаешь', 'аласың', 'you get')}</span> <MiniRes res={c.get} get />
                </span>
              </span>
            </button>
          ))}
          <button
            className="item"
            onClick={() => {
              setOpen(false);
              p.counter();
            }}
          >
            <Icon name="feather" />
            <span className="grow t">{L('Своё — собрать вручную', 'Өзімше — қолмен құрастыру', 'Custom: build it by hand')}</span>
            <Icon name="next" size={16} />
          </button>
        </div>
      </Sheet>
    </>
  );
}

const answerText = (k: string) =>
  k === 'accept'
    ? L('Ты согласился — ждём решения', 'Сен келістің — шешімді күтеміз', 'You agreed — waiting for the decision')
    : k === 'decline'
      ? L('Ты отказал', 'Сен бас тарттың', 'You declined')
      : L('Ты предложил встречное', 'Сен қарсы ұсыныс жасадың', 'You made a counteroffer');

/** A · Сделка — стеклянная карточка над доком */
export function TradeCard(p: Props) {
  const { t, from, v, answered, ideas } = useOffer(p);
  const tone = v.canAccept ? (v.fair >= 0 ? 'good' : 'warn') : 'bad';
  const agreed = answered?.kind === 'accept';
  const ref = useDealHeight(t.id);
  // Мини-плашка: кто, что отдаёшь → что получаешь, три кнопки. Не закрывает карту.
  // Нечем ответить — вместо «Да» сразу готовое встречное (одно — кнопкой, несколько — шторкой).
  return (
    <section ref={ref} key={t.id} className={`deal deal-mini glass strong ${agreed ? 'agreed' : ''}`} aria-label={L('Предложение от {name}', '{name} ұсынысы', 'Offer from {name}', { name: from.name })}>
      <div className="dm-row">
        <span className="deal-ava" style={{ background: PLAYER_HEX[from.color] }}>
          {from.name.charAt(0).toUpperCase()}
        </span>
        <span className="dm-who">
          <b className="dm-name">{from.name}</b>
          <small>{L('предлагает обмен', 'айырбас ұсынады', 'offers a trade')}</small>
        </span>
      </div>
      <div className="dm-swap">
        <MiniRes res={t.want} label={L('Ты отдаёшь', 'Сен бересің', 'You give')} />
        <Icon name="trade" size={18} className="dm-arrow" />
        <MiniRes res={t.give} get label={L('Ты получаешь', 'Сен аласың', 'You get')} />
      </div>
      {!answered && from.bot && <span key={`tm${t.id}`} className="dm-timer" aria-hidden />}
      {(answered || !v.canAccept) && (
        <p className={`dm-note ${answered ? '' : tone}`}>{answered ? answerText(answered.kind) : v.text}</p>
      )}
      {!answered && (
        <div className="dm-btns">
          <button className="btn" disabled={p.busy} onClick={() => void p.send({ type: 'respondTrade', tradeId: t.id, kind: 'decline' })}>
            {L('Нет', 'Жоқ', 'No')}
          </button>
          {v.canAccept || !ideas.length ? (
            <>
              <button className="btn" onClick={p.counter}>
                {L('Своё', 'Өзімше', 'Custom')}
              </button>
              <button className="btn deal-yes" disabled={p.busy || !v.canAccept} onClick={() => void p.send({ type: 'respondTrade', tradeId: t.id, kind: 'accept' })}>
                {L('Обменять', 'Айырбастау', 'Trade')}
              </button>
            </>
          ) : (
            <CounterButton p={p} ideas={ideas} className="btn deal-yes dm-cnt" />
          )}
        </div>
      )}
    </section>
  );
}

/** Одна сторона сделки. С подписью — колонка «Ты отдаёшь/получаешь» с названиями; без неё — компактно, значки ×n. */
function MiniRes({ res, get, label }: { res: ResourceMap; get?: boolean; label?: string }) {
  if (!label)
    return (
      <span className={`dm-res dm-compact ${get ? 'get' : 'give'}`}>
        {list(res).map((r) => (
          <span key={r} className="dm-r">
            <ResIcon r={r} size={22} />
            {(res[r] ?? 0) > 1 && <small>×{res[r]}</small>}
          </span>
        ))}
      </span>
    );
  return (
    <span className={`dm-res ${get ? 'get' : 'give'}`}>
      <small className="dm-lbl">{label}</small>
      <span className="dm-items">
        {list(res).map((r) => (
          <span key={r} className="dm-r">
            <ResIcon r={r} size={24} />
            <span>
              {(res[r] ?? 0) > 1 ? `${res[r]} ` : ''}
              {RESOURCE_NAME[r]}
            </span>
          </span>
        ))}
      </span>
    </span>
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
  const { t, from, v, answered, ideas } = useOffer(p);
  return (
    <section key={t.id} className="tro-caravan glass strong" style={{ ['--pc' as string]: PLAYER_HEX[from.color] }} aria-label={L('Входящее предложение', 'Кіріс ұсыныс', 'Incoming offer')}>
      <div className="trc-row">
        <button className="trc-ava" onClick={p.counter} aria-label={L('{name}: подробнее и встречное', '{name}: толығырақ және қарсы ұсыныс', '{name}: details and counteroffer', { name: from.name })}>
          {from.name.charAt(0).toUpperCase()}
        </button>
        <span className="trc-terms">
          <Chips res={t.want} />
          <Icon name="trade" size={16} />
          <Chips res={t.give} get />
        </span>
        {answered ? (
          <small className="trc-ans">{answered.kind === 'accept' ? L('Да', 'Иә', 'Yes') : answered.kind === 'decline' ? L('Нет', 'Жоқ', 'No') : L('Встречное', 'Қарсы', 'Counter')}</small>
        ) : (
          <>
            <button className="trc-btn no" aria-label={L('Отказать', 'Бас тарту', 'Decline')} disabled={p.busy} onClick={() => void p.send({ type: 'respondTrade', tradeId: t.id, kind: 'decline' })}>
              <Icon name="close" size={18} />
            </button>
            {!v.canAccept && ideas.length ? (
              <CounterButton p={p} ideas={ideas} className="trc-btn yes">
                <Icon name="trade" size={18} />
              </CounterButton>
            ) : (
              <button className="trc-btn yes" aria-label={L('Принять', 'Қабылдау', 'Accept')} disabled={p.busy || !v.canAccept} onClick={() => void p.send({ type: 'respondTrade', tradeId: t.id, kind: 'accept' })}>
                <Icon name="check" size={20} />
              </button>
            )}
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
