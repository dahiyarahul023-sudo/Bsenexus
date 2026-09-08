// BSE Nexus - Progressive Web App Service Worker
// Version: 4.0.0

const CACHE_NAME = 'bse-nexus-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon.svg',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/icon-192.png',
  '/icon-512.png',
  '/screenshots/desktop.png',
  '/screenshots/mobile.png'
];

// Install Event: Precaches essential offline application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Event: Cleans up obsolete cache versions and claims clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const isDevHost = self.location.hostname === 'localhost' || 
                        self.location.hostname === '127.0.0.1' || 
                        self.location.hostname.includes('-dev-') || 
                        self.location.hostname.includes('-pre-') || 
                        self.location.hostname.includes('run.app') || 
                        self.location.port === '3000';
      if (isDevHost) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
        await self.registration.unregister();
        return;
      }
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// Helper: Check if an API endpoint is strictly public and safe for offline caching
function isPublicCacheableApi(pathname) {
  // Only public, anonymous data like market announcements, results, or market pulse
  const publicEndpoints = [
    '/api/announcements',
    '/api/results',
    '/api/market-status',
    '/api/stats'
  ];
  return publicEndpoints.some(endpoint => pathname === endpoint || pathname.startsWith(endpoint + '?'));
}

// Fetch Event: Intelligent multi-strategy caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle HTTP/HTTPS requests
  if (!url.protocol.startsWith('http')) return;

  // 0. Development & Vite internal dev server bypass
  // Never intercept or cache in dev mode, or for Vite dev paths and cache-busting query strings
  const isDevHost = url.hostname === 'localhost' || 
                    url.hostname === '127.0.0.1' || 
                    url.hostname.includes('-dev-') || 
                    url.hostname.includes('-pre-') || 
                    url.hostname.includes('run.app') || 
                    url.port === '3000';
  if (
    isDevHost ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.searchParams.has('v') ||
    url.searchParams.has('t') ||
    url.searchParams.has('import')
  ) {
    return; // Pass through to browser native network
  }

  // 1. Navigation requests (HTML pages) -> Network first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
          return new Response('Offline - BSE Nexus is available once connection resumes.', {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // 2. API requests
  if (url.pathname.startsWith('/api/')) {
    // SECURITY & PRIVACY RULE:
    // Never cache private user/account data (watchlists, profile, settings, notifications, auth, admin)
    const isPrivateOrAuth = 
      request.headers.has('authorization') ||
      url.pathname.includes('/users') ||
      url.pathname.includes('/watchlists') ||
      url.pathname.includes('/settings') ||
      url.pathname.includes('/notifications') ||
      url.pathname.includes('/alert-rules') ||
      url.pathname.includes('/auth') ||
      url.pathname.includes('/admin') ||
      url.pathname.includes('/logs');

    if (isPrivateOrAuth || request.method !== 'GET' || !isPublicCacheableApi(url.pathname)) {
      // Network-only for all private/user/dynamic API requests - bypass Cache API completely
      event.respondWith(
        fetch(request).catch(() => {
          return new Response(JSON.stringify({ error: 'Network error or offline', offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );
      return;
    }

    // Public feeds only: Network first with cache fallback for offline reading
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // 3. Static assets: ONLY cache known production build assets (/assets/*) or items in STATIC_ASSETS
  const isCacheableAsset = url.pathname.startsWith('/assets/') || STATIC_ASSETS.includes(url.pathname);
  if (!isCacheableAsset) {
    return; // Do not cache arbitrary JS/CSS or dev modules
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Background Sync Event (Sync queued disclosures using correct /api/announcements)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-bse-disclosures' || event.tag === 'sync-watchlist') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch('/api/announcements');
          if (response && response.status === 200) {
            await cache.put('/api/announcements', response);
          }
        } catch (e) {
          console.warn('[PWA] Background sync fetch fallback:', e);
        }
      })
    );
  }
});

// 5. Periodic Background Sync Event (Periodic update of announcements)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-market-pulse' || event.tag === 'update-disclosures') {
    event.waitUntil(
      fetch('/api/announcements')
        .then((res) => {
          if (res && res.status === 200) {
            return caches.open(CACHE_NAME).then((cache) => cache.put('/api/announcements', res));
          }
        })
        .catch((err) => console.warn('[PWA] Periodic sync warning:', err))
    );
  }
});

// 6. Push Notification Event (Real-time BSE Material Filings & Telegram alerts)
self.addEventListener('push', (event) => {
  let data = {
    title: 'BSE Nexus Alert',
    body: 'New price-sensitive corporate disclosure published on BSE.',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag: 'bse-filing-notification',
    data: { url: '/?tab=announcements' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/android-chrome-192x192.png',
    badge: data.badge || '/favicon-32x32.png',
    tag: data.tag || 'bse-alert',
    vibrate: [100, 50, 100],
    data: data.data || { url: '/' },
    actions: [
      { action: 'open', title: 'Open Filing' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 7. Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

