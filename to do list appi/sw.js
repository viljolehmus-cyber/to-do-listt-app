/**
 * sw.js — Service Worker (PWA + offline)
 *
 * Strategia: Cache First sovelluksen tiedostoille, Network First API-kutsuille.
 * Supabase: lisää API-reitit NETWORK_ROUTES-listaan kun integroitu.
 */

const CACHE_NAME   = 'tehtavalista-v1';
const OFFLINE_URL  = '/index.html';

const PRECACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/storage.js',
  '/notifications.js',
  '/suggestions.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// SUPABASE: lisää Supabase-endpointit tähän (ne haetaan verkosta)
const NETWORK_ROUTES = [
  'supabase.co',
];

// ---------------------------------------------------------------------------
// Install: esitallenna tiedostot
// ---------------------------------------------------------------------------
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Jos tiedostoa ei löydy (esim. ikonit puuttuu), ei kaadeta asennusta
      Promise.allSettled(PRECACHE.map(url => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

// ---------------------------------------------------------------------------
// Activate: siivoa vanhat välimuistit
// ---------------------------------------------------------------------------
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------------
// Fetch: palvele välimuistista tai verkosta
// ---------------------------------------------------------------------------
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Verkko-only API-reitit
  if (NETWORK_ROUTES.some(r => url.hostname.includes(r))) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation: palauta index.html offline-tilassa
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Cache First muille tiedostoille
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => caches.match(OFFLINE_URL));
    })
  );
});

// ---------------------------------------------------------------------------
// Push-ilmoitukset (tulevaa Supabase/Web Push -integraatiota varten)
// ---------------------------------------------------------------------------
self.addEventListener('push', event => {
  // SUPABASE/Web Push: parse payload and show notification
  // const data = event.data?.json() || {};
  // event.waitUntil(self.registration.showNotification(data.title || 'Tehtävälista', {
  //   body: data.body,
  //   icon: '/icons/icon-192.png',
  //   tag: data.tag,
  //   data: { url: data.url || '/' },
  // }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
