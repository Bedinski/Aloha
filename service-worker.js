// service-worker.js — offline support for the Aloha dashboard.
//
// Strategy:
//   * App shell (HTML/CSS/JS/icons): cache-first, so the app opens instantly
//     and works with no signal once installed.
//   * Live data (NOAA / Open-Meteo): handled in the page via fetch + a
//     localStorage "last good" fallback, so we deliberately do NOT cache those
//     API responses here (avoids serving stale data twice over).

const CACHE = "aloha-shell-v5";
const SHELL = [
  "./",
  "./index.html",
  "./surf.html",
  "./css/styles.css",
  "./images/hero.png",
  "./js/app.js",
  "./js/forecast.js",
  "./js/sun.js",
  "./js/tides.js",
  "./js/surf.js",
  "./js/store.js",
  "./js/spots.js",
  "./js/rating.js",
  "./js/chart.js",
  "./js/alerts.js",
  "./js/buoy.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/favicon-64.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only manage same-origin shell requests; let API calls hit the network.
  if (url.origin !== self.location.origin) return;

  // Network-first for page navigations so a fresh deploy shows up right away;
  // fall back to the cached page when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // Cache-first for everything else (CSS/JS/images).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
