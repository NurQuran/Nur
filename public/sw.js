const SHELL="nur-shell-v1";
self.addEventListener("install",event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(["/","/read","/favorites","/nur-logo.png"]))));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok&&new URL(event.request.url).origin===self.location.origin){const copy=response.clone();caches.open(SHELL).then(cache=>cache.put(event.request,copy))}
    return response;
  }).catch(()=>caches.match("/"))));
});
