// High Stakes Truth service worker: network-first so updates land immediately,
// with a cached copy (including Three.js from the CDN) for offline play.
const CACHE = "hst-v1";
const CORE = [
  "./", "./index.html", "./styles.css", "./app.js", "./three-table.js",
  "./facts.js", "./facts-expansion.js", "./manifest.webmanifest",
  "./assets/icon-192.png", "./assets/icon-512.png", "./assets/favicon-48.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok || response.type === "opaque") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("./index.html")))
  );
});
