/* Pacific Sports - Box Label  :  service worker
   ──────────────────────────────────────────────────────────────────────────
   Why this file exists
     The factory in Haiti cannot count on the internet. The first time this
     page is opened WITH internet, everything it needs is copied onto that
     computer. After that the page opens with no internet at all.

   How it behaves  (stale-while-revalidate)
     · Opening the page always serves the copy already on the computer  ->
       instant, and it works offline.
     · At the same time, if there IS internet, a fresh copy is fetched in
       the background and stored for next time.
     · So the worker never shows a "you are offline" error, and the data is
       never more than one open out of date.

   ⚠ Do not switch this to network-first. On a slow or half-up connection
     the page would hang waiting for the network before showing anything,
     which is exactly what the factory must not experience.
   ────────────────────────────────────────────────────────────────────────── */

const CACHE = 'pslabel-v1';

/* The whole tool is one self-contained HTML file (fonts and QR code library
   are inside it), so this list is short on purpose. */
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* addAll fails the whole install if any one file 404s, so add them one by
       one - a missing icon must not stop the tool itself from being saved. */
    await Promise.all(FILES.map(async (u) => {
      try { await c.add(new Request(u, { cache: 'reload' })); } catch (err) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map(n => (n === CACHE ? null : caches.delete(n))));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          /* outside pages: leave alone */
  if (!url.pathname.startsWith('/boxlabel/')) return;        /* other parts of the site: leave alone */

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);

    /* A navigation to /boxlabel/ or /boxlabel/index.html is the same document */
    const key = (req.mode === 'navigate') ? './index.html' : req;

    const hit = await cache.match(key, { ignoreSearch: true });

    const fresh = fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        cache.put(key, res.clone()).catch(() => {});
      }
      return res;
    }).catch(() => null);

    if (hit) return hit;                 /* on the computer already -> instant, offline-safe */

    const net = await fresh;
    if (net) return net;

    /* Nothing cached and no internet: for a page open, hand back the tool if we
       have it under any key; otherwise a plain message rather than a dead tab. */
    const any = await cache.match('./index.html', { ignoreSearch: true });
    if (any) return any;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Box Label</title>' +
      '<body style="font-family:system-ui;padding:40px;line-height:1.6">' +
      '<h2>Not saved on this computer yet</h2>' +
      '<p>Open this page once while the internet is working. After that it opens with no internet.</p>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  })());
});

/* The page asks "is everything saved?" - answer from the cache, not from a guess */
self.addEventListener('message', (e) => {
  if (!e.data || e.data.q !== 'ready') return;
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match('./index.html', { ignoreSearch: true });
    const port = e.ports && e.ports[0];
    if (port) port.postMessage({ ready: !!hit });
  })());
});
