const CACHE_NAME = 'ourshow-v2';
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

    const url = new URL(event.request.url);

    // EXCLUDE: Do not cache APK files or non-GET requests
    if (url.pathname.endsWith('.apk')) return;

    // STRATEGY: Network First for HTML (Navigation) and Critical Logic
    // This ensures the user always gets the latest page content/skeleton AND critical logic
    if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname.includes('watchanddownload.js')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Update cache with new version
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Fallback to cache if offline
                    return caches.match(event.request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Fallback to index.html if the specific page is not in cache
                        return caches.match('./index.html').then((response) => {
                            return response || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
                        });
                    });
                })
        );
        return;
    }

    // STRATEGY: Cache First for Static Assets (CSS, JS, Images)
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch new
                return response || fetch(event.request).then((fetchResponse) => {
                    // Cache new static assets dynamically
                    if (fetchResponse && fetchResponse.status === 200 && fetchResponse.type === 'basic') {
                        const responseClone = fetchResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
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
