/* myCoolFont SW — app shell offline (M1). Estrategia: cache-first. */
const CACHE = 'mycoolfont-v1';
const SHELL = ['index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'engine/raster.js', 'engine/trace.js', 'engine/variants.js', 'engine/ttf.js', 'engine/fontbuild.js',
  'engine/woff.js', 'engine/charset.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith('http')) return; // blob:/data: (fuentes generadas) pasan directo
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
