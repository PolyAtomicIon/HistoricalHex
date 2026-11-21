// Telegram Mini App: определяем, что игра открыта внутри Telegram, берём initData для входа,
// подстраиваем интерфейс (развернуть, цвет шапки, без свайпа-закрытия, вибрация).

type TgWebApp = {
  initData: string;
  initDataUnsafe?: { start_param?: string; user?: { first_name?: string } };
  ready(): void;
  expand(): void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  HapticFeedback?: { impactOccurred(s: string): void; notificationOccurred(s: string): void; selectionChanged(): void };
  BackButton?: { show(): void; hide(): void; onClick(f: () => void): void; offClick(f: () => void): void };
};

const tg = (): TgWebApp | undefined => (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;

let hashData: string | undefined;
try {
  const h = new URLSearchParams(location.hash.slice(1));
  hashData = h.get('tgWebAppData') ?? undefined;
} catch {
  /* ok */
}

/** Открыто внутри Telegram? */
export const inTelegram = (): boolean => !!(tg()?.initData || hashData);

/** Подписанные данные входа (или undefined вне Telegram). */
export const tgInitData = (): string | undefined => tg()?.initData || hashData || undefined;

/** PIN из ссылки t.me/<бот>/play?startapp=<pin>. */
export const tgStartPin = (): string | undefined => {
  const p = tg()?.initDataUnsafe?.start_param;
  return p && /^\d{6}$/.test(p) ? p : undefined;
};

/** Подключить скрипт Telegram (только если мы внутри Telegram) и настроить окно. */
export function initTelegram(): void {
  if (!hashData) return;
  const s = document.createElement('script');
  s.src = 'https://telegram.org/js/telegram-web-app.js';
  s.onload = () => {
    const w = tg();
    if (!w) return;
    w.ready();
    w.expand();
    w.disableVerticalSwipes?.();
    w.setHeaderColor?.('#07131d');
    w.setBackgroundColor?.('#07131d');
    document.documentElement.classList.add('tg');
  };
  document.head.appendChild(s);
}

export function tgHaptic(kind: 'tap' | 'success' | 'error' | 'heavy'): boolean {
  const h = tg()?.HapticFeedback;
  if (!h) return false;
  if (kind === 'tap') h.impactOccurred('light');
  else if (kind === 'heavy') h.impactOccurred('heavy');
  else h.notificationOccurred(kind);
  return true;
}
