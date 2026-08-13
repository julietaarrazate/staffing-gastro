# ETAPA1_QUALITY_REVIEW.md — Revisión de calidad: métricas y business events

> Pedido explícito de Julieta antes de mergear PR #215: validar que las 5
> métricas nuevas y los 9 business events significan **exactamente** lo que
> sus nombres sugieren, con evidencia de código línea por línea — no una
> relectura superficial. Metodología: cada afirmación cita archivo:línea del
> commit real de la rama `claude/observability-product-analytics`. Ningún
> hallazgo de este documento agrega infraestructura ni tablas nuevas; el
> único cambio de código que motivó es un **rename** (§1.4).

---

## 1. Las 5 métricas — definición exacta, numerador, denominador, ejemplo

### Marco común a las 5

- **Fuente de datos:** todas se calculan en `AdminService.get_stats()`
  (`admin/application/services.py`), llamado por `GET /admin/stats`.
- **Período temporal: NINGUNA tiene ventana de tiempo.** Las 5 son
  agregados **all-time** (desde que existe la fila en la tabla hasta ahora),
  sin `WHERE created_at > ...` ni límite de filas. Esto es distinto de
  `avg_time_to_fill_minutes`/`pct_filled_under_10_min` (las métricas
  *preexistentes*, no tocadas en esta PR), que sí acotan a
  `list_recently_filled(limit=500)` — las 500 coberturas más recientes. Es
  una asimetría real entre las métricas viejas y las nuevas: **ninguna de
  las 5 nuevas es "reciente", las 5 son "desde el principio de los
  tiempos"**. A medida que la plataforma crezca, un mes malo se diluye entre
  meses buenos y la métrica se vuelve cada vez menos sensible a cambios
  recientes. No se corrige acá (agregar ventana temporal es un cambio de
  alcance, no de nombre) — se deja documentado como limitación conocida.
- **`sample_size`:** en las 5, es el **denominador** de la tasa — no una
  muestra aleatoria ni un subconjunto: es el conteo completo de casos
  elegibles. Se expone por separado para que nadie lea un `%` sin saber
  sobre cuántos casos se calculó (mismo criterio que `coverage_sample_size`,
  ya existente).

---

### 1.1 `shift_fill_rate_pct` → ✅ CORREGIDO: separado en `shift_assignment_rate_pct` + `shift_completion_rate_pct`

> **Actualización (2026-08-13, misma revisión):** el hallazgo de abajo se
> corrigió — ya no queda pendiente de decisión. `shift_fill_rate_pct` se
> **eliminó** del contrato (la PR seguía sin mergear, mismo criterio que el
> rename de `worker_repeat_rate` en §1.4) y se reemplazó por **dos**
> métricas con semántica separada, usando únicamente estados que ya existen
> en `ShiftStatus` (`FINALIZADO`/`PAGADO`, `Shift.finish()`/`mark_paid()`)
> — ningún estado nuevo, sin migración:
>
> - **`shift_assignment_rate_pct`** = exactamente la fórmula de abajo (sin
>   cambios) — "¿el matching encontró a alguien alguna vez?". Mismo
>   `sample_size` (denominador = `published`).
> - **`shift_completion_rate_pct`** (nueva) = `COUNT(status IN
>   ('finalizado','pagado')) / published` — "¿terminó cubierto y trabajado
>   de punta a punta?". El ejemplo de abajo, con esta métrica nueva, da
>   `completed = 1` (sólo A) → **`shift_completion_rate_pct = 20%`** —
>   exactamente el número que el análisis original señalaba como "el
>   correcto" en el párrafo de abajo.
>
> Verificado con un test dedicado
> (`test_admin_stats_shift_completion_rate_differs_from_assignment_rate`,
> `backend/tests/test_admin.py`) que arma a propósito un turno
> asignado→no-show→cancelado (cuenta para assignment, no para completion) y
> uno completado de punta a punta (cuenta para ambas). El análisis original
> queda abajo sin editar — es la evidencia que motivó la corrección.

