// Главная: выбор эпохи, «Создать игру» или вход по PIN.

import { useState } from 'react';
import { LORE_PACKS } from '../lore';
import { conn, useConn } from '../client/conn';
import { applyEra, eraCover, eraIcon } from './era';
import { EraCarousel } from './EraCarousel';
import { ArtIcon } from './icons';
import { haptic, sfx } from '../fx';

export const NAME_KEY = 'hh.name';
export function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
export function saveName(n: string): void {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* приватный режим */
  }
}

export function Home({ initialPin }: { initialPin?: string }) {
  const { status, fatal } = useConn();
  const [era, setEra] = useState(LORE_PACKS[0].id);
  const [pin, setPin] = useState(initialPin ?? '');
  const [name, setName] = useState(savedName());
  const [mode, setMode] = useState<'home' | 'join'>(initialPin ? 'join' : 'home');
  const [creating, setCreating] = useState(false);
  const pack = LORE_PACKS.find((p) => p.id === era)!;
  applyEra(pack);

  const join = () => {
    const n = name.trim();
    if (pin.replace(/\D/g, '').length !== 6 || !n) return;
    saveName(n);
    haptic('tap');
    conn.join(pin.replace(/\D/g, ''), n);
  };

  return (
    <main className="screen home">
      <div className="ambient" aria-hidden />
      <div key={era} className="hero-bg" style={{ backgroundImage: `url(${eraCover(era)})` }} aria-hidden />
      <div className="center-col">
        <header className="brand">
          <ArtIcon key={pack.id} className="brand-mark" src={eraIcon(pack.id, 'emblem')} size={72} fallback={<span className="brand-mark" />} />
          <h1 className="display brand-title">HistoricalHex</h1>
          <p className="muted brand-sub">Стройся, торгуй и узнавай историю — каждая партия в своей эпохе</p>
        </header>

        {mode === 'home' ? (
          <>
            <EraCarousel packs={LORE_PACKS} value={era} onChange={setEra} />
            <div className="panel glass stack">
              <button
                className="btn primary big wide"
                disabled={status !== 'online' || creating}
                onClick={() => {
                  sfx.play('pop');
                  setCreating(true);
                  setTimeout(() => setCreating(false), 4000);
                  conn.create({ lore: era });
                }}
              >
                Создать игру
              </button>
              <button className="btn wide" onClick={() => setMode('join')}>
                Войти по PIN
              </button>
              {status !== 'online' && <p className="faint small center">Подключаемся к серверу…</p>}
            </div>
          </>
        ) : (
          <form
            className="panel glass stack"
            onSubmit={(e) => {
              e.preventDefault();
              join();
            }}
          >
            <label className="label" htmlFor="pin">
              PIN игры
            </label>
            <input
              id="pin"
              className="field pin-field"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
            <label className="label" htmlFor="name">
              Твоё имя
            </label>
            <input
              id="name"
              className="field"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Бекзат"
              autoComplete="nickname"
            />
            <button className="btn primary big wide" type="submit" disabled={pin.length !== 6 || !name.trim() || status !== 'online'}>
              Войти
            </button>
            <button className="btn ghost wide" type="button" onClick={() => setMode('home')}>
              Назад
            </button>
          </form>
        )}
        {fatal && <div className="toast glass bad">{fatal}</div>}
      </div>
    </main>
  );
}
