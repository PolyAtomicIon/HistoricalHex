// История эпохи: вступление, словарь эпохи и факты с источниками.

import { useEffect, useState } from 'react';
import { RESOURCES } from '../engine';
import type { LoreFact, LorePack } from '../lore';
import { ArtIcon } from './icons';
import { eraIcon } from './era';

export function FactsList({ pack }: { pack: LorePack }) {
  const [only, setOnly] = useState<'all' | 'kz'>('all');
  const facts = pack.facts.filter((f) => only === 'all' || f.kz);
  return (
    <div className="stack">
      {pack.intro.map((p, i) => (
        <p key={i} className="intro-p">
          {p}
        </p>
      ))}
      <div className="label">Словарь эпохи</div>
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
          <ArtIcon src={eraIcon(pack.id, 'robber')} size={40} />
          <div className="grow">
            <div className="t">{pack.robber.name}</div>
            <div className="s">{pack.robber.note}</div>
          </div>
        </div>
      </div>
      <div className="seg">
        <button aria-pressed={only === 'all'} onClick={() => setOnly('all')}>
          Все факты · {pack.facts.length}
        </button>
        <button aria-pressed={only === 'kz'} onClick={() => setOnly('kz')}>
          Казахстан · {pack.facts.filter((f) => f.kz).length}
        </button>
      </div>
      {facts.map((f, i) => (
        <Fact key={i} f={f} />
      ))}
      <div className="label">Источники</div>
      <ul className="sources faint small">
        {pack.sources.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

export function Fact({ f }: { f: LoreFact }) {
  return (
    <div className="fact-card">
      {f.year && <span className="yr">{f.year}</span>}
      {f.kz && <span className="kz-tag">KZ</span>}
      {f.text}
      <span className="src">{f.source}</span>
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
