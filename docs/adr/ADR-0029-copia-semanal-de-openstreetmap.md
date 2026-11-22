# ADR-0029 — Comercios a captar: copia semanal de OpenStreetMap, no consulta en vivo

**Estado:** aceptado · **Fecha:** 2026-11-22 · **Decisión de Julieta:**
2026-11-22 · **Actualiza:** [ADR-0019](./ADR-0019-comercios-a-captar-desde-openstreetmap.md)
(la fuente sigue siendo OSM vía Overpass; cambia cuándo se la consulta).

> **Corrección (2026-11-22, tras el deploy):** una respuesta con 0 comercios nunca es éxito (falla con backoff) y una copia con 0 comercios cuenta como faltante; antes se guardaban copias vacías por 7 días. Ver `historial/2026-11-22-copia-osm-vacia.md`.

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
   la anterior y hay dos esperas, las dos con backoff exponencial en memoria:
   - **el barrio** descansa 1 h, el doble por cada falla seguida suya, hasta
     7 días (un barrio que falla siempre termina probándose una vez por
     semana);
   - **todo el refresco** se frena 30 min, el doble por cada falla seguida
     de cualquier barrio, hasta 24 h, y vuelve a cero con el primer éxito
     (casi siempre el problema es de los servidores, no del barrio).

   Un barrio pedido desde la pantalla se salta la pausa general (no la
   suya), como mucho una vez cada 15 min. Cuenta como falla una respuesta
   vacía cuando la copia anterior tenía comercios (Overpass a veces responde
   vacío al cortar una consulta) y una respuesta con `remark` «runtime
   error»: puede estar incompleta, así que nunca pisa una copia existente
   (sólo se guarda si el barrio no tenía ninguna). Una tarea que lleva más
   de 60 min (la más larga legítima ronda los 42) se da por colgada: se
   cancela, se loguea (`lead.snapshot_hung`) y cuenta como falla. Al apagar,
   `app/main.py` cancela la tarea junto con el scheduler.
4. **Despertares.** Mientras corre la tarea, el chequeo no pide deadline; la
   tarea despierta al scheduler al terminar **bien** (`notify_scheduler`,
   inyectado desde `app/main.py`). Tras una falla no lo despierta (lo que
   sigue es una pausa, salvo que haya un pedido de la pantalla que pueda
   saltársela): la próxima pasada del loop, a su hora (a lo sumo 6 h),
   devuelve el fin de la pausa. Con Overpass caído, Neon no se despierta
   por esto. Con todas las copias al día, la próxima deadline es
   cuando vence la más vieja (días): no agrega despertares (cuota de Neon).
   Llenar las 48 copias la primera vez son ~48 pasadas del scheduler,
   después unas 48 por semana.
5. **La importación lee la copia.** `POST /admin/leads/import` arma los leads
   desde la copia del barrio, con la misma deduplicación de siempre
   (`osm_ref`, sin pisar estado ni notas), y devuelve `fetched_at`. Si el
   barrio no tiene copia todavía responde **409** con
   `{code: "snapshot_pending", message: "Todavía no tenemos la copia de este
   barrio. La estamos pidiendo; probá de nuevo en un rato."}` (no promete
   minutos: con los servidores caídos puede tardar), lo pone primero en la cola
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

- La cola en memoria (pedidos de la pantalla, barrios en descanso, contadores
  de fallas y pausa general) se pierde al reiniciar el proceso; no importa,
  los barrios sin copia se bajan igual.
- Tras una falla, el refresco puede retomar hasta 6 h después del fin de la
  pausa (el loop no se despierta sólo por esto). Es a propósito: cuidar la
  cuota de Neon pesa más que unas horas en una copia semanal.
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
