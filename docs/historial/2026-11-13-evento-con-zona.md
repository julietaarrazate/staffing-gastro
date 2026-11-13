# Un evento no se publica sin zona

**Pedido:** hallazgo U058 de la prueba de punta a punta (etapa 2 de la salida a
beta). Publicar un evento sin tocar Provincia ni Barrio respondía 201: los
turnos salían sin ciudad ni coordenadas, el panel decía «Ubicación a
confirmar» y ningún trabajador cercano recibía aviso. El comercio veía todo
bien y no se enteraba.

**Qué cambió:** el formulario de evento (`/shifts/new-event`) ahora arranca en
la zona del local del comercio, igual que el asistente de turno: muestra la
dirección con «Cambiar» y publica con esa ciudad y esas coordenadas. Sin zona
no se puede publicar: el botón queda deshabilitado y una línea dice «Elegí la
zona del evento para poder publicar». Si el comercio no cargó su local (o lo
cargó sin coordenadas), ve el selector de zona y un link «Cargar mi local»
(`/profile/edit`), no un error. Mientras se busca el local no se muestra ni el
selector ni el pedido, para que no parpadee.
En el backend, `EventInput` (`backend/app/modules/shift/api/schemas.py`)
rechaza con 422 un evento sin ciudad ni coordenadas (mensaje: «Elegí la zona
del evento (ciudad o ubicación en el mapa)…»), así la regla no depende del
formulario. Los turnos del evento ya salían con la zona recibida; ahora siempre
hay una, por eso el aviso a los cercanos sale. La lectura del local se sacó de
`/shifts/new` a `frontend/lib/company-place.ts` (`useCompanyPlace`,
`companyPlaceFromProfile`) y la usan las dos pantallas.

**Por qué así:** alcanza con ciudad **o** par de coordenadas porque el aviso a
los cercanos usa cualquiera de los dos (hay tests existentes que publican con
ciudad sola). Se usó `PydanticCustomError` y no `ValueError` para que el
mensaje no salga con el prefijo «Value error, » en inglés. Se descartó migrar
los eventos viejos: no hay forma confiable de adivinar su zona.

**Tests:** `backend/tests/test_shift.py` (sin zona → 422 y no queda ningún
turno; con zona → los turnos la llevan y se avisa a quien está cerca),
`frontend/e2e/evento-con-zona.spec.ts` (precarga del local, cambiar zona, sin
local, local sin coordenadas) y `frontend/lib/company-place.test.ts`.

**Queda abierto:**
- Los eventos ya publicados sin zona no se corrigen solos. Hoy se arreglan
  editando cada turno del evento (turno por turno: no hay edición de todo el
  evento a la vez) y poniéndole la zona.
- Otro camino que crea turnos sin zona: `POST /shifts` y `PUT /shifts/{id}`
  siguen aceptando ciudad y coordenadas vacías; el asistente de turno
  (`/shifts/new`) la exige sólo en la pantalla, no en la API. No se tocó
  (fuera de este arreglo).
- El asistente de IA no crea eventos por su cuenta: arma un borrador que se
  revisa en `/shifts/new-event`, que ahora exige la zona; el borrador no trae
  zona (usa la del local).
