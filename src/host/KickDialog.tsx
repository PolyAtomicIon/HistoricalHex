// Окно ведущего «Выгнать игрока» посреди партии: выбрать игрока → выбрать бота, который доиграет за него.

import { useState } from 'react';
import type { ActionResult, BotLevel, GameState, PlayerId } from '../engine';
import { BOT_LEVELS } from '../engine';
import { BOT_LEVEL_NAME } from '../bots';
import { describeError } from '../net';
import { PLAYER_HEX, PLAYER_STROKE } from '../ui/theme';

const BOT_LEVEL_HINT: Record<BotLevel, string> = { easy: 'играет наугад', medium: 'играет с умом', hard: 'играет на победу' };
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Кого можно выгнать: живые игроки и те, кто вышел с ботом вместо себя (но не боты из лобби). */
export function kickable(state: GameState, exclude?: PlayerId): PlayerId[] {
  return state.order.filter((id) => {
    const p = state.players[id];
    return id !== exclude && !p.kicked && !(p.bot && !p.away);
  });
}

interface Props {
  state: GameState;
  /** Сам ведущий (в режиме «играю с этого устройства») — себя выгнать нельзя. */
  exclude?: PlayerId;
  onKick: (uid: PlayerId, level: BotLevel) => Promise<ActionResult>;
  onClose: () => void;
}

export function KickDialog({ state, exclude, onKick, onClose }: Props) {
  const [pick, setPick] = useState<PlayerId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const list = kickable(state, exclude);
  const p = pick ? state.players[pick] : undefined;

  const kick = async (level: BotLevel) => {
    if (!pick) return;
    setBusy(true);
    setError('');
    try {
      const res = await onKick(pick, level);
      if (res.ok) return onClose();
      setError(res.error);
    } catch (e) {
      setError(describeError(e));
    }
    setBusy(false);
  };

  return (
    <div className="kick-overlay" onClick={onClose}>
      <div className="card kick-dialog" onClick={(e) => e.stopPropagation()}>
        {!p ? (
          <>
            <h3>Кого выгнать?</h3>
            {list.length === 0 && <p className="muted">Выгонять некого — остались только боты.</p>}
            <div className="kick-list">
              {list.map((id) => {
                const pl = state.players[id];
                return (
                  <button key={id} className="btn" onClick={() => setPick(id)}>
                    <span className="chip" style={{ background: PLAYER_HEX[pl.color], borderColor: PLAYER_STROKE[pl.color] }} />
                    <span className="name">{pl.name}</span>
                    {pl.away && pl.bot && <small>🤖 за него играет бот</small>}
                  </button>
                );
              })}
            </div>
            <div className="kick-row">
              <button className="btn ghost" onClick={onClose}>
                Отмена
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>Выгнать {p.name}?</h3>
            <p className="muted">
              Карты и постройки останутся, до конца партии за игрока будет играть бот. Вернуться в эту игру игрок не
              сможет.
            </p>
            {p.away && p.bot ? (
              <>
                <p>
                  Сейчас за игрока уже играет бот «{BOT_LEVEL_NAME[p.bot]}» — он и продолжит.
                </p>
                <div className="kick-row">
                  <button className="btn ghost" onClick={() => setPick(null)} disabled={busy}>
                    Назад
                  </button>
                  <button className="btn primary" onClick={() => kick(p.bot!)} disabled={busy}>
                    🚫 Выгнать
                  </button>
                </div>
              </>
            ) : (
              <>
                <h4>Кто доиграет за него?</h4>
                <div className="kick-bots">
                  {BOT_LEVELS.map((l) => (
                    <button key={l} className={`btn bot-btn ${l}`} onClick={() => kick(l)} disabled={busy}>
                      <span>🤖 {capitalize(BOT_LEVEL_NAME[l])}</span>
                      <small>{BOT_LEVEL_HINT[l]}</small>
                    </button>
                  ))}
                </div>
                <div className="kick-row">
                  <button className="btn ghost" onClick={() => setPick(null)} disabled={busy}>
                    Назад
                  </button>
                </div>
              </>
            )}
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
