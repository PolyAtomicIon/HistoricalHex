// Лобби: PIN и QR, кто за столом, цвета, эпоха и настройки (у ведущего), старт.

import { InviteFriends } from './Social';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { BotLevel, PlayerColor } from '../engine';
import { PLAYER_COLORS } from '../engine';
import type { DiceMode, RoomView } from '../proto';
import { conn, useConn } from '../client/conn';
import { LORE_PACKS } from '../lore';
import { PLAYER_HEX } from '../ui/theme';
import { haptic, sfx } from '../fx';
import { savedName, saveName } from './Home';
import { eraCover, eraThumb, eraIcon, useEra } from './era';
import { ArtIcon, Icon } from './icons';
import { TurnSettings } from './TurnSettings';
import { Sheet } from './Sheet';
import { LearnCard, useLearn } from './learn/Learn';
import { PERSONAS } from '../bots/personas';
import { L } from '../i18n/l';

const diceList = (): { id: DiceMode; label: string; hint: string }[] => [
  { id: 'randomOrg', label: 'random.org', hint: L('Настоящий случай из атмосферного шума', 'Атмосфералық шудан алынған нағыз кездейсоқтық', 'True randomness from atmospheric noise') },
  { id: 'physical', label: L('Настоящие', 'Нағыз', 'Real'), hint: L('Бросаем кубики на столе и вводим, что выпало', 'Сүйекті үстелде лақтырып, түскенін енгізесіңдер', 'Roll physical dice at the table and enter the result') },
  { id: 'balanced', label: L('Ровные', 'Теңдестірілген', 'Balanced'), hint: L('Колода из 36 бросков — меньше серий', '36 лақтырудан тұратын жиын — қатар түсу азырақ', 'A deck of 36 rolls, fewer streaks') },
];

export function joinLink(pin: string, tv = false): string {
  const url = new URL(import.meta.env.BASE_URL, location.origin);
  url.searchParams.set('pin', pin);
  if (tv) url.searchParams.set('tv', '1');
  return url.toString();
}

export function Qr({ text, size = 180 }: { text: string; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    void QRCode.toDataURL(text, { margin: 0, errorCorrectionLevel: 'M', width: size * 3, color: { dark: '#101a26', light: '#f7f2e6' } }).then(setSrc);
  }, [text, size]);
  // Карточка-«паспарту»: светлое поле вокруг кода, чёткие модули (без сглаживания)
  return (
    <div className="qr-card" style={{ ['--qr' as string]: `${size}px` }}>
      {src ? <img className="qr" src={src} width={size} height={size} alt={L('QR-код для входа', 'Кіруге арналған QR-код', 'QR code to join')} /> : <div className="qr" />}
    </div>
  );
}

const botLabel = (): Record<BotLevel, string> => ({ easy: L('лёгкий', 'жеңіл', 'easy'), medium: L('средний', 'орташа', 'medium'), hard: L('сложный', 'қиын', 'hard') });

