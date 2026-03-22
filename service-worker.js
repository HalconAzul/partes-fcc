const CACHÉ = 'partes-fcc-v2';

auto.addEventListener('instalar', función(e) {
  e.esperaHasta(
    cachés.abierto(CACHÉ).entonces(función(cache) {
      retorno cache.agregar todo(['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png']);
    })
  );
  auto.saltarEsperando();
});

auto.addEventListener('activar', función(e) {
  e.esperaHasta(
    cachés.llaves().entonces(función(llaves) {
      retorno Promesa.todos(
        llaves.filtrado(función(k){ retorno k !== CACHÉ; })
            .mapa(función(k){ retorno cachés.eliminatorio(k); })
      );
    })
  );
  auto.clientes.reclamar();
});

auto.addEventListener('autobús', función(e) {
  var url = e.solicititud.url;
  si (url.incluye('script.google.com') || url.incluye('googleusercontent.com')) {
    retorno;
  }
  e.responderCon(
    cachés.partido(e.solicititud).entonces(función(caché) {
      si (caché) retorno caché;
      retorno fetch(e.solicititud).entonces(función(respuesta) {
        si (respuesta.ok && e.solicititud.método === 'OBTENEDOR') {
          var clon = respuesta.clon();
          cachés.abierto(CACHÉ).entonces(función(cache) { cache.put(e.solicititud, clon); });
        }
        retorno respuesta;
      });
    })
  );
});
