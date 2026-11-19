import { useState } from 'react';
import { NAME_MAX, describeError } from '../net';
import { GAME_TITLE } from '../i18n/ru';
import { Emblem } from '../ui/Logo';

export function JoinScreen({
  initialPin,
  initialName,
  onJoin,
  message,
}: {
  initialPin: string;
  initialName: string;
  onJoin: (pin: string, name: string) => Promise<void>;
  message?: string;
}) {
  const [pin, setPin] = useState(initialPin);
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(message ?? '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = pin.replace(/\D/g, '');
    if (digits.length !== 6) return setError('PIN — это 6 цифр с экрана ведущего');
    if (!name.trim()) return setError('Введи имя');
    setBusy(true);
    setError('');
    try {
      await onJoin(digits, name);
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <main className="screen center join">
      <Emblem className="big" />
      <h1 className="logo">{GAME_TITLE}</h1>
      <form className="card join-form" onSubmit={submit}>
        <label>
          PIN игры
          <input
            inputMode="numeric"
            autoComplete="off"
            maxLength={7}
            placeholder="123 456"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus={!initialPin}
          />
        </label>
        <label>
          Твоё имя
          <input
            maxLength={NAME_MAX}
            autoComplete="nickname"
            placeholder="Как тебя звать?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!!initialPin}
          />
        </label>
        <button className="btn primary big" disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
