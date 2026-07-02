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
- `cancellations` — cancelaciones. **Sigue sin cálculo automático** — ver
  limitación abajo.
- `badges` — insignias (catálogo `WorkerBadge`): `nunca_falto`, `top_mozo`,
  `top_bartender`, `eventos_premium`, `perfil_verificado`.
- `level` — nivel de gamificación (`bronce`, `plata`, `oro`, `platino`).

### Comercio
- `rating` — promedio de reseñas recibidas.
- `on_time_payment_rate` — tasa de pago a tiempo.
- `events_published` — turnos publicados.

## Reglas de negocio

- La reputación es **consecuencia del comportamiento**, no editable a mano.
- El **rating** se actualiza automáticamente con cada reseña.
- La reputación del trabajador **influye directamente en el score de matching**
  (peso 0.25 por reputación + 0.15 por puntualidad + 0.15 por desempeño).

## Inconsistencias a resolver

> Estas brechas deben cerrarse (definir reglas o marcar explícito lo pendiente):
>
> 1. **Insignias y niveles sin lógica de otorgamiento.** El catálogo de
>    `WorkerBadge` y los `GamificationLevel` existen, pero no hay reglas que las
>    asignen ni suban de nivel automáticamente. Hoy son presentacionales.
>    Fuera de alcance de R2.4 (es un ítem más grande, ver `TECH_DEBT.md` P2).
> 2. **`cancellations` (trabajador) y `on_time_payment_rate`/`events_published`
>    (comercio) siguen sin cálculo automático.** R2.4 resolvió
>    `punctuality_rate` y `events_completed` del trabajador (ver arriba), pero
>    el resto queda pendiente:
>    - `cancellations`: el dominio actual **no distingue quién cancela** un
>      turno. `Shift.cancel()` (`shift/domain/entities.py`) es una transición
>      genérica alcanzable desde cualquier estado no terminal, y en la API
>      sólo el comercio la dispara (`POST /shifts/{id}/cancel`, protegido por
>      `company_id` — no existe una ruta de cancelación por parte del
>      trabajador). Tampoco existe un estado `no_show`. Contar
>      `Shift.cancel()` como "cancelación del trabajador" sería incorrecto:
>      hoy siempre es el comercio quien cancela. `reject_assignment()` (el
>      trabajador rechaza una asignación antes de confirmarla) es una acción
>      distinta y ya notificada aparte; no se asimila a "cancelación" sin una
>      definición de producto explícita. **No se inventa un estado nuevo** —
>      requiere decisión de producto + ADR si se quiere distinguir el actor o
>      agregar `no_show` (ver `TECH_DEBT.md` P3).
>    - `on_time_payment_rate`/`events_published` (comercio): sin tocar en
>      R2.4, mismo motivo (fuera del alcance acotado: se centró en las
>      métricas del trabajador derivables honestamente del ciclo del turno).
>
> Propuesta: otorgar insignias/niveles por umbrales sobre `events_completed`/
> `punctuality_rate` (ya derivados); para `cancellations`, definir primero en
> `BUSINESS_RULES.md` quién puede cancelar y si se agrega `no_show`, con ADR
> si cambia el modelo de estados.
