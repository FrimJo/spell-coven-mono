// Bump this constant any time the embeddings file is regenerated so that
// clients evict the stale cache via the activate handler below.
const CACHE = 'card-index-v2';
const PRECACHE = ['/card-index/card-embeddings.bin', '/card-index/card-metadata.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(PRECACHE.map(path => cache.add(path).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => cached ?? fetch(event.request))
    );
  }
});
