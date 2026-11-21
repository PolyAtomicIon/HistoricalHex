// Главная: выбор эпохи, «Создать игру» или вход по PIN.

import { useEffect, useState } from 'react';
import { LORE_PACKS } from '../lore';
import { conn, useConn } from '../client/conn';
import { applyEra, eraCover, eraIcon } from './era';
import { ArtIcon, Icon } from './icons';
import { Sheet } from './Sheet';
import { ProfileView } from './Profile';
import { tgStartPin } from './tg';
import { InstallButton } from './pwa';
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

/** Эпохи, которые скоро появятся (обложка есть, играть пока нельзя). */
const SOON = [
  { id: 'horde', title: 'Золотая Орда', years: 'XIV в.' },
];

export function Home({ initialPin }: { initialPin?: string }) {
  const { status, fatal, profile } = useConn();
  const [era, setEra] = useState(LORE_PACKS[0].id);
  const startPin = initialPin ?? tgStartPin();
  const [pin, setPin] = useState(startPin ?? '');
  const [profileOpen, setProfileOpen] = useState<null | 'me' | 'top'>(null);
  const [name, setName] = useState(savedName());
  const [mode, setMode] = useState<'home' | 'join'>(startPin ? 'join' : 'home');
  const [creating, setCreating] = useState(false);
  const pack = LORE_PACKS.find((p) => p.id === era)!;
  applyEra(pack);
  useEffect(() => {
    if (status === 'online') conn.send({ t: 'profile' });
  }, [status]);

  const join = () => {
    const n = name.trim();
    if (pin.replace(/\D/g, '').length !== 6 || !n) return;
    saveName(n);
    haptic('tap');
    conn.join(pin.replace(/\D/g, ''), n);
  };
  const create = () => {
    sfx.play('pop');
    setCreating(true);
    setTimeout(() => setCreating(false), 4000);
    conn.create({ lore: era });
  };

  const me = profile?.profile;
  const leaders = profile?.leaders ?? [];
  const top3 = leaders.slice(0, 3);
  const myRow = me ? leaders.find((l) => l.id === me.id) : undefined;

  return (
    <main className="screen home hub">
      <Sheet open={!!profileOpen} onClose={() => setProfileOpen(null)} title={profileOpen === 'top' ? 'Лидеры' : 'Профиль'}>
        <ProfileView key={profileOpen ?? 'x'} initialTab={profileOpen ?? 'me'} />
      </Sheet>

      {mode === 'home' ? (
        <div className="hub-col">
          <header className="hub-head">
            <button className="hub-me" onClick={() => setProfileOpen('me')} aria-label="Профиль">
              <span className="pf-ava">{me?.photo ? <img src={me.photo} alt="" /> : (me?.name || name || 'И').charAt(0).toUpperCase()}</span>
              <span className="hub-hello">
                <small>{me && me.games > 0 ? 'С возвращением' : 'Добро пожаловать'}</small>
                <b>{me?.name || name || 'Игрок'}</b>
              </span>
            </button>
            <span className="hub-chip glass">
              <b className="accent">{me?.rating ?? '—'}</b>
              <small>рейтинг</small>
            </span>
            <span className="hub-chip glass">
              <b>{me?.streak ?? 0}</b>
              <small>дн. подряд</small>
            </span>
          </header>
          <InstallButton />

          <section key={pack.id} className="hub-hero glass" style={{ backgroundImage: `url(${eraCover(pack.id)})` }}>
            <span className="hub-hero-shade" aria-hidden />
            <span className="hub-hero-text">
              <span className="hub-tag">
                <ArtIcon src={eraIcon(pack.id, 'emblem')} size={18} /> {pack.years}
              </span>
              <b className="display">{pack.title}</b>
              <small>{pack.subtitle}</small>
            </span>
          </section>

          <div className="hub-actions">
            <button className="btn primary big" disabled={status !== 'online' || creating} onClick={create}>
              <Icon name="play" size={20} /> Новая партия
            </button>
            <button className="btn big" onClick={() => setMode('join')}>
              <Icon name="door" size={20} /> По PIN
            </button>
          </div>
          {status !== 'online' && <p className="faint small center">Подключаемся к серверу…</p>}

          <section className="hub-eras" aria-label="Эпохи">
            <div className="hub-sec-h">
              <b>Эпохи</b>
              <small className="faint">
                {LORE_PACKS.length} открыто · {SOON.length} скоро
              </small>
            </div>
            <div className="hub-strip">
              {LORE_PACKS.map((e) => (
                <button
                  key={e.id}
                  className={`hub-era ${e.id === era ? 'on' : ''}`}
                  aria-pressed={e.id === era}
                  onClick={() => {
                    sfx.play('tick');
                    setEra(e.id);
                  }}
                >
                  <img src={eraCover(e.id)} alt="" loading="lazy" />
                  <span>
                    <b className="hub-era-t">{e.short ?? e.title.replace(/^Эпоха /, '')}</b>
                    <small>{e.years}</small>
                  </span>
                </button>
              ))}
              {SOON.map((e) => (
                <div key={e.id} className="hub-era soon" aria-disabled="true">
                  <span className="hub-era-pic">
                    <img src={eraCover(e.id)} alt="" loading="lazy" />
                    <i>
                      <Icon name="ban" size={12} />
                    </i>
                  </span>
                  <span>
                    <b className="hub-era-t">{e.title}</b>
                    <small>скоро</small>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {top3.length > 0 && (
            <section className="hub-leaders glass" aria-label="Лидеры">
              <div className="hub-sec-h">
                <b>Лидеры</b>
                <button className="hub-more" onClick={() => setProfileOpen('top')}>
                  Подробнее <Icon name="next" size={14} />
                </button>
              </div>
              <div className="hub-pod">
                {[top3[1], top3[0], top3[2]].map((l, i) =>
                  l ? (
                    <div key={l.id} className={`p${l.place}`}>
                      {l.place === 1 && <Icon name="crown" size={16} />}
                      <span className="pf-ava sm">{l.photo ? <img src={l.photo} alt="" /> : l.name.charAt(0).toUpperCase()}</span>
                      <b>
                        {l.name}
                        {l.ai && <Icon name="bot" size={12} />}
                      </b>
                      <small className="hub-rating">{l.rating}</small>
                      <span className="hub-step display">{l.place}</span>
                    </div>
                  ) : (
                    <div key={`e${i}`} />
                  ),
                )}
              </div>
              {me && (
                <div className="hub-myrow">
                  {myRow && <span className="n">{myRow.place}</span>}
                  <span className="nm">Ты</span>
                  <small>{me.games > 0 ? `${me.games} парт. · ${me.wins} побед` : 'сыграй первую партию'}</small>
                  <b>{me.rating}</b>
                </div>
              )}
            </section>
          )}
        </div>
      ) : (
        <div className="center-col">
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
        </div>
      )}
      {fatal && <div className="toast glass bad">{fatal}</div>}
    </main>
  );
}
