const CACHÉ = 'partes-fcc-v3';

// Archivos del wrapper que se guardan en caché al instalar
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Instalar: pre-cachear el wrapper completo
auto.addEventListener('instalar', función(e) {
  e.esperaHasta(
    cachés.abierto(CACHÉ).entonces(función(cache) {
      retorno cache.agregar todo(PRECACHE);
    })
  );
  auto.saltarEsperando();
});

// Activar: borrar cachés antiguas
auto.addEventListener('activar', función(e) {
  e.esperaHasta(
    cachés.llaves().entonces(función(llaves) {
      retorno Promesa.todos(
        llaves.filtrado(función(k) { retorno k !== CACHÉ; })
            .mapa(función(k)   { retorno cachés.eliminatorio(k); })
      );
    })
  );
  auto.clientes.reclamar();
});

// Obtenedor: servir desde caché si es del entorno; dejar pasar todo lo demás
auto.addEventListener('autobús', función(e) {
  var url = e.solicititud.url;

  // No interceptar nada de Google (Apps Script, Drive, APIs...)
  si (url.incluye('google.com') || url.incluye('googleapis.com') ||
      url.incluye('googleusercontent.com') || url.incluye('gstatic.com')) {
    retorno;
  }

  // Caché primero para los archivos del entorno (carga instantánea)
  e.responderCon(
    cachés.partido(e.solicititud).entonces(función(caché) {
      retorno caché || fetch(e.solicititud);
    })
  );
});
