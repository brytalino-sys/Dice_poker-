// Офлайн-режим: сначала сеть (всегда свежая версия), без сети — сохранённая копия.
// Сетевую игру (адреса /ws и /api/) не трогаем.

const CACHE = 'dicepoker-8c7485df38';
const CORE = [
  './', 'index.html', 'game.js', 'style.css', 'fonts.css', 'config.js', 'favicon.svg',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dicepoker-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/') || url.pathname.endsWith('/ws') || url.pathname.endsWith('/sw.js')) return;
  e.respondWith(new Promise((resolve) => {
    let settled = false;
    const done = (r) => {
      if (!settled && r) {
        settled = true;
        resolve(r);
      }
    };
    // медленная сеть: через 4 секунды отдаём копию, а свежая версия всё равно сохранится в кэш
    const timer = setTimeout(() => fromCache(req).then(done), 4000);
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        clearTimeout(timer);
        done(res);
      })
      .catch(() => {
        clearTimeout(timer);
        fromCache(req).then((r) => done(r || Response.error()));
      });
  }));
});
