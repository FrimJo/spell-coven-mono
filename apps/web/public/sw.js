// Cache name is derived from the build-time hash in card-index-version.json,
// so a rebuilt embeddings file automatically produces a new cache name and
// the activate handler evicts the old one. If the version fetch fails on
// install (network error, file missing on first deploy), we degrade
// gracefully: skip precache and use a fallback name. The fetch handler still
// passes through to the network so the app keeps working.
const FALLBACK_CACHE = 'card-index-fallback';
const VERSION_URL = '/card-index/card-index-version.json';
const PRECACHE = ['/card-index/card-embeddings.bin', '/card-index/card-metadata.json'];

let activeCache = FALLBACK_CACHE;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    let cacheName = FALLBACK_CACHE;
    let shouldPrecache = false;
    try {
      const res = await fetch(VERSION_URL, { cache: 'no-store' });
      if (res.ok) {
        const { version } = await res.json();
        if (version && typeof version === 'string') {
          cacheName = `card-index-${version}`;
          shouldPrecache = true;
        }
      }
    } catch (_) {
      // network error / 404 — degrade to fallback, skip precache
    }
    activeCache = cacheName;
    if (shouldPrecache) {
      const cache = await caches.open(cacheName);
      await Promise.all(PRECACHE.map(path => cache.add(path).catch(() => {})));
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Re-resolve the active cache name in case the SW restarted between
    // install and activate (module-level state is not durable across SW
    // wake-ups). If the version fetch fails here, keep all caches — better
    // to leak one stale cache than to wipe a working one.
    try {
      const res = await fetch(VERSION_URL, { cache: 'no-store' });
      if (res.ok) {
        const { version } = await res.json();
        if (version && typeof version === 'string') {
          activeCache = `card-index-${version}`;
        }
      }
    } catch (_) {
      // keep current activeCache value
    }
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith('card-index-') && k !== activeCache)
        .map(k => caches.delete(k)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => cached ?? fetch(event.request)),
    );
  }
});
