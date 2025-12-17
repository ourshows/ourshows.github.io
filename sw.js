const CACHE_NAME = 'ourshow-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './public/style.css',
    './public/modal.css',
    './themes.css',
    './main.js',
    './auth.js',
    './public-config.js',
    './public/mobile-nav.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('fetch', (event) => {
    // Info: We only cache GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch new
                return response || fetch(event.request).then((fetchResponse) => {
                    // Optional: Dynamic caching of new requests could go here
                    return fetchResponse;
                });
            })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
