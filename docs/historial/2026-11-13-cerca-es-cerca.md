# «Cerca» es cerca: el radio corta los avisos y el feed se acota a la zona

**Pedido:** Julieta, salida a beta (etapa 2: arreglar lo que encontró la prueba
de punta a punta). Dos hallazgos graves con la misma raíz: una trabajadora de
otra provincia recibía «Turno cerca tuyo» de un bar a más de 1.300 km, y con
más de 50 turnos abiertos uno nuevo y cercano no lo veía nadie, mientras en
«Cerca tuyo» aparecía uno a más de 600 km.

**Qué cambió:**

- **Avisos.** «Turno cerca tuyo» (campanita y push) sale sólo a quien está a
  25 km o menos del turno. La escalada a urgente llega hasta 40 km y no más.
  Los recomendados que ve el comercio tampoco sugieren a nadie de más lejos
  que 25 km. Vale también para los favoritos del comercio: siguen entrando
  siempre al aviso, pero no si están fuera del radio.
- **Inicio y Mapa del trabajador.** Muestran sólo los turnos a 40 km o menos
  de la zona de su perfil. Con el perfil sin coordenadas, los de su ciudad;
  sin zona cargada, todos, como antes. Si hay más de 50 dentro del radio, se
  queda con los 50 más cercanos.
- **Buscar.** Sigue mostrando todo, ahora ordenado por distancia desde la
  zona del perfil: es la pantalla para mirar otras zonas.
- **«Estoy acá» en el Inicio.** Lo que se muestra es lo que queda a 40 km o
  menos de ese punto. Si ahí no hay nada, la pantalla lo dice («No hay turnos
  cerca de donde estás ahora») y ofrece ir a Buscar, en vez de listar como
  cercano un turno de otra provincia.
- **Búsqueda del asistente** («turnos de mozo en Palermo»): mide desde la
  zona que la persona pidió, no desde la de su perfil.
- **Mapa del trabajador con el GPS lejos de la zona.** El Mapa mide desde
  donde está el teléfono. Ahora corta ahí también: no muestra ni cuenta como
  «cerca tuyo» un turno a más de 40 km de ese punto. Si todo lo que llegó
  queda lejos, lo dice («No hay turnos cerca de donde estás ahora») y ofrece
  ir a Buscar; el vacío de siempre («No hay turnos cerca») suma el mismo
  botón.
- **Sin coordenadas** en alguna de las dos puntas (trabajador sin ubicación o
  turno sin coordenadas), «cerca» se decide por ciudad, comparada sin
  mayúsculas ni tildes. Sin ciudad en común, no es cerca.
- **Turno publicado sin zona** (ni coordenadas ni ciudad; la API lo acepta y
  el formulario de evento lo dejaba pasar): se mide desde el local del
  comercio, en el aviso, en la escalada, en los recomendados y en el feed.
  Sin esto, con el radio como límite duro ese turno dejaba de avisarle a todo
  el mundo y desaparecía del Inicio y del Mapa. El turno sigue sin ubicación
  propia: el local se usa sólo para medir.

En el código:

- `backend/app/core/geo.py`: `is_near` (la regla, una sola para avisos y
  listas), `same_city` / `normalize_city` y `bounding_box`.
- `backend/app/modules/matching/domain/`: `ESCALATION_RADIUS_KM = 40` junto a
  `DEFAULT_MAX_RADIUS_KM = 25` en `value_objects.py`; `city` en
  `CandidateProfile` y `ShiftRequirement`; `is_within_radius` en `scoring.py`,
  que `rank_candidates` aplica siempre. Como ese ranking es el del aviso, el
  de la escalada y el de los recomendados, los tres quedaron cubiertos.
- `backend/app/modules/shift/domain/nearby.py` (nuevo): `FeedOrigin`,
  `is_nearby`, los dos órdenes del feed y `zone_of` (desde dónde se mide un
  turno: su zona o, si no tiene ninguna, el local).
  `backend/app/modules/shift/application/zones.py` (nuevo) va a buscar el
  local; lo usan `ShiftService._notify_nearby_workers`,
  `ShiftService.list_feed` y `MatchingService.get_top_candidates`, para que
  los tres midan desde el mismo lugar.
