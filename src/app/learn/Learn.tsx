// «Как играть»: интерактивное обучение и справочник правил — открываются с главной, из лобби и из меню партии.

import { useState } from 'react';
import { Icon } from '../icons';
import { RulesSheet } from './RulesSheet';
import { Tutorial } from './Tutorial';
import { t3, tutorialDone, useLang } from './lang';
import type { T3 } from './lang';

const TXT: Record<string, T3> = {
  newbie: { ru: 'Впервые играешь?', kz: 'Алғаш ойнайсың ба?', en: 'First time playing?' },
  newbieS: {
    ru: 'Обучение за 3 минуты: сам нажмёшь все кнопки на учебной карте',
    kz: '3 минуттық оқу: оқу картасында барлық батырманы өзің басып көресің',
    en: 'A 3-minute tutorial: tap every button yourself on a practice board',
  },
  learn: { ru: 'Обучение', kz: 'Оқу', en: 'Tutorial' },
  rules: { ru: 'Правила', kz: 'Ережелер', en: 'Rules' },
};

export function useLearn() {
  const [tut, setTut] = useState(false);
  const [rules, setRules] = useState(false);
  const ui = (
    <>
      {tut && (
        <Tutorial
          onClose={() => setTut(false)}
          onRules={() => {
            setTut(false);
            setRules(true);
          }}
        />
      )}
      <RulesSheet open={rules} onClose={() => setRules(false)} />
    </>
  );
  return { openTutorial: () => setTut(true), openRules: () => setRules(true), ui };
}

/** Карточка «Как играть»: новичку — крупное приглашение в обучение, остальным — две тихие кнопки. */
export function LearnCard({ onTutorial, onRules, compact }: { onTutorial: () => void; onRules: () => void; compact?: boolean }) {
  const [lang] = useLang();
  const fresh = !tutorialDone();
  if (fresh && !compact)
    return (
      <section className="learn-card glass">
        <span className="learn-ic">
          <Icon name="bulb" size={22} />
        </span>
        <span className="learn-t">
          <b>{t3(TXT.newbie, lang)}</b>
          <small>{t3(TXT.newbieS, lang)}</small>
        </span>
        <span className="learn-acts">
          <button className="btn primary" onClick={onTutorial}>
            {t3(TXT.learn, lang)}
          </button>
          <button className="btn ghost" onClick={onRules}>
            {t3(TXT.rules, lang)}
          </button>
        </span>
      </section>
    );
  return (
    <div className="learn-row">
      <button className="btn ghost" onClick={onTutorial}>
        <Icon name="bulb" size={18} /> {t3(TXT.learn, lang)}
      </button>
      <button className="btn ghost" onClick={onRules}>
        <Icon name="book" size={18} /> {t3(TXT.rules, lang)}
      </button>
    </div>
  );
}
