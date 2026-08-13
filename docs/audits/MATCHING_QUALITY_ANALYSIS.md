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

---

## 9. Propuesta de medición (NO implementar todavía)

> Pedido explícito de Julieta (revisión de Etapa 1, 2026-08-13): antes de
> diseñar `match_log` como tabla, responder 10 preguntas de **producto y
> medición** — no de código. Este apartado no toca `§8` (el diseño mínimo
> ya está ahí, sigue vigente si se decide avanzar); responde el **por qué**
> y el **con qué cuidado**, no el **cómo**.

### 9.1 ¿Cuál es exactamente la hipótesis que queremos validar?

*"El orden en que el motor de matching prioriza candidatos (score
descendente) predice, mejor que el azar, quién termina postulándose y
siendo elegido para el turno."* Es una hipótesis comparativa (mejor que
azar), no absoluta ("el score es correcto") — porque no hay una definición
independiente de "candidato ideal" contra la cual comparar; el único
benchmark disponible es "¿ordenar por score hace algo, o daría lo mismo
ordenar al azar?".

### 9.2 ¿Qué significa "matching correcto" para Oído?

No es sólo "ranking preciso" en abstracto. Atado a `PRINCIPLES.md #1`
("cubrir un turno en < 10 minutos"), un matching correcto tiene **dos
dimensiones**, no una:

1. **Velocidad:** ¿el candidato de mayor score ayuda a cubrir más rápido?
2. **Calidad del resultado:** ¿el candidato que el ranking favoreció
   efectivamente se presenta y completa el turno (no termina en no-show)?

Un matching que "encuentra rápido" pero prioriza candidatos con alta tasa
de no-show histórica **no sería correcto** aunque acelere la métrica de
`time_to_cover` — cubriría rápido con la persona equivocada. Las dos
dimensiones pueden estar en tensión (el candidato más cercano —mayor peso,
0.30— no es necesariamente el más confiable) y una medición de calidad
tiene que poder detectar esa tensión, no sólo optimizar por velocidad.

### 9.3 ¿Cuál debería ser el outcome observable?

Hay una cadena de eslabones observables, de más rápido/ruidoso a más
lento/preciso:

```
match.generado (score calculado) → notificado → postulado → asignado
    → confirmado → completado (sin no-show)
```

Cada eslabón es un outcome válido para una pregunta distinta — no hay un
único "el" outcome correcto; depende de qué se quiera aprender (§9.4).

### 9.4 ¿`score → application`, `score → acceptance`, o `score → shift covered`?

Las tres miden cosas distintas, ninguna es "la incorrecta":

| Correlación | Qué mide realmente | Limitación |
|---|---|---|
| `score → application` | ¿El candidato notificado con score alto tiene más probabilidad de postularse? Mide si el matching alcanza a gente con interés/disponibilidad real. | No dice nada sobre si esa persona es *buena* — sólo si responde. |
| `score → acceptance` | ¿El comercio, entre los postulantes, tiende a elegir a los de mayor score? | Mezcla la señal del algoritmo con el criterio humano del comercio (fotos, chat, "feeling") — no aísla si el score en sí predice buen desempeño. |
| `score → shift covered (sin no-show)` | ¿El candidato que el ranking favoreció efectivamente completó el turno? | El outcome más cercano al negocio real, pero el más lento de observar (hay que esperar el ciclo completo) y el más ruidoso (influido por variables fuera del matching: pago, clima, imprevistos). |

### 9.5 ¿Cuál de esos outcomes es el verdadero KPI?

**Ninguno solo alcanza.** El KPI de negocio ya existe y es compuesto
(`shift_assignment_rate` + `shift_completion_rate` + `avg_time_to_fill_minutes`
+ `no_show_rate`, ya implementados en Etapa 1 — no son parte de este
documento). Para la
calidad del **matching específicamente**:

- **Proxy rápido (seguimiento semanal):** `score → application`. Se
  resuelve en minutos/horas, alto volumen, permite iterar rápido.
- **KPI de validación real (revisión mensual/trimestral, cuando haya
  volumen):** `score → shift covered sin no-show`. Es lento y de bajo
  volumen al principio, pero es el que realmente le importa al negocio —
  un matching que atrae postulantes rápido pero termina en no-shows no
  está cumpliendo su función.

No se recomienda elegir uno solo de forma permanente: son horizontes
temporales distintos del mismo problema.

### 9.6 ¿Qué sesgos introduciría guardar sólo los candidatos que el algoritmo muestra?

**Este es el punto más importante de todo el análisis.** Guardar únicamente
el top-N mostrado/notificado (§8.1: `NEARBY_NOTIFICATION_LIMIT=10`/
`ESCALATION_NOTIFICATION_LIMIT=20`) introduce un **sesgo de selección
clásico (survivorship bias)**: nunca sabremos cómo se hubiera comportado un
candidato de rank 15 que nunca fue mostrado — no hay grupo de comparación.
Concretamente, si el análisis encontrara que "los candidatos de mayor score
se postulan más", **no podríamos distinguir dos explicaciones opuestas**:

1. El score realmente identifica mejores candidatos (más disponibles, más
   cerca, más interesados).
2. Los candidatos de mayor score simplemente **reciben más oportunidades**
   (son los únicos notificados) — es un efecto de exposición, no de
   calidad del ranking. Un candidato de rank 20 podría ser igual de bueno
   pero nunca se entera de que el turno existe.

Sin resolver esto (§9.7), cualquier conclusión de "el matching funciona"
sacada de `match_log` sería, en el mejor de los casos, parcial — hay que
documentarlo como limitación explícita del análisis, no como algo a
ocultar.

