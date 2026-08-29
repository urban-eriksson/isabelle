// Service worker: caches the app shell so Isabelle opens instantly and works
// offline (class data is cached separately in localStorage by js/api.js).
// Bump CACHE_VERSION whenever shell files change so old caches are dropped.
const CACHE_VERSION = 'isabelle-v7';

const SHELL = [
    './',
    './index.html',
    './filter-settings.html',
    './manual.html',
    './css/styles.css',
    './css/manual.css',
    './js/index.js',
    './js/api.js',
    './js/filter-settings.js',
    './js/gyms-data.js',
    './js/pwa.js',
    './js/friskis.js',
    './js/drawer.js',
    './js/push.js',
    './site.webmanifest',
    './android-chrome-192x192.png',
    './android-chrome-512x512.png',
    './apple-touch-icon.png',
    './favicon-32x32.png',
    './favicon-16x16.png',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => cache.addAll(SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // The Friskis API and our own reminder API are never cached here.
    if (url.hostname.endsWith('brpsystems.com') || url.pathname.includes('/api/')) return;

    // Everything else (own files and the Font Awesome CDN): serve from cache, refresh in background.
    event.respondWith(
        caches.open(CACHE_VERSION).then(async cache => {
            const cached = await cache.match(request);
            const network = fetch(request).then(response => {
                if (response.ok || response.type === 'opaque') {
                    cache.put(request, response.clone());
                }
                return response;
            }).catch(() => cached);
            return cached || network;
        })
    );
});

// Morning reminders from the Isabelle server (see js/push.js)
self.addEventListener('push', event => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Isabelle', body: event.data?.text() }; }
    event.waitUntil(self.registration.showNotification(data.title || 'Isabelle', {
        body: data.body || '',
        icon: './android-chrome-192x192.png',
        badge: './android-chrome-192x192.png',
        data: { url: data.url || './' }
    }));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const target = new URL(event.notification.data?.url || './', self.location.href).href;
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            const existing = clients.find(c => c.url.startsWith(self.registration.scope));
            if (existing) return existing.focus();
            return self.clients.openWindow(target);
        })
    );
});
