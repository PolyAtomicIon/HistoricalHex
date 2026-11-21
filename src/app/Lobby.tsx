// Лобби: PIN и QR, кто за столом, цвета, эпоха и настройки (у ведущего), старт.

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { BotLevel, PlayerColor } from '../engine';
import { PLAYER_COLORS } from '../engine';
import type { DiceMode, RoomView } from '../proto';
import { conn } from '../client/conn';
import { LORE_PACKS } from '../lore';
import { PLAYER_HEX } from '../ui/theme';
import { haptic, sfx } from '../fx';
import { savedName, saveName } from './Home';
import { eraCover, eraIcon, useEra } from './era';
import { ArtIcon, Icon } from './icons';
import { TurnSettings } from './TurnSettings';
import { PERSONAS } from '../bots/personas';

const DICE: { id: DiceMode; label: string; hint: string }[] = [
  { id: 'randomOrg', label: 'random.org', hint: 'Настоящий случай из атмосферного шума' },
  { id: 'physical', label: 'Настоящие', hint: 'Бросаем кубики на столе и вводим, что выпало' },
  { id: 'balanced', label: 'Ровные', hint: 'Колода из 36 бросков — меньше серий' },
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
      {src ? <img className="qr" src={src} width={size} height={size} alt="QR-код для входа" /> : <div className="qr" />}
    </div>
  );
}

