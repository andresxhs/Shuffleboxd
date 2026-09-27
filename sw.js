const SHELL = 'shuffleboxd-v3', IMGS = 'shuffleboxd-img';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== IMGS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App files: network first so updates arrive, cache as offline fallback.
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./'))));
    return;
  }

  // Posters: cache first, keep the cache small.
  if (url.hostname === 'image.tmdb.org') {
    e.respondWith(caches.open(IMGS).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') {
        await c.put(req, r.clone());
        const ks = await c.keys();
        for (const k of ks.slice(0, Math.max(0, ks.length - 150))) c.delete(k);
      }
      return r;
    }));
  }
});
