// Социальное на главной: идущие партии (смотреть зрителем), недавние партии, профиль игрока по тапу.

import { useEffect, useState } from 'react';
import type { FriendRow, LiveGame, RecentGame } from '../proto';
import { conn, useConn } from '../client/conn';
import { LORE_PACKS } from '../lore';
import { PLAYER_HEX } from '../ui/theme';
import { ArtIcon, Icon } from './icons';
import { eraCoverMd, eraIcon } from './era';
import { Sheet } from './Sheet';
export { ProfileSheet } from './Profile';
import { t3, type Lang, type T3 } from './learn/lang';
import { L } from '../i18n/l';

const S: Record<string, T3> = {
  live: { ru: 'Сейчас играют', kz: 'Қазір ойнап жатыр', en: 'Playing now' },
  recent: { ru: 'Недавние партии', kz: 'Соңғы ойындар', en: 'Recent games' },
  watch: { ru: 'Смотреть', kz: 'Көру', en: 'Watch' },
  back: { ru: 'Вернуться', kz: 'Оралу', en: 'Rejoin' },
  turn: { ru: 'ход', kz: 'жүріс', en: 'turn' },
  setup: { ru: 'расстановка', kz: 'орналастыру', en: 'setup' },
  paused: { ru: 'пауза', kz: 'үзіліс', en: 'paused' },
  won: { ru: 'победил', kz: 'жеңді', en: 'won' },
  you: { ru: 'ты играл', kz: 'сен ойнадың', en: 'you played' },
  game: { ru: 'Партия', kz: 'Ойын', en: 'Game' },
  pts: { ru: 'оч.', kz: 'ұпай', en: 'pts' },
  bot: { ru: 'бот', kz: 'бот', en: 'bot' },
  friends: { ru: 'Друзья', kz: 'Достар', en: 'Friends' },
  playing: { ru: 'играет', kz: 'ойнап жатыр', en: 'playing' },
  lobby: { ru: 'в лобби', kz: 'лоббиде', en: 'in lobby' },
  online: { ru: 'в сети', kz: 'желіде', en: 'online' },
  noFriends: { ru: 'Добавляй друзей: нажми на игрока в лидерах или в партии — «Добавить в друзья». Здесь будет видно, кто в сети и где играет.', kz: 'Дос қос: көшбасшылардағы немесе ойындағы ойыншыны бас — «Досқа қосу». Мұнда кім желіде екені көрінеді.', en: 'Add friends: tap a player in leaders or a game, then “Add friend”. You will see who is online and where they play.' },
  withFriends: { ru: 'друзья', kz: 'достар', en: 'friends' },
  yours: { ru: 'Твоя партия', kz: 'Сенің ойының', en: 'Your game' },
  resume: { ru: 'Продолжить', kz: 'Жалғастыру', en: 'Continue' },
  onPause: { ru: 'на паузе', kz: 'үзілісте', en: 'on pause' },
  yourTurn: { ru: 'твой ход', kz: 'сенің жүрісің', en: 'your turn' },
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
    conn.send({ t: 'friends' });
    const id = window.setInterval(() => {
      if (document.hidden) return;
      conn.send({ t: 'feed' });
      conn.send({ t: 'friends' });
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
                <b>
                  {eraName(g.era)}
                  {g.friends && (
                    <small className="feed-fr">
                      {' · '}
                      <Icon name="users" size={12} /> {T('withFriends')}
                    </small>
                  )}
                </b>
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
                  {g.paused ? T('paused') : g.turn > 0 ? `${T('turn')} ${g.turn}` : T('setup')}
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

/** Мои незаконченные партии — крупно, наверху главной: вернуться одним касанием (и после паузы на дни). */
export function ResumeGames({ games, lang }: { games: LiveGame[]; lang: Lang }) {
  const T = (k: string) => t3(S[k], lang);
  if (!games.length) return null;
  return (
    <div className="resume-list">
      {games.map((g) => (
        <button key={g.pin} className="resume-card" onClick={() => conn.open(g.pin)} style={{ backgroundImage: `url(${eraCoverMd(g.era)})` }}>
          <span className="rc-shade" aria-hidden />
          <span className="rc-top">
            <span className={`rc-badge ${g.paused ? 'paused' : 'live'}`}>
              <Icon name={g.paused ? 'pause' : 'play'} size={12} />
              {T('yours')} · {g.paused ? T('onPause') : g.turn > 0 ? `${T('turn')} ${g.turn}` : T('setup')}
            </span>
          </span>
          <span className="rc-body">
            <b className="display">{eraName(g.era)}</b>
            <span className="rc-players">
              {g.players.map((p, i) => (
                <span key={i} className={`fp ${i === g.current ? 'now' : ''}`} style={{ ['--pc' as string]: PLAYER_HEX[p.color] }}>
                  <i />
                  {p.name}
                  <small>{p.points}</small>
                </span>
              ))}
            </span>
          </span>
          <span className="rc-cta">
            <Icon name="play" size={18} /> {T('resume')}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Сколько партий идёт прямо сейчас — живая точка на обложке. */
export function LiveCount({ n, lang }: { n: number; lang: Lang }) {
  if (!n) return null;
  const ru = () => {
    const d = n % 10;
    const h = n % 100;
    if (d === 1 && h !== 11) return 'партия идёт';
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return 'партии идут';
    return 'партий идут';
  };
  const word = lang === 'en' ? (n === 1 ? 'game live' : 'games live') : lang === 'kz' ? 'ойын жүріп жатыр' : ru();
  return (
    <span className="hub-livecount">
      <i aria-hidden /> {n} {word}
    </span>
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
                      {p.ai && <span className="ai-tag">{L('ИИ', 'ЖИ', 'AI')}</span>}
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

/** Полоска друзей на главной: кто в сети и где играет. Тап — профиль (там «Смотреть» / «Зайти»). */
export function FriendsStrip({ friends, lang, onOpen }: { friends: FriendRow[] | undefined; lang: Lang; onOpen: (p: { pid: string; name: string }) => void }) {
  const T = (k: string) => t3(S[k], lang);
  if (!friends) return null;
  const on = friends.filter((f) => f.online).length;
  return (
    <section className="hub-feed" aria-label={T('friends')}>
      <div className="hub-sec-h">
        <b>{T('friends')}</b>
        {friends.length > 0 && <small className={on ? 'hub-live-dot' : ''}>{on ? `${on} ${T('online')}` : friends.length}</small>}
      </div>
      {friends.length === 0 ? (
        <p className="fr-empty">
          <Icon name="plus" size={18} />
          <span>{T('noFriends')}</span>
        </p>
      ) : (
        <div className="fr-strip">
          {friends.map((f) => (
            <button key={f.id} className={`fr ${f.online ? 'on' : ''}`} onClick={() => onOpen({ pid: f.id, name: f.name })}>
              <span className="pf-ava">
                {f.photo ? <img src={f.photo} alt="" /> : f.name.charAt(0).toUpperCase()}
                {f.online && <i className={f.where?.state === 'playing' ? 'play' : ''} />}
              </span>
              <b>{f.name}</b>
              <small>{f.where ? T(f.where.state === 'playing' ? 'playing' : 'lobby') : f.online ? T('online') : f.rating}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Друг зовёт в партию — всплывашка поверх любого экрана. */
export function InviteToast() {
  const { invite, room } = useConn();
  useEffect(() => {
    if (!invite) return;
    const t = window.setTimeout(() => conn.dismissInvite(), 20_000);
    return () => window.clearTimeout(t);
  }, [invite]);
  if (!invite || room?.pin === invite.pin) return null;
  return (
    <div className="invite-toast glass" role="alert" key={invite.key}>
      <ArtIcon src={eraIcon(invite.era, 'emblem')} size={34} />
      <span className="grow">
        <b>{L('{name} зовёт в партию', '{name} ойынға шақырады', '{name} invites you to a game', { name: invite.from })}</b>
        <small>
          {eraName(invite.era)} · PIN {invite.pin}
        </small>
      </span>
      <button
        className="btn primary small-act"
        onClick={() => {
          conn.dismissInvite();
          conn.open(invite.pin);
        }}
      >
        {L('Открыть', 'Ашу', 'Open')}
      </button>
      <button className="it-x" aria-label={L('Закрыть', 'Жабу', 'Close')} onClick={() => conn.dismissInvite()}>
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

/** Лобби: позвать друзей за стол (всплывашка у тех, кто в сети, и пуш на телефон). */
export function InviteFriends() {
  const { friends, status, room } = useConn();
  const [sent, setSent] = useState<Record<string, number>>({});
  useEffect(() => {
    if (status !== 'online') return;
    conn.send({ t: 'friends' });
    const id = window.setInterval(() => conn.send({ t: 'friends' }), 15_000);
    return () => window.clearInterval(id);
  }, [status]);
  const list = (friends ?? []).filter((f) => f.where?.pin !== room?.pin);
  if (!list.length || !room?.seated) return null;
  return (
    <section className="panel glass stack lb-friends">
      <span className="label">{L('Позвать друзей', 'Достарды шақыру', 'Invite friends')}</span>
      <ul className="lbf-list">
        {list.slice(0, 8).map((f) => {
          const done = (sent[f.id] ?? 0) > Date.now() - 30_000;
          return (
            <li key={f.id}>
              <span className="pf-ava sm">
                {f.photo ? <img src={f.photo} alt="" /> : f.name.charAt(0).toUpperCase()}
                {f.online && <i className={f.where?.state === 'playing' ? 'play' : ''} />}
              </span>
              <span className="grow">
                <b>{f.name}</b>
                <small>{f.where ? (f.where.state === 'playing' ? L('играет', 'ойнап жатыр', 'playing') : L('в другом лобби', 'басқа лоббиде', 'in another lobby')) : f.online ? L('в сети', 'желіде', 'online') : L('придёт уведомление', 'хабарлама барады', 'will be notified')}</small>
              </span>
              <button
                className={`btn small-act ${done ? 'ghost' : ''}`}
                disabled={done}
                onClick={() => {
                  conn.send({ t: 'invite', id: f.id });
                  setSent((x) => ({ ...x, [f.id]: Date.now() }));
                }}
              >
                {done ? L('Позвали', 'Шақырылды', 'Invited') : L('Позвать', 'Шақыру', 'Invite')}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
