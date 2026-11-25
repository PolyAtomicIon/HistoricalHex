// Социальное на главной: идущие партии (смотреть зрителем), недавние партии, профиль игрока по тапу.

import { useEffect, useState } from 'react';
import type { LiveGame, RecentGame } from '../proto';
import { conn, useConn } from '../client/conn';
import { LORE_PACKS } from '../lore';
import { PLAYER_HEX } from '../ui/theme';
import { ArtIcon, Icon } from './icons';
import { eraIcon } from './era';
import { Sheet } from './Sheet';
export { ProfileSheet } from './Profile';
import { t3, type Lang, type T3 } from './learn/lang';

const S: Record<string, T3> = {
  live: { ru: 'Сейчас играют', kz: 'Қазір ойнап жатыр', en: 'Playing now' },
  recent: { ru: 'Недавние партии', kz: 'Соңғы ойындар', en: 'Recent games' },
  watch: { ru: 'Смотреть', kz: 'Көру', en: 'Watch' },
  back: { ru: 'Вернуться', kz: 'Оралу', en: 'Rejoin' },
  turn: { ru: 'ход', kz: 'жүріс', en: 'turn' },
  setup: { ru: 'расстановка', kz: 'орналастыру', en: 'setup' },
  won: { ru: 'победил', kz: 'жеңді', en: 'won' },
  you: { ru: 'ты играл', kz: 'сен ойнадың', en: 'you played' },
  game: { ru: 'Партия', kz: 'Ойын', en: 'Game' },
  pts: { ru: 'оч.', kz: 'ұпай', en: 'pts' },
  bot: { ru: 'бот', kz: 'бот', en: 'bot' },
};

const eraName = (id: string) => {
  const p = LORE_PACKS.find((x) => x.id === id);
  return p ? (p.short ?? p.title.replace(/^Эпоха /, '')) : id;
};

/** «5 мин назад», «3 ч назад», «вчера», «12 нояб.» */
export function timeAgo(t: number, lang: Lang = 'ru', now = Date.now()): string {
  const m = Math.round((now - t) / 60000);
  const L = { ru: ['только что', 'мин назад', 'ч назад', 'вчера'], kz: ['жаңа ғана', 'мин бұрын', 'сағ бұрын', 'кеше'], en: ['just now', 'min ago', 'h ago', 'yesterday'] }[lang];
  if (m < 1) return L[0];
  if (m < 60) return `${m} ${L[1]}`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${L[2]}`;
  if (h < 48) return L[3];
  return new Date(t).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'kz' ? 'kk-KZ' : 'ru-RU', { day: 'numeric', month: 'short' });
}

/** Лента главной: запрос при подключении и раз в 20 секунд, пока главная открыта. */
export function useFeed() {
  const { status, feed } = useConn();
  useEffect(() => {
    if (status !== 'online') return;
    conn.send({ t: 'feed' });
    const id = window.setInterval(() => {
      if (!document.hidden) conn.send({ t: 'feed' });
    }, 20_000);
    return () => window.clearInterval(id);
  }, [status]);
  return feed;
}

export function LiveGames({ live, lang }: { live: LiveGame[]; lang: Lang }) {
  const T = (k: string) => t3(S[k], lang);
  if (!live.length) return null;
  return (
    <section className="hub-feed" aria-label={T('live')}>
      <div className="hub-sec-h">
        <b>{T('live')}</b>
        <small className="hub-live-dot">{live.length}</small>
      </div>
      <ul className="feed-list">
        {live.map((g) => (
          <li key={g.pin}>
            <button className="feed-row" onClick={() => conn.open(g.pin)}>
              <ArtIcon src={eraIcon(g.era, 'emblem')} size={34} />
              <span className="feed-main">
                <b>{eraName(g.era)}</b>
                <span className="feed-players">
                  {g.players.map((p, i) => (
                    <span key={i} className={`fp ${i === g.current ? 'now' : ''} ${p.bot ? 'bot' : ''} ${!p.online ? 'off' : ''}`} style={{ ['--pc' as string]: PLAYER_HEX[p.color] }}>
                      <i />
                      {p.name}
                      <small>{p.points}</small>
                    </span>
                  ))}
                </span>
              </span>
              <span className="feed-act">
                <span className="feed-cta">{g.mine ? T('back') : T('watch')}</span>
                <small>
                  {g.turn > 0 ? `${T('turn')} ${g.turn}` : T('setup')}
                  {g.watchers > 0 && (
                    <span className="feed-eyes">
                      {' · '}
                      <Icon name="eye" size={12} />
                      {g.watchers}
                    </span>
                  )}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RecentGames({ recent, lang, onPlayer }: { recent: RecentGame[]; lang: Lang; onPlayer: (p: { pid: string; name: string }) => void }) {
  const T = (k: string) => t3(S[k], lang);
  const [open, setOpen] = useState<RecentGame | null>(null);
  const [last, setLast] = useState<RecentGame | null>(null);
  useEffect(() => {
    if (open) setLast(open);
  }, [open]);
  if (!recent.length) return null;
  return (
    <section className="hub-feed" aria-label={T('recent')}>
      <div className="hub-sec-h">
        <b>{T('recent')}</b>
      </div>
      <ul className="feed-list">
        {recent.map((g) => {
          const w = g.players.find((p) => p.winner) ?? g.players[0];
          const others = g.players.filter((p) => p !== w);
          return (
            <li key={g.id}>
              <button className={`feed-row ${g.mine ? 'mine' : ''}`} onClick={() => setOpen(g)}>
                <ArtIcon src={eraIcon(g.era, 'emblem')} size={34} />
                <span className="feed-main">
                  <b>
                    {w.name} <small>{T('won')}</small>
                  </b>
                  <span className="feed-sub">
                    {eraName(g.era)} · {others.map((p) => p.name).join(', ')}
                  </span>
                </span>
                <span className="feed-act">
                  <small>{timeAgo(g.finishedAt, lang)}</small>
                  {g.mine && <small className="feed-you">{T('you')}</small>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={last ? eraName(last.era) : T('game')} description={last ? timeAgo(last.finishedAt, lang) : undefined}>
        {last && (
          <ol className="feed-result">
            {last.players.map((p, i) => {
              const tap = p.profileId ? () => (setOpen(null), onPlayer({ pid: p.profileId!, name: p.name })) : undefined;
              return (
                <li key={i}>
                  <button className="feed-res-row" disabled={!tap} onClick={tap}>
                    <span className="n">{i + 1}</span>
                    <span className="pf-ava sm">{p.bot ? <Icon name="bot" size={16} /> : p.name.charAt(0).toUpperCase()}</span>
                    <span className="nm">
                      {p.name}
                      {p.ai && <span className="ai-tag">ИИ</span>}
                      {p.winner && <Icon name="crown" size={14} />}
                    </span>
                    <b>
                      {p.vp} <small>{T('pts')}</small>
                    </b>
                    {tap && <span className="chev">›</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </Sheet>
    </section>
  );
}
