// Переключатель темы: тёмная / светлая / как в системе. Сегменты, как у выбора языка.

import { Moon, Sun, SunMoon } from 'lucide-react';
import { L } from '../i18n/l';
import { useTheme } from './theme';
import type { ThemeMode } from './theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [mode, setMode] = useTheme();
  const opts: [ThemeMode, string][] = [
    ['dark', L('Тёмная', 'Қараңғы', 'Dark')],
    ['light', L('Светлая', 'Жарық', 'Light')],
    ['auto', L('Как в системе', 'Жүйедегідей', 'System')],
  ];
  return (
    <div className={`seg theme-seg ${className}`} role="group" aria-label={L('Тема', 'Тақырып', 'Theme')}>
      {opts.map(([id, label]) => (
        <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Компактная кнопка для главной: по тапу тёмная → светлая → как в системе. */
export function ThemeCycle() {
  const [mode, setMode] = useTheme();
  const next: ThemeMode = mode === 'dark' ? 'light' : mode === 'light' ? 'auto' : 'dark';
  const name = mode === 'dark' ? L('Тёмная тема', 'Қараңғы тақырып', 'Dark theme') : mode === 'light' ? L('Светлая тема', 'Жарық тақырып', 'Light theme') : L('Тема как в системе', 'Жүйедегі тақырып', 'System theme');
  const Ico = mode === 'dark' ? Moon : mode === 'light' ? Sun : SunMoon;
  return (
    <button className="hub-theme" aria-label={name} title={name} onClick={() => setMode(next)}>
      <Ico size={18} strokeWidth={2} />
    </button>
  );
}
