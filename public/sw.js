const SHELL = "nur-shell-v23";
const CONTENT = "nur-content-v1";
const OFFLINE_SHELL = ["/", "/read", "/favorites", "/assistant", "/manifest.webmanifest", "/nur-logo.png", "/icons/nur-180.png", "/icons/nur-192.png", "/icons/nur-512.png", "/icons/nur-app-rounded-1024.png", "/data/word-data.js", "/icons/ui/fqih.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(OFFLINE_SHELL)));
});

self.addEventListener("activate", event => {
  // Wait for older pages to close before retiring the assets they still use.
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("nur-shell-") && key !== SHELL).map(key => caches.delete(key)))));
});

function serve(event, resolve) {
  let cacheTask = Promise.resolve();
  const store = (name, request, response) => {
    const copy = response.clone();
    cacheTask = caches.open(name).then(cache => cache.put(request, copy)).catch(() => {});
  };
  const responseTask = resolve(store);
  event.respondWith(responseTask);
  // Register the lifetime extension synchronously; later callbacks cannot
  // reliably call waitUntil() on Safari.
  event.waitUntil(responseTask.then(() => cacheTask).catch(() => {}));
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && url.hostname !== "api.alquran.cloud") return;

  if (!sameOrigin) {
    serve(event, async store => {
      let cached = await caches.match(event.request);
      // Previously downloaded Uthmani texts used a duplicated edition URL.
      if (!cached && url.pathname.includes("/editions/quran-uthmani,")) {
        const legacy = new URL(url.href);
        legacy.pathname = legacy.pathname.replace("/editions/quran-uthmani,", "/editions/quran-uthmani,quran-uthmani,");
        cached = await caches.match(legacy.href);
      }
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) store(CONTENT, event.request, response);
      return response;
    });
    return;
  }

  if (event.request.mode === "navigate") {
    serve(event, async store => {
      try {
        const response = await fetch(event.request);
        if (response.ok) store(SHELL, new Request(url.origin + url.pathname), response);
        return response;
      } catch {
        return (await caches.match(url.origin + url.pathname)) || (await caches.match("/")) || Response.error();
      }
    });
    return;
  }

  if (url.pathname.startsWith("/api/warsh/")) {
    serve(event, async store => {
      try {
        const response = await fetch(event.request);
        if (response.ok) store(CONTENT, event.request, response);
        return response;
      } catch {
        return (await caches.match(event.request)) || Response.error();
      }
    });
    return;
  }

  // Do not cache framework/RSC fetches: stale responses mixed with new bundles
  // can make a reader page repeatedly fail after a deployment.
  if (!["script", "style", "font", "image", "manifest"].includes(event.request.destination)) return;
  serve(event, async store => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) store(SHELL, event.request, response);
    return response;
  });
});
