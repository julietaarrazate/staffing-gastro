# La copia de OpenStreetMap ya no guarda barrios vacíos como éxito

**Pedido:** con #730 en producción, Agronomía, Almagro, Balvanera y Barracas
terminaron con `lead.snapshot_refreshed comercios=0` aunque los logs
mostraban ConnectError, Timeout y 504 en los servidores de Overpass. Quedaron
copias vacías que no se iban a volver a pedir por 7 días (Almagro tiene
cientos de comercios). Belgrano iba por el mismo camino.

**Qué cambió:** la causa estaba en dos caminos que no dejan rastro de falla
en el log, reproducidos con tests (fallaban antes del arreglo):

- un servidor responde **200 sin `remark` y sin elementos** (los demás
  fallan): `OverpassPlaceSource` lo tomaba como respuesta completa y la
  devolvía; una respuesta buena no se loguea;
- un servidor corta la consulta (`remark` «runtime error») y trae elementos
  que no son comercios: quedaba como respuesta parcial con 0 comercios, y
  `PlaceSnapshotService.refresh` guardaba una parcial si el barrio no tenía
  copia.

Arreglo (`backend/app/modules/lead/`):

- `infrastructure/overpass_place_source.py`: una respuesta con 0 comercios
  se loguea (`lead.overpass_empty`) y se prueba el próximo servidor; una
  parcial sólo se guarda como respaldo si trae comercios.
- `application/services.py`: 0 comercios nunca es éxito, ni siquiera de un
  servidor sano y sin `remark` (en la Ciudad ningún barrio tiene 0 bares ni
  cafés en OSM): falla y entra al backoff del refresco. Importar un barrio
  con copia vacía responde 409 y lo pide, como si no tuviera copia.
- `infrastructure/repositories.py`: `fetched_at_by_barrio` ignora las copias
  con 0 comercios, así que `plan` (y la fecha en pantalla) las trata como
  faltantes. Las copias vacías que ya están en producción se vuelven a pedir
  solas, sin tocar datos a mano.

**Por qué así:** el chequeo va en el caso de uso, no sólo en el adaptador,
para que valga con cualquier fuente. Un barrio que de verdad no coincidiera
con OSM se reintenta con backoff hasta una vez por semana.

**Queda abierto:** después del deploy, ver en los logs de Render que Almagro,
Agronomía, Balvanera y Barracas pasen a `lead.snapshot_refreshed` con más de
0 comercios, y mirar si aparece `lead.overpass_empty` (qué servidor responde
vacío).
