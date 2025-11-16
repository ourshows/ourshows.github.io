// sw.js - Minimal Service Worker (Required for PWA install)
// This doesn't cache anything - just makes the app installable

const CACHE_NAME = 'ourshow-minimal-v1';

// Install - just activates immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...');
  self.skipWaiting();
});

// Activate - clean up and take control
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Fetch - pass through to network (no caching)
self.addEventListener('fetch', (event) => {
  // Just let all requests go to network normally
  event.respondWith(fetch(event.request));
});

console.log('[SW] Minimal service worker loaded - PWA installable');