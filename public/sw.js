// Empanel PWA Service Worker
// Offline-first caching with graceful network & CORS error fallbacks

const CACHE_NAME = 'empanel-pwa-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
];

// Install: precache application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache skipped in current environment:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: cleanup stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: network-first for navigation, stale-while-revalidate for assets
// Gracefully falls back to cache on CORS errors or dropped network connections
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Skip non-GET requests and WebSocket signaling relays
  if (req.method !== 'GET' || url.pathname.startsWith('/api/relay') || req.headers.get('Upgrade') === 'websocket') {
    return;
  }

  // 2. Skip Vite dev server internal HMR endpoints
  if (url.pathname.includes('@vite') || url.pathname.includes('@fs') || url.pathname.includes('hot-update')) {
    return;
  }

  // 3. Navigation requests (HTML page loads): Network-first with cache fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return response;
        })
        .catch(async (error) => {
          console.warn('[SW] Navigation network request failed (offline or CORS). Falling back to cached shell:', error);
          const cached = await caches.match(req);
          if (cached) return cached;
          const indexFallback = await caches.match('/index.html');
          if (indexFallback) return indexFallback;
          const rootFallback = await caches.match('/');
          if (rootFallback) return rootFallback;
          throw error;
        })
    );
    return;
  }

  // 4. Static assets & API queries: Cache with network background revalidation
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((fetchError) => {
          // Gracefully catch CORS failures or offline states so they don't break the app
          console.warn('[SW] Asset fetch failed, falling back to cache:', req.url, fetchError);
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response(null, { status: 504, statusText: 'Offline Fallback' });
        });

      return cachedResponse || fetchPromise;
    })
  );
});
