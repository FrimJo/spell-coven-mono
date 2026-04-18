const CACHE = 'card-index-v1';
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
  if (PRECACHE.some(path => event.request.url.includes(path))) {
    event.respondWith(
      caches.match(event.request).then(cached => cached ?? fetch(event.request))
    );
  }
});
