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
import { LearnCard, useLearn } from './learn/Learn';
import { LANGS, t3, useLang } from './learn/lang';
import type { T3 } from './learn/lang';
import { FriendsStrip, LiveGames, ProfileSheet, RecentGames, useFeed } from './Social';

/** Тексты главной на трёх языках (названия эпох пока по-русски — это имена собственные из лор-паков). */
const H: Record<string, T3> = {
  hello: { ru: 'Добро пожаловать', kz: 'Қош келдің', en: 'Welcome' },
  back: { ru: 'С возвращением', kz: 'Қайта оралдың', en: 'Welcome back' },
  player: { ru: 'Игрок', kz: 'Ойыншы', en: 'Player' },
  rating: { ru: 'рейтинг', kz: 'рейтинг', en: 'rating' },
  streak: { ru: 'дн. подряд', kz: 'күн қатар', en: 'day streak' },
  newGame: { ru: 'Новая партия', kz: 'Жаңа ойын', en: 'New game' },
  byPin: { ru: 'По PIN', kz: 'PIN арқылы', en: 'Join by PIN' },
  connecting: { ru: 'Подключаемся к серверу…', kz: 'Серверге қосылып жатыр…', en: 'Connecting to the server…' },
  eras: { ru: 'Эпохи', kz: 'Дәуірлер', en: 'Eras' },
  open: { ru: 'открыто', kz: 'ашық', en: 'open' },
  soon: { ru: 'скоро', kz: 'жақында', en: 'soon' },
  leaders: { ru: 'Лидеры', kz: 'Көшбасшылар', en: 'Leaders' },
  more: { ru: 'Подробнее', kz: 'Толығырақ', en: 'More' },
  you: { ru: 'Ты', kz: 'Сен', en: 'You' },
  games: { ru: 'парт.', kz: 'ойын', en: 'games' },
  wins: { ru: 'побед', kz: 'жеңіс', en: 'wins' },
  first: { ru: 'сыграй первую партию', kz: 'алғашқы ойынды ойна', en: 'play your first game' },
  pin: { ru: 'PIN игры', kz: 'Ойын PIN-і', en: 'Game PIN' },
  name: { ru: 'Твоё имя', kz: 'Атың', en: 'Your name' },
  namePh: { ru: 'Например, Бекзат', kz: 'Мысалы, Бекзат', en: 'For example, Bekzat' },
  enter: { ru: 'Войти', kz: 'Кіру', en: 'Join' },
  goBack: { ru: 'Назад', kz: 'Артқа', en: 'Back' },
  profile: { ru: 'Профиль', kz: 'Профиль', en: 'Profile' },
};

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
  const { status, fatal, profile, friends } = useConn();
  const [era, setEra] = useState(LORE_PACKS[0].id);
  const startPin = initialPin ?? tgStartPin();
  const [pin, setPin] = useState(startPin ?? '');
  const [profileOpen, setProfileOpen] = useState<null | 'me' | 'top'>(null);
  const [name, setName] = useState(savedName());
  const [mode, setMode] = useState<'home' | 'join'>(startPin ? 'join' : 'home');
  const [creating, setCreating] = useState(false);
  const pack = LORE_PACKS.find((p) => p.id === era)!;
  applyEra(pack);
  const learn = useLearn();
  const [lang, setLang] = useLang();
  const T = (k: string) => t3(H[k], lang);
  const feed = useFeed();
  const [who, setWho] = useState<{ pid: string; name: string } | null>(null);
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
      <Sheet open={!!profileOpen} onClose={() => setProfileOpen(null)} title={profileOpen === 'top' ? T('leaders') : T('profile')}>
        <ProfileView key={profileOpen ?? 'x'} initialTab={profileOpen ?? 'me'} />
      </Sheet>
      <ProfileSheet who={who} onClose={() => setWho(null)} />

      {mode === 'home' ? (
        <div className="hub-col">
          <header className="hub-head">
            <button className="hub-me" onClick={() => setProfileOpen('me')} aria-label={T('profile')}>
              <span className="pf-ava">{me?.photo ? <img src={me.photo} alt="" /> : (me?.name || name || 'И').charAt(0).toUpperCase()}</span>
              <span className="hub-hello">
                <small>{me && me.games > 0 ? T('back') : T('hello')}</small>
                <b>{me?.name || name || T('player')}</b>
              </span>
            </button>
            <span className="hub-chip glass">
              <b className="accent">{me?.rating ?? '—'}</b>
              <small>{T('rating')}</small>
            </span>
            <span className="hub-chip glass">
              <b>{me?.streak ?? 0}</b>
              <small>{T('streak')}</small>
            </span>
          </header>
          <div className="hub-lang" role="group" aria-label="Language">
            {LANGS.map((l) => (
              <button key={l.id} className={l.id === lang ? 'on' : ''} onClick={() => setLang(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
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
              <Icon name="play" size={20} /> {T('newGame')}
            </button>
            <button className="btn big" onClick={() => setMode('join')}>
              <Icon name="door" size={20} /> {T('byPin')}
            </button>
          </div>
          {status !== 'online' && <p className="faint small center">{T('connecting')}</p>}
          <LearnCard onTutorial={learn.openTutorial} onRules={learn.openRules} />
          <FriendsStrip friends={friends} lang={lang} onOpen={setWho} />
          {feed && <LiveGames live={feed.live} lang={lang} />}

          <section className="hub-eras" aria-label={T('eras')}>
            <div className="hub-sec-h">
              <b>{T('eras')}</b>
              <small className="faint">
                {LORE_PACKS.length} {T('open')} · {SOON.length} {T('soon')}
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
                    <small>{T('soon')}</small>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {top3.length > 0 && (
            <section className="hub-leaders glass" aria-label={T('leaders')}>
              <div className="hub-sec-h">
                <b>{T('leaders')}</b>
                <button className="hub-more" onClick={() => setProfileOpen('top')}>
                  {T('more')} <Icon name="next" size={14} />
                </button>
              </div>
              <div className="hub-pod">
                {[top3[1], top3[0], top3[2]].map((l, i) =>
                  l ? (
                    <button key={l.id} className={`p${l.place}`} onClick={() => setWho({ pid: l.id, name: l.name })}>
                      {l.place === 1 && <Icon name="crown" size={16} />}
                      <span className="pf-ava sm">{l.photo ? <img src={l.photo} alt="" /> : l.name.charAt(0).toUpperCase()}</span>
                      <b>
                        {l.name}
                        {l.ai && <Icon name="bot" size={12} />}
                      </b>
                      <small className="hub-rating">{l.rating}</small>
                      <span className="hub-step display">{l.place}</span>
                    </button>
                  ) : (
                    <div key={`e${i}`} />
                  ),
                )}
              </div>
              {me && (
                <div className="hub-myrow">
                  {myRow && <span className="n">{myRow.place}</span>}
                  <span className="nm">{T('you')}</span>
                  <small>{me.games > 0 ? `${me.games} ${T('games')} · ${me.wins} ${T('wins')}` : T('first')}</small>
                  <b>{me.rating}</b>
                </div>
              )}
            </section>
          )}
          {feed && <RecentGames recent={feed.recent} lang={lang} onPlayer={setWho} />}
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
              {T('pin')}
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
              {T('name')}
            </label>
            <input
              id="name"
              className="field"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={T('namePh')}
              autoComplete="nickname"
            />
            <button className="btn primary big wide" type="submit" disabled={pin.length !== 6 || !name.trim() || status !== 'online'}>
              {T('enter')}
            </button>
            <button className="btn ghost wide" type="button" onClick={() => setMode('home')}>
              {T('goBack')}
            </button>
          </form>
        </div>
      )}
      {fatal && <div className="toast glass bad">{fatal}</div>}
      {learn.ui}
    </main>
  );
}
