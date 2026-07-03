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

## Reglas de negocio

- La reputación es **consecuencia del comportamiento**, no editable a mano.
- El **rating** se actualiza automáticamente con cada reseña.
- La reputación del trabajador **influye directamente en el score de matching**
  (peso 0.25 por reputación + 0.15 por puntualidad + 0.15 por desempeño).

## Insignias y niveles: reglas de otorgamiento (ADR-0004)

Funciones puras en `worker/domain/rules.py` (`compute_badges`,
`compute_level`), sin DB, recalculadas **desde cero** (sin histéresis) al
finalizar un turno (`ShiftService.finish`) y al registrar una cancelación del
trabajador (`ShiftService.worker_cancel`, ver [SHIFT.md](./SHIFT.md)).

**Insignias:**

| Insignia | Regla |
|---|---|
| `nunca_falto` | `cancellations == 0 AND events_completed >= 3` |
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