### 9.7 ¿Cómo medir calidad sin contaminar el matching actual?

Dos caminos, con costos muy distintos:

- **Observación pasiva** (lo que propone `match_log`, §8): loguear qué se
  muestra sin cambiar el algoritmo ni el orden. No contamina nada — es
  puramente un espejo de lo que ya pasa. **Limitación:** hereda el sesgo de
  selección de §9.6 sin resolverlo.
- **Experimentación (A/B con orden aleatorizado para un grupo de control)**:
  resolvería el sesgo de §9.6 de forma rigurosa, pero significa que una
  fracción de turnos reales reciba **a propósito** un matching peor
  (aleatorio) durante el experimento — un costo real y directo contra la
  meta central del producto (`PRINCIPLES.md #1`, cubrir en <10 min) en una
  etapa de **beta cerrada con usuarios reales**. Con el volumen actual
  (decenas de turnos/semana), un experimento así tendría además poca
  potencia estadística — no alcanzaría a detectar diferencias reales antes
  de acumular meses de datos.

**Recomendación de esta pregunta:** sólo observación pasiva por ahora. La
experimentación con grupo de control es una herramienta legítima, pero su
costo (turnos peor cubiertos a propósito) no se justifica a esta escala ni
en esta etapa del producto. Se documenta la limitación de sesgo, no se
resuelve con un experimento todavía.

### 9.8 ¿Guardar todos los matches o una muestra/ventana?

**Todos los automáticos** (no los de `/candidates` bajo demanda, ya
excluidos en §8.1), sin muestreo. El volumen ya estimado en §7 es acotado
por diseño (≤30 filas/turno) y trivial en cualquier escenario realista de
crecimiento (§9.10). Muestrear agregaría complejidad (¿cómo se decide qué
muestrear sin introducir OTRO sesgo?) sin resolver ninguna necesidad real a
este volumen — se justificaría recién en un escenario de miles de turnos
por día, muy lejos de la escala actual.

### 9.9 ¿Qué mínimo conjunto de datos necesitaríamos conservar?

El de §8.2 (`shift_id`, `worker_profile_id`, `rank`, `score`, `trigger`,
`shown_at`) sigue siendo el mínimo correcto **para las preguntas de §9.4/
9.5**. Una tentación al leer §9.6 sería "guardemos también a TODOS los
candidatos elegibles evaluados (no sólo los mostrados), así podemos medir
el sesgo de selección" — **se descarta a propósito**: multiplicaría el
volumen (potencialmente 50-100+ candidatos evaluados por turno, contra
≤10-30 mostrados) sin una hipótesis clara que lo justifique todavía, y
contradice el principio de "mínimo necesario" (regla explícita de Julieta).
El sesgo de selección queda **documentado como limitación conocida** del
análisis (§9.6), no resuelto con más almacenamiento.

### 9.10 Costo aproximado de almacenamiento

Con las 7 columnas de §8.2 (2 UUIDs de referencia + 1 UUID propio + rank
`SMALLINT` + score `FLOAT` + trigger `VARCHAR` corto + timestamp) más el
índice compuesto propuesto en §8.3: **~150-170 bytes por fila** (estimación
conservadora, incluye overhead de fila + índice de Postgres). Con un
promedio conservador de ~15 filas/turno (no todos escalan, así que el
promedio real es menor a las ≤30 del peor caso):

| Turnos publicados | Filas estimadas | Espacio estimado |
|---:|---:|---:|
| 1.000 | ~15.000 | ~2.5 MB |
| 10.000 | ~150.000 | ~25 MB |
| 100.000 | ~1.500.000 | ~255 MB |

**El costo de almacenamiento no es, en ningún escenario realista de
crecimiento a mediano plazo, un argumento válido en contra de
`match_log`.** Si hay un motivo para no implementarlo todavía, no es este
— es el sesgo de selección de §9.6 y la prioridad relativa frente a otro
trabajo.

### 9.11 Recomendación

**B — Persistir un `match_log` mínimo, con dos condiciones explícitas:**

1. El diseño de 7 columnas de §8 (sin sub-scores, sin snapshot de perfil,
   sin campo de "resultado") sigue siendo el correcto — se valida acá, no
   se agranda.
2. **El sesgo de selección de §9.6 se documenta de forma visible junto a
   cualquier dashboard o reporte que use estos datos** — no como nota al
   pie, sino como parte del propio hallazgo ("estos números comparan sólo
   candidatos que el algoritmo ya favoreció; no hay grupo de control").
   Sin esta condición, `match_log` es fácil de mal-leer como "prueba" de
   que el matching funciona, cuando en el mejor de los casos es evidencia
   parcial.

**Por qué no A (no persistir):** el costo es bajo (§9.10, trivial), el
esfuerzo de implementación es bajo (§8.6, 4-6h) y sin este dato **hoy es
literalmente imposible** responder la pregunta que motivó todo este
documento ("¿los candidatos que prioriza el algoritmo son los que terminan
contratados?") — seguir sin medir no es neutral, es siempre responder "no
sabemos" a esa pregunta indefinidamente.

**Por qué no C (alternativa más simple):** se evaluó no encontrar una
alternativa genuinamente más simple que aporte la misma señal — cualquier
cosa más liviana que "loguear qué se mostró" (p. ej. sólo contar cuántas
notificaciones se mandan, sin score ni rank) no permitiría correlacionar
con `applications`/`assignment`, que es el objetivo central. Ir más liviano
que eso deja de responder la pregunta original.

**Se reitera: esta es una recomendación, no una implementación.** Ningún
código de esta sección se escribió — `match_log` sigue sin existir en el
esquema hasta que Julieta lo apruebe explícitamente.
