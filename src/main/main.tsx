import { StrictMode } from 'react';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
// Заставка уходит, когда интерфейс нарисован (и не раньше 600 мс, чтобы не мигала)
setTimeout(hideSplash, 600);
