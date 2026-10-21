/* Hirfa service worker: offline card, offline fallback, Web Push. */
const VERSION = 'hirfa-v1';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];
// Pages worth keeping for offline use: the craftsman's card first.
const KEEP = [/^\/app\/card$/, /^\/app$/];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Immutable build assets and card QR codes: cache first.
  if (url.pathname.startsWith('/_next/static/') || /^\/api\/v1\/craftsmen\/\d+\/qr$/.test(url.pathname) || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Pages: network first; keep a copy of the card; fall back to the copy, then to the offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && KEEP.some((r) => r.test(url.pathname))) caches.open(PAGES).then((c) => c.put(url.pathname, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(url.pathname)) || (await caches.match(OFFLINE_URL))),
    );
  }
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'cache-card' && typeof data.url === 'string' && data.url.startsWith('/app/')) {
    fetch(data.url, { credentials: 'same-origin' }).then((res) => res.ok && caches.open(PAGES).then((c) => c.put(data.url, res)));
  }
  // Signing out removes personal pages from this device.
  if (data.type === 'logout') caches.delete(PAGES);
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Hirfa', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'حِرفة', {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag,
      dir: 'auto',
      data: { url: payload.url || '/app' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/app', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(self.location.origin));
      if (open) return open.navigate(target).then((w) => w && w.focus());
      return self.clients.openWindow(target);
    }),
  );
});
