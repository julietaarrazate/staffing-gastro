# SHIFT.md — El Turno (dominio)

> El **turno** es la entidad central de Staffya. Acá se describe su negocio y su
> ciclo de vida a nivel dominio. La máquina de estados formal (tabla de
> transiciones, eventos, auditoría) es materia de `STATE_MACHINE.md` /
> `SHIFT_LIFECYCLE.md` (reglas operativas). Modelo en
> [DOMAIN.md](./DOMAIN.md#shift--shift).

## Qué es

Un turno es una **posición de trabajo puntual** que un comercio necesita cubrir:
un puesto (`WorkerSkill`), una cantidad de personas, una fecha/horario, una paga
y una ubicación. Representa la unidad de intercambio del marketplace.

## Datos del turno

- **Qué:** puesto (`position`), cantidad, `urgent`, título, descripción,
  `dress_code`.
- **`urgent` no es sólo un flag de orden en el feed:** al **publicar** un
  turno urgente con coordenadas, "sale a buscar" trabajadores — se notifica
  de inmediato a los 10 candidatos disponibles con la skill pedida más
  cercanos (fan-out sincrónico, sin cola ni broker, ver
  [ADR-0005](./adr/ADR-0005-ping-turnos-urgentes.md) y
  [NOTIFICATIONS.md](./NOTIFICATIONS.md#eventos-que-generan-notificación)).
- **Cuándo:** `start_at`, `end_at`.
- **Cuánto:** `pay_amount`, `currency`, `tips` (acepta propinas).
- **Dónde:** dirección, ciudad, coordenadas (ver [LOCATION.md](./LOCATION.md)).
- **Estado y asignación:** `status`, trabajador asignado, campos de asistencia
  (check-in/out con ubicación y timestamp), `paid_at`.

## Ciclo de vida ("Modo Uber")

```
BORRADOR → PUBLICADO → BUSCANDO_PERSONAL → ASIGNADO → CONFIRMADO →
EN_CAMINO → CHECK_IN → TRABAJANDO → CHECK_OUT → FINALIZADO → PAGADO
                         ▲              │    ▲
                         │              │    └── (no-show, ADR-0007,
                         │              │         desde CONFIRMADO/EN_CAMINO) ─┐
                         │              └── (cancelación del trabajador,      │
                         │                   ADR-0004) ──────┐                │
                         └──── (rechazo del trabajador) ─────┴────────────────┘
CANCELADO: alcanzable desde cualquier estado no terminal (comercio). Si el
trabajador ya estaba CONFIRMADO o más adelante, es cancelación tardía
(ADR-0007): notifica al trabajador y le cuesta reputación al comercio.
```

- **BORRADOR:** creado por el comercio; editable; no visible.
- **PUBLICADO / BUSCANDO_PERSONAL:** **abierto** — visible en el feed y el mapa;
  los trabajadores se postulan (ver [MATCHING.md](./MATCHING.md)).
- **ASIGNADO:** el comercio eligió un trabajador; espera confirmación.
- **CONFIRMADO:** el trabajador aceptó. Si en vez de aceptar **rechaza**, el turno
  vuelve a `buscando_personal`. **([ADR-0004](./adr/ADR-0004-cancelacion-trabajador-e-insignias.md))**
  desde acá el trabajador también puede **cancelar** su asignación
  (`POST /shifts/{id}/worker-cancel`) — antes de salir hacia el turno, no
  después de hacer check-in. Igual que el rechazo, el turno vuelve a
  `buscando_personal` (se limpia `worker_profile_id`), pero además incrementa
  `WorkerProfile.cancellations` del trabajador (afecta insignias/nivel, ver
  [REPUTATION.md](./REPUTATION.md)) y notifica al comercio
  (`shift_reopened`).
  Desde `CONFIRMADO` o `EN_CAMINO` el comercio puede en cambio marcar
  **no-show** (`POST /shifts/{id}/no-show`, **[ADR-0007](./adr/ADR-0007-no-show-y-cancelacion-tardia.md)**):
  el trabajador asignado no apareció. Reabre el turno igual que
  `worker-cancel` (vuelve a `buscando_personal`, se limpia
  `worker_profile_id`), pero además: incrementa `WorkerProfile.no_shows`
  (**distinto** de `cancellations` — señal más grave, ver
  [REPUTATION.md](./REPUTATION.md)), guarda `no_show_at`/
  `last_no_show_worker_profile_id` en el propio turno como registro
  auditable, y notifica al trabajador (`shift_no_show`).
- **EN_CAMINO → CHECK_IN → TRABAJANDO → CHECK_OUT:** asistencia; check-in y
  check-out **capturan geolocalización**. Una vez hecho el check-in, el
  trabajador ya se presentó — ya no aplica no-show ni cancelación; un
  abandono en este punto es un problema distinto, sigue explícitamente fuera
  de alcance (mismo criterio que ADR-0004/ADR-0007; detección **automática**
  de turnos colgados sin check-in seguiría requiriendo un job en background,
  ver `TECH_DEBT.md`).
- **FINALIZADO:** el comercio cierra el turno trabajado.
- **PAGADO:** el comercio registró el pago (ver [PAYMENTS.md](./PAYMENTS.md)).
- **CANCELADO:** cancelado antes de terminar (por el comercio; terminal). Si
  al cancelar el trabajador ya estaba **comprometido** (`COMMITTED_STATUSES`:
  confirmó o está en pleno ciclo de trabajo), es **cancelación tardía**
  (ADR-0007): notifica al trabajador (`shift_cancelled_late`) e incrementa
  `CompanyProfile.late_cancellations` — efecto simétrico al `no_shows`/
  `cancellations` del trabajador. Cancelar sin que nadie llegó a
  comprometerse (borrador, publicado, buscando personal, o asignado sin
  confirmar) no tiene este efecto.

**Estados terminales:** `finalizado`, `pagado`, `cancelado` (no admiten más
transiciones). **Editables:** `borrador`, `publicado`. **Abiertos (feed):**
`publicado`, `buscando_personal`.

## Reglas de negocio

- **Horario válido:** `start_at < end_at`.
- **Visibilidad:** un turno aparece en el feed **sólo** en estados abiertos.
- **Propiedad:** las acciones del lado comercio (publicar, editar, cancelar,
  asignar, finalizar, pagar) sólo las hace el **comercio dueño**; ajeno = 404.
- **Acciones del trabajador** (confirmar, rechazar, cancelar, salir,
  check-in/out) sólo las hace el **trabajador asignado**; si no, 404
  (no-disclosure).
- **Reversibilidad del match:** un rechazo o una cancelación del trabajador
  (ADR-0004) reabren la búsqueda; un turno abierto no "recuerda" postulantes
  descartados salvo su postulación registrada.
- **Cierre → reputación:** al llegar a `finalizado`/`pagado` se habilita la
  **calificación bidireccional** (ver [REPUTATION.md](./REPUTATION.md)).

## Invariantes

- Un turno pertenece a un único comercio y, cuando está asignado, a un único
  trabajador (`worker_profile_id`).
- Los estados terminales no cambian.
- check-out no puede ocurrir sin check-in previo; las transiciones de asistencia
  respetan el orden del ciclo.
- La cantidad (`quantity`) representa cuántas personas se necesitan para el
  puesto. **Decisión de producto (R1.4):** por ahora **un turno = una
  persona** — `quantity` queda capado a `1` en la API (`ShiftInput`) y en el
  wizard del comercio. Para cubrir varios puestos hay que crear varios
  turnos.

> **Resuelto (era "inconsistencia a resolver, cantidad > 1"):** el modelo de
> asignación guarda **un** `worker_profile_id`, y ahora `quantity` no puede
> ser mayor a 1, así que ya no hay divergencia entre lo que se promete y lo
> que el ciclo de vida del turno puede cubrir. Si en el futuro se decide
> soportar turnos multi-persona de verdad (varias asignaciones sobre el mismo
> turno), eso requiere un rediseño con **ADR** — ver `TECH_DEBT.md#p1`.
