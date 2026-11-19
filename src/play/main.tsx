// Экран игрока — делается на Этапе 4. Пока заглушка, чтобы собиралась вторая страница.
import { createRoot } from 'react-dom/client';
import '../ui/base.css';

createRoot(document.getElementById('root')!).render(
  <main className="screen center">
    <h1 className="logo">Хексленд</h1>
    <p className="tagline">Экран игрока скоро будет здесь 🙂</p>
  </main>,
);
