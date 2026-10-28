const SHELL_CACHE = 'spotfinder-shell-v6';
const STATIC_CACHE = 'spotfinder-static-v6';
const PREVIOUS_STATIC_CACHE = 'spotfinder-static-v5';
const SHELL = ['/', '/manifest.json?v=3', '/app-icon-v2-192.png?v=3', '/app-icon-v2-512.png?v=3', '/app-icon-v2-180.png?v=3', '/app-icon-maskable-192.png?v=3', '/app-icon-maskable-512.png?v=3', '/favicon.svg?v=3'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      // A tab from the preceding deployment may still need a previously
      // requested hashed chunk. Keep one earlier static cache through updates.
      keys.filter(key => key.startsWith('spotfinder-') && ![SHELL_CACHE, STATIC_CACHE, PREVIOUS_STATIC_CACHE].includes(key))
        .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then(async response => {
          if (response.ok && url.pathname === '/') {
            const cachedResponse = response.clone();
            const cache = await caches.open(SHELL_CACHE);
            await cache.put('/', cachedResponse);
          }
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || /\.(?:png|svg|ico|woff2?)$/i.test(url.pathname)) {
    const hasExpectedType = response => {
      const contentType = response.headers.get('content-type') || '';
      if (request.destination === 'script' || /\.m?js$/i.test(url.pathname)) return /(?:java|ecma)script/i.test(contentType);
      if (request.destination === 'style' || /\.css$/i.test(url.pathname)) return /text\/css/i.test(contentType);
      return !/text\/html/i.test(contentType);
    };
    event.respondWith(
      caches.match(request).then(async cached => {
        if (cached && hasExpectedType(cached)) return cached;
        if (cached) {
          const keys = await caches.keys();
          await Promise.all(keys.filter(key => key.startsWith('spotfinder-static-'))
            .map(key => caches.open(key).then(cache => cache.delete(request))));
        }
        const response = await fetch(request);
        if (response.ok && hasExpectedType(response)) {
          const cachedResponse = response.clone();
          const cache = await caches.open(STATIC_CACHE);
          await cache.put(request, cachedResponse);
        }
        return response;
      })
    );
  }
});