- `ShiftService.list_feed` (`shift/application/services.py`): con zona, pide
  los abiertos de una caja de coordenadas sin cortar la página
  (`ShiftRepository.list_open_unpaged`), mide la distancia exacta en Python y
  recién entonces corta. `FEED_RADIUS_KM` es el radio de la escalada.
- `GET /shifts/feed` (`shift/api/routes.py`, `dependencies.py`,
  `schemas.py`): `scope=nearby|all` (por defecto `nearby`) y
  `latitude`/`longitude` como punto de búsqueda.
- `frontend/lib/current-location.ts`: `nearbyOnly` y `NEARBY_RADIUS_KM`.
  `frontend/app/feed/page.tsx`, `frontend/app/buscar/page.tsx` y
  `frontend/app/map/page.tsx` los usan (el Mapa, desde el GPS).
- Tests: `backend/tests/test_cerca_es_cerca.py` (feed, avisos, push,
  escalada, recomendados, turno sin zona, «Disponible ahora»),
  `test_shift_nearby.py` (`zone_of`), la sección «El radio es un límite
  duro» de `test_matching_scoring.py`, `test_geo.py`,
  `frontend/lib/current-location.test.ts` y
  `frontend/e2e/cerca-es-cerca.spec.ts`.

**Por qué así:**

- **Los radios ya estaban decididos** (25 km, y 40 km en la escalada,
  ADR-0009): no se cambiaron. El de 40 estaba escrito como `25 × 1,6` en el
  servicio; ahora es una constante con nombre en el dominio.
- **El feed usa el radio de la escalada (40 km)** para que la lista y el
  aviso no se contradigan: midiendo desde la zona del perfil, todo lo que te
  pueden avisar lo ves en el Inicio. No vale con «Disponible ahora» prendido
  lejos de esa zona (ver «Queda abierto»).
- **Turno sin zona: se mide desde el local, y no se rechaza.** Rechazar con
  422 cualquier turno sin zona cambiaba el contrato de la API y no resolvía
  los que ya están publicados, que al desplegar habrían quedado invisibles.
  Medir desde el local al leer cubre a los dos y no toca datos. Se descartó
  copiar la zona del local al turno al publicar: cambia lo que muestra la
  tarjeta («Ubicación a confirmar») y le agrega al check-in una validación
  de lugar que ese turno hoy no tiene.
- **El servidor mide desde la zona del perfil, no desde donde está el
  teléfono.** Es lo único que ya tiene. Mandar la ubicación del momento
  («Estoy acá», el GPS del Mapa) para armar el feed sería un uso nuevo de la
  ubicación que `/privacidad` hoy no contempla: no se hizo. El punto de
  búsqueda que acepta el endpoint es el centro de una zona que la persona
  escribió por nombre. «Disponible ahora» tampoco se usa acá: sigue siendo
  para que el comercio mida desde ahí.
- **Si hay más turnos que el tope dentro del radio, el corte es por
  cercanía**, y recién adentro van los urgentes primero. Cortar con «urgentes
  primero» repetía el problema en una ciudad con muchos turnos: como todo
  turno sin cubrir pasa a urgente a los 8 minutos, el recién publicado de la
  vuelta volvía a quedar afuera.
- **Filtro grueso en SQL, distancia exacta en Python.** La caja de
  coordenadas son comparaciones simples que resuelven Postgres y el SQLite de
  los tests; no hace falta PostGIS. Para Buscar, el orden por distancia sale
  de SQL con aritmética común (distancia aproximada) para no traer todo el
  mercado a memoria.
- **Se descartó** dejar el filtro sólo en la pantalla: el servidor seguiría
  cortando en 50 antes de filtrar y el turno cercano seguiría sin llegar.

Se corrigieron los docs que decían lo contrario: `docs/reference/LOCATION.md`
afirmaba que la cercanía era «preferencia, no barrera dura»; también
`MATCHING.md`, `API.md`, `NOTIFICATIONS.md`, `WORKER.md`, `QUE_EXISTE_HOY.md` y
`MAPA_DEL_CODIGO.md`.

