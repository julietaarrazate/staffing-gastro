# ADR-0004 — Cancelación del trabajador (reabre el turno) e insignias/niveles automáticos

**Estado:** aceptado · **Fecha:** 2026-07-02

## Contexto

Dos brechas quedaron documentadas en `TECH_DEBT.md` (P2 y P3) y en
`REPUTATION.md` ("Inconsistencias a resolver"), ambas bloqueadas por
decisiones de producto pendientes:

1. **`cancellations` del trabajador nunca se actualizaba.** `Shift.cancel()`
   (`shift/domain/entities.py`) es una transición **terminal** (→
   `CANCELADO`) y en la API sólo la dispara el **comercio**
   (`POST /shifts/{id}/cancel`, protegido por `company_id`). No existía
   ninguna ruta para que el trabajador cancele una asignación ya confirmada,
   así que `WorkerProfile.cancellations` quedaba fijo en `0` para siempre —
   contarlo desde `Shift.cancel()` habría sido incorrecto, porque siempre lo
   dispara el comercio, no el trabajador.
2. **`WorkerBadge`/`GamificationLevel` sin lógica de otorgamiento.** El
   catálogo existe y se serializa en la API, pero ningún caso de uso lo
   escribe: `WorkerProfile` nace con `badges=[]`/`level=BRONCE` y se queda
   así para siempre, aunque el trabajador complete decenas de turnos.

R2.4 ya había resuelto `events_completed`/`punctuality_rate` del trabajador
(recalculados en `ShiftService.finish`), dejando la base numérica lista para
que las reglas de insignias/niveles se apoyen en datos reales — pero
`cancellations` seguía faltando, y las reglas de otorgamiento nunca se
definieron.

## Decisión

### 1. Cancelación del trabajador (nueva transición, reabre el turno)

- **Transición nueva:** `Shift.worker_cancel()` — sólo alcanzable desde
  `CONFIRMADO`. Antes de confirmar, el trabajador ya tiene `reject()` (que
  también reabre la búsqueda); después de hacer check-in, "cancelar" sería
  abandono de un turno en curso, un problema distinto (detección de
  **no-show**) que queda **explícitamente fuera de alcance** de este ADR —
  ver "Fuera de alcance" abajo.
- **Efecto en el turno:** a diferencia de `cancel()` (comercio, **terminal**,
  → `CANCELADO`), `worker_cancel()` **reabre** el turno: vuelve a
  `BUSCANDO_PERSONAL`, se limpia `worker_profile_id` y vuelve a aparecer en
  el feed (mismo criterio de negocio que `reject()`: el comercio sigue
  necesitando cubrir el puesto).
- **Endpoint:** `POST /shifts/{shift_id}/worker-cancel`, protegido por
  "trabajador asignado" (mismo patrón que `confirm`/`reject`/`depart`/
  check-in/out: `ShiftNotAssignedToWorkerError` → **404**, no-disclosure).
- **Efecto en reputación:** `WorkerProfileRepository.record_cancellation`
  (puerto nuevo, análogo a `record_completed_shift` de R2.4) incrementa
  `WorkerProfile.cancellations` en 1 y dispara el recálculo de
  `badges`/`level` (ver punto 2).
- **Notificación:** `NotificationType.SHIFT_REOPENED` (`"shift_reopened"`) al
  comercio, con el mensaje de que el trabajador canceló y el turno volvió a
  buscar personal.

### 2. Insignias y niveles: reglas de otorgamiento automático

Función pura de dominio en `worker/domain/rules.py` (sin DB, testeable con
`WorkerProfile` en memoria):

- `compute_badges(profile) -> set[WorkerBadge]`
- `compute_level(profile) -> GamificationLevel`

**Reglas de insignias:**

| Insignia | Regla |
|---|---|
| `nunca_falto` | `cancellations == 0 AND events_completed >= 3` |
| `top_mozo` | `"mozo" in skills AND rating >= 4.5 AND events_completed >= 10` |
| `top_bartender` | `"bartender" in skills AND rating >= 4.5 AND events_completed >= 10` |
| `eventos_premium` | `events_completed >= 20` |
| `perfil_verificado` | **no implementada** — ver más abajo |

`eventos_premium` es un **proxy honesto por volumen**: el dominio hoy no
modela ningún concepto de "evento premium" (una categoría de turno especial,
pago superior, etc.); no se inventa ese concepto para esta insignia, se usa
el volumen de eventos completados como aproximación declarada como tal.

