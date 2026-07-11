# ADR-0005 — Ping en tiempo real de turnos urgentes: fan-out sincrónico, sin broker, top-10

**Estado:** aceptado · **Fecha:** 2026-07-11

## Contexto

`Shift.urgent` existe desde el modelo original (entidad, columna indexada,
schemas de API, orden "urgentes primero" en el feed — ver
[SHIFT.md](../SHIFT.md)), pero hoy es **puramente pasivo**: marcar un turno
como urgente sólo cambia su orden en el feed. La misión del producto es
**cubrir una posición eventual en menos de 10 minutos**
([PRODUCT.md](../PRODUCT.md), principio 1 de [PRINCIPLES.md](../PRINCIPLES.md)),
y un turno urgente que sólo espera a que algún trabajador lo encuentre
navegando el feed no cumple esa promesa: necesita **salir a buscar**
activamente a quien puede cubrirlo.

El motor de matching (`matching/`) ya sabe rankear candidatos elegibles
(disponibles + con la skill) por cercanía (Haversine) para un turno dado
(`MatchingService.get_top_candidates`); el módulo de notificaciones
(`notification/`) ya persiste y empuja avisos por WebSocket en tiempo real al
crearlos (`SqlAlchemyNotificationRepository.add`, ver
[NOTIFICATIONS.md](../NOTIFICATIONS.md)). Faltaba la pieza que conecta
"se publicó un turno urgente" con "avisarle ya a la gente correcta".

## Decisión

### Qué dispara el ping

Al publicar un turno (`ShiftService.publish_shift`) que tiene `urgent=True`
**y** coordenadas propias (`latitude`/`longitude`), el turno "sale a buscar"
trabajadores: se notifica de inmediato a los **10** (`URGENT_PING_LIMIT`)
candidatos **disponibles** con la **skill** pedida por el turno, **más
cercanos**, excluyendo a quienes no tienen coordenadas propias (no se puede
calcular "cerca tuyo" sin ellas). Turnos no urgentes, o urgentes sin
coordenadas, no disparan ningún ping — comportamiento sin cambios.

### Puerto nuevo, sin acoplar dominios

`NearbyCandidatesPort` (`shift/domain/repositories.py`, junto al
`ShiftRepository`) es el puerto mínimo que `ShiftService` necesita:
`list_nearby(skill, latitude, longitude, limit) -> list[NearbyCandidate]`,
donde `NearbyCandidate` es sólo `user_id` + `distance_km` — lo mínimo para
notificar y armar el mensaje, no un perfil enriquecido (eso es del motor de
matching).

