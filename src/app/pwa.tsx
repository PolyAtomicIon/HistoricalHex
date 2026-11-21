// PWA: регистрация service worker (только в проде) и кнопка «Установить» на главной.

import { useEffect, useState } from 'react';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { inTelegram } from './tg';

type BIP = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: BIP | undefined;
const subs = new Set<() => void>();

const standalone = () =>
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
        <Icon name="up" size={18} /> Установить
      </button>
      <Sheet open={iosHelp} onClose={() => setIosHelp(false)} title="Игра на экране «Домой»">
        <ol className="stack install-steps">
          <li>Нажми «Поделиться» внизу Safari (квадрат со стрелкой).</li>
          <li>Выбери «На экран „Домой“».</li>
          <li>Готово — HistoricalHex откроется на весь экран, как приложение.</li>
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
  if (!vapid) return 'Сервер ещё не готов, попробуй через минуту';
  if (pushSupport() === 'install') return 'На iPhone уведомления работают, когда игра установлена на экран «Домой»';
  if (pushSupport() === 'no') return 'Этот браузер не умеет уведомления';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'Разреши уведомления в настройках браузера';
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(vapid) }));
  send(sub.toJSON());
  return null;
}
