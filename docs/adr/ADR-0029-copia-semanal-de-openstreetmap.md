# ADR-0029 — Comercios a captar: copia semanal de OpenStreetMap, no consulta en vivo

**Estado:** aceptado · **Fecha:** 2026-11-22 · **Decisión de Julieta:**
2026-11-22 · **Actualiza:** [ADR-0019](./ADR-0019-comercios-a-captar-desde-openstreetmap.md)
(la fuente sigue siendo OSM vía Overpass; cambia cuándo se la consulta).

## Contexto

«Traer comercios del barrio» (`POST /api/v1/admin/leads/import`) consultaba
Overpass en vivo, con la admin esperando, y en producción fallaba siempre:
desde Render `overpass-api.de` rechaza la conexión, `maps.mail.ru` responde
504 y los otros dos servidores no contestan en los 80 s que tenía la
consulta (por debajo de los ~100 s a los que cortan el frontend y
Cloudflare) → 502. Probado también desde otra red: los servidores públicos
de Overpass están saturados. Consultarlos a todos a la vez (2026-11-19) sólo
sumó carga. No hay plazo que entre en un pedido HTTP y alcance.

## Decisión

1. **Copia por barrio en la base.** Dos tablas (migración `0062`):
   `lead_place_snapshots`, los comercios de cada copia (los campos de
   `PlaceCandidate`, única por `(barrio, osm_ref)`), y
   `lead_snapshot_barrios`, de cuándo es la copia de cada barrio (UTC) y
   cuántos comercios trae. La fecha va aparte para que una copia **vacía**
   (un barrio sin comercios con nombre en OSM, o un nombre que no coincide)
   cuente como copia y no se vuelva a pedir en cada pasada. Puerto
   `PlaceSnapshotRepository` en el dominio del módulo `lead`, adaptador
   SQLAlchemy.
2. **Refresco en segundo plano, de a un barrio.** Un chequeo del scheduler
   en proceso (`lead/infrastructure/place_snapshot_job.py`, entra por
   `extra_checks` desde `app/main.py`, como el borrado de evidencias de
   ADR-0021) elige un barrio cuya copia no existe o tiene más de 7 días
   (regla pura en `lead/domain/snapshots.py`) y lo baja **en una tarea
   aparte**, para no frenar el loop ni a los demás chequeos. Nunca hay dos a
   la vez. La consulta es la de siempre (`build_query`, con `[timeout:170]`),
   contra los servidores de `OVERPASS_URLS` **de a uno, en serie**: 180 s por
   servidor y hasta 3 vueltas con 1 y 5 minutos de espera entre vueltas.
   Entre un barrio y el siguiente hay 30 s de pausa.
3. **La copia sólo se reemplaza si la consulta salió bien.** Si falla, queda
   la anterior, ese barrio descansa una hora antes de volver a probarse y
   todo el refresco se frena 30 minutos (casi siempre el problema es de los
   servidores, no del barrio); un barrio pedido desde la pantalla no espera
   esa pausa general. Una
   respuesta vacía cuando la copia anterior tenía comercios cuenta como falla
   (Overpass a veces responde vacío al cortar una consulta).
4. **Despertares.** Mientras corre la tarea, el chequeo no pide deadline; la
   tarea despierta al scheduler al terminar (`notify_scheduler`, inyectado
   desde `app/main.py`). Con todas las copias al día, la próxima deadline es
   cuando vence la más vieja (días): no agrega despertares (cuota de Neon).
   Llenar las 48 copias la primera vez son ~48 pasadas del scheduler,
   después unas 48 por semana.
5. **La importación lee la copia.** `POST /admin/leads/import` arma los leads
   desde la copia del barrio, con la misma deduplicación de siempre
   (`osm_ref`, sin pisar estado ni notas), y devuelve `fetched_at`. Si el
   barrio no tiene copia todavía responde **409** con
   `{code: "snapshot_pending", message: "Todavía no tenemos la copia de este
   barrio; se baja en los próximos minutos."}`, lo pone primero en la cola
   del refresco y despierta al scheduler. `GET /admin/leads/summary` suma
   `snapshots` (barrio → fecha de la copia) y la pantalla muestra «Datos de
   OpenStreetMap del <fecha>», o que todavía no hay copia. La atribución ODbL
   sigue igual.

## Por qué

- Es la única forma de que la admin no dependa de que un servicio comunitario
  saturado conteste dentro de un pedido HTTP. En segundo plano se puede
  esperar minutos y reintentar.
- Los comercios de un barrio cambian despacio: una semana de antigüedad no
  cambia a quién ir a ver.
- Un barrio por vez y en serie es lo más liviano para Overpass.
- Sin infraestructura nueva: el scheduler en proceso ya existe (plan free de
  Render, un web service).

Descartado: un Cron de Render aparte (infraestructura nueva y paga); bajar
toda la Ciudad en una consulta (consulta gigante, justo lo que ADR-0019
evita); una copia de OSM propia (Overpass local o un extracto `.pbf`):
demasiado pesado para lo que se usa.

## Consecuencias

- La cola en memoria (pedidos de la pantalla y barrios en pausa) se pierde
  al reiniciar el proceso; no importa, los barrios sin copia se bajan igual.
- Sólo corre en producción (el scheduler está gateado a
  `settings.is_production`): en local o en los E2E «Traer comercios» dice
  que no hay copia, salvo que se cargue una a mano.
- ⚠️ Con todos los servidores caídos, un barrio puede tardar hasta ~42
  minutos en darse por fallido (3 vueltas × 4 servidores × 180 s, más
  esperas). Es una tarea de fondo y no frena nada; sólo demora el siguiente.
- ⚠️ No se pudo probar contra Overpass real desde la sesión; los tests usan
  un transporte httpx falso. Después del deploy, mirar en los logs de Render
  `lead.snapshot_refreshed` / `lead.snapshot_failed`.
- ✅ Tests: `backend/tests/test_lead.py`, `frontend/lib/leads.test.ts`,
  `frontend/e2e/admin-leads.spec.ts`.
