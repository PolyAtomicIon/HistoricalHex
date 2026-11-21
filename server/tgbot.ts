// Бот Telegram: вход из обычного браузера через ссылку t.me/<бот>?start=login_<код>.
// Сервер опрашивает getUpdates (без вебхука), находит /start login_<код> и привязывает устройство к Telegram.
// Login Widget в Казахстане ненадёжен (telegram.org блокируется), а t.me открывает приложение Telegram.
// Без TG_BOT_TOKEN модуль ничего не делает.

import { randomBytes } from 'node:crypto';
import type { TgUser } from './accounts';

interface Pending {
  pid: string;
  until: number;
  done: (u: TgUser) => void;
}

const pending = new Map<string, Pending>();
const TTL = 10 * 60 * 1000;

export class TgBot {
  private offset = 0;
  private stopped = false;
  constructor(
    private token: string,
    readonly name: string,
    private appUrl: string,
  ) {}

  /** Ссылка для входа: откроет бота, нажатие «Start» подтвердит вход этого устройства. */
  loginLink(pid: string, done: (u: TgUser) => void): string {
    for (const [k, v] of pending) if (v.until < Date.now() || v.pid === pid) pending.delete(k);
    const code = randomBytes(9).toString('base64url');
    pending.set(code, { pid, until: Date.now() + TTL, done });
    return `https://t.me/${this.name}?start=login_${code}`;
  }

  start(): void {
    void this.loop();
  }

  stop(): void {
    this.stopped = true;
  }

  private async api<T>(method: string, body: unknown): Promise<T> {
    const r = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(40_000),
    });
    const j = (await r.json()) as { ok: boolean; result: T; description?: string };
    if (!j.ok) throw new Error(j.description ?? method);
    return j.result;
  }

  private async loop(): Promise<void> {
    while (!this.stopped) {
      try {
        const updates = await this.api<{ update_id: number; message?: { chat: { id: number }; from?: TgUser; text?: string } }[]>('getUpdates', {
          offset: this.offset,
          timeout: 30,
          allowed_updates: ['message'],
        });
        for (const u of updates) {
          this.offset = u.update_id + 1;
          await this.onMessage(u.message).catch((e) => console.error('tg message', e));
        }
      } catch (e) {
        console.error('tg poll', (e as Error).message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  private async onMessage(m?: { chat: { id: number }; from?: TgUser; text?: string }): Promise<void> {
    if (!m?.from || !m.text) return;
    const arg = /^\/start(?:\s+(\S+))?/.exec(m.text)?.[1];
    if (arg?.startsWith('login_')) {
      const p = pending.get(arg.slice(6));
      if (!p || p.until < Date.now()) {
        await this.reply(m.chat.id, 'Ссылка для входа устарела. Нажми «Войти через Telegram» в игре ещё раз.');
        return;
      }
      pending.delete(arg.slice(6));
      p.done(m.from);
      await this.reply(m.chat.id, `Готово, ${m.from.first_name ?? 'игрок'}! Вернись в игру — профиль уже привязан.`);
      return;
    }
    if (m.text.startsWith('/start')) {
      await this.api('sendMessage', {
        chat_id: m.chat.id,
        text: 'HistoricalHex — стройся, торгуй и узнавай историю. Каждая партия в своей эпохе.',
        reply_markup: { inline_keyboard: [[{ text: 'Играть', web_app: { url: this.appUrl } }]] },
      });
    }
  }

  private reply(chat: number, text: string) {
    return this.api('sendMessage', { chat_id: chat, text });
  }
}
