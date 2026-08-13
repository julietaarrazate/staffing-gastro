# MATCHING_QUALITY_ANALYSIS.md — Análisis del motor de matching y diseño mínimo para medir su calidad

> Responde el pedido explícito de Julieta de evaluar el modelo de matching
> **antes** de decidir si se persiste algo nuevo (`match_log`,
> `OBSERVABILITY_AND_PRODUCT_ANALYTICS.md §2.2/§5`). Este documento **no
> implementa nada** — es el análisis + la propuesta de diseño para decidir
> con datos, no por default. Metodología: lectura directa de
> `matching/domain/scoring.py`, `matching/application/services.py`,
> `matching/api/routes.py` y los dos call-sites de `rank_candidates` en
> `shift/application/services.py` (commit `8b87269`).

## 1. Qué score calcula actualmente

`score_candidate()` (`matching/domain/scoring.py:64-86`) devuelve un
`ScoreBreakdown` con 5 sub-scores normalizados a `[0,1]` y un total
ponderado (`ScoreBreakdown.total()`, `matching/domain/value_objects.py:44-50`):

| Factor | Peso | Fórmula | Rango de entrada |
|---|---|---|---|
| Distancia | 0.30 | `1 - (distancia_km / 25)`, 0 si ≥25km, **0.5 si falta geolocalización de alguna punta** | Haversine, sin PostGIS |
| Reputación | 0.25 | `rating / 5` | `WorkerProfile.rating`, 0-5 |
| Experiencia | 0.15 | `min(años / 10, 1.0)` | `WorkerProfile.years_experience` |
| Puntualidad | 0.15 | `punctuality_rate` clamped a [0,1] | `WorkerProfile.punctuality_rate` |
| Desempeño | 0.15 | `completados / (completados + cancelaciones + 2×no_shows)`, **0.5 si nunca trabajó** | contadores de `WorkerProfile` |

Los pesos están validados en el constructor de `MatchWeights`
(`__post_init__`, deben sumar 1.0 exacto — falla con `ValueError` si no).
Son "valores semilla" documentados como ajustables (`docs/reference/MATCHING.md`,
`docs/reference/REPUTATION.md`), nunca calibrados contra resultado real —
**exactamente el problema que este documento busca poder resolver**.

## 2. Qué señales utiliza

Todas ya existen en el dominio, ninguna se calcula ad-hoc para el matching:
posición/coordenadas del turno (`Shift`), y del lado candidato — coordenadas,
disponibilidad, skills, `rating`, `years_experience`, `punctuality_rate`,
`events_completed`, `cancellations`, `no_shows` (todas de `WorkerProfile`,
ver `docs/reference/REPUTATION.md`). **No usa** nada de `Company` ni de
afinidad histórica local↔trabajador (explícitamente fuera de alcance en
`MATCHING.md#fuera-de-alcance`).

## 3. Dónde se calcula

Capa de **dominio puro** (`matching/domain/scoring.py`): funciones sin
efectos secundarios, sin `async`, sin acceso a DB. `rank_candidates()`
recibe una lista de `CandidateProfile` ya resuelta y un `ShiftRequirement`,
y devuelve una lista de `MatchResult` ordenada. **No hay ORM ni sesión de
DB en este archivo** — es testeable sin fixtures de base de datos (y de
hecho `test_matching_scoring.py` lo prueba así).

## 4. Cuándo se calcula (dos call-sites, comportamiento distinto)

Es el punto más importante para el diseño de instrumentación — **no hay un
único momento** en que "se calcula el matching":

### 4.1 Automático — al publicar y al escalar (le llega al trabajador)

`ShiftService._notify_nearby_workers()` (`shift/application/services.py:224-293`),
invocado desde:
- `publish_shift()` (línea 205) — límite **10** candidatos, radio 25km.
- `escalate_urgency()` (línea 313, scheduler automático, ADR-0009) — límite
  **20**, radio 40km (`ESCALATION_RADIUS_KM = 25 × 1.6`).

