// Service Worker for School Master Offline Portal
const CACHE_NAME = 'school-master-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-cache partial failure:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Non-GET requests and live API/APK endpoints always bypass service-worker cache
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.toLowerCase().endsWith('.apk')
  ) {
    return;
  }

  // Handle SPA navigation requests without ever caching 404/error responses
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', responseClone));
            return response;
          }
          // Fall back to SPA shell on 404/5xx so deep links never show raw Page Not Found
          return caches.match('/index.html').then((cached) => cached || fetch('/index.html').catch(() => response));
        })
        .catch(() => {
          return caches.match('/index.html').then(
            (cached) => cached || new Response('Offline — please reconnect to load School Master.', { status: 503 })
          );
        })
    );
    return;
  }

  // Handle static assets (cache-first with network fallback & background update)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return new Response('Network offline', { status: 503, statusText: 'Service Unavailable' });
        });
    })
  );
});
