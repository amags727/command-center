const CACHE = 'cc-v18';
const ASSETS = ['./index.html', './core.js', './calendar.js', './flashcard-review.js', './today.js', './week.js', './dissertation.js', './chat.js', './anki.js', './translate.js', './aotd.js', './meals.js', './progress.js', './week-archive.js', './app.js', './firebase-sync.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only cache GET requests with http/https schemes
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;

  e.respondWith(
    fetch(e.request).then(r => {
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return r;
    }).catch(() => caches.match(e.request))
  );
});