Este es el que **efectivamente le llega al trabajador** (crea una
`Notification` por cada uno de los rankeados). El score se calcula, se usa
para decidir a quién notificar, y **se descarta** — ni el score ni el rank
quedan en la `Notification` (que sólo tiene `title`/`message`/`link`, ver
`notification/domain/entities.py`). Es **best-effort**: un fallo acá nunca
bloquea la publicación (`try/except` con `logger.exception`, línea 289).

### 4.2 Bajo demanda — cuando el comercio abre "candidatos" (no le llega a nadie)

`MatchingService.get_top_candidates()` vía `GET /shifts/{id}/candidates`
(`matching/api/routes.py:38-64`) — el comercio puede abrir esta pantalla
**las veces que quiera**, cada vez recalcula desde cero (sin caché), límite
configurable por query param hasta 50 (default 10). **No hay rate limit en
esta ruta** (verificado: `grep RateLimiter matching/api/routes.py` → sin
resultados) — a diferencia de otras rutas de lectura del repo. Esto no le
notifica nada a nadie: es lo que el comercio **ve** para decidir a quién
asignar manualmente.

**Implicancia para el diseño (§8):** cualquier instrumentación que trate
estos dos call-sites como "lo mismo" mediría cosas distintas bajo el mismo
nombre. §8 los separa.

## 5. ¿Es determinista?

**Sí, como función pura** — mismo input, mismo output, siempre (no hay
aleatoriedad, no hay reloj, no hay I/O dentro de `scoring.py`). Pero **el
input no está congelado en el tiempo**: `rank_candidates()` lee
`candidate.rating`/`punctuality_rate`/`events_completed`/disponibilidad
**en vivo** desde el perfil actual en cada llamada (`MATCHING.md` ya lo
documenta para el caso de la reputación, verificado con test de integración
end-to-end en `test_full_shift_lifecycle.py`). Consecuencia práctica:
**llamar dos veces al mismo turno con el mismo candidato en momentos
distintos puede dar scores distintos** — no por un bug, sino porque el
perfil del candidato cambió entre medio (nueva reseña, turno completado,
etc.). Esto es relevante para el diseño: **si se quiere medir "qué vio el
comercio/trabajador en el momento de la decisión", hay que guardar el score
en ese instante — no se puede reconstruir después pidiéndole al motor que
recalcule con el estado actual.**

## 6. Relación con `application`/`acceptance` hoy

**Ninguna, a nivel de datos.** `ShiftApplication` (postulación) y
`MatchResult` (ranking) son dos mundos que nunca se cruzan en el modelo: no
existe ninguna fila, columna ni tabla que diga "a este candidato se le
mostró/notificó este turno con este score, y X días después se postuló".
El único punto de contacto es **conceptual**, no de datos: un candidato
rankeado alto recibe una `Notification` (§4.1) cuyo `link` lo lleva al
feed/candidatos, y **si** se postula, eso genera una `ShiftApplication`
independiente — pero nada conecta ambos eventos salvo la coincidencia de
`shift_id` + `worker_profile_id`, que hoy nadie cruza. Es exactamente el
gap que motivó este documento.

**Buena noticia para el diseño:** el **resultado final** (quién quedó
asignado) ya vive en `Shift.worker_profile_id` (`shift/domain/entities.py:63`,
seteado en `assign()`), y las postulaciones intermedias en
`ShiftApplication.worker_profile_id` (`application/domain/entities.py:24`).
**Ambas usan `worker_profile_id` como clave**, el mismo campo que ya expone
`MatchResult.profile_id` (`matching/domain/entities.py`, ver
`rank_candidates()` línea 108). Esto significa que **el diseño mínimo no
necesita guardar el resultado (aceptado/rechazado) en ningún lado nuevo** —
se obtiene haciendo `JOIN` contra `applications`/`shifts` que ya existen,
por `(shift_id, worker_profile_id)`. Sólo falta guardar **qué se le mostró y
con qué score**, no qué pasó después.

## 7. Volumen potencial si se guardara cada recomendación