export function Lobby({ room, tv = false }: { room: RoomView; tv?: boolean }) {
  const pack = useEra(room.settings.lore);
  const [name, setName] = useState(savedName());
  const mine = room.lobby.find((s) => s.id === room.me);
  const taken = new Set(room.lobby.filter((s) => s.id !== room.me).map((s) => s.color));
  const host = room.isHost && !tv;
  const canStart = room.lobby.length >= 3 && room.lobby.every((s) => s.color) && room.lobby.some((s) => !s.bot);

  return (
    <main className="screen lobby">
      <div className="ambient" aria-hidden />
      <div key={pack.id} className="hero-bg" style={{ backgroundImage: `url(${eraCover(pack.id)})` }} aria-hidden />
      <div className="center-col">
        <header className="lobby-head">
          <div className="era-badge glass">
            <ArtIcon src={eraIcon(pack.id, 'emblem')} size={30} />
            <b>{pack.title}</b>
            <small className="muted">{pack.years}</small>
          </div>
          <div className="pin-block">
            <span className="label">PIN</span>
            <span className="display pin">{room.pin.replace(/(\d{3})(\d{3})/, '$1 $2')}</span>
          </div>
        </header>

        <div className={`lobby-grid ${tv ? 'tv' : ''}`}>
          <section className="panel glass stack">
            <div className="row">
              <Qr text={joinLink(room.pin)} size={tv ? 220 : 104} />
              <div className="stack grow join-txt">
                <b>Сканируй и заходи</b>
                <span className="muted small">или введи PIN на сайте</span>
                {!tv && (
                  <a className="btn wide" href={joinLink(room.pin, true)} target="_blank" rel="noreferrer">
                    <Icon name="tv" /> Экран для ТВ
                  </a>
                )}
              </div>
            </div>

            <div className="label">За столом · {room.lobby.length}/6</div>
            <ul className="list seats">
              {room.lobby.map((s) => (
                <li key={s.id} className="item seat" style={{ ['--pc' as string]: s.color ? PLAYER_HEX[s.color] : '#666' }}>
                  <span className="seat-dot" />
                  <span className="grow t">
                    {s.name}
                    {s.id === room.hostId && <span className="faint small"> · ведущий</span>}
                    {s.id === room.me && <span className="faint small"> · ты</span>}
                    {s.persona && <span className="seat-style">ИИ · {PERSONAS.find((x) => x.id === s.persona)?.style}</span>}
                  </span>
                  {!s.online && <span className="faint small">не в сети</span>}
                  {host && s.id !== room.me && (
                    <button className="seat-x" aria-label={`Убрать ${s.name}`} onClick={() => conn.send({ t: 'kick', player: s.id })}>
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {host && room.lobby.length < 6 && (
              <div className="bot-add">
                <span className="bot-add-l">
                  <Icon name="bot" size={16} /> Бот
                </span>
                <div className="seg">
                  {(['easy', 'medium', 'hard'] as BotLevel[]).map((l) => (
                    <button key={l} onClick={() => conn.send({ t: 'addBot', level: l })}>
                      {l === 'easy' ? 'лёгкий' : l === 'medium' ? 'средний' : 'сложный'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {!tv && (
            <section className="panel glass stack">
              {!mine ? (
                <form
                  className="stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!name.trim()) return;
                    saveName(name.trim());
                    conn.join(room.pin, name.trim());
                  }}
                >
                  <b>{room.isHost ? 'Играешь с этого телефона?' : 'Как тебя зовут?'}</b>
                  <input className="field" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Имя" />
                  <button className="btn primary wide" disabled={!name.trim()}>
                    Сесть за стол
                  </button>
                </form>
              ) : (
                <>
                  <div className="label">Твой цвет</div>
                  <div className="colors">
                    {PLAYER_COLORS.map((c: PlayerColor) => (
                      <button
                        key={c}
                        className={`color ${mine.color === c ? 'on' : ''}`}
                        style={{ background: PLAYER_HEX[c] }}
                        disabled={taken.has(c)}
                        aria-label={c}
                        aria-pressed={mine.color === c}
                        onClick={() => {
                          haptic('tap');
                          sfx.play('tick');
                          conn.send({ t: 'color', color: c });
                        }}
                      />
                    ))}
                  </div>
                </>
              )}

              {host ? (
                <>
                  <div className="label">Эпоха</div>
                  <div className="era-rows" role="radiogroup" aria-label="Эпоха">
                    {LORE_PACKS.map((p) => (
                      <button
                        key={p.id}
                        role="radio"
                        aria-checked={p.id === room.settings.lore}
                        className={`era-row ${p.id === room.settings.lore ? 'on' : ''}`}
                        onClick={() => conn.send({ t: 'settings', settings: { lore: p.id } })}
                      >
                        <span className="er-art" style={{ backgroundImage: `url(${eraCover(p.id)})` }} aria-hidden>
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
                  <div className="label">Кубики</div>
                  <div className="seg" role="group">
                    {DICE.map((d) => (
                      <button
                        key={d.id}
                        aria-pressed={room.settings.dice === d.id}
                        onClick={() => conn.send({ t: 'settings', settings: { dice: d.id } })}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <p className="faint small">{DICE.find((d) => d.id === room.settings.dice)?.hint}</p>
                  <div className="label">Очков для победы</div>
                  <div className="seg" role="group">
                    {[8, 10, 12].map((v) => (
                      <button key={v} aria-pressed={room.settings.vpToWin === v} onClick={() => conn.send({ t: 'settings', settings: { vpToWin: v } })}>
                        {v}
                      </button>
                    ))}
                  </div>
                  <TurnSettings settings={room.settings} editable />
                  <button
                    className="btn primary big wide"
                    disabled={!canStart}
                    onClick={() => {
                      sfx.play('fanfare');
                      conn.send({ t: 'start' });
                    }}
                  >
                    Начать партию
                  </button>
                  {!canStart && <p className="faint small center">Нужно от 3 игроков (можно с ботами), у всех — цвет</p>}
                </>
              ) : (
                <div className="stack">
                  <p className="muted">
                    Кубики: <b>{DICE.find((d) => d.id === room.settings.dice)?.label}</b> · до {room.settings.vpToWin} очков ·{' '}
                    {room.settings.turnSeconds > 0 ? `${Math.round(room.settings.turnSeconds / 60 * 10) / 10} мин на ход` : 'без таймера'}
                  </p>
                  <p className="muted">Ждём, пока ведущий начнёт…</p>
                </div>
              )}
              <button
                className="btn ghost wide"
                onClick={() => {
                  if (mine) conn.send({ t: 'leaveLobby' });
                  conn.forget();
                }}
              >
                Выйти
              </button>
            </section>
          )}
        </div>

        <section className="panel glass intro">
          {pack.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      </div>
    </main>
  );
}
