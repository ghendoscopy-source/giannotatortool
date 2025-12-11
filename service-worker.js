// service-worker.js — CACHE DISABLED FOR JS/HTML

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  clients.claim();
});

// Intercept requests — DO NOT CACHE ANYTHING
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Always fetch fresh JS/HTML so app.js never becomes stale
  if (req.destination === "script" || req.destination === "document") {
    event.respondWith(fetch(req));
    return;
  }

  // Allow normal network fetch for everything else (images, patterns, etc.)
  event.respondWith(fetch(req));
});
