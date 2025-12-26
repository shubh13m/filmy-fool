const CACHE_NAME = 'flixmix-v11';
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
  // ADD THIS LINE: It tells the new SW to take control of the page immediately
  return self.clients.claim(); 
});

// Fetch: Smart caching
self.addEventListener('fetch', (event) => {
  // For API calls, try network first, don't cache
  if (event.request.url.includes('omdbapi.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For UI assets, use cache-first
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') self.skipWaiting();
});
