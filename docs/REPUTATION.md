# REPUTATION.md — Reputación (dominio)

> Cómo se construye y usa la confianza en Staffya. Se apoya en
> [Review](./DOMAIN.md#review--review) y alimenta [MATCHING.md](./MATCHING.md).

## Por qué importa

La reputación es la **moneda del marketplace**: hace que elegir (comercio) y ser
elegido (trabajador) sea seguro, y reemplaza al "boca a boca" informal. Es
bidireccional: comercio y trabajador se califican mutuamente.

## Reseñas (`Review`)

- **Cuándo:** sólo sobre turnos **cerrados** (`finalizado` o `pagado`).
- **Quién:** el comercio y el trabajador **asignado** al turno.
- **Qué:** una calificación de **1 a 5** y un comentario opcional.
- **Unicidad:** una sola reseña por usuario por turno.
- **Efecto:** cada reseña **recalcula el rating promedio** del calificado y le
  genera una notificación (`review_received`).

## Métricas de reputación

### Trabajador
- `rating` — promedio de reseñas recibidas (impacta el matching).
- `punctuality_rate` — tasa de puntualidad. **(R2.4)** se recalcula al
  finalizar cada turno (`ShiftService.finish`,
  `backend/app/modules/shift/application/services.py`) como promedio móvil
  simple sobre los turnos completados: puntual = check-in dentro de **±15
  minutos** del horario pactado (`start_at`). `finish()` sólo es alcanzable
  habiendo pasado por check-in y check-out (ver
  `Shift._transition` en `shift/domain/entities.py`), así que siempre hay un
  check-in real para evaluar.
- `events_completed` — trabajos completados. **(R2.4)** se incrementa en el
  mismo punto (`ShiftService.finish`), un evento por turno finalizado con
  éxito.
- `cancellations` — cancelaciones. **([ADR-0004](./adr/ADR-0004-cancelacion-trabajador-e-insignias.md))**
  se incrementa cuando el trabajador cancela una asignación ya **confirmada**
  (`POST /shifts/{id}/worker-cancel`,
  `WorkerProfileRepository.record_cancellation`). Distinto de `Shift.cancel()`
  (comercio, terminal) y de `reject_assignment()` (trabajador rechaza antes
  de confirmar, no se cuenta como cancelación).
- `no_shows` — no presentado. **([ADR-0007](./adr/ADR-0007-no-show-y-cancelacion-tardia.md))**
  se incrementa cuando el **comercio** marca manualmente que el trabajador
  asignado no se presentó a un turno ya confirmado
  (`POST /shifts/{id}/no-show`, sólo alcanzable desde `CONFIRMADO`/
  `EN_CAMINO`, antes del check-in; `WorkerProfileRepository.record_no_show`).
  **Separado de `cancellations`** a propósito: no aparecer sin aviso es una
  señal peor que cancelar con anticipación, y se pondera distinto (ver
  matching abajo). No es detección automática por horario vencido (eso sigue
  fuera de alcance, requeriría un scheduler — ver `TECH_DEBT.md`): es un
  juicio manual del comercio, igual que "Cancelar".
- `badges` — insignias (catálogo `WorkerBadge`): `nunca_falto`, `top_mozo`,
  `top_bartender`, `eventos_premium`, `perfil_verificado`. **(ADR-0004)**
  otorgamiento automático por reglas — ver abajo. `perfil_verificado` es la
  única que **no** se otorga automáticamente (ver ADR-0004).
- `level` — nivel de gamificación (`bronce`, `plata`, `oro`, `platino`).
  **(ADR-0004)** recalculado por umbrales de `events_completed` + piso de
  `rating` — ver abajo.

### Comercio
- `rating` — promedio de reseñas recibidas.
- `on_time_payment_rate` — tasa de pago a tiempo.
- `events_published` — turnos publicados.
- `late_cancellations` — cancelaciones tardías. **([ADR-0007](./adr/ADR-0007-no-show-y-cancelacion-tardia.md))**
  se incrementa cuando el comercio cancela un turno con el trabajador ya
  **comprometido** (`COMMITTED_STATUSES`: confirmó su asistencia o está en
  pleno ciclo de trabajo) — `ShiftService.cancel_shift` lo detecta
  comparando el estado del turno *antes* de cancelar,
  `CompanyProfileRepository.record_late_cancellation`. Cancelar antes de que
  el trabajador confirme no cuenta: nunca llegó a comprometerse. Efecto
  **simétrico** al `cancellations`/`no_shows` del trabajador — no se mezcla
  con `rating` (que sigue siendo sólo el promedio de reseñas).

## Reglas de negocio

- La reputación es **consecuencia del comportamiento**, no editable a mano.
- El **rating** se actualiza automáticamente con cada reseña.
- La reputación del trabajador **influye directamente en el score de matching**
  (peso 0.25 por reputación + 0.15 por puntualidad + 0.15 por desempeño). El
  desempeño (`_performance_score`) pondera `no_shows` **el doble** que
  `cancellations` en su denominador (`NO_SHOW_PERFORMANCE_WEIGHT = 2`,
  `matching/domain/scoring.py`) — valor semilla conservador y ajustable
  (ADR-0007, mismo criterio que las suscripciones Fase 1: no hay datos
  reales todavía para calibrarlo con precisión).
- **Verificado con un test de integración de punta a punta**
  (`backend/tests/test_full_shift_lifecycle.py`): la reputación calculada
  por una reseña real (`rating`) efectivamente entra al ranking de un turno
  nuevo — dos trabajadores con historial idéntico salvo la reseña recibida
  (5★ vs. 1★) quedan ordenados por esa diferencia en `/shifts/{id}/candidates`.
  Antes de este batch (`PRIMER_TURNO_REAL_SPEC.md`) esto nunca se había
  recorrido de punta a punta con un turno real; el resultado: **ya andaba
  bien**, no hizo falta arreglar el lazo reseña→reputación→ranking.

## Insignias y niveles: reglas de otorgamiento (ADR-0004)

Funciones puras en `worker/domain/rules.py` (`compute_badges`,
`compute_level`), sin DB, recalculadas **desde cero** (sin histéresis) al
finalizar un turno (`ShiftService.finish`), al registrar una cancelación del
trabajador (`ShiftService.worker_cancel`) y al marcar un no-show
(`ShiftService.mark_no_show`, ADR-0007 — ver [SHIFT.md](./SHIFT.md)).

**Insignias:**

| Insignia | Regla |
|---|---|
| `nunca_falto` | `cancellations == 0 AND no_shows == 0 AND events_completed >= 3` (extendida por ADR-0007: un no-show la rompe igual que una cancelación) |
| `top_mozo` | `"mozo" in skills AND rating >= 4.5 AND events_completed >= 10` |
| `top_bartender` | `"bartender" in skills AND rating >= 4.5 AND events_completed >= 10` |
| `eventos_premium` | `events_completed >= 20` (proxy por volumen; el dominio no modela "evento premium" como concepto propio) |
| `perfil_verificado` | **no implementada** — `is_verified` vive en `User` (`identity`), no en `WorkerProfile`; cruzar módulos desde una función pura de dominio violaría las capas (ver ADR-0004) |

**Niveles** (`GamificationLevel`), por `events_completed` con piso de
`rating`:

| Nivel | Regla |
|---|---|
| `bronce` | default |
| `plata` | `events_completed >= 5 AND rating >= 3.5` |
| `oro` | `events_completed >= 20 AND rating >= 4.0` |
| `platino` | `events_completed >= 50 AND rating >= 4.5` |

**Limitación conocida:** el recálculo no se dispara al recibir una reseña
(`update_rating`); si el rating cambia por una reseña nueva, las
insignias/nivel quedan con el rating anterior hasta el próximo turno
finalizado o cancelado. Aceptado por simplicidad — ver ADR-0004.

## Inconsistencias a resolver

> Sigue pendiente, fuera de alcance de ADR-0004 (no había decisión de
> producto para esto y no la resuelve este cambio):
>
> - **`on_time_payment_rate`/`events_published` (comercio) siguen sin
>   cálculo automático.** Mismo motivo que en R2.4: el trabajo se centró en
>   las métricas del trabajador derivables honestamente del ciclo del turno.
>   Requiere enganchar `mark_paid`/`publish` en `ShiftService` a un puerto
>   análogo de `CompanyProfileRepository` — no requiere ADR (no cambia el
>   modelo de estados), sólo esfuerzo de implementación pendiente.
