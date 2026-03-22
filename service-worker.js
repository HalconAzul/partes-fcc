// Service Worker mínimo — necesario para que Chrome
// reconozca la app como instalable (PWA criteria)
const CACHE = 'partes-fcc-v1';

// Al instalar: guardar los archivos del wrapper en caché
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(['/', '/index.html', '/manifest.json']);
    })
  );
  self.skipWaiting();
});

// Al activar: limpiar cachés antiguas
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Al hacer fetch: devolver desde caché si existe, sino red
self.addEventListener('fetch', function(e) {
  // Solo interceptar peticiones al propio wrapper (no las del iframe de Apps Script)
  var url = e.request.url;
  if (url.includes('script.google.com') || url.includes('googleusercontent.com')) {
    return; // dejar pasar sin caché
  }
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request);
    })
  );
});