export function Lobby({ room, tv = false }: { room: RoomView; tv?: boolean }) {
  const pack = useEra(room.settings.lore);
  const { profile } = useConn();
  const [name, setName] = useState(savedName());
  const [sheet, setSheet] = useState<null | 'settings' | 'color'>(null);
  const [botLevel, setBotLevel] = useState<BotLevel>('medium');
  const mine = room.lobby.find((s) => s.id === room.me);
  const taken = new Set(room.lobby.filter((s) => s.id !== room.me).map((s) => s.color));
  const host = room.isHost && !tv;
  const learn = useLearn();
  const humans = room.lobby.filter((s) => !s.bot).length;
  const canStart = room.lobby.length >= 3 && room.lobby.every((s) => s.color) && humans > 0;
  const need = Math.max(0, 3 - room.lobby.length);

  // Ведущий почти всегда играет сам — сажаем за стол сразу, с именем из профиля (один раз на комнату:
  // если он встал из-за стола, обратно не сажаем)
  const knownName = (savedName() || profile?.profile.name || '').trim();
  const seatKey = `hh.autoseat.${room.pin}`;
  useEffect(() => {
    if (!host || mine || !knownName) return;
    try {
      if (sessionStorage.getItem(seatKey)) return;
      sessionStorage.setItem(seatKey, '1');
    } catch {
      /* ok */
    }
    conn.join(room.pin, knownName);
  }, [host, !!mine, knownName]); // eslint-disable-line react-hooks/exhaustive-deps

  const dice = diceList().find((d) => d.id === room.settings.dice);
  const timer = room.settings.turnSeconds > 0 ? L('{n} мин', '{n} мин', '{n} min', { n: Math.round((room.settings.turnSeconds / 60) * 10) / 10 }) : L('без таймера', 'таймерсіз', 'no timer');
  const summary = `${dice?.label ?? L('Обычные кубики', 'Әдеттегі сүйек', 'Standard dice')} · ${L('до {n} очков', '{n} ұпайға дейін', 'to {n} points', { n: room.settings.vpToWin })} · ${timer}${room.settings.autoRoll ? ' · ' + L('автобросок', 'авто лақтыру', 'auto-roll') : ''}`;
  const slots = Array.from({ length: 6 }, (_, i) => room.lobby[i]);

  return (
    <main className={`screen lobby ${tv ? '' : 'lobby2'}`}>
      <div className="ambient" aria-hidden />
      <div key={pack.id} className="hero-bg" style={{ backgroundImage: `url(${eraCover(pack.id)})` }} aria-hidden />
      <div className={tv ? 'center-col' : 'lobby-col'}>
        {tv ? (
          <header className="lobby-head">
            <div className="era-badge glass">
              <ArtIcon src={eraIcon(pack.id, 'emblem')} size={30} />
              <b>{pack.title}</b>
            </div>
            <div className="pin-block">
              <span className="label">PIN</span>
              <span className="display pin">{room.pin.replace(/(\d{3})(\d{3})/, '$1 $2')}</span>
            </div>
          </header>
        ) : (
          <button className="era-badge glass lb-era" onClick={() => host && setSheet('settings')} disabled={!host} aria-label={host ? L('Эпоха: {title}. Сменить', 'Дәуір: {title}. Ауыстыру', 'Era: {title}. Change', { title: pack.title }) : pack.title}>
            <ArtIcon src={eraIcon(pack.id, 'emblem')} size={30} />
            <span className="lb-era-t">
              <b>{pack.title}</b>
              <small>{pack.years}</small>
            </span>
            {host && <Icon name="next" size={16} />}
          </button>
        )}

        <section className={`panel glass stack lobby-join ${tv ? 'tv' : ''}`}>
          <div className="row">
            <Qr text={joinLink(room.pin)} size={tv ? 220 : 96} />
            <div className="stack grow join-txt">
              {tv ? (
                <>
                  <b>{L('Сканируй и заходи', 'Сканерлеп кір', 'Scan to join')}</b>
                  <span className="muted small">{L('или введи PIN на сайте', 'немесе сайтқа PIN енгіз', 'or enter the PIN on the site')}</span>
                </>
              ) : (
                <>
                  <span className="lb-pin-l">{L('PIN для входа', 'Кіру PIN-і', 'Join PIN')}</span>
                  <span className="display lb-pin">{room.pin.replace(/(\d{3})(\d{3})/, '$1 $2')}</span>
                  <a className="btn lb-tv" href={joinLink(room.pin, true)} target="_blank" rel="noreferrer">
                    <Icon name="tv" size={18} /> {L('На ТВ', 'ТВ-ға', 'On TV')}
                  </a>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="panel glass stack">
          <div className="lb-sec">
            <span className="label lb-count">{L('Стол · {n}/6', 'Үстел · {n}/6', 'Table · {n}/6', { n: room.lobby.length })}</span>
            {host && room.lobby.length < 6 && (
              <div className="lb-level" role="group" aria-label={L('Уровень бота', 'Бот деңгейі', 'Bot level')}>
                {(['easy', 'medium', 'hard'] as BotLevel[]).map((l) => (
                  <button key={l} aria-pressed={botLevel === l} onClick={() => setBotLevel(l)}>
                    {botLabel()[l]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="lb-seats">
            {slots.map((s, i) =>
              s ? (
                <div key={s.id} className={`lb-seat ${s.id === room.me ? 'me' : ''}`} style={{ ['--pc' as string]: s.color ? PLAYER_HEX[s.color] : '#666' }}>
                  <button
                    className="lb-ava"
                    onClick={() => s.id === room.me && setSheet('color')}
                    aria-label={s.id === room.me ? L('Сменить цвет', 'Түсті ауыстыру', 'Change color') : s.name}
                    disabled={s.id !== room.me}
                  >
                    {s.bot ? <Icon name="bot" size={18} /> : s.name.charAt(0).toUpperCase()}
                    {!s.online && !s.bot && <i className="off" aria-label={L('не в сети', 'желіде емес', 'offline')} />}
                  </button>
                  <b>{s.id === room.me ? L('Ты', 'Сен', 'You') : s.name}</b>
                  <small>
                    {s.id === room.hostId ? L('ведущий', 'жүргізуші', 'host') : s.bot ? (PERSONAS.find((x) => x.id === s.persona)?.style ?? botLabel()[s.bot]) : L('игрок', 'ойыншы', 'player')}
                  </small>
                  {host && s.id !== room.me && (
                    <button className="lb-x" aria-label={L('Убрать {name}', '{name} алып тастау', 'Remove {name}', { name: s.name })} onClick={() => conn.send({ t: 'kick', player: s.id })}>
                      <Icon name="close" size={12} />
                    </button>
                  )}
                </div>
              ) : host ? (
                <button
                  key={`e${i}`}
                  className="lb-seat empty"
                  onClick={() => {
                    sfx.play('tick');
                    conn.send({ t: 'addBot', level: botLevel });
                  }}
                >
                  <span className="lb-ava">
                    <Icon name="bot" size={18} />
                  </span>
                  <b>{L('+ бот', '+ бот', '+ bot')}</b>
                  <small>{botLabel()[botLevel]}</small>
                </button>
              ) : (
                <div key={`e${i}`} className="lb-seat empty">
                  <span className="lb-ava" />
                  <b>{L('свободно', 'бос', 'free')}</b>
                </div>
              ),
            )}
          </div>
          {!tv && !mine && (
            <form
              className="lb-name"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                saveName(name.trim());
                conn.join(room.pin, name.trim());
              }}
            >
              <input className="field" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder={room.isHost ? L('Играешь сам? Имя', 'Өзің ойнайсың ба? Атың', 'Playing? Your name') : L('Твоё имя', 'Атың', 'Your name')} />
              <button className="btn primary" disabled={!name.trim()}>
                {L('Сесть', 'Отыру', 'Sit down')}
              </button>
            </form>
          )}
        </section>

        {!tv && <InviteFriends />}
        {!tv && <LearnCard onTutorial={learn.openTutorial} onRules={learn.openRules} />}

        {!tv && (
          <button className="lb-settings glass" onClick={() => host && setSheet('settings')} disabled={!host}>
            <span>
              <b>{L('Настройки партии', 'Ойын баптаулары', 'Game settings')}</b>
              <small>{summary}</small>
            </span>
            {host && <Icon name="next" size={16} />}
          </button>
        )}

        {tv && (
          <section className="panel glass intro">
            {pack.intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        )}
      </div>

      {!tv && (
        <footer className="lobby-foot">
          <button
            className="btn icon lf-exit"
            aria-label={L('Выйти', 'Шығу', 'Leave')}
            onClick={() => {
              if (mine) conn.send({ t: 'leaveLobby' });
              conn.forget();
            }}
          >
            <Icon name="door" size={18} />
          </button>
          {host ? (
            <button
              className="btn primary big grow"
              disabled={!canStart}
              onClick={() => {
                sfx.play('fanfare');
                conn.send({ t: 'start' });
              }}
            >
              {canStart ? L('Начать партию', 'Ойынды бастау', 'Start game') : need > 0 ? L('Нужно ещё {n} — добавь ботов', 'Тағы {n} керек — бот қос', '{n} more needed — add bots', { n: need }) : L('Нужен хотя бы один человек', 'Кемінде бір адам керек', 'At least one human is needed')}
            </button>
          ) : (
            <div className="lf-wait grow">
              <span className="spinner sm" aria-hidden /> {L('Ждём, пока ведущий начнёт…', 'Жүргізуші бастағанын күтеміз…', 'Waiting for the host to start…')}
            </div>
          )}
        </footer>
      )}

      <Sheet open={sheet === 'color'} onClose={() => setSheet(null)} title={L('Твой цвет', 'Сенің түсің', 'Your color')}>
        <div className="colors">
          {PLAYER_COLORS.map((c: PlayerColor) => (
            <button
              key={c}
              className={`color ${mine?.color === c ? 'on' : ''}`}
              style={{ background: PLAYER_HEX[c] }}
              disabled={taken.has(c)}
              aria-label={c}
              aria-pressed={mine?.color === c}
              onClick={() => {
                haptic('tap');
                sfx.play('tick');
                conn.send({ t: 'color', color: c });
                setSheet(null);
              }}
            />
          ))}
        </div>
        {room.isHost && mine && (
          <button
            className="btn ghost wide"
            onClick={() => {
              conn.send({ t: 'leaveLobby' });
              setSheet(null);
            }}
          >
            {L('Я только веду — встать из-за стола', 'Мен тек жүргіземін — үстелден тұру', 'I only host — leave the table')}
          </button>
        )}
      </Sheet>

      <Sheet open={sheet === 'settings'} onClose={() => setSheet(null)} title={L('Настройки партии', 'Ойын баптаулары', 'Game settings')}>
        <div className="stack">
          <div className="label">{L('Эпоха', 'Дәуір', 'Era')}</div>
          <div className="era-rows" role="radiogroup" aria-label={L('Эпоха', 'Дәуір', 'Era')}>
            {LORE_PACKS.map((p) => (
              <button
                key={p.id}
                role="radio"
                aria-checked={p.id === room.settings.lore}
                className={`era-row ${p.id === room.settings.lore ? 'on' : ''}`}
                onClick={() => conn.send({ t: 'settings', settings: { lore: p.id } })}
              >
                <span className="er-art" style={{ backgroundImage: `url(${eraThumb(p.id)})` }} aria-hidden>
                  <ArtIcon src={eraIcon(p.id, 'emblem')} size={26} />
                </span>
                <span className="er-txt">
                  <b>{p.title}</b>
                  <small>{p.years}</small>
                </span>
                <span className="er-check" aria-hidden>
                  {p.id === room.settings.lore && <Icon name="check" size={16} />}
                </span>
              </button>
            ))}
          </div>
          <div className="label">{L('Кубики', 'Сүйектер', 'Dice')}</div>
          <div className="seg" role="group">
            {diceList().map((d) => (
              <button key={d.id} aria-pressed={room.settings.dice === d.id} onClick={() => conn.send({ t: 'settings', settings: { dice: d.id } })}>
                {d.label}
              </button>
            ))}
          </div>
          <p className="faint small">{dice?.hint}</p>
          <div className="label">{L('Очков для победы', 'Жеңіске қажет ұпай', 'Points to win')}</div>
          <div className="seg" role="group">
            {[8, 10, 12].map((v) => (
              <button key={v} aria-pressed={room.settings.vpToWin === v} onClick={() => conn.send({ t: 'settings', settings: { vpToWin: v } })}>
                {v}
              </button>
            ))}
          </div>
          <TurnSettings settings={room.settings} editable />
          <button className="btn primary wide" onClick={() => setSheet(null)}>
            {L('Готово', 'Дайын', 'Done')}
          </button>
        </div>
      </Sheet>
      {learn.ui}
    </main>
  );
}
