// «Сводка стола» на телефоне: то, что ТВ показывает на большом экране, — по запросу, в одном листе.
//   Рынок  — чего на столе в дефиците, чего много, что кончилось в банке;
//   Числа  — кто что получит на каждом числе кубиков;
//   Журнал — события партии (бывшая строка рассказчика сверху экрана).

import { useMemo } from 'react';
import type { PlayerId, PublicState, Resource } from '../engine';
import { RESOURCE_NAME } from '../i18n/ru';
import { PLAYER_HEX } from '../ui/theme';
import { Icon } from './icons';
import { ResIcon } from './ResIcon';
import { tableHarvest, type Supply } from './income';
import { L } from '../i18n/l';

const ORDER: Record<NonNullable<Supply['tag']> | 'ok', number> = { none: 0, scarce: 1, ok: 2, plenty: 3 };

function tagText(s: Supply): { text: string; tone: 'bad' | 'good' | 'faint' } | null {
  if (s.tag === 'none') return { text: L('никто не добывает', 'ешкім өндірмейді', 'nobody produces it'), tone: 'bad' };
  if (s.tag === 'scarce') return { text: L('дефицит', 'тапшы', 'scarce'), tone: 'bad' };
  if (s.tag === 'plenty') return { text: L('много', 'көп', 'plenty'), tone: 'good' };
  if (s.bank < 4) return { text: L('банк почти пуст', 'банк бос дерлік', 'bank almost empty'), tone: 'faint' };
  return null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function MarketTab({ pub, me }: { pub: PublicState; me?: PlayerId }) {
  const { supply } = useMemo(() => tableHarvest(pub), [pub.buildings, pub.robberHex, pub.bank]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = [...supply].sort((a, b) => ORDER[a.tag ?? 'ok'] - ORDER[b.tag ?? 'ok']);
  return (
    <ul className="ti-market">
      {list.map((s) => {
        const t = tagText(s);
        return (
          <li key={s.r}>
            <ResIcon r={s.r} size={36} />
            <span className="ti-m-txt">
              <b>{cap(RESOURCE_NAME[s.r])}</b>
              <small>
                ≈ {s.perRoll.toFixed(1).replace('.', ',')} {L('за бросок', 'бір лақтыруға', 'per roll')} · {L('в банке {n}', 'банкте {n}', '{n} in bank', { n: s.bank })}
              </small>
            </span>
            {t && <span className={`ti-tag ${t.tone}`}>{t.text}</span>}
            {s.by.length > 0 && (
              // Кто добывает — у них и проси при обмене
              <span className="ti-by">
                {s.by.map((b) => (
                  <span key={b.who} className={`ti-by-p ${b.who === me ? 'me' : ''}`} style={{ ['--pc' as string]: PLAYER_HEX[pub.players[b.who]?.color] }}>
                    <i />
                    {b.who === me ? L('Ты', 'Сен', 'You') : pub.players[b.who]?.name} <small>{b.perRoll.toFixed(1).replace('.', ',')}</small>
                  </span>
                ))}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Гонка за «Самым сильным войском»: сколько воинов сыграл каждый и сколько нужно, чтобы забрать бонус. */
export function ArmyRace({ pub, me, title }: { pub: PublicState; me?: PlayerId; title: string }) {
  const list = pub.order.map((id) => ({ id, n: pub.players[id].knightsPlayed })).sort((a, b) => b.n - a.n);
  const holder = pub.largestArmy;
  const top = holder ? pub.players[holder].knightsPlayed : 0;
  const need = holder ? top + 1 : 3;
  return (
    <section className="ti-army">
      <div className="ti-army-h">
        <b>{title}</b>
        <small>{holder ? L('у {name} · чтобы забрать, нужно {need}', '{name} иесі · алу үшін {need} керек', '{name} holds it · {need} to take it', { name: holder === me ? L('тебя', 'сенде', 'you') : pub.players[holder].name, need }) : L('нужно 3 сыгранных воина — бонус +2 очка', '3 жауынгер ойнау керек — бонус +2 ұпай', 'play 3 knights for a +2 point bonus')}</small>
      </div>
      <div className="ti-army-row">
        {list.map(({ id, n }) => (
          <span key={id} className={`ti-army-p ${id === holder ? 'lead' : ''}`} style={{ ['--pc' as string]: PLAYER_HEX[pub.players[id].color] }}>
            <i />
            <span className="ti-army-name">{id === me ? L('Ты', 'Сен', 'You') : pub.players[id].name}</span>
            <b>
              <Icon name="army" size={13} /> {n}
            </b>
          </span>
        ))}
      </div>
    </section>
  );
}

export function NumbersTab({ pub, me }: { pub: PublicState; me?: PlayerId }) {
  const { rows } = useMemo(() => tableHarvest(pub), [pub.buildings, pub.robberHex, pub.bank]); // eslint-disable-line react-hooks/exhaustive-deps
  const hit = pub.dice && pub.phase !== 'setup' && pub.phase !== 'roll' ? pub.dice[0] + pub.dice[1] : 0;
  if (!rows.length) return <p className="muted small">{L('Числа появятся, когда на карте будут поселения.', 'Картада елдімекендер пайда болғанда сандар шығады.', 'Numbers will appear once there are settlements on the map.')}</p>;
  return (
    <ul className="ti-nums">
      {rows.map((r) => (
        <li key={r.n} className={r.n === hit ? 'hit' : ''}>
          <span className={`ti-n ${r.ways === 5 ? 'hot' : ''}`}>
            {r.n}
            <i>{'•'.repeat(r.ways)}</i>
          </span>
          <span className="ti-gets">
            {r.gets.length === 0 && <small className="faint">{L('никто', 'ешкім', 'nobody')}</small>}
            {r.gets.map((g) => (
              <span key={g.who} className={`ti-g ${g.who === me ? 'me' : ''}`} style={{ ['--pc' as string]: PLAYER_HEX[pub.players[g.who]?.color] }}>
                {(Object.entries(g.res) as [Resource, number][]).map(([res, c]) => (
                  <span key={res} className="ti-r">
                    <ResIcon r={res} size={20} />
                    {c > 1 && <small>{c}</small>}
                  </span>
                ))}
              </span>
            ))}
            {r.blocked && (
              <span className="ti-blocked" title={L('Гекс захвачен', 'Гекс басып алынған', 'Hex is blocked')}>
                <Icon name="ban" size={14} />
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
