// Профиль игрока: рейтинг, партии, победы, серия дней, коллекция эпох, таблица лидеров, вход через Telegram.

import { useEffect, useState } from 'react';
import { conn, useConn } from '../client/conn';
import { LORE_PACKS } from '../lore';
import { eraCover, eraIcon } from './era';
import { ArtIcon, Icon } from './icons';
import { inTelegram } from './tg';

export function ProfileView() {
  const { profile: data, status } = useConn();
  const [tab, setTab] = useState<'me' | 'top'>('me');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  useEffect(() => {
    if (status === 'online') conn.send({ t: 'profile' });
  }, [status]);

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
                setEditing(!p.telegram);
              }}
            >
              {p.name}
              {!p.telegram && <Icon name="feather" size={14} />}
            </button>
          )}
          <div className="faint small">{p.telegram ? `Telegram${p.username ? ` · @${p.username}` : ''}` : 'Гость на этом устройстве'}</div>
        </div>
        <div className="pf-rating">
          <b className="display">{p.rating}</b>
          <small>рейтинг</small>
        </div>
      </div>

      <div className="seg">
        <button aria-pressed={tab === 'me'} onClick={() => setTab('me')}>
          Мой профиль
        </button>
        <button aria-pressed={tab === 'top'} onClick={() => setTab('top')}>
          Лучшие игроки
        </button>
      </div>

      {tab === 'me' ? (
        <>
          <div className="pf-stats">
            <Stat n={p.games} l="партий" />
            <Stat n={p.wins} l="побед" />
            <Stat n={`${rate}%`} l="побед из всех" />
            <Stat n={p.streak} l={p.playedToday ? 'дней подряд' : 'дней подряд · сыграй сегодня'} hot={p.streak > 0} />
          </div>
          {p.streakBest > 1 && <p className="faint small center">Лучшая серия: {p.streakBest} дн.</p>}

          <div className="label">Коллекция эпох · {Object.keys(p.eras).length}/{LORE_PACKS.length}</div>
          <div className="pf-eras">
            {LORE_PACKS.map((e) => {
              const s = p.eras[e.id];
              return (
                <div key={e.id} className={`pf-era ${s ? 'got' : ''}`} style={{ backgroundImage: `url(${eraCover(e.id)})` }}>
                  <ArtIcon src={eraIcon(e.id, 'emblem')} size={40} />
                  <b>{e.title}</b>
                  <small>{s ? `${s.games} парт. · ${s.wins} побед` : 'ещё не играл'}</small>
                </div>
              );
            })}
          </div>

          {!p.telegram && (
            <div className="hint-card">
              <Icon name="star" size={18} />
              <span>
                {inTelegram()
                  ? 'Входим через Telegram…'
                  : data.tgBot
                    ? 'Открой игру в Telegram — профиль и рейтинг будут с тобой на любом телефоне.'
                    : 'Статистика пока хранится на этом устройстве. Скоро — вход через Telegram.'}
              </span>
            </div>
          )}
          {!p.telegram && data.tgBot && !inTelegram() && (
            <a className="btn wide tg-btn" href={`https://t.me/${data.tgBot}/play`} target="_blank" rel="noreferrer">
              Открыть в Telegram
            </a>
          )}
        </>
      ) : (
        <ol className="list leaders">
          {data.leaders.length === 0 && <p className="muted center">Пока никого — сыграй первую партию!</p>}
          {data.leaders.map((r) => (
            <li key={r.id} className={`item lead ${r.id === p.id ? 'me' : ''}`}>
              <span className={`ld-place p${r.place}`}>{r.place}</span>
              <span className="pf-ava sm">{r.photo ? <img src={r.photo} alt="" /> : r.name.charAt(0).toUpperCase()}</span>
              <div className="grow">
                <div className="t">{r.name}</div>
                <div className="s">
                  {r.games} парт. · {r.wins} побед
                </div>
              </div>
              <b>{r.rating}</b>
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
