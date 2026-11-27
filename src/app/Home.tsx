// Главная: выбор эпохи, «Создать игру» или вход по PIN.

import { useEffect, useRef, useState } from 'react';
import { GENGHIS_PACK, LORE_PACKS } from '../lore';
import { conn, useConn } from '../client/conn';
import { applyEra, eraCoverMd, eraThumb, eraIcon } from './era';
import { ArtIcon, Icon } from './icons';
import { Sheet } from './Sheet';
import { ProfileView } from './Profile';
import { tgStartPin } from './tg';
import { InstallButton } from './pwa';
import { haptic, sfx } from '../fx';
import { LearnCard, useLearn } from './learn/Learn';
import { LANGS, t3, useLang } from './learn/lang';
import { ThemeCycle } from './ThemeToggle';
import type { T3 } from './learn/lang';
import { FriendsStrip, LiveCount, LiveGames, ProfileSheet, RecentGames, ResumeGames, useFeed } from './Social';
import { L } from '../i18n/l';

/** Тексты главной на трёх языках (названия эпох пока по-русски — это имена собственные из лор-паков). */
const H: Record<string, T3> = {
  hello: { ru: 'Добро пожаловать', kz: 'Қош келдің', en: 'Welcome' },
  back: { ru: 'С возвращением', kz: 'Қайта оралдың', en: 'Welcome back' },
  player: { ru: 'Игрок', kz: 'Ойыншы', en: 'Player' },
  rating: { ru: 'рейтинг', kz: 'рейтинг', en: 'rating' },
  streak: { ru: 'дн. подряд', kz: 'күн қатар', en: 'day streak' },
  newGame: { ru: 'Новая партия', kz: 'Жаңа ойын', en: 'New game' },
  about: { ru: 'Об игре', kz: 'Ойын туралы', en: 'About the game' },
  byPin: { ru: 'По PIN', kz: 'PIN арқылы', en: 'Join by PIN' },
  connecting: { ru: 'Подключаемся…', kz: 'Қосылуда…', en: 'Connecting…' },
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
  const [era, setEra] = useState(GENGHIS_PACK.id);
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
  // Имя для входа по PIN: сохранённое или из профиля (у новых — случайное, можно поменять)
  useEffect(() => {
    if (!name && profile?.profile.name) setName(profile.profile.name);
  }, [profile?.profile.name]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const mine = feed?.live.filter((g) => g.mine) ?? [];
  const others = feed?.live.filter((g) => !g.mine) ?? [];
  // свайп по обложке листает эпохи
  const swipe = useRef<{ x: number; y: number } | null>(null);
  // бейдж на слайде: чужие идущие партии именно в этой эпохе
  const liveHere = others.filter((g) => g.era === pack.id && !g.paused).length;
  // соседние обложки грузим заранее, чтобы свайп не показывал пустую карточку
  useEffect(() => {
    const i = LORE_PACKS.findIndex((e) => e.id === era);
    for (const d of [1, -1]) new Image().src = eraCoverMd(LORE_PACKS[(i + d + LORE_PACKS.length) % LORE_PACKS.length].id);
  }, [era]);
  const stepEra = (d: number) => {
    const i = LORE_PACKS.findIndex((e) => e.id === era);
    const next = LORE_PACKS[(i + d + LORE_PACKS.length) % LORE_PACKS.length];
    sfx.play('tick');
    haptic('tap');
    setEra(next.id);
  };

  const me = profile?.profile;
  const leaders = profile?.leaders ?? [];
  const top3 = leaders.slice(0, 3);
  const myRow = me ? leaders.find((l) => l.id === me.id) : undefined;

  return (
    <main className="screen home hub" style={{ ['--era-cover' as string]: `url(${eraThumb(pack.id)})` }}>
      <span className="hub-glow" aria-hidden />
      <Sheet open={!!profileOpen} onClose={() => setProfileOpen(null)} title={profileOpen === 'top' ? T('leaders') : T('profile')}>
        <ProfileView key={profileOpen ?? 'x'} initialTab={profileOpen ?? 'me'} />
      </Sheet>
      <ProfileSheet who={who} onClose={() => setWho(null)} />

      {mode === 'home' ? (
        <div className="hub-col">
          <header className="hub-head">
            <button className="hub-me" onClick={() => setProfileOpen('me')} title={T('profile')}>
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
          <div className="hub-prefs">
            <div className="hub-lang" role="group" aria-label="Language">
              {LANGS.map((l) => (
                <button key={l.id} className={l.id === lang ? 'on' : ''} onClick={() => setLang(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
            <ThemeCycle />
          </div>
          <InstallButton />

          <ResumeGames games={mine} lang={lang} />

          <section
            className="hub-hero glass"
            onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
            onPointerUp={(e) => {
              const s0 = swipe.current;
              swipe.current = null;
              if (!s0) return;
              const dx = e.clientX - s0.x;
              if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s0.y)) stepEra(dx < 0 ? 1 : -1);
            }}
            onPointerCancel={() => (swipe.current = null)}
          >
            <span
              key={pack.id}
              className="hub-hero-img"
              aria-hidden
              style={{ backgroundImage: `url(${eraCoverMd(pack.id)}), url(${eraThumb(pack.id)})` }}
            />
            <span className="hub-hero-shade" aria-hidden />
            <LiveCount n={liveHere} lang={lang} />
            <span className="hub-dots" aria-hidden>
              {LORE_PACKS.map((e) => (
                <i key={e.id} className={e.id === era ? 'on' : ''} />
              ))}
            </span>
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
              <Icon name="play" size={20} /> {status === 'online' ? T('newGame') : T('connecting')}
            </button>
            <button className="btn big" onClick={() => setMode('join')}>
              <Icon name="door" size={20} /> {T('byPin')}
            </button>
          </div>
          <LearnCard onTutorial={learn.openTutorial} onRules={learn.openRules} />
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
                  <img src={eraThumb(e.id)} alt="" loading="lazy" width={180} height={101} />
                  <span>
                    <b className="hub-era-t">{e.short ?? e.title.replace(/^Эпоха /, '')}</b>
                    <small>{e.years}</small>
                  </span>
                </button>
              ))}
              {SOON.map((e) => (
                <div key={e.id} className="hub-era soon" aria-disabled="true">
                  <span className="hub-era-pic">
                    <img src={eraThumb(e.id)} alt="" loading="lazy" width={180} height={101} />
                    <i>
                      <Icon name="ban" size={12} />
                    </i>
                  </span>
                  <span>
                    <b className="hub-era-t">{e.id === 'horde' ? L('Золотая Орда', 'Алтын Орда', 'Golden Horde') : e.title}</b>
                    <small>{T('soon')}</small>
                  </span>
                </div>
              ))}
            </div>
          </section>
          <FriendsStrip friends={friends} lang={lang} onOpen={setWho} />
          {feed && <LiveGames live={others} lang={lang} />}


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
          <a className="hub-about" href={`${import.meta.env.BASE_URL}about/?lang=${lang}`}>
            {T('about')} <Icon name="next" size={14} />
          </a>
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