Depende **enteramente** de cuál de los dos call-sites (§4) se instrumenta —
son órdenes de magnitud distintos:

| Fuente | Filas por evento | Frecuencia (beta actual, Palermo) | Acotado naturalmente? |
|---|---|---|---|
| `_notify_nearby_workers` en `publish_shift` | ≤10 | 1 vez por turno publicado | **Sí** — un publish por turno |
| `_notify_nearby_workers` en `escalate_urgency` | ≤20 | 0-1 vez por turno (sólo si no se cubre rápido, ADR-0009) | **Sí** — el scheduler decide cuándo, no el usuario |
| `GET /shifts/{id}/candidates` (bajo demanda) | ≤50 (default 10) | **Sin límite** — el comercio puede abrir la pantalla cuantas veces quiera, sin rate limit | **No** — controlado por el cliente, no por el servidor |

**Estimación conservadora a escala beta** (~200 usuarios, volumen real de
Palermo, sin cifra oficial de turnos/semana en este repo — se razona con
órdenes de magnitud): si se instrumentan **sólo** los eventos automáticos
(publish + escalation), el techo es `≤30 filas × turnos publicados`. Con
decenas de turnos/semana, son cientos de filas/semana — trivial para
Postgres, sin necesidad de partición ni de política de agregación. Si se
instrumentara **también** la vista bajo demanda sin ningún límite, el
volumen queda atado a cuántas veces un comercio refresca la pantalla — no
es impredecible en el sentido de "puede crecer sin límite con más
usuarios" (ambos escalan con actividad real), pero sí es **la fuente que
un comercio podría inflar sin querer** (dejar la pestaña abierta con
auto-refresh, por ejemplo) sin que eso represente una decisión real de
matching. **Recomendación (§8): instrumentar primero sólo los eventos
automáticos** — son los que efectivamente le llegan a un trabajador y
producen una decisión (postularse o no), y su volumen es acotado por
diseño (el `NEARBY_NOTIFICATION_LIMIT`/`ESCALATION_NOTIFICATION_LIMIT` ya
existentes). La vista bajo demanda queda para una segunda etapa, si el
análisis de la primera muestra que hace falta.

## 8. Diseño mínimo viable propuesto (NO IMPLEMENTAR TODAVÍA)

### 8.1 Alcance: sólo el call-site automático (§4.1, §7)

Instrumentar `_notify_nearby_workers()` — es el único punto donde el score
se traduce en una acción real hacia el trabajador (notificación), tiene
volumen acotado por diseño, y es exactamente lo que hace falta para
responder "¿los candidatos que el algoritmo prioriza son los que terminan
siendo seleccionados?". La vista bajo demanda del comercio (§4.2) no se
instrumenta en esta primera etapa — no está bloqueada, es una decisión de
"empezar por lo que responde la pregunta con menos ruido".

### 8.2 Información mínima a conservar por fila

No hace falta el desglose de los 5 sub-scores (§1) para responder la
pregunta central (¿el orden predice la selección?) — alcanza con el score
total y la posición en el ranking. El desglose se puede reconstruir después
si hace falta recalibrar pesos específicos, pero **no es necesario para la
medición inicial** — coincide con la regla de Julieta de preferir lo
mínimo. Columnas propuestas:

| Columna | Tipo | Por qué |
|---|---|---|
| `id` | UUID PK | Mismo patrón que el resto del esquema |
| `shift_id` | UUID, `FK → shifts.id ON DELETE CASCADE` | Correlación con el turno; cascada porque el log pierde sentido sin el turno |
| `worker_profile_id` | UUID, `FK → worker_profiles.id ON DELETE CASCADE` | Misma clave que `ShiftApplication`/`Shift.worker_profile_id` (§6) — permite el `JOIN` sin traducir IDs |
| `rank` | SMALLINT | Posición en el ranking mostrado (1 = mejor) |
| `score` | FLOAT | Score total en el momento (§5: hay que congelarlo, no se puede recalcular después) |
| `trigger` | VARCHAR corto (`"publish"` \| `"escalation"`) | Distingue las dos sub-fuentes de §4.1 sin tablas separadas |
| `shown_at` | TIMESTAMPTZ, `server_default=now()` | Cuándo se generó — permite ventanas de análisis |

