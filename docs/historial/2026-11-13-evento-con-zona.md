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
cargó sin coordenadas o sin ciudad), ve el selector de zona y un link «Cargar mi local»
(`/profile/edit`), no un error. Mientras se busca el local se reserva el lugar de su
tarjeta y la zona vigente se deriva al renderizar (sin copiarla a un estado),
para que no parpadee ni salte la página.
En el backend, `EventInput` (`backend/app/modules/shift/api/schemas.py`)
rechaza con 422 un evento al que le falte la ciudad o las coordenadas
(mensaje: «Elegí la zona del evento (provincia y barrio, o tu local con
ubicación)…»), así la regla no depende del formulario. El frontend
(`parseErrorDetail`) muestra ese mensaje en el cartel en vez de «Error
inesperado». Los turnos del evento ya salían con la zona recibida; ahora siempre
hay una, por eso el aviso a los cercanos sale. La lectura del local se sacó de
`/shifts/new` a `frontend/lib/company-place.ts` (`useCompanyPlace`,
`companyPlaceFromProfile`) y la usan las dos pantallas.

**Por qué así:** se piden ciudad **y** coordenadas porque cada una sirve a
algo distinto: la ciudad es lo que muestran el panel y las tarjetas del
trabajador (sin ella dicen «Ubicación a confirmar»), y el aviso a los cercanos
sólo mide distancia con coordenadas (con ciudad sola el aviso salía a quien
tuviera más experiencia, no a quien estaba cerca). Un local con el punto en el
mapa pero sin ciudad escrita cuenta como «sin zona» en el formulario: se pide
Provincia/Barrio, que siempre da las dos. Se usó `PydanticCustomError` y no
`ValueError` para que el mensaje no salga con el prefijo «Value error, » en
inglés. Se descartó migrar los eventos viejos: no hay forma confiable de
adivinar su zona.

**Tests:** `backend/tests/test_shift.py` (sin zona, incluida ciudad sola o
coordenadas solas → 422 y no queda ningún turno; con zona → los turnos la llevan
y, con tope de un aviso, le llega a la trabajadora cercana y no a la lejana
de mejor perfil),
`frontend/e2e/evento-con-zona.spec.ts` (precarga del local, cambiar zona, sin
local, local sin coordenadas) y `frontend/lib/company-place.test.ts`.

**Queda abierto:**
- Los eventos ya publicados sin zona no se corrigen solos y desde la app no hay
  forma de arreglarlos: no existe pantalla para editar un turno. Las opciones
  reales son un `PUT /shifts/{id}` por API con la zona, sólo mientras el turno
  está en borrador o publicado (con alguien asignado ya no), o cancelar y volver
  a publicar con zona (consume cupo del plan).
- Otro camino que crea turnos sin zona: `POST /shifts` y `PUT /shifts/{id}`
  siguen aceptando ciudad y coordenadas vacías; el asistente de turno
  (`/shifts/new`) la exige sólo en la pantalla, no en la API. No se tocó
  (fuera de este arreglo). La regla de evento vive en el esquema HTTP: quien
  llame a `ShiftService.create_event` por dentro la saltea (hoy nadie lo hace).
- El asistente de IA no crea eventos por su cuenta: arma un borrador que se
  revisa en `/shifts/new-event`, que ahora exige la zona; el borrador no trae
  zona (usa la del local).
- Un perfil que guarda el punto del mapa («Usar mi ubicación») con la ciudad
  vacía produce esa misma zona incompleta en el local: el formulario de evento
  ya lo trata como sin zona, pero el perfil sigue permitiéndolo.
