// Web Push: уведомление «Твой ход», когда приложение свёрнуто или соединение потеряно.
// Ключи VAPID создаются один раз и хранятся в DATA_DIR/vapid.json; подписки — в DATA_DIR/push.json.

import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import webpush from 'web-push';

let publicKey = '';
let file = '';
/** Подписки по id игрока (устройство). */
const subs = new Map<string, webpush.PushSubscription[]>();

export function initPush(dataDir: string, contact = 'mailto:noreply@historicalhex.local'): string {
  const keyFile = join(dataDir, 'vapid.json');
  let keys: { publicKey: string; privateKey: string };
  try {
    keys = JSON.parse(readFileSync(keyFile, 'utf8'));
  } catch {
    keys = webpush.generateVAPIDKeys();
    writeFileSync(keyFile, JSON.stringify(keys), { mode: 0o600 });
  }
  webpush.setVapidDetails(contact, keys.publicKey, keys.privateKey);
  publicKey = keys.publicKey;
  file = join(dataDir, 'push.json');
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, webpush.PushSubscription[]>;
    for (const [k, v] of Object.entries(raw)) subs.set(k, v);
  } catch {
    /* нет файла — нет подписок */
  }
  return publicKey;
}

export const vapidPublicKey = () => publicKey;

function save() {
  try {
    writeFileSync(file + '.tmp', JSON.stringify(Object.fromEntries(subs)));
    renameSync(file + '.tmp', file);
  } catch (e) {
    console.error('push save failed', e);
  }
}

const valid = (s: unknown): s is webpush.PushSubscription =>
  !!s &&
  typeof s === 'object' &&
  typeof (s as webpush.PushSubscription).endpoint === 'string' &&
  /^https:\/\//.test((s as webpush.PushSubscription).endpoint) &&
  typeof (s as webpush.PushSubscription).keys?.p256dh === 'string' &&
  typeof (s as webpush.PushSubscription).keys?.auth === 'string';

export function addSubscription(pid: string, sub: unknown): boolean {
  if (!valid(sub)) return false;
  const list = (subs.get(pid) ?? []).filter((x) => x.endpoint !== sub.endpoint);
  list.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  subs.set(pid, list.slice(-4));
  save();
  return true;
}

export function removeSubscriptions(pid: string): void {
  if (subs.delete(pid)) save();
}

export const hasPush = (pid: string) => (subs.get(pid)?.length ?? 0) > 0;

export async function sendPush(pid: string, payload: { title: string; body: string; url: string; tag?: string }): Promise<void> {
  const list = subs.get(pid);
  if (!list?.length) return;
  const keep: webpush.PushSubscription[] = [];
  await Promise.all(
    list.map(async (s) => {
      try {
        await webpush.sendNotification(s, JSON.stringify(payload), { TTL: 600, urgency: 'high' });
        keep.push(s);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // 404/410 — подписка умерла; остальное — временная ошибка, подписку оставляем
        if (code !== 404 && code !== 410) keep.push(s);
      }
    }),
  );
  if (keep.length !== list.length) {
    subs.set(pid, keep);
    save();
  }
}
