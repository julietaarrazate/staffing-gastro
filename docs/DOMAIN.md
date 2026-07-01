# DOMAIN.md — Dominio de Staffya

> Modelo del negocio **tal como está en el código** (`backend/app/modules/*`).
> Para el producto ver [PRODUCT.md](./PRODUCT.md); para las capas y dependencias
> [ARCHITECTURE.md](./ARCHITECTURE.md). El comportamiento funcional por módulo se
> profundiza en la Fase 2 (WORKER.md, EMPLOYER.md, SHIFT.md, …).

## Cómo leer este documento

El plan de negocio nombra 15 "entidades". Algunas son **entidades reales** con su
propia persistencia; otras son **conceptos** que en el código se modelan como
campos, estados o transiciones. Se documenta la realidad y se marca cada caso.

| Concepto del negocio | En el código | Tipo |
|---|---|---|
| Worker | `WorkerProfile` (módulo `worker`) | Entidad |
| Employer / Organization | `CompanyProfile` (módulo `company`) | Entidad (no hay `Organization` aparte) |
| Shift | `Shift` (módulo `shift`) | Entidad |
| Match | `ShiftApplication` (módulo `application`) + asignación en `Shift` | Entidad + estado |
| Chat | `ChatMessage` (módulo `chat`) | Entidad |
| Review | `Review` (módulo `review`) | Entidad |
| Notification | `Notification` (módulo `notification`) | Entidad |
| Reputation | métricas de `WorkerProfile` / `CompanyProfile` | Campos derivados |
| Badge | `WorkerBadge` (enum) | Catálogo (value object) |
| Availability | `WorkerProfile.is_available` | Campo |
| Check In / Check Out | transiciones + campos geo de `Shift` | Estado + campos |
| Location | ciudad/barrio + lat/lng en perfiles y turnos | Value objects / campos |
| Payment | acción `mark-paid` sobre `Shift` (placeholder) | Estado (sin cobro real) |

---

## Identity (usuario y rol)

- **Propósito:** autenticación y autorización. Un `User` tiene email, password
  hasheada, `full_name`, `status` (activo/suspendido), `is_verified` y un
  **rol**: `worker` | `employer` | `admin` (`UserRole`).
- **Responsabilidades:** login/registro, emisión de **JWT + refresh token**,
  resolución del usuario autenticado.
- **Reglas / invariantes:**
  - No se permite **auto-registro como admin**; el primer admin se promueve vía
    `ADMIN_EMAILS`.
  - El `User` es la identidad; el **perfil** (worker o company) es una entidad
    aparte ligada por `user_id`.

## Worker — `WorkerProfile`

- **Propósito:** perfil del trabajador eventual y su reputación.
- **Datos:** `user_id`, foto, ciudad, bio, geolocalización (lat/lng),
  **skills** (`WorkerSkill`), años de experiencia, idiomas, certificaciones, CV,
  `is_available`.
- **Reputación (campos derivados):** `rating`, `events_completed`,
  `punctuality_rate`, `cancellations`, `badges` (`WorkerBadge[]`), `level`
  (`GamificationLevel`).
- **`WorkerSkill`:** `mozo`, `bartender`, `barista`, `runner`, `cocinero`,
  `cajero`, `recepcionista`, `personal_eventos`, `ayudante_cocina`,
  `personal_salon`.
- **`GamificationLevel`:** `bronce`, `plata`, `oro`, `platino`.
- **`WorkerBadge`:** `nunca_falto`, `top_mozo`, `top_bartender`,
  `eventos_premium`, `perfil_verificado`.
- **Relaciones:** 1–1 con `User`; recibe/asigna `Shift`; se postula vía
  `ShiftApplication`; participa de `Chat` y `Review`.
- **Invariantes:** un `User` con rol `worker` tiene a lo sumo un `WorkerProfile`.
  Debe existir para postularse o ser asignado.

> **Inconsistencia a resolver:** el catálogo de `WorkerBadge` y los niveles
> existen, pero **no se observa lógica que otorgue insignias ni suba de nivel
> automáticamente**. Hoy son un value object presentacional. Propuesta: definir
> las reglas de otorgamiento (o marcarlo explícito como pendiente) en
> `REPUTATION.md` (Fase 2).

## Employer — `CompanyProfile`

- **Propósito:** perfil del comercio que publica turnos.
- **Datos:** `user_id`, `name`, logo, **categoría** (`CompanyCategory`),
  descripción, dirección, ciudad, lat/lng, capacidad, horarios.
- **Reputación:** `rating`, `events_published`, `on_time_payment_rate`.
- **`CompanyCategory`:** `restaurante`, `bar`, `cafeteria`, `salon_eventos`,
  `catering`, `empresa_gastronomica`.
- **Relaciones:** 1–1 con `User`; publica `Shift`; participa de `Chat` y `Review`.
- **Invariantes:** un `User` `employer` tiene a lo sumo un `CompanyProfile`; debe
  existir para publicar turnos.

> **Nota:** "Organization" del plan **no existe** como entidad separada. Si en el
> futuro un employer administra varios locales, será un ADR nuevo (Fase 10).

## Shift — `Shift`

- **Propósito:** un turno de trabajo puntual publicado por un comercio.
- **Datos:** `company_id`, `position` (`WorkerSkill`), `quantity`, `start_at`/
  `end_at`, `pay_amount`/`currency`, `tips`, `dress_code`, `urgent`, dirección/
  ciudad/lat-lng, título, descripción, `status` (`ShiftStatus`),
  `worker_profile_id` (asignado), campos de asistencia (`check_in_*`,
  `check_out_*`, `paid_at`).
