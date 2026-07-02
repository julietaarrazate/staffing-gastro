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
- **Cuándo:** `start_at`, `end_at`.
- **Cuánto:** `pay_amount`, `currency`, `tips` (acepta propinas).
- **Dónde:** dirección, ciudad, coordenadas (ver [LOCATION.md](./LOCATION.md)).
- **Estado y asignación:** `status`, trabajador asignado, campos de asistencia
  (check-in/out con ubicación y timestamp), `paid_at`.

## Ciclo de vida ("Modo Uber")

```
BORRADOR → PUBLICADO → BUSCANDO_PERSONAL → ASIGNADO → CONFIRMADO →
EN_CAMINO → CHECK_IN → TRABAJANDO → CHECK_OUT → FINALIZADO → PAGADO
                         ▲                                     
                         └──── (rechazo del trabajador) ───────┘
CANCELADO: alcanzable desde cualquier estado no terminal.
```

- **BORRADOR:** creado por el comercio; editable; no visible.
- **PUBLICADO / BUSCANDO_PERSONAL:** **abierto** — visible en el feed y el mapa;
  los trabajadores se postulan (ver [MATCHING.md](./MATCHING.md)).
- **ASIGNADO:** el comercio eligió un trabajador; espera confirmación.
- **CONFIRMADO:** el trabajador aceptó. Si en vez de aceptar **rechaza**, el turno
  vuelve a `buscando_personal`.
- **EN_CAMINO → CHECK_IN → TRABAJANDO → CHECK_OUT:** asistencia; check-in y
  check-out **capturan geolocalización**.
- **FINALIZADO:** el comercio cierra el turno trabajado.
- **PAGADO:** el comercio registró el pago (ver [PAYMENTS.md](./PAYMENTS.md)).
- **CANCELADO:** cancelado antes de terminar.

**Estados terminales:** `finalizado`, `pagado`, `cancelado` (no admiten más
transiciones). **Editables:** `borrador`, `publicado`. **Abiertos (feed):**
`publicado`, `buscando_personal`.

## Reglas de negocio

- **Horario válido:** `start_at < end_at`.
- **Visibilidad:** un turno aparece en el feed **sólo** en estados abiertos.
- **Propiedad:** las acciones del lado comercio (publicar, editar, cancelar,
  asignar, finalizar, pagar) sólo las hace el **comercio dueño**; ajeno = 404.
- **Acciones del trabajador** (confirmar, rechazar, salir, check-in/out) sólo las
  hace el **trabajador asignado**; si no, 404 (no-disclosure).
- **Reversibilidad del match:** un rechazo reabre la búsqueda; un turno abierto no
  "recuerda" postulantes descartados salvo su postulación registrada.
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