**`perfil_verificado` queda fuera de la lógica automática.** `is_verified`
vive en `User` (módulo `identity`, ver `identity/domain/entities.py`), **no**
en `WorkerProfile`. Incorporarlo a `compute_badges` — una función pura de
dominio del módulo `worker`, sin acceso a DB — forzaría acoplar ese cálculo a
otro módulo (leer `User` desde dentro de `worker/domain` o encadenar una
consulta a `identity` en cada `finish`/`worker_cancel`), violando la regla de
capas de `CLAUDE.md` ("cruces entre módulos: por puerto/repositorio
inyectado, nunca acoplando dominios") por una insignia que hoy es sólo
presentacional. Se deja explícitamente sin otorgamiento automático: el
catálogo la sigue exponiendo, pero ningún caso de uso la asigna. Si se
necesita en el futuro, la vía correcta es una consulta explícita desde la
capa de aplicación (inyectando un puerto de `identity`), no una función pura
de dominio cruzando módulos.

**Reglas de nivel** (`GamificationLevel`), por `events_completed` con **piso
de rating** (evita subir de nivel por volumen puro sin calidad):

| Nivel | Regla |
|---|---|
| `bronce` | default (`events_completed >= 0`) |
| `plata` | `events_completed >= 5 AND rating >= 3.5` |
| `oro` | `events_completed >= 20 AND rating >= 4.0` |
| `platino` | `events_completed >= 50 AND rating >= 4.5` |

**Sin histéresis:** el nivel (y las insignias) se **recalculan desde cero**
en cada evento relevante — no hay memoria de "nivel ya alcanzado". Si el
rating de un trabajador cae por debajo del piso del nivel que tenía, en el
siguiente evento recalculado vuelve al nivel que sí cumple. Se documenta así
deliberadamente por simplicidad; si el negocio pide "no bajar de nivel", es
una decisión de producto nueva con su propio ADR (afecta la percepción de
logro del trabajador).

**Cuándo se recalculan:** en los dos puntos donde ya se actualizan las
métricas que alimentan las reglas — `WorkerProfileRepository
.record_completed_shift` (al finalizar un turno, `ShiftService.finish`, R2.4)
y el nuevo `WorkerProfileRepository.record_cancellation` (al `worker_cancel`,
punto 1 de este ADR). Ambos métodos del adaptador SQLAlchemy
(`worker/infrastructure/repositories.py`) llaman a
`compute_badges`/`compute_level` sobre el perfil ya actualizado y persisten
el resultado. **No** se recalculan al recibir una reseña (`update_rating`,
`review/application/services.py`): el rating puede cambiar ahí, pero el
recálculo de insignias/nivel queda para el próximo evento de turno
(finalización o cancelación) — es una limitación conocida y aceptada por
simplicidad (evita otro punto de escritura sobre el mismo perfil desde un
módulo distinto); si en el futuro se vuelve un problema de producto real
(insignias visiblemente desactualizadas tras una reseña), se resuelve
agregando ese tercer punto de recálculo, sin necesidad de un ADR nuevo (no
cambia ningún modelo ni contrato).

## Por qué

- **Cancelación del trabajador:** el dominio ya tenía el patrón exacto para
  esto en `reject()` (reabre búsqueda, limpia asignación); `worker_cancel()`
  es la misma idea aplicada un paso más adelante en el ciclo (después de
  confirmar). Cerrarla como transición **no terminal** —a diferencia de
  `cancel()` del comercio— es coherente con la misión de "cubrir una
  posición en <10 min": el sistema no debe dar el puesto por perdido sólo
  porque el trabajador asignado se bajó.
- **Insignias/niveles por umbral:** son las métricas ya derivadas
  honestamente del ciclo de turno (R2.4 + este ADR), sin inventar conceptos
  nuevos de dominio (como "evento premium") ni forzar cruces de módulo
  (`perfil_verificado`). El piso de rating en los niveles evita el caso
  obvio de gaming (acumular turnos de mala calidad para subir de nivel).

## Fuera de alcance (explícito)

- **Detección de "no-show"** (el trabajador no cancela ni hace check-in, y
  el turno queda colgado en `CONFIRMADO`/`EN_CAMINO`): requeriría un job en
  background/cron (ver `TECH_DEBT.md`, ítem nuevo) para detectar turnos
  vencidos sin check-in — infraestructura nueva sin necesidad demostrada
  hoy. No se implementa acá; `worker_cancel()` cubre sólo la cancelación
  **explícita** del trabajador.
- **`perfil_verificado` automático:** ver arriba — queda fuera, catálogo sin
  otorgamiento.
- **Recalcular insignias/nivel al recibir una reseña:** ver arriba, limitación
  conocida y aceptada.

## Consecuencias

- ✅ Cierra `TECH_DEBT.md` P3 (parte de `cancellations`) y P2 (insignias) —
  ver actualización en ese documento.
- ✅ `REPUTATION.md` ya no tiene métricas "sin cálculo automático" salvo las
  explícitamente fuera de alcance de este ADR (`on_time_payment_rate`/
  `events_published` del comercio, sin tocar).
- ✅ Tests unitarios puros de `compute_badges`/`compute_level`
  (`tests/test_worker_rules.py`) más tests de integración de la transición y
  del recálculo end-to-end (`tests/test_shift.py`, `tests/test_attendance.py`).
- ⚠️ Nuevo estado alcanzable desde `CONFIRMADO` además de `EN_CAMINO`
  (avance normal): cualquier código que asuma que `CONFIRMADO` sólo avanza
  hacia `EN_CAMINO` debe considerar también el retroceso a
  `BUSCANDO_PERSONAL`. No se detectó tal código al auditar `shift/` y
  `matching/`.
- ⚠️ Insignia `perfil_verificado` sigue sin otorgarse nunca automáticamente;
  si se muestra en el frontend como "no ganada" para todos los trabajadores,
  es el comportamiento esperado hasta que se resuelva con una decisión de
  producto + implementación explícita cruzando el puerto de `identity`.
