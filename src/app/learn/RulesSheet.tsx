// Справочник правил: поиск, оглавление и карточки разделов на трёх языках.

import { Fragment, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Sheet } from '../Sheet';
import { Icon } from '../icons';
import { LANGS, t3, useLang } from './lang';
import type { Lang } from './lang';
import { RULE_SECTIONS } from './rulesContent';
import type { RuleSection } from './rulesContent';
import { matchRanges, queryTerms, searchRules } from './rulesSearch';
import './rules.css';

const UI = {
  title: { ru: 'Правила игры', kz: 'Ойын ережелері', en: 'Game rules' },
  placeholder: { ru: 'Поиск по правилам', kz: 'Ережелерден іздеу', en: 'Search the rules' },
  contents: { ru: 'Содержание', kz: 'Мазмұны', en: 'Contents' },
  emptyTitle: { ru: 'Ничего не нашлось', kz: 'Ештеңе табылмады', en: 'Nothing found' },
  emptyHint: {
    ru: 'Попробуй другое слово, например «семь», «сбросить» или «порт».',
    kz: 'Басқа сөзді байқап көр, мысалы «қарақшы», «қала» немесе «айырбас».',
    en: 'Try another word, like “robber”, “city” or “trade”.',
  },
  clear: { ru: 'Очистить', kz: 'Тазалау', en: 'Clear' },
  found: { ru: 'Найдено', kz: 'Табылды', en: 'Found' },
};

/** Приводим к виду для сравнения: нижний регистр, ё = е, қазақ-буквы остаются как есть. */

/** Подсвечивает совпадения запроса — каждое до конца слова. */
function highlight(text: string, terms: string[]): ReactNode {
  if (!terms.length) return text;
  const ranges = matchRanges(text, terms);
  if (!ranges.length) return text;
  const out: ReactNode[] = [];
  let from = 0;
  ranges.forEach(([a, b], k) => {
    if (a > from) out.push(text.slice(from, a));
    out.push(<mark key={k}>{text.slice(a, b)}</mark>);
    from = b;
  });
  if (from < text.length) out.push(text.slice(from));
  return <Fragment>{out}</Fragment>;
}

function Paragraph({ text, q }: { text: string; q: string[] }) {
  if (text.startsWith('• ')) {
    return (
      <li className="rules-li">
        <span aria-hidden className="rules-dot" />
        <span>{highlight(text.slice(2), q)}</span>
      </li>
    );
  }
  const numbered = /^\d\.\s/.test(text);
  return <p className={numbered ? 'rules-p rules-step' : 'rules-p'}>{highlight(text, q)}</p>;
}

/** Подряд идущие пункты «• …» собираем в один список. */
function renderBody(body: string[], q: string[]): ReactNode[] {
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    const items = list;
    list = [];
    out.push(
      <ul className="rules-ul" key={`ul${out.length}`}>
        {items.map((t, i) => (
          <Paragraph key={i} text={t} q={q} />
        ))}
      </ul>,
    );
  };
  body.forEach((text, i) => {
    if (text.startsWith('• ')) list.push(text);
    else {
      flush();
      out.push(<Paragraph key={`p${i}`} text={text} q={q} />);
    }
  });
  flush();
  return out;
}

export function RulesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [lang, setLang] = useLang();
  const [query, setQuery] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const q = useMemo(() => queryTerms(query), [query]);

  const visible = useMemo(() => searchRules(RULE_SECTIONS, q, lang), [q, lang]);

  const jump = (id: string) => {
    const el = bodyRef.current?.querySelector<HTMLElement>(`[data-rule="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Sheet open={open} onClose={onClose} title={t3(UI.title, lang)}>
      <div className="rules" ref={bodyRef}>
        <div className="seg rules-lang" role="group">
          {LANGS.map((l) => (
            <button key={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>
              {l.label}
            </button>
          ))}
        </div>

        <div className="rules-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t3(UI.placeholder, lang)}
            aria-label={t3(UI.placeholder, lang)}
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {query && (
            <button className="rules-clear" onClick={() => setQuery('')} aria-label={t3(UI.clear, lang)}>
              <Icon name="close" size={16} />
            </button>
          )}
        </div>

        {!q.length && (
          <nav className="rules-toc" aria-label={t3(UI.contents, lang)}>
            {RULE_SECTIONS.map((s) => (
              <button key={s.id} className="rules-chip" onClick={() => jump(s.id)}>
                <Icon name={s.icon} size={15} />
                <span>{t3(s.title, lang)}</span>
              </button>
            ))}
          </nav>
        )}

        {q.length > 0 && visible.length > 0 && (
          <p className="rules-count">
            {t3(UI.found, lang)}: {visible.length}
          </p>
        )}

        {visible.map((s) => (
          <section className="rules-card" key={s.id} data-rule={s.id}>
            <h3 className="rules-h">
              <span className="rules-ico" aria-hidden>
                <Icon name={s.icon} size={18} />
              </span>
              <span>{highlight(t3(s.title, lang), q)}</span>
            </h3>
            {renderBody(
              s.body.map((b) => t3(b, lang)),
              q,
            )}
          </section>
        ))}

        {visible.length === 0 && (
          <div className="rules-empty">
            <Icon name="bulb" size={28} />
            <b>{t3(UI.emptyTitle, lang)}</b>
            <span>{t3(UI.emptyHint, lang)}</span>
          </div>
        )}
      </div>
    </Sheet>
  );
}
