/// <reference lib="webworker" />
/** Offline shell for the Atlas. Bundled to public/sw.js by `bun run build:sw`. */
// Aliased rather than redeclared so this file stays a plain script and the bundle stays free of module boilerplate.
const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = 'atlas-shell-v1';
const CORE = ['/', '/places/', '/about/', '/manifest.webmanifest', '/favicon.svg', '/og-default.svg'];

sw.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => sw.clients.claim()));
});

sw.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match('/places/')) || Response.error()));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => {
    const network = fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    });
    return cached || network;
  }));
});