**Código:** `shift/infrastructure/repositories.py::count_publication_stats()`.

```sql
published = COUNT(*) WHERE published_at IS NOT NULL
filled    = COUNT(*) WHERE published_at IS NOT NULL AND first_assigned_at IS NOT NULL
rate = filled / published * 100
```

- **Numerador:** turnos cuyo `first_assigned_at` no es `NULL` — es decir,
  turnos que **alguna vez** tuvieron un trabajador asignado.
- **Denominador:** turnos que alguna vez se publicaron (`published_at` no
  `NULL`), sin importar su estado actual.
- **Excluidos:** turnos en `BORRADOR` (nunca publicados) no entran ni al
  numerador ni al denominador. Turnos publicados **antes** de la migración
  `0020` (2026-08-02) tampoco: `published_at` quedó `NULL` para ellos (sin
  backfill, documentado ya en `PlatformStats` — no es un hallazgo nuevo).
- **`shift_fill_rate_sample_size`** = `published` (el denominador).

**⚠️ Hallazgo — el nombre sugiere más de lo que mide:**
`Shift.assign()` (`shift/domain/entities.py:154-168`) documenta
explícitamente: *"`first_assigned_at` sólo se completa la PRIMERA vez (no se
pisa en una reasignación posterior a un rechazo/no-show)"*. Esto significa
que **un turno que se asignó, el trabajador no se presentó, y el comercio
terminó cancelándolo sin cubrirlo nunca — cuenta como "filled"** en esta
métrica, porque en algún momento tuvo un `first_assigned_at`. La métrica
mide **"¿el matching encontró a alguien dispuesto a decir que sí, al menos
una vez?"** (una señal real y útil — mide si el algoritmo de matching
funciona), **no** "¿el turno terminó cubierto/trabajado exitosamente?" (que
sería la lectura natural de "fill rate" para alguien de negocio).

**Ejemplo concreto (5 turnos):**

| Turno | `published_at` | `first_assigned_at` | Estado final real |
|---|:---:|:---:|---|
| A | ✅ | ✅ (día 1, 8 min después) | `PAGADO` (se completó de punta a punta) |
| B | ✅ | ✅ (día 1, 20 min después) | `CANCELADO` (el asignado hizo no-show, el comercio canceló sin reasignar) |
| C | ✅ | ❌ | `CANCELADO` (nadie se postuló nunca) |
| D | ✅ | ✅ (día 3) | `BUSCANDO_PERSONAL` (el asignado rechazó; sigue abierto hoy) |
| E | ✅ | ❌ | `PUBLICADO` (todavía abierto, sin nadie) |

`published = 5`, `filled = 3` (A, B, D) → **`shift_fill_rate_pct = 60%`**.

De esos 3, sólo **A** realmente terminó con alguien trabajando y cobrando.
B está cancelado sin cobertura real; D sigue sin trabajador confirmado hoy.
Un lector que interprete "60% de fill rate" como "60% de los turnos se
cubrieron exitosamente" **se equivoca** — el número real de turnos
completados exitosamente en este ejemplo es 1/5 = 20%.

