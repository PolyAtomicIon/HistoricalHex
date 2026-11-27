// Затишье перед ударом: кто-то выбирает цель для атаки — по краям экрана пульсирует красное,
// сверху баннер «Кэндзи выбирает цель…», звучит зловещий гул. Висит, пока цель не выбрана.

import { L } from '../i18n/l';
import { useEffect } from 'react';
import { haptic, sfx } from './sfx';
import { duckMusic } from './music';

export interface ThreatInfo {
  key: number;
  name: string;
  color: string;
  /** Это я выбираю цель. */
  mine: boolean;
  /** Как называется удар в этой эпохе («Барымта», «Налёт»…). */
  attack: string;
  img: string;
}

export function Threat({ t, tv }: { t: ThreatInfo | null; tv?: boolean }) {
  useEffect(() => {
    if (!t) return;
    sfx.play('omen');
    duckMusic(5);
    if (!t.mine && !tv) haptic('heavy');
  }, [t?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!t) return null;
  return (
    <div key={t.key} className={`threat ${tv ? 'tv' : ''}`} style={{ ['--pc' as string]: t.color }} aria-live="polite">
      <div className="threat-vignette" aria-hidden="true" />
      {/* атакующему хватает подсказки внизу («нажми на светящееся место») — баннер только остальным */}
      {!t.mine && (
        <div className="threat-banner glass strong">
          <img src={t.img} alt="" />
          <div>
            <b>{L('{name} выбирает цель', '{name} мақсат таңдайды', '{name} is picking a target', { name: t.name })}</b>
            <small>{L('Куда ударит «{a}»?', '«{a}» қайда соққы береді?', 'Where will “{a}” strike?', { a: t.attack })}</small>
          </div>
        </div>
      )}
    </div>
  );
}
