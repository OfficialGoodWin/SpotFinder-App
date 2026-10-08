const SHELL_CACHE = 'spotfinder-shell-v3';
const STATIC_CACHE = 'spotfinder-static-v3';
const SHELL = ['/', '/manifest.json', '/app-icon-v2-192.png', '/app-icon-v2-512.png', '/app-icon-v2-180.png', '/favicon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('spotfinder-') && ![SHELL_CACHE, STATIC_CACHE].includes(key))
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
      fetch(request)
        .then(async response => {
          if (response.ok) {
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
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(async response => {
        const contentType = response.headers.get('content-type') || '';
        const expectsJavaScript = request.destination === 'script' || /\.m?js$/i.test(url.pathname);
        const hasExpectedType = !expectsJavaScript || /(?:java|ecma)script/i.test(contentType);

        if (response.ok && hasExpectedType) {
          const cachedResponse = response.clone();
          const cache = await caches.open(STATIC_CACHE);
          await cache.put(request, cachedResponse);
        }
        return response;
      }))
    );
  }
});
