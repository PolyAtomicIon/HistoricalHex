// Профиль игрока: рейтинг, партии, победы, серия дней, коллекция эпох, таблица лидеров, вход через Telegram.

import { useEffect, useState } from 'react';
import { conn, useConn } from '../client/conn';
import { LORE_PACKS } from '../lore';
import { eraCover, eraThumb, eraIcon } from './era';
import { ArtIcon, Icon } from './icons';
import { inTelegram } from './tg';
import { Sheet } from './Sheet';
import { L } from '../i18n/l';

/** Вход через Telegram временно скрыт (весь код на месте). */
const SHOW_TELEGRAM = false;
/** Портал проверит вход ученика, подпишет билет и вернёт в игру на этот же адрес. Адрес портала — от сервера. */
export function portalLoginUrl(portal: string): string {
  const back = new URL(location.href);
  back.searchParams.delete('aql');
  return `${portal.replace(/\/$/, '')}/historicalhex/launch?return=${encodeURIComponent(back.toString())}`;
}

export function ProfileView({ initialTab = 'me' }: { initialTab?: 'me' | 'top' } = {}) {
  const { profile: data, status, tgLink } = useConn();
  const [tab, setTab] = useState<'me' | 'top'>(initialTab);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [who, setWho] = useState<{ pid: string; name: string } | null>(null);
  useEffect(() => {
    if (status === 'online') conn.send({ t: 'profile' });
  }, [status]);

  // Telegram пока скрыт: вход — через AQL Portal (код Telegram на месте, включается флагом)
  const needLink = SHOW_TELEGRAM && !!data?.tgBot && !data.profile.telegram && !inTelegram();
  useEffect(() => {
    if (needLink && status === 'online') conn.send({ t: 'tgLink' });
  }, [needLink, status]);

  if (!data) {
    return (
      <div className="center" style={{ padding: 30 }}>
        <div className="spinner" />
      </div>
    );
  }
  const p = data.profile;
  const rate = p.games ? Math.round((p.wins / p.games) * 100) : 0;
  return (
    <div className="stack profile">
      <ProfileSheet who={who} onClose={() => setWho(null)} />
      <div className="pf-head">
        <span className="pf-ava">{p.photo ? <img src={p.photo} alt="" /> : p.name.charAt(0).toUpperCase()}</span>
        <div className="grow">
          {editing ? (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                conn.send({ t: 'rename', name });
                setEditing(false);
              }}
            >
              <input className="field" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} autoFocus />
              <button className="btn primary" type="submit">
                <Icon name="check" size={18} />
              </button>
            </form>
          ) : (
            <button
              className="pf-name"
              onClick={() => {
                setName(p.name);
                setEditing(!p.telegram && !p.portal);
              }}
            >
              {p.name}
              {!p.telegram && !p.portal && <Icon name="feather" size={14} />}
            </button>
          )}
          <div className="faint small">{p.portal ? 'AQL Portal' : p.telegram ? `Telegram${p.username ? ` · @${p.username}` : ''}` : L('Гость на этом устройстве', 'Осы құрылғыдағы қонақ', 'Guest on this device')}</div>
        </div>
        <div className="pf-rating">
          <b className="display">{p.rating}</b>
          <small>{L('рейтинг', 'рейтинг', 'rating')}</small>
        </div>
      </div>

      <div className="seg">
        <button aria-pressed={tab === 'me'} onClick={() => setTab('me')}>
          {L('Мой профиль', 'Менің профилім', 'My profile')}
        </button>
        <button aria-pressed={tab === 'top'} onClick={() => setTab('top')}>
          {L('Лучшие игроки', 'Үздік ойыншылар', 'Top players')}
        </button>
      </div>

      {tab === 'me' ? (
        <>
          <div className="pf-stats">
            <Stat n={p.games} l={L('партий', 'ойын', 'games')} />
            <Stat n={p.wins} l={L('побед', 'жеңіс', 'wins')} />
            <Stat n={`${rate}%`} l={L('побед из всех', 'жеңіс үлесі', 'win rate')} />
            <Stat n={p.streak} l={p.playedToday ? L('дней подряд', 'күн қатарынан', 'days in a row') : L('дней подряд · сыграй сегодня', 'күн қатарынан · бүгін ойна', 'days in a row · play today')} hot={p.streak > 0} />
          </div>
          {p.streakBest > 1 && <p className="faint small center">{L('Лучшая серия: {n} дн.', 'Үздік серия: {n} күн', 'Best streak: {n} d', { n: p.streakBest })}</p>}

          <div className="label">{L('Коллекция эпох', 'Дәуірлер жинағы', 'Era collection')} · {Object.keys(p.eras).length}/{LORE_PACKS.length}</div>
          <div className="pf-eras">
            {LORE_PACKS.map((e) => {
              const s = p.eras[e.id];
              return (
                <div key={e.id} className={`pf-era ${s ? 'got' : ''}`} style={{ backgroundImage: `url(${eraThumb(e.id)})` }}>
                  <ArtIcon src={eraIcon(e.id, 'emblem')} size={40} />
                  <b>{e.title}</b>
                  <small>{s ? L('{g} парт. · {w} побед', '{g} ойын · {w} жеңіс', '{g} games · {w} wins', { g: s.games, w: s.wins }) : L('ещё не играл', 'әлі ойнамаған', 'not played yet')}</small>
                </div>
              );
            })}
          </div>

          {!p.portal && data.portal && (
            <div className="portal-login">
              <span className="pl-text">
                <b>{L('Войди через AQL Portal', 'AQL Portal арқылы кір', 'Sign in with AQL Portal')}</b>
                <small>{L('Профиль, рейтинг и серия — твои на любом устройстве', 'Профиль, рейтинг және серия — кез келген құрылғыда сенімен', 'Your profile, rating and streak on any device')}</small>
              </span>
              <a className="btn primary" href={portalLoginUrl(data.portal)}>
                {L('Войти', 'Кіру', 'Sign in')}
              </a>
            </div>
          )}
          {SHOW_TELEGRAM && !p.telegram && (
            <div className="hint-card">
              <Icon name="star" size={18} />
              <span>
                {inTelegram()
                  ? L('Входим через Telegram…', 'Telegram арқылы кіріп жатырмыз…', 'Signing in with Telegram…')
                  : data.tgBot
                    ? L('Войди через Telegram — профиль и рейтинг будут с тобой на любом телефоне. Бот пришлёт подтверждение.', 'Telegram арқылы кір — профиль мен рейтинг кез келген телефонда сенімен болады. Бот растау жібереді.', 'Sign in with Telegram to keep your profile and rating on any phone. The bot will send a confirmation.')
                    : L('Статистика пока хранится на этом устройстве. Скоро — вход через Telegram.', 'Статистика әзірге осы құрылғыда сақталады. Жақында — Telegram арқылы кіру.', 'Stats are stored on this device for now. Telegram sign-in is coming soon.')}
              </span>
            </div>
          )}
          {SHOW_TELEGRAM && !p.telegram && data.tgBot && !inTelegram() && (
            <div className="row">
              <a className={`btn grow tg-btn ${tgLink ? '' : 'disabled'}`} href={tgLink} target="_blank" rel="noreferrer">
                {L('Войти через Telegram', 'Telegram арқылы кіру', 'Sign in with Telegram')}
              </a>
              <a className="btn grow" href={`https://t.me/${data.tgBot}/play`} target="_blank" rel="noreferrer">
                {L('Играть в Telegram', 'Telegram-да ойнау', 'Play in Telegram')}
              </a>
            </div>
          )}
        </>
      ) : (
        <ol className="list leaders">
          {data.leaders.length === 0 && <p className="muted center">{L('Пока никого — сыграй первую партию!', 'Әзірге ешкім жоқ — алғашқы ойынды ойна!', 'Nobody yet — play the first game!')}</p>}
          {data.leaders.map((r) => (
            <li key={r.id}>
              <button className={`item lead ${r.id === p.id ? 'me' : ''}`} onClick={() => setWho({ pid: r.id, name: r.name })}>
              <span className={`ld-place p${r.place}`}>{r.place}</span>
              <span className="pf-ava sm">{r.photo ? <img src={r.photo} alt="" /> : r.name.charAt(0).toUpperCase()}</span>
              <div className="grow">
                <div className="t">
                  {r.name}
                  {r.ai && <span className="ai-tag">{L('ИИ', 'ЖИ', 'AI')}</span>}
                </div>
                <div className="s">
                  {L('{g} парт. · {w} побед', '{g} ойын · {w} жеңіс', '{g} games · {w} wins', { g: r.games, w: r.wins })}
                </div>
              </div>
              <b>{r.rating}</b>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Stat({ n, l, hot }: { n: number | string; l: string; hot?: boolean }) {
  return (
    <div className={`pf-stat ${hot ? 'hot' : ''}`}>
      <b className="display">{n}</b>
      <small>{l}</small>
    </div>
  );
}

/** Профиль другого игрока (человек или ИИ) — в шторке по тапу. */
export function PlayerProfileCard({ pid, name, color, onShow }: { pid: string; name: string; color: string; onShow?: () => void }) {
  const { playerProfile, status } = useConn();
  useEffect(() => {
    if (status === 'online') conn.send({ t: 'playerProfile', pid });
  }, [pid, status]);
  const p = playerProfile?.pid === pid ? playerProfile.profile : undefined;
  return (
    <div className="stack profile">
      <div className="pf-head">
        <span className="pf-ava" style={{ background: color }}>
          {p?.photo ? <img src={p.photo} alt="" /> : name.charAt(0).toUpperCase()}
        </span>
        <div className="grow">
          <div className="pf-name">{name}</div>
          <div className="faint small">
            {p?.ai ? `${L('ИИ', 'ЖИ', 'AI')} · ${p.ai.style} · ${p.ai.level === 'easy' ? L('лёгкий', 'жеңіл', 'easy') : p.ai.level === 'medium' ? L('средний', 'орташа', 'medium') : L('сложный', 'қиын', 'hard')}` : p?.telegram ? 'Telegram' : L('Игрок', 'Ойыншы', 'Player')}
          </div>
        </div>
        {p && (
          <div className="pf-rating">
            <b className="display">{p.rating}</b>
            <small>{L('рейтинг', 'рейтинг', 'rating')}</small>
          </div>
        )}
      </div>
      {p === undefined && (
        <div className="center" style={{ padding: 20 }}>
          <div className="spinner" />
        </div>
      )}
      {p === null && <p className="muted">{L('Профиля пока нет — это первая партия игрока.', 'Профиль әзірге жоқ — бұл ойыншының алғашқы ойыны.', 'No profile yet — this is the player’s first game.')}</p>}
      {p && (
        <>
          {p.ai && <p className="muted pf-bio">{p.ai.bio}</p>}
          <div className="pf-stats">
            <Stat n={p.games} l={L('партий', 'ойын', 'games')} />
            <Stat n={p.wins} l={L('побед', 'жеңіс', 'wins')} />
            <Stat n={`${p.games ? Math.round((p.wins / p.games) * 100) : 0}%`} l={L('побед из всех', 'жеңіс үлесі', 'win rate')} />
            <Stat n={p.streakBest} l={L('лучшая серия, дн.', 'үздік серия, күн', 'best streak, d')} />
          </div>
          <div className="label">{L('Эпохи', 'Дәуірлер', 'Eras')}</div>
          <div className="pf-eras">
            {LORE_PACKS.map((e) => {
              const s = p.eras[e.id];
              return (
                <div key={e.id} className={`pf-era ${s ? 'got' : ''}`} style={{ backgroundImage: `url(${eraThumb(e.id)})` }}>
                  <ArtIcon src={eraIcon(e.id, 'emblem')} size={36} />
                  <b>{e.title}</b>
                  <small>{s ? L('{g} парт. · {w} побед', '{g} ойын · {w} жеңіс', '{g} games · {w} wins', { g: s.games, w: s.wins }) : L('не играл', 'ойнамаған', 'not played')}</small>
                </div>
              );
            })}
          </div>
        </>
      )}
      {p && !p.ai && <FriendActions id={p.id} />}
      {onShow && (
        <button className="btn wide" onClick={onShow}>
          <Icon name="layers" /> {L('Показать постройки на карте', 'Құрылыстарды картада көрсету', 'Show buildings on the map')}
        </button>
      )}
    </div>
  );
}

/** Шторка с профилем игрока (из лидеров, недавних партий). */
export function ProfileSheet({ who, onClose }: { who: { pid: string; name: string } | null; onClose: () => void }) {
  // Держим последнего, чтобы содержимое не пропадало во время анимации закрытия
  const [last, setLast] = useState(who);
  useEffect(() => {
    if (who) setLast(who);
  }, [who]);
  return (
    <Sheet open={!!who} onClose={onClose} title={last?.name ?? ''}>
      {last && <PlayerProfileCard key={last.pid} pid={last.pid} name={last.name} color="rgba(255,255,255,0.08)" />}
    </Sheet>
  );
}

/** В друзья / из друзей; если друг сейчас за столом — зайти или смотреть. */
function FriendActions({ id }: { id: string }) {
  const { profile, friends, room } = useConn();
  if (!profile || profile.profile.id === id) return null;
  const on = (profile.friends ?? []).includes(id);
  const where = friends?.find((f) => f.id === id)?.where;
  const here = room?.pin === where?.pin;
  return (
    <div className="pf-friend">
      {where && !here && (
        <button className="btn primary wide" onClick={() => conn.open(where.pin)}>
          <Icon name={where.state === 'playing' ? 'eye' : 'door'} size={18} /> {where.state === 'playing' ? L('Смотреть партию', 'Ойынды көру', 'Watch game') : L('Зайти в лобби', 'Лоббиге кіру', 'Join lobby')}
        </button>
      )}
      <button className={`btn wide ${on ? 'ghost' : ''}`} onClick={() => conn.send({ t: 'friend', id, on: !on })}>
        <Icon name={on ? 'check' : 'plus'} size={18} /> {on ? L('В друзьях', 'Достарда', 'Friends') : L('Добавить в друзья', 'Досқа қосу', 'Add friend')}
      </button>
    </div>
  );
}
