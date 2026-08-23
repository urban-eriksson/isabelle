// Service worker: caches the app shell so Isabelle opens instantly and works
// offline (class data is cached separately in localStorage by js/api.js).
// Bump CACHE_VERSION whenever shell files change so old caches are dropped.
const CACHE_VERSION = 'isabelle-v2';

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

    // The Friskis API is never cached here; api.js handles that with its own freshness rules.
    if (url.hostname.endsWith('brpsystems.com')) return;

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
