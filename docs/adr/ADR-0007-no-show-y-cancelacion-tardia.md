# ADR-0007 — No-show del trabajador y cancelación tardía del comercio

**Estado:** aceptado · **Fecha:** 2026-07-21

## Contexto

`PRIMER_TURNO_REAL_SPEC.md` (batch launch-gate T1) pide recorrer y cerrar tres
lazos construidos-pero-nunca-validados antes de buscar usuarios reales: el
ciclo de reseñas end-to-end, la primera experiencia del comercio y el
no-show. Este ADR cubre el tercero (Parte C).

ADR-0004 ya había dejado **explícitamente fuera de alcance** la detección de
no-show, con este razonamiento: "el trabajador no cancela ni hace check-in y
el turno queda colgado en `confirmado`/`en_camino` pasado el horario;
requeriría un job en background/cron para barrer turnos vencidos —
infraestructura nueva sin necesidad demostrada". Ese razonamiento aplicaba a
la **detección automática** (¿cuánto tiempo pasado el horario pactado se
considera abandono? necesita un scheduler que hoy no existe en el repo).

El spec de este batch pide algo más chico y ya construible sin esa
infraestructura: que el **comercio marque manualmente** "no se presentó"
desde el turno en marcha. No hay ambigüedad de umbral temporal que resolver
con un cron — es un juicio humano del comercio, como ya lo es "Cancelar".
Este ADR resuelve esa versión manual; la detección automática por cron sigue
fuera de alcance y queda documentada como tal en `TECH_DEBT.md`.

De paso, el spec pidió el efecto **simétrico**: la cancelación tardía del
comercio (con el trabajador ya confirmado) también debía costarle reputación
al comercio, y hoy no avisaba nada al trabajador — un hueco real encontrado
al recorrer el flujo (ver `STATUS.md`/reporte del batch).

## Decisión

### 1. No-show del trabajador (nueva transición, reabre el turno)

- **Transición nueva:** `Shift.no_show()` — alcanzable desde `CONFIRMADO` o
  `EN_CAMINO`. Antes de esos estados no hay a quién marcar ausente (`ASIGNADO`
  todavía no confirmó — ahí el comercio puede reasignar directo). Después del
  check-in ya no aplica: el trabajador se presentó, un abandono en curso es
  un problema distinto y sigue fuera de alcance (mismo criterio que
  ADR-0004).
- **Efecto en el turno:** igual que `worker_cancel()`, **reabre** (→
  `BUSCANDO_PERSONAL`, limpia `worker_profile_id`) en vez de cancelar
  (terminal): el comercio sigue necesitando cubrir el puesto y puede
  re-buscar. Si en cambio prefiere no seguir buscando, usa el endpoint de
  cancelar ya existente sobre el turno reabierto — no se duplica esa lógica.
- **Auditoría sin tabla nueva:** antes de limpiar `worker_profile_id` se
  guarda en `Shift.last_no_show_worker_profile_id` (+ `Shift.no_show_at`),
  mismo criterio que `check_in_at`/`check_out_at`: el registro vive en el
  propio turno, no en una tabla de auditoría aparte (infraestructura que no
  hace falta para este alcance).
- **Endpoint:** `POST /shifts/{shift_id}/no-show` (comercio, dueño del
  turno).
- **Efecto en reputación:** `WorkerProfileRepository.record_no_show`
  (puerto nuevo, mismo patrón que `record_completed_shift`/
  `record_cancellation`) incrementa `WorkerProfile.no_shows` — **campo
  nuevo, separado de `cancellations`**: un no-show es una señal peor (cero
  aviso) que una cancelación explícita, así que no se mezclan en el mismo
  contador. Nunca un `UPDATE` a mano.
- **Notificación:** `NotificationType.SHIFT_NO_SHOW` al trabajador (in-app +
  push best-effort automático, ver `ACCESO_MODERNO.md` — cualquier
  `Notification` nueva ya dispara push si el usuario tiene suscripción
  activa, sin código adicional).

### 2. `no_shows` pesa en matching y en insignias

- **Matching** (`matching/domain/scoring.py::_performance_score`): un
  no-show pesa **el doble** que una cancelación en el denominador del score
  de desempeño (`NO_SHOW_PERFORMANCE_WEIGHT = 2`, constante ajustable). Valor
  semilla conservador — no hay datos reales todavía para calibrar cuánto
  debería doler un no-show frente a una cancelación avisada; se declara así
  explícitamente (mismo criterio que las suscripciones Fase 1,
  ADR-0005).
- **Insignia `nunca_falto`** (`worker/domain/rules.py`): ahora exige
  `cancellations == 0 AND no_shows == 0` (antes sólo miraba
  `cancellations`). Un no-show rompe la insignia igual que una cancelación.

### 3. Cancelación tardía del comercio (efecto simétrico)

