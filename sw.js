/* Epiphany Schools — offline support (works when served over http/https). */
const CACHE = 'epiphany-v2';
const SHELL = [
  './', './index.html', './portal.html', './manifest.webmanifest',
  './assets/css/base.css', './assets/css/site.css', './assets/css/portal.css',
  './assets/js/data.js', './assets/js/config.js', './assets/js/cloud.js', './assets/vendor/supabase-2.45.4.min.js',
  './assets/js/ui.js', './assets/js/site.js',
  './assets/js/portal.js', './assets/js/portal-academic.js', './assets/js/portal-office.js',
  './assets/img/crest.svg'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // Network first for our own files so updates arrive quickly; fall back to cache offline.
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  } else if (/images\.unsplash\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    // Cache-first for photos and fonts.
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
  }
});
