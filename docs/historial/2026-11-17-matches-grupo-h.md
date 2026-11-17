# Beta etapa 3, grupo H: Matches del trabajador (U066, U068, U088)

**Pedido:** triaje de la etapa 3 (`docs/planning/BETA_ETAPA3_TRIAJE.md`, grupo H).
«Asignados» mezclaba lo pagado con lo próximo, los recordatorios no llevaban
link propio, la pantalla se veía cortada en celulares chicos y un postulante a
un turno cerrado leía «esperando respuesta».

**Qué cambió:**
- **U066, orden.** `SqlAlchemyShiftRepository.list_by_worker`
  (`backend/app/modules/shift/infrastructure/repositories.py`) ordena en la
  consulta: primero los turnos no terminales por inicio ascendente (el próximo
  arriba), después los terminales (pagado, finalizado, cancelado, no cubierto)
  por inicio descendente. Así el límite de 50 no corta lo próximo. En
  `frontend/app/my-shifts/page.tsx`, «Asignados» separa lo terminado bajo un
  subtítulo «Terminados».
- **U066, recordatorios.** `send_checkin_reminder` y `send_departure_reminder`
  (`shift/application/services.py`) guardan `link="/my-shifts"`, donde están
  «Llegué» y «Va en camino». No se usa `/turno/<id>` porque esa página no
  tiene las acciones del trabajador.
- **U068.** La causa de «nombres cortados» y tarjetas más anchas que la
  pantalla era la grilla de una columna sin `grid-cols-1` (la columna
  implícita crece con el nombre largo): ahora lleva `grid-cols-1`. Las tres
  pestañas ya no scrollean en horizontal: `SegmentedControl` acepta `count`
  y lo muestra como numerito aparte (el nombre accesible sigue siendo
  «Postulaciones (1)»). Debajo de `sm` el control usa `text-caption`
  (13 px), menos relleno y menos espacio, y cada pestaña mide según su
  contenido (`flex-auto`): con 14 px las pestañas se pasaban del margen de la
  página (en CI, 4 px de la pantalla). Si igual no entran (contadores de tres
  cifras, 320 px), se recorta el nombre con «…» y el número queda a la vista.
  Specs a 360 px con contadores de dos cifras (sin recorte) y a 320 px con
  120 guardados (sin desborde). El cambio alcanza a todos los usos del
  control en celular (registro, `/shifts`, admin), revisados en pantalla.
  «Comparar (n)» pasa a `variant="surface"`: el único ámbar de la pantalla es
  «Postularme».
- **U088.** Una postulación `pendiente` cuyo turno ya no está abierto
  (`publicado`/`buscando_personal`) muestra «El turno se cerró sin cubrir» o
  «El comercio canceló el turno», sin compartir y con «Quitar de la lista»
  (el mismo retiro de siempre). La pestaña cuenta sólo las que siguen abiertas.
  La API ya devolvía el turno embebido: no cambió quién ve qué.

**Por qué así:** el orden va en SQL y no en Python para que la paginación sea
coherente; los estados «activos» son los no terminales
(`TERMINAL_STATUSES`). El subtítulo «Terminados» reusa el estilo de los
rótulos chicos de la app, sin componente nuevo.

**Queda abierto:** nada de este grupo. El recordatorio no abre la tarjeta del
turno concreto (la pantalla no tiene anclas por turno).
