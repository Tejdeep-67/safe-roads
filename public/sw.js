// Service worker for Safe Roads.
// Keeps the app shell (html, js, css, icons) and the detection model on the phone so
// the app opens fast and works as an installed app. Everything else goes to the network:
//  - /api/* (sign in, reports, photos) is never cached, it's per user and must be fresh
//  - map tiles, search and routes are other sites, the browser handles those itself
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const MODEL = `model-${VERSION}`;
const PRECACHE = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== MODEL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// network first for pages so a new deploy shows up straight away, the cached copy only when offline
async function page(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const c = await caches.open(SHELL);
      c.put('/', res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match('/');
    return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

// cache first for files that never change under the same name
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok && res.status === 200) {
    const c = await caches.open(cacheName);
    c.put(request, res.clone());
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(page(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, SHELL));
  } else if (url.pathname.startsWith('/models/')) {
    event.respondWith(cacheFirst(request, MODEL));
  } else if (PRECACHE.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL));
  }
  // anything else (demo video, screenshots...) just goes to the network
});
