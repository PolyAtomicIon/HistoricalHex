// HistoricalHex service worker: офлайн-оболочка и кэш ассетов.
// Хэшированные файлы — из кэша; страница — сначала сеть; картинки эпох — из кэша с фоновым обновлением.
const CACHE = 'hh-v1';
const BASE = new URL(self.registration.scope).pathname;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  if (sameOrigin && (url.pathname.startsWith(BASE + 'ws') || url.pathname.startsWith(BASE + 'api'))) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(BASE, copy));
          return res;
        })
        .catch(() => caches.match(BASE).then((r) => r || Response.error())),
    );
    return;
  }
  if (sameOrigin && url.pathname.startsWith(BASE + 'assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
    return;
  }
  if ((sameOrigin && (url.pathname.startsWith(BASE + 'eras/') || url.pathname.startsWith(BASE + 'icons/'))) || url.host.endsWith('gstatic.com') || url.host.endsWith('googleapis.com')) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => put(req, res)).catch(() => hit);
        return hit || net;
      }),
    );
  }
});

function put(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

// Уведомление «Твой ход» (Web Push)
self.addEventListener('push', (e) => {
  let d = { title: 'HistoricalHex', body: 'Твой ход!', url: BASE, tag: 'turn' };
  try {
    d = { ...d, ...e.data.json() };
  } catch {
    /* пустой пуш */
  }
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      tag: d.tag,
      renotify: true,
      icon: BASE + 'icons/icon-192.png',
      badge: BASE + 'icons/icon-192.png',
      data: { url: d.url },
      vibrate: [80, 40, 80],
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || BASE;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(BASE) && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
