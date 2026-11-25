// Загрузка 3D-карты: код three.js (~1 МБ) + сборка шейдеров на телефоне — это секунды.
// Вместо пустого моря со спиннером — процент, полоса и фразы про остров, который «поднимается из моря».
// Процент честный по этапам: скачивание кода (плавно до 80%), сцена создана (до 95%), первые кадры — 100%.

import { Suspense, lazy, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Board3DProps } from '../board3d/Board3D';
import type { Lang } from './learn/lang';

let codeLoaded = false;
const subs = new Set<() => void>();

/** Общая ленивая 3D-карта: знает, когда её код скачан. */
export const Board3DLazy = lazy(() =>
  import('../board3d/Board3D').then((m) => {
    codeLoaded = true;
    subs.forEach((f) => f());
    return m;
  }),
);

const useCodeLoaded = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => codeLoaded,
  );

const PHRASES: Record<Lang, string[]> = {
  ru: ['Поднимаем остров из моря', 'Сажаем леса, выпускаем овец', 'Насыпаем горы руды', 'Распахиваем поля', 'Спускаем корабли в порты', 'Почти готово'],
  kz: ['Аралды теңізден көтеріп жатырмыз', 'Орман егіп, қой жайып жатырмыз', 'Кен тауларын үйіп жатырмыз', 'Егін жыртып жатырмыз', 'Кемелерді айлаққа түсіріп жатырмыз', 'Дайын болуға аз қалды'],
  en: ['Raising the island from the sea', 'Planting forests, letting out sheep', 'Piling up ore mountains', 'Ploughing the fields', 'Launching ships into the ports', 'Almost there'],
};
const NOTE: Record<Lang, string> = {
  ru: '3D-карта загружается · в первый раз дольше',
  kz: '3D-карта жүктелуде · алғашқыда ұзағырақ',
  en: 'Loading the 3D board · slower the first time',
};
const FLAT: Record<Lang, string> = { ru: 'Пока открыть 2D', kz: 'Әзірге 2D ашу', en: 'Use 2D for now' };

/**
 * Экран загрузки поверх места карты. `ready` — 3D нарисовала первые кадры: доводим до 100% и плавно убираем.
 * `onFlat` — через 8 секунд предлагаем 2D, если 3D всё ещё грузится (медленный интернет).
 */
export function Loading3D({ ready, lang = 'ru', onFlat }: { ready: boolean; lang?: Lang; onFlat?: () => void }) {
  const loaded = useCodeLoaded();
  const [p, setP] = useState(() => (codeLoaded ? 80 : 0));
  const [gone, setGone] = useState(false);
  const [slow, setSlow] = useState(false);
  const t0 = useRef(Date.now());
  useEffect(() => {
    if (ready) {
      setP(100);
      const t = window.setTimeout(() => setGone(true), 450);
      return () => window.clearTimeout(t);
    }
    const id = window.setInterval(() => {
      const t = Date.now() - t0.current;
      // пока качается код — плавно к 80% (не упираемся, но и не «висим» на месте); код есть — к 95%
      const target = loaded ? 95 : 80 * (1 - Math.exp(-t / 3500));
      setP((x) => (loaded ? x + (target - x) * 0.12 : Math.max(x, target)));
      if (t > 8000) setSlow(true);
    }, 120);
    return () => window.clearInterval(id);
  }, [ready, loaded]);
  if (gone) return null;
  const list = PHRASES[lang];
  const phrase = list[Math.min(list.length - 1, Math.floor((p / 100) * list.length))];
  return (
    <div className={`load3d ${ready ? 'done' : ''}`} role="status" aria-live="polite">
      <div className="l3-island" aria-hidden>
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <b className="l3-pct">{Math.round(p)}%</b>
      <span className="l3-bar">
        <span style={{ transform: `scaleX(${p / 100})` }} />
      </span>
      <span key={phrase} className="l3-phrase">
        {phrase}…
      </span>
      <small className="l3-note">{NOTE[lang]}</small>
      {slow && onFlat && !ready && (
        <button className="btn ghost small-act l3-flat" onClick={onFlat}>
          {FLAT[lang]}
        </button>
      )}
    </div>
  );
}

/** 3D-карта с экраном загрузки поверх: пока код качается и шейдеры собираются, видно процент и фразы. */
export function Board3DWithLoader({ lang, onFlat, ...props }: Board3DProps & { lang?: Lang; onFlat?: () => void }) {
  const [ready, setReady] = useState(false);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Suspense fallback={null}>
        <Board3DLazy {...props} onReady={() => setReady(true)} />
      </Suspense>
      <Loading3D ready={ready} lang={lang} onFlat={onFlat} />
    </div>
  );
}
