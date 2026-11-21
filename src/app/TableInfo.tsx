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

const ORDER: Record<NonNullable<Supply['tag']> | 'ok', number> = { none: 0, scarce: 1, ok: 2, plenty: 3 };

function tagText(s: Supply): { text: string; tone: 'bad' | 'good' | 'faint' } | null {
  if (s.tag === 'none') return { text: 'никто не добывает', tone: 'bad' };
  if (s.tag === 'scarce') return { text: 'дефицит', tone: 'bad' };
  if (s.tag === 'plenty') return { text: 'много', tone: 'good' };
  if (s.bank < 4) return { text: 'банк почти пуст', tone: 'faint' };
  return null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function MarketTab({ pub }: { pub: PublicState }) {
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
                ≈ {s.perRoll.toFixed(1).replace('.', ',')} за бросок · в банке {s.bank}
              </small>
            </span>
            {t && <span className={`ti-tag ${t.tone}`}>{t.text}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function NumbersTab({ pub, me }: { pub: PublicState; me?: PlayerId }) {
  const { rows } = useMemo(() => tableHarvest(pub), [pub.buildings, pub.robberHex, pub.bank]); // eslint-disable-line react-hooks/exhaustive-deps
  const hit = pub.dice && pub.phase !== 'setup' && pub.phase !== 'roll' ? pub.dice[0] + pub.dice[1] : 0;
  if (!rows.length) return <p className="muted small">Числа появятся, когда на карте будут поселения.</p>;
  return (
    <ul className="ti-nums">
      {rows.map((r) => (
        <li key={r.n} className={r.n === hit ? 'hit' : ''}>
          <span className={`ti-n ${r.ways === 5 ? 'hot' : ''}`}>
            {r.n}
            <i>{'•'.repeat(r.ways)}</i>
          </span>
          <span className="ti-gets">
            {r.gets.length === 0 && <small className="faint">никто</small>}
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
              <span className="ti-blocked" title="Гекс захвачен">
                <Icon name="ban" size={14} />
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
