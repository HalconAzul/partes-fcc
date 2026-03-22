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
        llaves.filtro(función(k){ retorno k !== CACHÉ; })
            .mapa(función(k){ retorno cachés.eliminar(k); })
      );
    })
  );
  auto.clientes.reclamar();
});

auto.addEventListener('buscar', función(e) {
  var url = e.solicitud.url;
  si (url.incluye('script.google.com') || url.incluye('googleusercontent.com')) {
    retorno;
  }
  e.responderCon(
    cachés.partido(e.solicitud).entonces(función(caché) {
      si (caché) retorno caché;
      retorno fetch(e.solicitud).entonces(función(respuesta) {
        si (respuesta.ok && e.solicitud.método === 'OBTENER') {
          var clon = respuesta.clon();
          cachés.abierto(CACHÉ).entonces(función(cache) { cache.put(e.solicitud, clon); });
        }
        retorno respuesta;
      });
    })
  );
});