- **Responsabilidades:** representar la oferta y su **ciclo de vida completo**
  (publicación, matching/asignación, asistencia geolocalizada, cierre y pago).
- **`ShiftStatus`:** `borrador → publicado → buscando_personal → asignado →
  confirmado → en_camino → check_in → trabajando → check_out → finalizado →
  pagado`, más `cancelado`.
- **Reglas / invariantes:**
  - `start_at < end_at` (horario válido).
  - Sólo editable/cancelable por su comercio dueño.
  - Aparece en el **feed** sólo si está en estados abiertos
    (`publicado`/`buscando_personal`, `OPEN_STATUSES`).
  - `reject` de un asignado vuelve el turno a `buscando_personal`.
  - `cancelado`, `finalizado`, `pagado` son **terminales**.
  - check-in/check-out capturan geolocalización.
- Detalle en [SHIFT.md](./SHIFT.md) / `STATE_MACHINE.md` (fases siguientes).

## Match — `ShiftApplication` + asignación

- **Propósito:** el "match" estilo Tinder tiene **dos lados**:
  - **Lado trabajador:** `ShiftApplication` — el worker se **postula** a un turno
    abierto (swipe derecha). Estados `ApplicationStatus`: `pendiente`, `aceptada`,
    `rechazada`, `retirada`. Único por (turno, trabajador).
  - **Lado comercio:** la **asignación** — el comercio elige un postulante (o un
    candidato recomendado por `matching`) y asigna el turno; el worker confirma o
    rechaza. Se materializa en `Shift.worker_profile_id` + estado
    `asignado`/`confirmado`.
- **Invariante:** un trabajador se postula una sola vez por turno; sólo se puede
  postular a turnos abiertos.
- No hay una entidad `Match` única: el match es la conjunción postulación +
  asignación + confirmación. Ver [MATCHING.md](./MATCHING.md) (Fase 2).

## Matching (motor de recomendación)

- **Propósito:** rankear candidatos para un turno (no persiste entidades).
- **Factores:** distancia (Haversine), experiencia, reputación, puntualidad,
  desempeño. La afinidad histórica local↔trabajador queda fuera (Fase futura).
- **También:** búsqueda de trabajadores por mapa (rol + radio) para el comercio.
- Devuelve nombre, foto y rating del candidato.

## Chat — `ChatMessage`

- **Propósito:** mensajería trabajador↔comercio **por turno**.
- **Datos:** `shift_id`, `sender_user_id`, `body`, `read`, `created_at`.
- **Reglas:** la conversación la integran el comercio y el trabajador **asignado**
  a ese turno; entrega en **tiempo real por WebSocket**; avisa al destinatario con
  una `Notification`.

## Review — `Review`

- **Propósito:** calificación **bidireccional** al cerrar un turno.
- **Datos:** `shift_id`, `reviewer_user_id`, `reviewee_user_id`, `rating` (1–5),
  `comment`, `created_at`.
- **Reglas / invariantes:**
  - Sólo sobre turnos cerrados (`finalizado` o `pagado`).
  - Una sola reseña por usuario por turno (único `shift_id`+`reviewer`).
  - Cada reseña **recalcula el rating promedio** del calificado (alimenta la
    reputación y por lo tanto el matching) y genera una `Notification`.

## Reputation (métricas derivadas)

- **No es una entidad.** Es el conjunto de métricas del perfil: `rating`,
  `punctuality_rate`, `events_completed`, `cancellations` (worker) y `rating`,
  `on_time_payment_rate`, `events_published` (company).
- **Fuente:** las reseñas actualizan el rating; el resto se espera derivar del
  ciclo de vida de los turnos. Ver nota de insignias/niveles arriba.

## Notification — `Notification`

- **Propósito:** avisos in-app por usuario.
- **`NotificationType`:** `shift_assigned`, `shift_confirmed`, `shift_rejected`,
  `shift_checked_out`, `shift_paid`, `chat_message`, `review_received`,
  `new_applicant`.
- **Entrega:** en **tiempo real por WebSocket** (antes polling); marcables como
  leídas.

## Availability

- **No es una entidad.** Es el flag `WorkerProfile.is_available` (disponible /
  no disponible), que el trabajador togglea desde su Inicio y que el matching/
  búsqueda respeta.

## Check In / Check Out

- **No son entidades.** Son **transiciones** del turno (`en_camino → check_in`,
  `trabajando → check_out`) que **capturan geolocalización** (lat/lng + timestamp)
  en campos del propio `Shift`. Son la prueba de asistencia.

## Location

- **No es una entidad.** La ubicación se maneja como **ciudad/barrio + lat/lng**:
  - Perfiles y turnos guardan `city` y coordenadas.
  - El frontend usa un **selector de barrios/ciudades de Argentina** (no lat/lng
    manual) que completa las coordenadas.
  - El matching usa las coordenadas para distancia (Haversine).
  - Detalle en [LOCATION.md](./LOCATION.md) (Fase 2).

## Payment

- **Placeholder.** Hoy la acción `mark-paid` sólo cambia el `Shift` a `pagado`
  (registra que el comercio pagó por fuera); **no procesa un cobro**. La
  integración real (MercadoPago) es roadmap. Ver
  [PRODUCT.md](./PRODUCT.md#fuera-de-alcance-hoy) y `PAYMENTS.md` (Fase 2).

---

## Reglas transversales del dominio

- **No-disclosure:** "existe pero no es tuyo" se trata como **404, nunca 403**
  (no se revela la existencia de recursos ajenos).
- **Perfil requerido:** para publicar (comercio) o postularse/ser asignado
  (trabajador) hay que tener el perfil creado.
- **Reputación como moneda:** las reseñas mueven el rating, que alimenta el
  matching; es el incentivo central del marketplace.
