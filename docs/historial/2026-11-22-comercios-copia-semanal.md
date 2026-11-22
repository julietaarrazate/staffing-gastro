# «Traer comercios del barrio» lee una copia semanal de OpenStreetMap (ADR-0029)

**Pedido:** «Traer comercios del barrio» (admin → Crecimiento) fallaba
siempre en producción con 502: desde Render `overpass-api.de` rechaza la
conexión, `maps.mail.ru` da 504 y los otros dos no contestan en 80 s. Los
servidores públicos de Overpass están saturados (probado también desde otra
red). Julieta decidió una copia semanal.

**Qué cambió:** la admin elige el barrio y toca «Traer comercios del
barrio»: la lista se arma al instante desde la copia guardada, y debajo de
los botones se lee «Datos de OpenStreetMap del <fecha>». Si el barrio todavía
no tiene copia, la pantalla lo dice y el botón avisa «Todavía no tenemos la
copia de este barrio; se baja en los próximos minutos» (aviso, no error).

- Tablas nuevas `lead_place_snapshots` y `lead_snapshot_barrios` (migración
  `0062_copia_semanal_osm.py`); puerto `PlaceSnapshotRepository` y adaptador
  `SqlAlchemyPlaceSnapshotRepository` (`backend/app/modules/lead/`).
- Regla de qué barrio refrescar en `lead/domain/snapshots.py` (sin copia o
  de más de 7 días; los pedidos desde la pantalla primero; un barrio que
  falló descansa una hora y, tras una falla, todo el refresco se frena 30
  minutos salvo un barrio pedido desde la pantalla).
- Caso de uso `PlaceSnapshotService` (`lead/application/services.py`):
  consulta primero y escribe después; si la consulta falla o vuelve vacía
  con una copia anterior llena, la copia anterior queda.
- Chequeo del scheduler `lead/infrastructure/place_snapshot_job.py`,
  enganchado en `app/main.py` por `extra_checks`: baja un barrio por vez en
  una tarea aparte (nunca dos), despierta al scheduler al terminar y, con
  todo al día, devuelve la fecha de vencimiento de la copia más vieja.
- `OverpassPlaceSource` ahora consulta los servidores de a uno, en serie,
  180 s cada uno, hasta 3 vueltas con 1 y 5 minutos de espera
  (`[timeout:170]` en la consulta).
- `POST /admin/leads/import` lee la copia (misma deduplicación de leads) y
  devuelve `fetched_at`; sin copia, 409 `snapshot_pending` y el barrio va
  primero en la cola. `GET /admin/leads/summary` suma `snapshots`.
- Frontend: `frontend/app/admin/leads/page.tsx`, `snapshotLabel` en
  `frontend/lib/leads.ts`, tipos en `lib/types.ts`.

**Por qué así:** ningún plazo que entre en un pedido HTTP alcanza con
servidores saturados; en segundo plano se puede esperar minutos y
reintentar sin que la admin espere. Un barrio por vez es lo más liviano para
Overpass, y la próxima deadline a días de distancia no suma despertares de
Neon. Descartados: Cron de Render aparte, una consulta de toda la Ciudad, un
Overpass propio. Detalle en
[ADR-0029](../adr/ADR-0029-copia-semanal-de-openstreetmap.md).

**Queda abierto:** verificar en producción, después del deploy, que en los
logs de Render aparezcan `lead.snapshot_refreshed` y que Palermo tenga copia.
En local y en los E2E el scheduler no corre, así que «Traer comercios» dice
que no hay copia.