La implementación real (`MatchingNearbyCandidatesAdapter`,
`shift/infrastructure/nearby_candidates.py`) reutiliza por **composición** el
`CandidateRepository` del módulo `matching` (mismo filtro SQL
disponible+skill que ya usa el ranking) y calcula la distancia con el mismo
`haversine_km` compartido (`app/core/geo.py`). Es el **único** archivo de
`shift` que conoce `matching`, y sólo importa su **puerto** de dominio; la
instancia concreta (`SqlAlchemyCandidateRepository`) se arma en
`shift/api/dependencies.py` (composición de dependencias), exactamente el
mismo patrón que ya usa `matching/api/dependencies.py` para inyectar el
`ShiftRepository` de este módulo. `shift/domain` y `shift/application` no
importan nada de `matching` — ver
[CLAUDE.md](../../CLAUDE.md#no-hacer) ("cruces entre módulos: por
puerto/repositorio inyectado, nunca acoplando dominios").

### Fan-out sincrónico, sin cola ni broker

El ping se emite **dentro del mismo caso de uso** que publica el turno
(`ShiftService._ping_nearby_urgent_candidates`, llamado al final de
`publish_shift`), creando una `Notification` por candidato
(`NotificationType.NEARBY_URGENT_SHIFT`) — el mismo patrón que el resto de
las notificaciones del sistema (ver [EVENTS.md](../EVENTS.md)): **no hay** bus
de eventos, cola ni outbox. Persistir la `Notification` ya dispara el push en
vivo por WebSocket (`SqlAlchemyNotificationRepository.add` hace
`ws_manager.broadcast_notification`), así que no hace falta ninguna pieza de
infraestructura nueva.

**La publicación es lo primario, el fan-out es secundario:** todo el fan-out
(la consulta de candidatos cercanos + el alta de cada notificación) está
envuelto en un único `try/except`. Si falla — el puerto de matching no
responde, una notificación no se pudo persistir — se loggea
(`logger.exception`) y se sigue: el turno **ya quedó publicado** (el
`await self._shifts.update(shift)` corrió antes), nunca se revierte la
publicación ni se propaga la excepción al caller.

### Mensaje (español, no-disclosure)

Título fijo: `"⚡ Turno urgente cerca tuyo"`. Mensaje: rol pedido, nombre del
comercio si el turno lo tiene cargado, y distancia aproximada ("a ~2 km" /
"a menos de 1 km"). El nombre del comercio **no** es información nueva: ya es
público en el feed (`ShiftResponse.company_name`, resuelto en
`shift/api/routes.py::_with_company_info`) — incluirlo en el ping no viola
no-disclosure. El deep-link (frontend) es al **feed normal**
(`/feed`), no a una pantalla propia del turno con más datos de los que el
trabajador vería ahí.

### Por qué **10** y por qué alcanza para la beta

- El radio de matching ya usa `DEFAULT_MAX_RADIUS_KM` (25 km,
  [MATCHING.md](../MATCHING.md)) para el scoring ponderado; acá no se
  replica ese tope porque el universo objetivo (beta en **Palermo**, decenas
  de trabajadores activos, no miles) hace que "los 10 disponibles más
  cercanos con la skill" ya sea, en la práctica, un radio acotado sin
  necesidad de parametrizarlo.
- 10 es suficiente para generar competencia por el turno (varios trabajadores
  reciben el aviso a la vez, el más rápido en postularse gana) sin saturar
  de notificaciones a la base de usuarios ni acercarse a ningún límite de
  carga: en esta escala, una decena de `INSERT` + `broadcast_notification`
  síncronos dentro de la misma request de publicar un turno es un costo
  despreciable (mismo orden de magnitud que las notificaciones existentes de
  asignación/confirmación).
- Fan-out **sincrónico** es coherente con [EVENTS.md](../EVENTS.md): un solo
  proceso, un solo `ws_manager` en memoria, sin necesidad de reintentos
  garantizados — publicar un turno ya tolera esa latencia extra (una decena
  de operaciones de DB) sin degradar la experiencia del comercio.

## Fuera de alcance (explícito)

- **Re-disparar el ping si el turno se edita** (cambia de posición, se le
  agrega ubicación después de publicado, etc.): sólo se dispara en
  `publish_shift`. Si el negocio pide "también avisar de nuevo si se
  actualiza un turno urgente ya publicado", es una extensión del mismo
  patrón, no requiere ADR nuevo.
- **Radio máximo / filtro por distancia:** no se excluye a un candidato por
  estar "demasiado lejos" (a diferencia del `max_radius_km` del scoring de
  matching); sólo se toma el top-10 más cercano entre los disponibles con la
  skill. A la escala de la beta no hace falta; si el universo de
  trabajadores crece mucho fuera de Palermo, agregar un radio máximo es un
  cambio menor sobre `MatchingNearbyCandidatesAdapter`, no un ADR nuevo.
- **Deduplicar/agrupar pings si el mismo trabajador es candidato de varios
  turnos urgentes publicados casi al mismo tiempo:** cada publicación corre
  su propio fan-out independiente; un trabajador puede recibir varios pings
  seguidos. No se detectó como problema de producto hoy (a esta escala, es
  señal de que hay trabajo real cerca), pero si se vuelve ruido, es una
  decisión de producto nueva (throttling/agrupación), no una corrección de
  este ADR.

## Trigger para revisitar esta decisión (→ R4)

Señales de **carga real** que ameritan volver a este ADR y evaluar mover el
fan-out a un job asíncrono/outbox (ver tabla de trade-offs en
[EVENTS.md](../EVENTS.md)):

- Más de una instancia del backend corriendo a la vez (el `ws_manager` en
  memoria ya deja de alcanzar para el push en vivo *antes* de que el fan-out
  sea el cuello de botella — sería la señal más temprana).
- El fan-out empieza a alargar perceptiblemente la respuesta de
  `POST /shifts/{id}/publish` (decenas de candidatos elegibles por turno
  urgente, no unidades) — hoy, con la base de trabajadores de la beta, el
  costo es marginal.
- Se expande a otras ciudades/barrios simultáneamente y "top-10 más cercano
  sin radio máximo" deja de ser un proxy razonable de "cerca" (empieza a
  notificar candidatos genuinamente lejos porque no hay 10 disponibles
  cerca).

Ninguna de estas señales está presente hoy: la beta opera en Palermo con
decenas de trabajadores, un solo proceso backend, y el fan-out agrega una
decena de escrituras a una request que ya hace varias.

## Consecuencias

- ✅ `Shift.urgent` deja de ser un campo pasivo: cumple la promesa de
  "cubrir en < 10 minutos" empujando el turno activamente a quien puede
  cubrirlo, sin infraestructura nueva.
- ✅ Reutiliza el motor de matching (filtro SQL disponible+skill, Haversine)
  y el pipeline de notificaciones (persistencia + WebSocket) existentes; no
  duplica lógica de elegibilidad ni de entrega en tiempo real.
- ✅ Cero infraestructura nueva (sin cola, sin broker, sin tabla nueva) —
  coherente con "simplicidad primero" ([PRINCIPLES.md](../PRINCIPLES.md)).
- ⚠️ `ShiftService` ahora depende de un puerto más (`NearbyCandidatesPort`,
  opcional en el constructor para no romper otros posibles callers) —
  documentado como cruce permitido, no una regresión de capas.
- ⚠️ Ver "Fuera de alcance" y "Trigger para revisitar" arriba: son
  limitaciones conocidas y aceptadas a esta escala, no bugs.
