// История эпохи: вступление, словарь эпохи и факты с источниками.

import { useEffect, useState } from 'react';
import { RESOURCES } from '../engine';
import type { LoreFact, LorePack } from '../lore';
import { ArtIcon } from './icons';
import { eraIcon } from './era';
import { L } from '../i18n/l';

export function FactsList({ pack }: { pack: LorePack }) {
  const [only, setOnly] = useState<'all' | 'kz'>('all');
  const facts = pack.facts.filter((f) => only === 'all' || f.kz);
  return (
    <div className="stack">
      <p className="faint small lore-region">{pack.region}</p>
      {pack.intro.map((p, i) => (
        <p key={i} className="intro-p">
          {p}
        </p>
      ))}
      <div className="label">{L('Словарь эпохи', 'Дәуір сөздігі', 'Era glossary')}</div>
      <div className="glossary">
        {RESOURCES.map((r) => (
          <div key={r} className="item">
            <ArtIcon src={eraIcon(pack.id, `res-${r}`)} size={40} />
            <div className="grow">
              <div className="t">{pack.resources[r].name}</div>
              <div className="s">{pack.resources[r].note}</div>
            </div>
          </div>
        ))}
        <div className="item">
          <ArtIcon src={eraIcon(pack.id, 'robber-unit')} size={40} />
          <div className="grow">
            <div className="t">{pack.robber.name}</div>
            <div className="s">{pack.robber.note}</div>
          </div>
        </div>
      </div>
      <div className="seg">
        <button aria-pressed={only === 'all'} onClick={() => setOnly('all')}>
          {L('Все факты · {n}', 'Барлық фактілер · {n}', 'All facts · {n}', { n: pack.facts.length })}
        </button>
        <button aria-pressed={only === 'kz'} onClick={() => setOnly('kz')}>
          {L('Казахстан · {n}', 'Қазақстан · {n}', 'Kazakhstan · {n}', { n: pack.facts.filter((f) => f.kz).length })}
        </button>
      </div>
      {facts.map((f, i) => (
        <Fact key={i} f={f} />
      ))}
      <div className="label">{L('Источники', 'Дереккөздер', 'Sources')}</div>
      <ul className="sources faint small">
        {pack.sources.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

export function Fact({ f, big, noSource }: { f: LoreFact; big?: boolean; noSource?: boolean }) {
  return (
    <div className={`fact-card ${big ? 'big' : ''}`}>
      {(f.year || f.kz) && (
        <div className="fc-head">
          {f.year && <span className="yr">{f.year}</span>}
          {f.kz && <span className="kz-tag">{L('Казахстан', 'Қазақстан', 'Kazakhstan')}</span>}
        </div>
      )}
      <p className="fc-text">{f.text}</p>
      {!noSource && f.source && !/\.(json|ts|md)\b/.test(f.source) && <span className="src">{f.source}</span>}
    </div>
  );
}

/** Случайный факт, который меняется каждые N секунд (для ожидания хода и ТВ). */
export function useRotatingFact(pack: LorePack, everyMs = 14000): LoreFact {
  const [i, setI] = useState(() => Math.floor(Math.random() * pack.facts.length));
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1 + Math.floor(Math.random() * 3)) % pack.facts.length), everyMs);
    return () => clearInterval(t);
  }, [pack, everyMs]);
  return pack.facts[i % pack.facts.length];
}
