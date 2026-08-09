const SHELL = "nur-shell-v12";
const CONTENT = "nur-content-v1";
const ALLOWED_EXTERNAL_HOSTS = new Set([
  "api.alquran.cloud",
  "server6.mp3quran.net", "server7.mp3quran.net", "server9.mp3quran.net",
  "server10.mp3quran.net", "server11.mp3quran.net", "server13.mp3quran.net",
  "server16.mp3quran.net", "cdn.islamic.network"
]);
const OFFLINE_SHELL = ["/", "/read", "/favorites", "/assistant", "/manifest.webmanifest", "/nur-logo.png", "/icons/nur-180.png", "/icons/nur-192.png", "/icons/nur-512.png", "/icons/nur-app-rounded-1024.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(OFFLINE_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("nur-shell-") && key !== SHELL).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !ALLOWED_EXTERNAL_HOSTS.has(url.hostname)) return;

  if (!sameOrigin) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok || response.type === "opaque") caches.open(CONTENT).then(cache => cache.put(event.request, response.clone()));
      return response;
    })));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(SHELL).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match("/"))));
    return;
  }

  event.respondWith(fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(SHELL).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request)));
});
