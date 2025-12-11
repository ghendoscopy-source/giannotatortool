// service-worker.js — safe version

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  clients.claim();
});

// DO NOT INTERCEPT external requests
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept Google Apps Script requests
  if (url.origin.includes("script.google.com") ||
      url.origin.includes("googleusercontent.com")) {
    return; // allow normal network fetch
  }

  // Always fetch fresh HTML/JS files
  if (event.request.destination === "document" ||
      event.request.destination === "script") {
    event.respondWith(fetch(event.request));
    return;
  }

  // Default (no caching)
  event.respondWith(fetch(event.request));
});
