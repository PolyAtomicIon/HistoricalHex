import { createHash, createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { leaderboard, profileOf, randomName, recordGame, renameDefaultProfiles, renameProfile, signInTelegram, useMemoryAccounts, verifyMiniApp, verifyWidget, view } from '../server/accounts';

const TOKEN = '123:abc';

function miniApp(user: object, authDate = Math.floor(Date.now() / 1000)) {
  const p = new URLSearchParams({ auth_date: String(authDate), query_id: 'q1', user: JSON.stringify(user) });
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  p.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return p.toString();
}

describe('accounts', () => {
  beforeEach(() => useMemoryAccounts());

  it('проверяет подпись Mini App и отвергает подделку и старые данные', () => {
    const data = miniApp({ id: 42, first_name: 'Бек' });
    expect(verifyMiniApp(data, TOKEN)?.id).toBe(42);
    expect(verifyMiniApp(data.replace('42', '43'), TOKEN)).toBeNull();
    expect(verifyMiniApp(data, 'other')).toBeNull();
    expect(verifyMiniApp(miniApp({ id: 1 }, Math.floor(Date.now() / 1000) - 2 * 86400), TOKEN)).toBeNull();
  });

  it('проверяет подпись Login Widget', () => {
    const d: Record<string, string | number> = { id: 7, first_name: 'A', auth_date: Math.floor(Date.now() / 1000) };
    const dcs = Object.keys(d).sort().map((k) => `${k}=${d[k]}`).join('\n');
    const hash = createHmac('sha256', createHash('sha256').update(TOKEN).digest()).update(dcs).digest('hex');
    expect(verifyWidget({ ...d, hash }, TOKEN)?.id).toBe(7);
    expect(verifyWidget({ ...d, id: 8, hash }, TOKEN)).toBeNull();
  });

  it('записывает партию один раз: игры, победы, эпохи, серия, рейтинг', () => {
    const g = {
      id: 'g1',
      era: 'ww2',
      finishedAt: Date.now(),
      players: [
        { pid: 'pA', name: 'Аня', vp: 10, winner: true },
        { pid: 'pB', name: 'Боря', vp: 7, winner: false },
        { pid: 'pBot', name: 'Бот', bot: 'medium' as const, vp: 5, winner: false },
      ],
    };
    recordGame(g);
    recordGame(g);
    const a = view(profileOf('pA'));
    const b = view(profileOf('pB'));
    expect(a.games).toBe(1);
    expect(a.wins).toBe(1);
    expect(a.eras.ww2).toEqual({ games: 1, wins: 1 });
    expect(a.streak).toBe(1);
    expect(a.rating).toBeGreaterThan(1000);
    expect(b.rating).toBeLessThan(1000);
    expect(leaderboard()[0].id).toBe('pA');
  });

  it('вход через Telegram переносит гостевой профиль и связывает второе устройство', () => {
    recordGame({ id: 'g2', era: 'japan', finishedAt: Date.now(), players: [{ pid: 'dev1', name: 'Гость', vp: 10, winner: true }, { pid: 'b', name: 'Бот', bot: 'easy', vp: 3, winner: false }] });
    signInTelegram('dev1', { id: 99, first_name: 'Бекзат' });
    signInTelegram('dev2', { id: 99, first_name: 'Бекзат' });
    const v = view(profileOf('dev2'));
    expect(v.telegram).toBe(true);
    expect(v.games).toBe(1);
    expect(v.name).toBe('Бекзат');
  });
});

import { PERSONAS, simulateGame } from '../server/personas';
import { findProfile } from '../server/accounts';

describe('ИИ-персонажи', () => {
  beforeEach(() => useMemoryAccounts());

  it('партия ботов-персонажей доигрывается и пишет им статистику', () => {
    let r = null;
    for (let i = 0; i < 3 && !r; i++) r = simulateGame(PERSONAS.slice(0, 4), 'ww2');
    expect(r).not.toBeNull();
    expect(r!.players.filter((p) => p.winner)).toHaveLength(1);
    recordGame({ id: 'sim1', era: r!.era, finishedAt: Date.now(), players: r!.players });
    const w = r!.players.find((p) => p.winner)!;
    const prof = findProfile(w.pid, w.persona)!;
    expect(prof.ai?.style).toBeTruthy();
    expect(prof.games).toBe(1);
    expect(prof.wins).toBe(1);
    expect(leaderboard().length).toBe(4);
  }, 20000);
});

import { profileByPortal, signInPortal, signPortalTicket, verifyPortalTicket } from '../server/accounts';
describe('вход через AQL Portal', () => {
  const secret = 'portal-secret-123';
  const now = 1_800_000_000_000;
  const mk = (over: Partial<{ uid: string; name: string; exp: number; jti: string }> = {}) =>
    signPortalTicket({ uid: 'u42', name: 'Айгерим', exp: now / 1000 + 120, jti: Math.random().toString(36), ...over }, secret);

  it('верный билет принимается, имя и id на месте', () => {
    expect(verifyPortalTicket(mk(), secret, now)).toEqual({ uid: 'u42', name: 'Айгерим', photo: undefined });
  });
  it('подделка, чужой секрет, просрочка и слишком долгий срок — отказ', () => {
    const t = mk();
    expect(verifyPortalTicket(t.slice(0, -2) + '00', secret, now)).toBeNull();
    expect(verifyPortalTicket(mk(), 'other', now)).toBeNull();
    expect(verifyPortalTicket(mk({ exp: now / 1000 - 1 }), secret, now)).toBeNull();
    expect(verifyPortalTicket(mk({ exp: now / 1000 + 3600 }), secret, now)).toBeNull();
    expect(verifyPortalTicket('мусор', secret, now)).toBeNull();
  });
  it('повтор того же билета не проходит', () => {
    const t = mk({ jti: 'once-1' });
    expect(verifyPortalTicket(t, secret, now)).not.toBeNull();
    expect(verifyPortalTicket(t, secret, now)).toBeNull();
  });
  it('вход привязывает устройство; второе устройство видит тот же профиль', () => {
    const a = signInPortal('dev-A', { uid: 'u77', name: 'Нурлан' });
    const b = signInPortal('dev-B', { uid: 'u77', name: 'Нурлан' });
    expect(a.id).toBe(b.id);
    expect(profileByPortal('u77')?.portalId).toBe('u77');
  });
});

describe('объединение устройств в один аккаунт', () => {
  beforeEach(() => useMemoryAccounts());
  const play = (id: string, pid: string, win: boolean) =>
    recordGame({ id, era: 'genghis', finishedAt: Date.now(), players: [{ pid, name: 'Гость', vp: win ? 10 : 4, winner: win }, { pid: 'bot1', name: 'Бот', bot: 'easy', vp: win ? 4 : 10, winner: !win }] });

  it('гостевые партии со второго и третьего устройства переходят в аккаунт портала', () => {
    play('g1', 'phone', true);
    play('g2', 'laptop', true);
    play('g3', 'laptop', false);
    play('g4', 'tablet', false);
    const u = { uid: '777', name: 'Bekzat Y.' };
    const a = signInPortal('phone', u); // первое устройство: гостевой профиль становится аккаунтом
    expect(a.games).toBe(1);
    signInPortal('laptop', u);
    const b = signInPortal('tablet', u);
    expect(b.id).toBe(a.id);
    expect(b.games).toBe(4);
    expect(b.wins).toBe(2);
    expect(b.eras.genghis).toEqual({ games: 4, wins: 2 });
    // гостевые профили больше не в таблице лидеров, второй вход не удваивает
    signInPortal('laptop', u);
    expect(profileByPortal('777')!.games).toBe(4);
    const rows = leaderboard(50).filter((r) => r.name === 'Гость');
    expect(rows).toHaveLength(0);
  });

  it('новому игроку — случайное имя, пока он не назовётся сам', () => {
    expect(randomName(() => 0)).toBe('Смелый Беркут');
    const p = profileOf('newbie');
    expect(p.name).not.toBe('Игрок');
    expect(p.name).toMatch(/^\S+ \S+$/);
    // Сел за стол со своим именем — профиль его берёт
    expect(profileOf('newbie', 'Айгерим').name).toBe('Айгерим');
    // Дальше имя за другим столом уже не меняет профиль
    expect(profileOf('newbie', 'Другое').name).toBe('Айгерим');
    // Переименовался сам — тоже насовсем
    profileOf('n2');
    renameProfile('n2', 'Ержан');
    expect(profileOf('n2', 'Кто-то').name).toBe('Ержан');
    // Старые «Игрок» переименовываются разово
    profileOf('old', 'Игрок');
    expect(renameDefaultProfiles()).toBe(0);
  });
});
