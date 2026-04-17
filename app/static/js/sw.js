const CACHE_VERSION = 'silentvoice-pwa-v4';
const APP_SHELL = [
  '/',
  '/login',
  '/register',
  '/manifest.json',
  '/static/css/style.css?v=twa3',
  '/static/js/app.js?v=twa3',
  '/static/js/avatar.js?v=twa6',
  '/static/icons/icon-192.svg',
  '/static/icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.status === 200) {
      const copy = response.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const { request } = event;
  const url = new URL(request.url);
  const acceptsHtml = request.headers.get('accept')?.includes('text/html');
  const isStaticCode = url.pathname.startsWith('/static/js/') || url.pathname.startsWith('/static/css/');

  if (isStaticCode) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.mode === 'navigate' || acceptsHtml) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }

          const fallback = await caches.match('/');
          if (fallback) {
            return fallback;
          }

          return new Response(
            '<!doctype html><html><head><meta charset="utf-8"><title>SilentVoice Offline</title></head><body><h1>Offline</h1><p>Internet bilan aloqani tekshirib, qayta urinib ko\'ring.</p></body></html>',
            {
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