**¿Representa correctamente el concepto de negocio "shift_fill_rate"?**
**No exactamente.** Mide un concepto real y útil (tasa de "match
encontrado"), pero el nombre invita a leerlo como tasa de cobertura
exitosa. **Recomendación (no aplicada todavía, a la espera de tu decisión):**
renombrar a `shift_first_match_rate_pct` (o similar) **o** agregar una
segunda métrica `shift_completed_rate_pct` = `COUNT(status IN (FINALIZADO,
PAGADO)) / published` que sí mida cobertura exitosa de punta a punta. No lo
apliqué porque cambia el contrato de la API (rompe lo que ya mergué en
#215) y quiero tu confirmación antes de tocarlo de nuevo.

---

### 1.2 `application_to_acceptance_rate_pct`

**Código:** `application/infrastructure/repositories.py::count_application_stats()`.

```sql
total    = COUNT(*)
accepted = COUNT(*) WHERE status = 'aceptada'
rate = accepted / total * 100
```

- **Numerador:** postulaciones con `status = ACEPTADA` (estado terminal,
  ver `ShiftApplication.accept()`, sólo alcanzable desde `PENDIENTE`).
- **Denominador:** **todas** las postulaciones alguna vez creadas, sin
  filtrar por estado. `ApplicationStatus` tiene 4 valores (no 3 como
  documenté originalmente en la PR — corregido acá):
  `PENDIENTE`, `ACEPTADA`, `RECHAZADA`, `RETIRADA`
  (`application/domain/value_objects.py`).
- **Excluidos:** ninguno — el denominador mezcla las 4 categorías.
- **`application_acceptance_sample_size`** = `total`.

**⚠️ Hallazgo — el denominador mezcla 3 cosas distintas:** una postulación
`PENDIENTE` (turno todavía sin decidir — el resultado literalmente no
existe todavía), una `RECHAZADA` (el comercio eligió a otro) y una
`RETIRADA` (el propio trabajador se arrepintió) cuentan igual en el "no
aceptado" implícito del denominador. Esto tiene dos efectos:
1. Postulaciones a turnos recién publicados y todavía abiertos (con
   aplicantes en `PENDIENTE`) **bajan artificialmente** la tasa — no porque
   el comercio haya rechazado a nadie, sino porque el proceso no terminó.
2. `RETIRADA` no es una señal de "el matching falló" — es una decisión del
   trabajador, a veces por razones ajenas al match (cambió de planes).
   Mezclarla con `RECHAZADA` combina "el comercio no te quiso" con "vos no
   quisiste" bajo una sola tasa.

**Ejemplo concreto (7 postulaciones):**

| # | Status |
|---|---|
| 1 | `ACEPTADA` |
| 2 | `RECHAZADA` |
| 3 | `RECHAZADA` |
| 4 | `PENDIENTE` (turno abierto, sin decidir todavía) |
| 5 | `RETIRADA` (el trabajador se arrepintió) |
| 6 | `ACEPTADA` |
| 7 | `PENDIENTE` |

`total = 7`, `accepted = 2` → **`application_to_acceptance_rate_pct = 28.6%`**.

Si se excluyeran las `PENDIENTE` (#4, #7) del denominador —porque su
resultado literalmente no existe todavía—, la tasa sobre las 5 resueltas
sería `2/5 = 40%`, un número bastante distinto.

**¿Representa correctamente "application_to_acceptance_rate"?**
**El nombre es razonablemente honesto** (es literalmente "de todas las
postulaciones, cuántas terminaron aceptadas"), pero **el resultado no es
comparable entre ventanas de tiempo distintas** si la proporción de
`PENDIENTE` varía (p. ej., medirla un lunes con muchos turnos recién
publicados da un número más bajo que medirla un viernes con la mayoría ya
resuelta) — no por cambios reales en calidad de matching, sino por el
momento de la medición. **Recomendación:** documentar la limitación (hecho,
acá) y considerar excluir `PENDIENTE` del denominador en una iteración
futura, si se decide que la tasa debe reflejar "calidad de conversión" y no
"snapshot del funnel en un instante". No aplicado todavía.

---

### 1.3 `no_show_rate_pct`

**Código:** `worker/infrastructure/repositories.py::count_engagement_stats()`.

```sql
completed_total     = SUM(worker_profiles.events_completed)
cancellations_total = SUM(worker_profiles.cancellations)
no_shows_total       = SUM(worker_profiles.no_shows)
sample_size = completed_total + cancellations_total + no_shows_total
rate = no_shows_total / sample_size * 100
```

- **Numerador:** suma de `no_shows` de **todos** los perfiles de
  trabajador — cada no-show real incrementa el contador de un worker
  exactamente una vez (`WorkerProfileRepository.record_no_show`,
  disparado únicamente por `ShiftService.mark_no_show`).
- **Denominador:** suma de los 3 contadores — representa el total de
  **compromisos resueltos** de trabajadores (turnos completados +
  cancelados por el trabajador + no-shows), sea cual sea el resultado.
- **Excluidos correctamente:** turnos en curso (asignado/confirmado, sin
  resolver todavía) no suman a ningún contador — no se cuentan ni a favor
  ni en contra hasta que se resuelven. Cancelaciones **del comercio**
  (`cancel_shift`) tampoco tocan estos contadores del trabajador (van a
  `CompanyProfile.late_cancellations`, otra tabla) — correcto: el
  trabajador no debe cargar con una cancelación que no fue suya. Un
  trabajador que **rechaza** una asignación antes de confirmar
  (`reject_assignment`) tampoco suma nada acá — nunca llegó a
  comprometerse (ver `docs/reference/REPUTATION.md`).
- **`no_show_sample_size`** = el denominador de arriba.

**Ejemplo concreto (4 trabajadores):**

| Worker | `events_completed` | `cancellations` | `no_shows` |
|---|:---:|:---:|:---:|
| W1 | 5 | 0 | 1 |
| W2 | 2 | 1 | 0 |
| W3 | 0 | 0 | 2 |
| W4 | 10 | 0 | 0 |

`no_shows_total = 3`, `sample_size = 17 + 1 + 3 = 21` → **`no_show_rate_pct = 14.3%`**.

**¿Representa correctamente "no_show_rate"?** **Sí, con precisión** — es la
métrica mejor calibrada de las 5: numerador y denominador son consistentes
(ambos cuentan "eventos de compromiso resueltos"), la exclusión de
compromisos en curso es correcta, y el nombre describe exactamente lo que
mide. Único caveat compartido con las otras 4: es all-time, sin ventana.

---

### 1.4 `worker_completion_repeat_rate_pct` (renombrada — antes `worker_repeat_rate_pct`)

**Código:** `worker/infrastructure/repositories.py::count_engagement_stats()`
(mismo método que 1.3).

```sql
workers_1plus = COUNT(worker_profiles WHERE events_completed >= 1)
workers_2plus = COUNT(worker_profiles WHERE events_completed >= 2)
rate = workers_2plus / workers_1plus * 100
```

- **Numerador:** trabajadores con `events_completed >= 2` — completaron el
  ciclo entero (`confirmar → check-in → check-out → finalizar`,
  `ShiftService.finish`) al menos dos veces, en toda su historia.
- **Denominador:** trabajadores con `events_completed >= 1`.
- **Excluidos — el hallazgo central de esta revisión:** un trabajador que
  se registró, completó su perfil, se postuló a 10 turnos y nunca fue
  elegido tiene `events_completed = 0` — **no entra en el denominador**.
  No cuenta como "no repite": directamente no existe para esta métrica.
  Tampoco cuenta un trabajador con no-shows/cancelaciones pero cero
  turnos completados (ver W3 del ejemplo de 1.3, abajo se reusa).
- **`worker_completion_repeat_sample_size`** = `workers_1plus`.

**Confirmación del pedido explícito de Julieta:** *"worker_repeat_rate"* tal
como estaba nombrada **NO es "% de trabajadores que vuelven a usar Oído"**.
La diferencia:

| Concepto | Qué necesitaría medirse |
|---|---|
| `worker_completion_repeat_rate_pct` (esta métrica, ya implementada) | De los que **completaron** ≥1 turno, ¿qué % completó un 2do? |
| "% de trabajadores que vuelven a usar Oído" (retención real) | De **todos los que se registraron/postularon alguna vez**, ¿qué % volvió a abrir la app / postularse / ser asignado en una ventana de tiempo (p. ej. 30 días)? |

La segunda necesitaría: (a) una definición de "actividad" más amplia que
"completó un turno" (login, postulación, etc. — hoy no hay tracking de
sesiones/logins más allá del JWT efímero), y (b) una ventana temporal
(retención SIEMPRE se mide con ventana — "volvió dentro de N días" — nunca
all-time). Ninguna de las dos cosas existe hoy en el esquema sin agregar
columnas nuevas.

**Acción tomada (no sólo documentada — aplicada en esta misma revisión,
antes del próximo commit):** renombré el campo público de
`worker_repeat_rate_pct`/`worker_repeat_sample_size` a
**`worker_completion_repeat_rate_pct`/`worker_completion_repeat_sample_size`**
en `PlatformStats` (dtos), `PlatformStatsResponse` (schema HTTP),
`AdminService.get_stats()` y los tests de `test_admin.py`. Elegí renombrar
en vez de sólo documentar porque dejar `worker_repeat_rate` público en la
API HTTP invita exactamente a la lectura equivocada que señalaste — un
consumidor futuro del endpoint (dashboard, otro desarrollador) no
necesariamente va a leer este documento antes de usar el campo. **Si
preferís otro nombre o revertir el rename, es un cambio de una línea en 4
archivos — decime y lo ajusto.**

**Ejemplo concreto (mismos 4 workers de 1.3):**

`workers_1plus = 3` (W1, W2, W4 — **W3 queda afuera**, tiene 0 completados
pese a sus 2 no-shows), `workers_2plus = 2` (W1, W4) →
**`worker_completion_repeat_rate_pct = 66.7%`**.

Si la pregunta de negocio fuera "¿qué % de los 4 trabajadores que
interactuaron con la plataforma volvió a tener actividad?", la respuesta
correcta sería sobre una base de 4 (todos tuvieron al menos un evento,
completado o no), no de 3.

---

### 1.5 `employer_repeat_rate_pct`

**Código:** `company/infrastructure/repositories.py::count_engagement_stats()`.

```sql
companies_1plus = COUNT(company_profiles WHERE events_published >= 1)
companies_2plus = COUNT(company_profiles WHERE events_published >= 2)
rate = companies_2plus / companies_1plus * 100
```

- **Numerador:** comercios con `events_published >= 2` — publicaron 2+
  turnos en su historia.
- **Denominador:** comercios con `events_published >= 1`.
- **Excluidos:** comercios que crearon perfil pero nunca publicaron
  (`events_published = 0`) no entran al denominador.
- **`employer_repeat_sample_size`** = `companies_1plus`.

**Diferencia importante con 1.4 (asimetría real, no un error):**
`events_published` se incrementa en **cada** transición
`BORRADOR→PUBLICADO` (`CompanyProfileRepository.record_published_shift`,
disparado por `ShiftService.publish_shift`), **sin importar si el turno
después se cubre o no**. Publicar es una acción de un solo paso, unilateral
del comercio — mucho más cercana a "usar el producto" que "completar un
turno" (que depende de que otra persona coopere, dure horas, y pase por 6
transiciones de estado). Por eso `employer_repeat_rate_pct`, sin
necesidad de renombrar, **sí se acerca razonablemente** a un proxy de
recurrencia de uso — aunque sigue siendo all-time (sin ventana) y sigue
excluyendo comercios con cero publicaciones.

**Ejemplo concreto (3 comercios):**

| Comercio | `events_published` |
|---|:---:|
| E1 | 4 |
| E2 | 1 |
| E3 | 0 (creó perfil, nunca publicó) |

`companies_1plus = 2` (E1, E2 — **E3 afuera**), `companies_2plus = 1` (E1) →
**`employer_repeat_rate_pct = 50%`**.

**¿Representa correctamente "employer_repeat_rate"?** **Razonablemente
sí**, con el caveat de "all-time, sin ventana" compartido por las 5 y la
exclusión de comercios con cero publicaciones (que sí podría discutirse si
"repeat" debería partir de "se registró", no de "publicó por primera vez" —
pero esa es una pregunta de producto sobre onboarding, no de definición de
la métrica en sí).

---

## 2. Business events — auditoría de emisión

### Marco común

**Hallazgo transversal #1 — orden de escritura vs. commit:** los 4
repositorios tocados (`ShiftRepository`, `ShiftApplicationRepository`,
`WorkerProfileRepository`, `CompanyProfileRepository`) hacen
`await self._session.commit()` **dentro** de cada método `update()`/`add()`
individual (confirmado leyendo las 4 implementaciones). **Los 9 eventos
están todos ubicados DESPUÉS del `await ...update()/add()` correspondiente**
— verificado línea por línea en la tabla de abajo. Esto significa: **si el
`commit()` falla (excepción), la excepción se propaga antes de llegar a la
línea del `logger.info(...)` — el evento nunca se emite para una escritura
que no se persistió.** No hay ningún caso, de los 9, donde el log se emita
antes del commit.

**Hallazgo transversal #2 — no hay una única transacción por caso de uso:**
esto **no es nuevo de esta PR** — ya está catalogado en
`docs/audits/2026-08-oido/04_PERFORMANCE.md §1.5` ("commit por repositorio,
no por caso de uso"). Consecuencia para los eventos: en un flujo con
múltiples pasos (p. ej. `assign_worker` → `_accept_application` →
`_reject_pending_applicants`, 3 commits independientes), **no existe un
"rollback" que pueda deshacer un paso anterior ya commiteado si un paso
posterior falla**. Si `_reject_pending_applicants` fallara a mitad de su
loop (2do de 3 rechazos), los primeros 2 `UPDATE`s ya están commiteados
en la base — no hay nada que "revertir". El caso "evento logueado pero
luego hay rollback" **no puede ocurrir** con la arquitectura actual, porque
no hay una transacción envolvente que revierta lo ya commiteado. Lo que sí
puede pasar es lo inverso: un paso intermedio se commitea sin que su
evento se llegue a loguear (ver `_reject_pending_applicants` abajo).

**Hallazgo transversal #3 — doble emisión bajo carrera concurrente (no
introducido por esta PR, preexistente):** ningún `get_by_id`/`_get_owned`
usa `SELECT ... FOR UPDATE` ni hay columna de versión para locking
optimista (confirmado: `_get_owned` en `shift/application/services.py:887-892`
es un `SELECT` plano). Dos requests **verdaderamente concurrentes** al
mismo turno (p. ej. dos intentos de `assign_worker` a distintos
trabajadores, llegando al mismo tiempo) podrían ambos leer el estado
pre-transición, ambos pasar el guard de dominio (`Shift.assign()` valida en
memoria, no en la base), y ambos commitear — el último commit gana en la
fila, pero **ambos** ya ejecutaron su `logger.info("shift.assigned", ...)`
antes de eso. Es un escenario de carrera genuino, ya presente en el código
antes de esta PR (afecta cualquier mutación, no sólo el logging) — se
documenta acá porque es la respuesta honesta a "¿puede emitirse dos veces
por la misma transición?", pero no es un defecto introducido por los
eventos en sí.

**Contra retries/dobles clicks normales (no carrera):** los endpoints de
`shift` (`publish`, `cancel`, `assign`, `no-show`) y `apply`/`withdraw`
están protegidos por `Depends(idempotent)`
(`RecorderDep`, confirmado en cada handler de `shift/api/routes.py`). Con
`Idempotency-Key`, un reintento devuelve la respuesta cacheada **sin
re-ejecutar el handler** — cero riesgo de doble emisión. Sin
`Idempotency-Key` (modo *grace*), un reintento sí re-ejecuta el handler,
pero el **guard de estado del dominio** (`Shift._transition`,
`ApplicationStatus` checks) rechaza la segunda ejecución con una excepción
ANTES de llegar al `.update()`/log — porque el estado ya cambió en el
primer intento. Doble emisión por reintento simple: **no**, salvo el
escenario de carrera genuino del punto anterior.

### Tabla evento por evento

| Evento | Archivo:línea | ¿Después del commit? | ¿Doble emisión posible? | `data` |
|---|---|:---:|---|---|
| `shift.published` | `shift/application/services.py:205-208` | ✅ (línea 201 `update()`) | No por retry (guard `BORRADOR→PUBLICADO`); sí por carrera genuina (ver arriba) | `shift_id`, `company_id` |
| `shift.escalated` | `shift/application/services.py:317` | ✅ (línea 312 `update()`) | No por retry (lo dispara sólo el scheduler, 1 vez por `escalated_at IS NULL`); no aplica carrera (proceso único) | `shift_id` |
| `shift.cancelled` | `shift/application/services.py:374-381` | ✅ (línea 373 `update()`) | No por retry (guard `is_terminal`); sí por carrera si dos cancelaciones simultáneas (idempotente en efecto — el turno queda `CANCELADO` una sola vez, pero el log podría duplicarse) | `shift_id`, `company_id`, `was_committed` (bool) |
| `shift.assigned` | `shift/application/services.py:501-508` | ✅ (línea 500 `update()`) | No por retry; sí por carrera (dos `assign` a distinto worker, ver Hallazgo #3) | `shift_id`, `worker_profile_id`, `company_id` |
| `application.accepted` | `shift/application/services.py:531-534` | ✅ (línea 530 `update()`) | No por retry (guard `PENDIENTE`); depende de la carrera de arriba si aplica | `shift_id`, `worker_profile_id` |
| `application.rejected` | `shift/application/services.py:557-560` | ✅ (después del loop completo de `update()`, línea 551) | **Agregado, no por-fila** — un solo log con `count` al final del loop. Si el loop falla a mitad (2 de 3 rechazos commiteados), el log **no se emite** (asimetría: estado parcial sin evento) | `shift_id`, `count` (int) |
| `worker.no_show` | `shift/application/services.py:420-429` | ✅ (línea 419 `update()`) | No por retry (guard `CONFIRMADO/EN_CAMINO`); `trigger` distingue manual (comercio) de automático (scheduler) | `shift_id`, `worker_profile_id`, `trigger` (`"manual"`\|`"automatic"`) |
| `application.submitted` | `application/application/services.py:67-70` | ✅ (línea 64 `add()`) | No — `AlreadyAppliedError` bloquea una 2da postulación del mismo trabajador al mismo turno **antes** de llegar acá (chequeo explícito líneas 58-62) | `shift_id`, `worker_profile_id` |
| `application.withdrawn` | `application/application/services.py:149-155` | ✅ (línea 148 `update()`) | No por retry (guard `PENDIENTE`) | `shift_id`, `worker_profile_id` |

### PII, tokens, secretos, coordenadas

**Confirmado — ninguno de los 9 eventos incluye:** contraseñas, tokens
(JWT/refresh/Idempotency-Key), emails, nombres completos, coordenadas
geográficas, ni ningún dato del body del request. Los únicos campos usados
en los 9 `extra=` son: `shift_id`, `company_id`, `worker_profile_id` (los 3
son UUIDs — identificadores internos, no información personal en sí
mismos), `was_committed`/`trigger` (booleano/string de estado interno), y
`count` (entero). Es el mismo criterio que ya aplica
`app/core/idempotency.py` en su propio logging (loguea `path`/`method`/
`user_id`, nunca el body). **No hace falta ningún cambio** — confirmado por
inspección directa de cada línea de la tabla de arriba, no por inferencia.

### Sobre "event store"

Confirmado: **no se introdujo ningún concepto de event store.** Los 9
`logger.info(...)` son exactamente lo que dice `docs/reference/EVENTS.md`
que ya existe en el repo — *"efectos que el propio servicio produce de
forma sincrónica dentro del caso de uso"* — con la única adición de que
ahora también generan una línea de log JSON, además de la mutación de
estado que ya hacían. No hay tabla de eventos, no hay replay, no hay
consumidor async, no hay garantía de entrega — son observability/product
analytics sobre logs de proceso (stdout de Render), tal como pedía el
prompt original de la Etapa 1.

---

## 3. Matching quality — propuesta de medición (producto, no código)

Ver la sección nueva agregada a
[`MATCHING_QUALITY_ANALYSIS.md §9`](./MATCHING_QUALITY_ANALYSIS.md#9-propuesta-de-medición-no-implementar-todavía) —
no se duplica acá para mantener un solo lugar de verdad sobre matching.

---

## 4. Estado de CI de la PR #215 (verificado 2026-08-13, commit `1ace587`)

| Check | Estado | Nota |
|---|---|---|
| Backend (pytest) | ✅ `success` | 369 tests |
| Frontend (tsc + build) | ⏭️ `skipped` | Correcto — `dorny/paths-filter` no detectó cambios en `frontend/**` (esta PR es 100% backend + docs) |
| E2E (Playwright) | ⏭️ `skipped` | Mismo motivo — depende del job frontend |
| Detectar cambios | ✅ `success` | |
| Vercel (deploy preview) | ✅ `success` | Deploy del frontend sin cambios, como esperado |

**No hay ningún check obligatorio en rojo ni pendiente.** Los `skipped` de
frontend/E2E son el comportamiento correcto del path-filtering
(`.github/workflows/ci.yml`), no una falla — no hay nada que arreglar.

Con el rename de §1.4 aplicado después de este chequeo, corrí de nuevo
`pytest tests/test_admin.py` localmente (15/15 verde) — el próximo push
disparará CI de nuevo sobre el commit nuevo; se reporta cuando termine.

---

## Resumen ejecutivo

- **Las 4 métricas restantes están bien calibradas** (`no_show_rate`,
  `application_to_acceptance_rate` con el caveat de `PENDIENTE`/`RETIRADA`
  documentado, `employer_repeat_rate`, y la ya renombrada
  `worker_completion_repeat_rate`). Ninguna tiene bugs de cálculo — los 4
  `SUM(CASE...)`/`COUNT(...)` están matemáticamente correctos para lo que
  dicen medir.
- **`shift_fill_rate` → ✅ CORREGIDO**, separada en dos métricas
  (§1.1): `shift_assignment_rate_pct` (la fórmula original, sin cambios —
  "encontró un match alguna vez") y `shift_completion_rate_pct` (nueva —
  "terminó cubierto/trabajado de punta a punta", usando `FINALIZADO`/
  `PAGADO`, estados ya existentes del dominio, sin migración). Test
  dedicado que arma un caso asignado→no-show→cancelado (queda fuera de
  completion) y uno completado de punta a punta.
- **`worker_repeat_rate` → renombrada a `worker_completion_repeat_rate`**
  (código + tests ya actualizados). Documentado explícitamente que NO es
  retención general de trabajadores — es recurrencia de COMPLETACIÓN entre
  quienes ya completaron ≥1 turno.
- **370/370 tests backend verdes**, `ruff` limpio en todos los archivos
  tocados.
- **Los 9 business events están limpios**: siempre después del commit
  correspondiente, sin PII/secretos/coordenadas, sin concepto de event
  store. Único riesgo real de doble emisión es una carrera concurrente
  genuina (preexistente en la arquitectura, no introducida por los
  eventos) — documentado, no oculto.
- **CI de la PR: verde**, sin acción pendiente.
