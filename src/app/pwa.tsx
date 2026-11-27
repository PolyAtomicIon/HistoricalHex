// PWA: регистрация service worker (только в проде) и кнопка «Установить» на главной.

import { useEffect, useState } from 'react';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { inTelegram } from './tg';
import { L } from '../i18n/l';

type BIP = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: BIP | undefined;
const subs = new Set<() => void>();

/** Открыто как установленное приложение (с главного экрана). */
export const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Установленное приложение: класс html.pwa — для стилей (см. app.css). */
function fitStandalone(): void {
  document.documentElement.classList.add('pwa');
}

export function registerPwa(): void {
  if (typeof window === 'undefined') return;
  if (standalone()) {
    if (document.body) fitStandalone();
    else window.addEventListener('DOMContentLoaded', fitStandalone, { once: true });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BIP;
    subs.forEach((f) => f());
  });
  if (import.meta.env.PROD && 'serviceWorker' in navigator && !inTelegram()) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => undefined);
    });
  }
}

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

export function InstallButton() {
  const [, force] = useState(0);
  const [iosHelp, setIosHelp] = useState(false);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  if (standalone() || inTelegram()) return null;
  if (!deferred && !isIos()) return null;
  return (
    <>
      <button
        className="btn glass install-btn"
        onClick={async () => {
          if (deferred) {
            await deferred.prompt();
            deferred = undefined;
            force((x) => x + 1);
          } else setIosHelp(true);
        }}
      >
        <Icon name="up" size={18} /> {L('Установить', 'Орнату', 'Install')}
      </button>
      <Sheet open={iosHelp} onClose={() => setIosHelp(false)} title={L('Игра на экране «Домой»', 'Ойын «Басты экранда»', 'Game on your Home Screen')}>
        <ol className="stack install-steps">
          <li>{L('Нажми «Поделиться» внизу Safari (квадрат со стрелкой).', 'Safari-дің төменгі жағындағы «Бөлісу» түймесін бас (көрсеткісі бар шаршы).', 'Tap Share at the bottom of Safari (the square with an arrow).')}</li>
          <li>{L('Выбери «На экран „Домой“».', '«Басты экранға қосу» таңда.', 'Choose Add to Home Screen.')}</li>
          <li>{L('Готово — HistoricalHex откроется на весь экран, как приложение.', 'Дайын — HistoricalHex қолданба сияқты толық экранда ашылады.', 'Done: HistoricalHex will open full screen, like an app.')}</li>
        </ol>
      </Sheet>
    </>
  );
}

/** Убрать заставку из index.html. */
export function hideSplash(): void {
  const el = document.getElementById('splash');
  if (!el) return;
  el.classList.add('out');
  setTimeout(() => el.remove(), 500);
}

const b64 = (base64: string) => {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** Можно ли вообще включить уведомления на этом устройстве (iPhone — только из установленного приложения). */
export function pushSupport(): 'ok' | 'install' | 'no' {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIos() && !standalone() ? 'install' : 'no';
  }
  if (isIos() && !standalone()) return 'install';
  return 'ok';
}

/** Включить «Твой ход» (Web Push). Возвращает текст ошибки или null. */
export async function enablePush(vapid: string | undefined, send: (sub: unknown) => void): Promise<string | null> {
  if (!vapid) return L('Сервер ещё не готов, попробуй через минуту', 'Сервер әлі дайын емес, бір минуттан кейін қайталап көр', 'The server is not ready yet, try again in a minute');
  if (pushSupport() === 'install') return L('На iPhone уведомления работают, когда игра установлена на экран «Домой»', 'iPhone-да хабарландырулар ойын «Басты экранға» орнатылғанда жұмыс істейді', 'On iPhone, notifications work once the game is added to the Home Screen');
  if (pushSupport() === 'no') return L('Этот браузер не умеет уведомления', 'Бұл браузер хабарландыруды қолдамайды', 'This browser does not support notifications');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return L('Разреши уведомления в настройках браузера', 'Браузер баптауларында хабарландыруға рұқсат бер', 'Allow notifications in your browser settings');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(vapid) }));
  send(sub.toJSON());
  return null;
}

/** iPhone/iPad в Safari (не установленное приложение). */
export const iosBrowser = (): boolean => isIos() && !standalone();
