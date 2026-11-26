const CACHE_NAME = "suncheck-shell-v4";
const BASE_PATH = new URL(self.registration.scope).pathname;
const assetUrl = (path) => `${BASE_PATH}${path.replace(/^\/+/, "")}`;
const SHELL_ASSETS = [
  BASE_PATH,
  assetUrl("manifest.webmanifest"),
  assetUrl("icons/suncheck-icon.svg"),
  assetUrl("icons/icon-192.png"),
  assetUrl("icons/icon-512.png")
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  // Weather and geocoding APIs live on other origins: let the browser fetch them directly
  // so the service worker can never serve or break live data.
  if (new URL(request.url).origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(BASE_PATH)));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
