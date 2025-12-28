const CACHE_NAME = 'flixmix-v26'; // Updated version
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// Install: Cache core UI assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: Clean up old versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  return self.clients.claim(); 
});

// Fetch: Network-First for UI, Network-Only for API
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // 1. API Calls: Always try network, do not cache search results 
  // (to keep the "random" feel fresh)
  if (url.includes('omdbapi.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. UI Assets: Network-First Strategy
  // This ensures your light theme and app logic updates show up immediately
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Update the cache with the fresh version
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return response;
      })
      .catch(() => caches.match(event.request)) // If offline, use cache
  );
});

// Handle the "Update Now" button click from app.js
self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