**Queda abierto:**

- **«Disponible ahora» prendido lejos de la zona del perfil: el aviso y el
  Inicio no coinciden.** El aviso mide desde la posición de «Disponible
  ahora» (ADR-0014) y el feed desde la zona del perfil. Con el perfil en una
  ciudad y «Disponible ahora» en otra, llega «Turno cerca tuyo» de un turno
  que el Inicio no lista (el aviso abre `/turno/<id>`, así que se puede
  postular igual), y un turno de la zona del perfil aparece en el Inicio sin
  que le llegue aviso. Que el feed mida desde esa posición es una decisión de
  producto y de privacidad (la pantalla tendría que medir desde ahí también,
  y hay que ver si el texto de `/privacidad` lo cubre): no se tomó acá. El
  comportamiento de hoy lo fija
  `test_disponible_ahora_mueve_el_aviso_pero_no_el_feed`.
- **Turno sin zona de un comercio que tampoco tiene ubicación.** No hay
  contra qué medir: no se le avisa a nadie y no aparece en el Inicio ni en el
  Mapa de quien tiene zona; sólo en Buscar. Queda un registro en el log
  (`shift.unplaced`), pero el comercio no se entera. El formulario de evento
  ya exige zona en otra rama (`claude/evento-con-zona`); falta decidir si la
  API la exige para todo turno. No se contó cuántos turnos abiertos sin zona
  hay en producción.
- **«Estoy acá» y el GPS del Mapa lejos de la zona del perfil.** El servidor
  sólo conoce la zona del perfil. Quien está a más de 40 km de su zona ve el
  Inicio (con «Estoy acá») y el Mapa vacíos, con el botón a Buscar. Para que
  esas dos pantallas traigan lo cercano al lugar donde la persona está, hay
  que mandar esa ubicación al servidor: es una decisión de producto y de
  privacidad (texto
  de `/privacidad` y versión de términos), no un detalle técnico. El endpoint
  ya acepta el punto.
- **Tope de 50 por pedido, sin «ver más».** En el Inicio y el Mapa quedan los
  50 más cercanos dentro del radio; en Buscar, los 50 más cercanos de todo el
  país (o los 50 más nuevos si el perfil no tiene coordenadas). No se agregó
  paginación en las pantallas. Consecuencia en Buscar: con más de 50 turnos
  abiertos cerca de la zona del perfil, no llega a mostrar ninguno de otra
  zona, y no tiene filtro de zona para pedirlos. Antes traía 50 del país
  (urgentes y nuevos). Hasta que haya paginación o filtro por zona, Buscar
  no cumple del todo con «mirar otras zonas» en una ciudad con mucha oferta.
- **Mapa sin GPS.** Si la persona no da permiso de ubicación, el Mapa
  muestra lo que mandó el servidor (lo cercano a la zona del perfil, o los 50
  más nuevos del país si el perfil no tiene zona) bajo el título «Turnos en
  el centro de Buenos Aires», que ya estaba y no se tocó.
- **Sin índice nuevo.** La caja de coordenadas filtra sobre los turnos
  abiertos que todavía no empezaron (índice `(status, start_at)`). Si el
  volumen crece, conviene un índice por coordenadas.
- **Caminos que no paginan en SQL.** Un trabajador con ciudad pero sin
  coordenadas hace traer todos los abiertos para comparar la ciudad en
  Python. Son pocos perfiles (el selector de zona carga ciudad y coordenadas
  juntas); si dejara de ser raro, hace falta una columna de ciudad
  normalizada.
- **Trabajadores sin zona en el perfil** (ni coordenadas ni ciudad) dejan de
  recibir «Turno cerca tuyo»: no hay con qué decir que están cerca. En el
  Inicio siguen viendo todo. No se midió cuántos hay en producción.
- **Los recomendados usan siempre 25 km**, también después de la escalada
  (que avisa hasta 40 km): quien se entera por la escalada desde más lejos
  aparece como postulante, no como recomendado.
- **Aplicaciones abiertas con la versión anterior:** hasta que se actualicen,
  su Buscar pide el feed sin `scope=all` y ve sólo lo cercano.
