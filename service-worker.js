const CACHE = 'partes-fcc-v4';

// Archivos del wrapper que se guardan en caché al instalar
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Instalar: pre-cachear el wrapper completo
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE);
    })
  );
  self.skipWaiting();
});

// Activar: borrar cachés antiguas
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k)   { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: servir desde caché si es del wrapper; dejar pasar todo lo demás
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // No interceptar nada de Google (Apps Script, Drive, APIs...)
  if (url.includes('google.com') || url.includes('googleapis.com') ||
      url.includes('googleusercontent.com') || url.includes('gstatic.com')) {
    return;
  }

  // Caché primero para los archivos del wrapper (carga instantánea)
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request);
    })
  );
});
