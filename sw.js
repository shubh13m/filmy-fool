const CACHE_NAME = 'filmyfool-v11'; // Increment this every time you push a change
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// 1. Install: Cache core UI assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Caching new assets');
      return cache.addAll(ASSETS);
    })
  );
  // REMOVED self.skipWaiting() from here.
  // We want the worker to wait until the user clicks the Update Button.
});

// 2. Activate: Clean up old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('SW: Removing old cache', key);
          return caches.delete(key);
        })
      );
    })
  );
  // Take control of the page immediately
  return self.clients.claim(); 
});

// 3. Fetch: Network-First Strategy for UI, Network-Only for API
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // 1. API Calls: Network Only
  if (url.includes('omdbapi.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. UI Assets: Network-First, but ONLY use cache if network fails
  // We stop "putting" things into the cache here to avoid the version mismatch
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// 4. Message: This is the listener for your Update Button
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    console.log('SW: skipWaiting signal received. Activating new version...');
    self.skipWaiting();
  }
});
