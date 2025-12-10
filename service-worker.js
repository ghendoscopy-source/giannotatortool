const SW_VERSION = 'v1';
const STATIC_CACHE = `static-cache-${SW_VERSION}`;

// Important: no leading slashes — use relative paths for GitHub Pages
const ASSETS = [
  'index.html',
  'app.js',
  'diagnoses.js',
  'organs.js',
  'static/icons/icon-192.png',
  'static/icons/icon-512.png'
];

// Install: cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== STATIC_CACHE)
          .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// Fetch: cache-first strategy
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(res => {
          if (!res || res.status !== 200) return res;
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match('index.html'));  // also remove leading slash
    })
  );
});