**Deliberadamente afuera:** los 5 sub-scores individuales, cualquier
snapshot del perfil del candidato (rating/distancia al momento), y
cualquier campo de "resultado" (se deriva por `JOIN`, §6). Si el análisis
con estas 7 columnas muestra que hace falta más detalle, se agrega
**cuando haga falta**, no por adelantado.

### 8.3 Estrategia de índices

Dos patrones de consulta esperados: "candidatos mostrados para este turno"
(`shift_id`) y "cruzar contra postulaciones/asignación de este trabajador"
(`worker_profile_id`). Un índice compuesto `(shift_id, worker_profile_id)`
cubre el primer patrón directo y sirve de prefijo para el segundo si se
filtra también por turno; si el análisis necesita "todo lo que se le mostró
a este trabajador en un rango de fechas" sin turno conocido, se suma un
índice sobre `(worker_profile_id, shown_at)`. **No se proponen ambos de
entrada** — arrancar con `(shift_id, worker_profile_id)` (el patrón que sí
sabemos que se va a usar, §8.4) y agregar el segundo si el análisis real lo
pide, mismo criterio de "no adelantarse" que el resto del documento.

### 8.4 Estrategia de retención

El valor de esta tabla es **analítico** (medir si el ranking predice
selección), no operacional (no se consulta en el camino caliente de ningún
endpoint de usuario) — coincide con el mismo perfil que `idempotency_keys`
(analítico/técnico, no de negocio en caliente), que ya tiene una política
de limpieza perezosa (`_lazy_cleanup`, 24h TTL, `app/core/idempotency.py`).
Acá el horizonte útil es distinto: para medir "¿se postuló en los días
siguientes a que se lo notificara?" hace falta una ventana de semanas, no
horas. Propuesta: **sin borrado automático en la primera etapa** — a la
escala de la beta (§7, cientos de filas/semana) no hay presión de espacio
que lo justifique, y borrar prematuramente destruye exactamente el dato que
se quiere analizar. Revisar la política (agregar una limpieza tipo
`_lazy_cleanup` con TTL de meses, no horas) **sólo si el volumen real
después de instrumentar lo amerita** — no de antemano.

### 8.5 Qué preguntas responde este diseño mínimo

Con estas 7 columnas + `JOIN` contra `applications`/`shifts` ya existentes:

1. ¿El candidato rankeado #1 se postula más seguido que el #10? (correlación
   rank↔tasa de postulación)
2. ¿El candidato finalmente asignado (`Shift.worker_profile_id`) tenía en
   promedio mejor `rank`/`score` que el resto de los notificados?
3. ¿Cuánto tarda en postularse un candidato notificado, según su rank
   (¿el #1 responde más rápido)?
4. ¿Qué fracción de turnos se cubre con alguien que **ni siquiera estaba**
   en el top notificado (o sea, se postuló por su cuenta viendo el feed,
   sin el aviso)? — señal de si el matching realmente está haciendo el
   trabajo o si el feed abierto alcanza igual.

Lo que **no** responde sin agregar el desglose de sub-scores (deliberado,
§8.2): "¿qué factor específico (distancia vs. reputación) predice mejor la
selección?" — pregunta legítima, pero de una segunda etapa, después de
confirmar con esto que vale la pena invertir en calibrar pesos.

### 8.6 Costo estimado (para cuando se decida implementar)

Migración Alembic nueva (mismo patrón que `0011`-`0021`) + 1 método en
`NotificationRepository`-equivalente o un repositorio propio chico +
2-3 líneas en `_notify_nearby_workers()` (guardar antes del loop de
notificaciones, no dentro — un solo `bulk insert`) + tests. Estimado
**4-6 horas**, sin tocar el algoritmo de scoring ni el contrato de
`/shifts/{id}/candidates`. No se implementa en este documento —
queda para cuando Julieta lo apruebe explícitamente.