- **Sin transición nueva:** `Shift.cancel()` ya es terminal desde cualquier
  estado no terminal, incluido con el trabajador confirmado. Lo que faltaba
  no era la transición — es lo que pasa alrededor de ella.
- **"Tardía" se define en `ShiftService.cancel_shift`:** si al momento de
  cancelar el turno estaba en `COMMITTED_STATUSES` (el mismo conjunto que ya
  usa la regla de doble turno: `CONFIRMADO`, `EN_CAMINO`, `CHECK_IN`,
  `TRABAJANDO`, `CHECK_OUT`), es tardía. Cancelar un turno en `BORRADOR`,
  `PUBLICADO`, `BUSCANDO_PERSONAL` o `ASIGNADO` (sin confirmar todavía) no
  cuenta: el trabajador nunca llegó a comprometerse.
- **Efecto en reputación:** `CompanyProfileRepository.record_late_cancellation`
  (puerto nuevo, campo nuevo `CompanyProfile.late_cancellations`) incrementa
  en 1. No se mezcla con `rating` (que sigue siendo sólo el promedio de
  reseñas) — mismo criterio que `WorkerProfile.cancellations`/`no_shows`, que
  tampoco tocan `rating` directamente.
- **Hallazgo al recorrer el flujo:** antes de este ADR, cancelar un turno con
  el trabajador ya confirmado **no notificaba a nadie** — el trabajador se
  enteraba recién al abrir la app y ver que su turno desapareció. Se cierra
  con `NotificationType.SHIFT_CANCELLED_LATE` (in-app + push best-effort,
  mismo mecanismo automático que el resto de las notificaciones).

## Por qué

- **Manual, no cron:** resuelve el caso de uso real pedido por el spec sin la
  infraestructura que ADR-0004 correctamente había diferido. Si más adelante
  se quiere detección automática de turnos colgados sin check-in pasado el
  horario, es un ítem propio con su propio ADR (agrega un scheduler, decisión
  de infraestructura no gratuita).
- **Contador separado (`no_shows` ≠ `cancellations`):** mezclar ambos
  contadores diluiría la señal — cancelar avisando con anticipación y no
  aparecer nunca no son la misma falta de confiabilidad, y el producto ya
  distingue conceptos similares (`reject()` vs `worker_cancel()`, ADR-0004).
- **Simetría comercio↔trabajador:** la reputación es "la moneda del
  marketplace" (`REPUTATION.md`) en las dos direcciones; que sólo el
  trabajador tuviera consecuencias por fallar tarde rompía esa simetría
  declarada.
- **Reabre en vez de cancelar (no-show):** mismo argumento que ADR-0004 para
  `worker_cancel()`: la misión de "<10 min" no se resigna un puesto sólo
  porque quien estaba asignado no apareció.

## Fuera de alcance (explícito)

- **Detección automática de no-show por cron/scheduler:** sigue fuera, por lo
  ya razonado en ADR-0004. Este ADR resuelve sólo el marcado **manual** por
  el comercio.
- **No-show después del check-in** (abandono a mitad de turno): fuera de
  alcance, mismo criterio que ADR-0004 con `worker_cancel()`.
- **Impacto de `late_cancellations` sobre `rating`/visibilidad del comercio
  en el matching:** hoy el motor de matching sólo rankea **trabajadores**
  para un turno (ver `MATCHING.md`); no existe un "ranking de comercios" del
  lado del trabajador donde este contador pudiera pesar. Si se construye tal
  ranking en el futuro, es la extensión natural — no corresponde a este ADR.
- **Recalibrar `NO_SHOW_PERFORMANCE_WEIGHT` con datos reales:** valor semilla
  declarado como ajustable, no una decisión definitiva.

## Consecuencias

- ✅ Cierra el ítem de no-show manual pedido por
  `PRIMER_TURNO_REAL_SPEC.md` Parte C. El ítem de detección **automática**
  (cron) sigue abierto en `TECH_DEBT.md`, ahora distinguido explícitamente
  del manual.
- ✅ `REPUTATION.md`/`MATCHING.md`/`SHIFT.md` actualizados con los campos y
  pesos nuevos.
- ✅ Tests de integración que recorren el flujo completo
  (`tests/test_shift.py`, nuevos casos de no-show y cancelación tardía;
  `tests/test_matching_scoring.py`, peso del no-show en el desempeño).
- ⚠️ Migración `0014` agrega columnas nuevas (`worker_profiles.no_shows`,
  `company_profiles.late_cancellations`, `shifts.no_show_at`,
  `shifts.last_no_show_worker_profile_id`) — todas `nullable`/con
  `server_default`, sin backfill necesario.
- ⚠️ Mismo aviso que ADR-0004: código que asuma que `CONFIRMADO`/`EN_CAMINO`
  sólo avanzan hacia adelante debe considerar también el retroceso a
  `BUSCANDO_PERSONAL` por no-show (además de por `worker_cancel`/`reject`).
