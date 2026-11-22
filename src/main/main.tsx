import { Component, StrictMode } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import '../app/lite';

// Полифилы для старых Safari (iOS 15.0–15.3)
if (!Object.hasOwn) {
  Object.defineProperty(Object, 'hasOwn', { value: (o: object, k: PropertyKey) => Object.prototype.hasOwnProperty.call(o, k) });
}
if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    value(this: unknown[], i: number) {
      const n = Math.trunc(i) || 0;
      return this[n < 0 ? this.length + n : n];
    },
  });
}
import { createRoot } from 'react-dom/client';
import '../app/app.css';
import '../app/components.css';
import { App } from '../app/App';
import { hideSplash, registerPwa } from '../app/pwa';
import { initTelegram } from '../app/tg';

initTelegram();
registerPwa();

// Ошибки в браузере игрока уходят в журнал сервера: так видно, что ломается на чужих телефонах.
{
  let sent = 0;
  const seen = new Set<string>();
  const report = (msg: string) => {
    if (sent >= 15 || seen.has(msg)) return;
    seen.add(msg);
    sent++;
    void import('../client/conn').then(({ conn }) => conn.send({ t: 'clientError', msg, ua: navigator.userAgent }));
  };
  window.addEventListener('error', (e) => report(`${e.message} @ ${e.filename?.split('/').pop() ?? ''}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => report(`unhandled: ${e.reason instanceof Error ? `${e.reason.message} ${e.reason.stack?.split('\n')[1]?.trim() ?? ''}` : String(e.reason)}`));
}

/** Если интерфейс упал — не белый экран, а кнопка вернуться в партию (место за столом сохранится). */
class Crash extends Component<{ children: ReactNode }, { err?: string }> {
  override state: { err?: string } = {};
  static getDerivedStateFromError(e: Error) {
    return { err: e.message };
  }
  override componentDidCatch(e: Error, info: ErrorInfo) {
    void import('../client/conn').then(({ conn }) =>
      conn.send({ t: 'clientError', msg: `react: ${e.message} ${info.componentStack?.split('\n').slice(1, 4).join(' <')}`, ua: navigator.userAgent }),
    );
  }
  override render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', color: '#f4efe6', background: '#0b1016', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 320 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 22 }}>Экран сломался</h2>
          <p style={{ margin: '0 0 20px', opacity: 0.75, lineHeight: 1.45 }}>Твоё место за столом сохранено — партия продолжится с того же хода.</p>
          <button
            onClick={() => location.reload()}
            style={{ font: 'inherit', fontSize: 17, fontWeight: 700, padding: '14px 28px', borderRadius: 999, border: 0, background: '#f4efe6', color: '#0b1016' }}
          >
            Вернуться в игру
          </button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Crash>
      <App />
    </Crash>
  </StrictMode>,
);
// Заставка уходит, когда интерфейс нарисован (и не раньше 600 мс, чтобы не мигала)
setTimeout(hideSplash, 600);
