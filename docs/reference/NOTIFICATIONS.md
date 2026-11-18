# NOTIFICATIONS.md — Notificaciones (dominio)

> Avisos in-app por usuario. Modelo en
> [DOMAIN.md](../foundation/DOMAIN.md#notification--notification). Tiempo real en
> [ARCHITECTURE.md](../foundation/ARCHITECTURE.md#tiempo-real-websockets).

## Qué es

El sistema de avisos que mantiene a cada usuario al tanto de lo que le pasa a sus
turnos y conversaciones, **en tiempo real**. Reemplazó al polling anterior.

## Eventos que generan notificación

Las notificaciones son el efecto visible de los hitos del dominio. Tipos
(`NotificationType`) y cuándo se disparan:

| Tipo | Se dispara cuando… | Destinatario |
|------|--------------------|--------------|
| `new_applicant` | un trabajador se postula a un turno | comercio |
| `shift_assigned` | el comercio asigna el turno a un trabajador | trabajador |
| `shift_confirmed` | el trabajador confirma la asistencia | comercio |
| `shift_rejected` | el trabajador rechaza la asignación. Si el turno ya había empezado, el texto dice que se reofreció (U080, ver «Turno reofrecido») | comercio |
| `shift_checked_out` | el trabajador marca la salida (check-out) | comercio |
| `shift_paid` | el comercio marca el turno como pagado | trabajador |
| `shift_reopened` | el trabajador cancela su asignación ya confirmada ([ADR-0004](../adr/ADR-0004-cancelacion-trabajador-e-insignias.md)), o se suspende la cuenta de la persona asignada o confirmada ([ADR-0024](../adr/ADR-0024-efectos-de-una-suspension.md)); el turno vuelve a buscar personal. También cuando una persona confirmada **falta** y el turno se reofrece (U080, ver «Turno reofrecido») | comercio |
| `shift_cancelled_late` | el comercio cancela un turno con el trabajador ya confirmado o en pleno turno (cancelación tardía, [ADR-0007](../adr/ADR-0007-no-show-y-cancelacion-tardia.md)) | trabajador asignado |
| `shift_no_show` | el comercio marca «No se presentó» (`manual`) o el sistema no vio su llegada pasado el plazo (`automatic`, scheduler de asistencia, [ADR-0008](../adr/ADR-0008-asistencia-simplificada-y-no-show-automatico.md)); el turno vuelve a buscar personal | trabajador ausente (el comercio recibe el suyo como `shift_reopened` o `shift_not_covered`, ver «Turno reofrecido»); abre `/profile` |
| `shift_cancelled` | el comercio cancela un turno asignado que el trabajador todavía no había confirmado, o el turno se cancela porque se suspendió la cuenta del comercio ([ADR-0024](../adr/ADR-0024-efectos-de-una-suspension.md)) | trabajador asignado |
| `applied_shift_cancelled` | el comercio cancela un turno con postulaciones pendientes | cada persona con la postulación pendiente |
| `applications_withdrawn` | el trabajador confirma un turno y la app retira sus postulaciones pendientes a turnos del mismo horario (U123). Un solo aviso por confirmación; abre `/my-shifts`. Push con la política por defecto | el trabajador que confirmó |
| `shift_finished` | el comercio finaliza el turno (U018): «Cerró tu turno» / «Calificá a <comercio> por el turno "<título>".»; abre `/my-shifts?turno=<id>` (salta a «Asignados» y resalta el turno). Push con la política por defecto (24 h) | trabajador asignado |
| `chat_message` | llega un mensaje nuevo en el chat del turno | destinatario del mensaje |
| `review_received` | recibió una reseña | calificado |

## Reglas de negocio

- **Ausencia (`shift_no_show`), textos (U082/U089).** Mismo destinatario en los dos
  casos; cambia lo que se cuenta. El aviso tiene un solo destino, el perfil
  (`/profile`, donde se ve la ausencia); «Soporte» queda como texto, no como link.
  - Automática: título «No registramos tu llegada»; texto «No registramos tu
    llegada al turno "X" y quedó como ausencia. Si fue un error, escribinos
    desde Soporte.»
  - Manual: título «Te marcaron como no presentado»; texto «El comercio marcó
    que no te presentaste al turno "X". Esto impacta tu reputación. Si fue un
    error, escribinos desde Soporte.»
  - **El comercio recibe un aviso propio desde U080** (2026-11-18; antes no,
    decisión G3): ver «Turno reofrecido» abajo.
- **Turno reofrecido (U080, [ADR-0015](../adr/ADR-0015-turno-no-cubierto.md)).**
  Cuando quien tenía un turno lo deja con el horario ya empezado:
  - **Al comercio, un solo aviso por reapertura**, que dice qué pasó y qué
    sigue. Si se reofreció (quedan al menos 2 horas), con el tipo de siempre
    (`shift_reopened`; `shift_rejected` si fue un rechazo) y link a
    `/shifts/<id>/candidates`: «<qué pasó> Como ya había empezado, lo
    reofrecimos como urgente hasta las HH:MM; se paga lo que reste desde que
    llegue el reemplazo.» La hora es hasta cuándo se ofrece: 2 horas antes
    del fin del horario. Qué pasó: «No registramos la llegada de <nombre> a
    "X".» (ausencia automática, título «No registramos la llegada a tu
    turno»), «Marcaste que <nombre> no se presentó a "X".» (ausencia manual,
    título «Reofrecimos tu turno como urgente»), o el texto de la cancelación
    o del rechazo. El nombre es el de la persona que el comercio ya ve en su
    panel.
  - Si no quedaban 2 horas, el único aviso es `shift_not_covered`: «"X" quedó
    sin cubrir: <motivo> y quedan menos de 2 horas de horario, así que no lo
    reofrecimos. Podés publicarlo de nuevo.»
  - **A quienes están cerca** (`urgent_shift_nearby`, el círculo de la
    escalada y los favoritos; no a quien ya tuvo ese turno y lo dejó): título
    «¡Urgente! <puesto> para ahora, cerca tuyo»; texto «<comercio> necesita
    cubrir <puesto> ya: el turno empezó y va hasta las HH:MM. Paga $X por
    hora, desde que llegás. Postulate ahora.» Abre `/turno/<id>`. Uno por
    reapertura; la escalada no lo repite.
  - Si al turno reofrecido le quedan menos de 2 horas y nadie confirmó
    (`shift_not_covered`): «"X" quedó sin cubrir: lo reofrecimos como urgente
    y no se consiguió reemplazo a tiempo. Podés publicarlo de nuevo.»
  - Un turno que quedó reabierto por una ausencia **antes** de este cambio (sin
    la marca de reofrecido) conserva el texto anterior: «"X" quedó sin
    cubrir: una persona confirmada no se presentó y no se consiguió reemplazo
    a tiempo. Podés publicarlo de nuevo.» Sin ausencia previa queda el de
    siempre: «Se agotó el tiempo para cubrir "X" sin que nadie confirmara.
    Podés publicarlo de nuevo.»
- **Leídas/no leídas:** se marcan de a una al tocarlas, o todas juntas con
  "Marcar todas como leídas" en el panel de la campanita
  (`POST /notifications/read-all`).
- **Turnos cerca (`new_shift_nearby`, `urgent_shift_nearby`):** sólo a quien
  está **dentro del radio** del turno (25 km en el primer aviso, 40 km en la
  escalada; sin distancia que medir, a quien es de su misma ciudad): fuera de
  eso no llega ni la campanita ni el push, tampoco a un favorito. El turno
  se mide desde su zona o, si se publicó sin ninguna, desde el local del
  comercio; el trabajador, desde la zona de su perfil o desde "Disponible
  ahora" mientras está prendido. Y sólo a
  cuentas con rol trabajador y activas, las mismas que pueden salir como
  candidatas ([MATCHING.md](./MATCHING.md)). Un perfil de trabajador
  colgado de un admin o de un suspendido no recibe nada.
- **Evento publicado (2026-11-14, U086): un aviso por persona, no uno por
  puesto.** Al publicar un evento (`ShiftService.create_event`) cada persona
  recibe un solo `new_shift_nearby`: «Evento X: 5 puestos cerca tuyo» (con
  «¡Urgente!» si algún puesto lo es), con la cuenta de los puestos que le
  tocan por oficio y distancia; abre `/turno/<id>` del primero. Mismo radio,
  tope por puesto, favoritos y «Disponible ahora» que un turno suelto
  (`_rank_nearby`); un evento de un solo puesto avisa como turno suelto. La
  escalada (`urgent_shift_nearby`) también es uno solo por evento y por
  persona: el scheduler sube cada puesto a urgente (`escalate_urgency(notify=False)`)
  y al terminar la pasada `ShiftService.notify_event_escalation` manda «¡Urgente!
  Evento X: N puestos cerca tuyo» con el radio y el tope de la escalada, abriendo
  el primer puesto que le toca. Los turnos sueltos siguen con un aviso por turno.
  Ni el aviso de publicación ni el de la escalada le llegan a quien ya está
  confirmado (o más adelante) en otro puesto del mismo evento cuyo horario se
  pisa; eso se saca antes del tope, así el lugar lo ocupa el que sigue.
- **Destino de los avisos de turno cerca:** abren `/turno/<id>`, donde la
  persona se postula (primera tanda y escalada). Los viejos guardados con
  `/feed` siguen yendo al Inicio.
- **Cancelación de un turno (2026-11-13): una persona, un aviso.** Al
  asignado le llega `shift_cancelled_late` si ya había confirmado y
  `shift_cancelled` si no; a cada postulación pendiente,
  `applied_shift_cancelled` (y pasa a `rechazada`). El texto sólo nombra el
  turno: ni el motivo ni los demás postulantes. No reciben nada quien retiró
  su postulación, quien había quedado afuera al asignarse el turno
  (postulación ya `rechazada`) ni el comercio. Los avisos salen después de
  guardar la cancelación (`ShiftService._notify_shift_cancelled`): si la base
  rechaza un aviso o cae el push, la cancelación igual responde bien y el
  otro aviso sale.
- **Postulaciones retiradas al confirmar (`applications_withdrawn`, U123,
  2026-11-18).** Título «Retiramos una postulación» o «Retiramos N
  postulaciones»; el texto nombra el turno confirmado y los retirados con su
  comercio (`"Barra" en Bar Palermo`; hasta tres, el resto contado) y cierra
  con «Si el turno confirmado se cae, podés volver a postularte.» Si el aviso
  falla, la confirmación igual responde bien
  (`ShiftService._withdraw_overlapping_applications`).
- **Suspensión de una cuenta (2026-11-14, [ADR-0024](../adr/ADR-0024-efectos-de-una-suspension.md)).**
  Ningún texto dice el motivo ni que la otra cuenta está «suspendida»: dice
  qué pasó con el turno y qué sigue. Salen después de guardar cada turno y no
  hacen fallar la suspensión (`ShiftService._cancel_for_company_suspension`,
  `_reopen_for_worker_suspension`).
  - Comercio suspendido, a la persona asignada o confirmada en un turno que
    no empezó (`shift_cancelled`, abre `/feed`): título «Se canceló un turno
    tuyo»; texto «"X" se canceló. Ya no tenés que ir ni responder, y no cuenta
    en tu reputación. Mirá otros turnos cerca.» Nunca `shift_cancelled_late`:
    no es cancelación tardía.
  - Trabajador suspendido, al comercio de cada turno suyo que no empezó
    (`shift_reopened`, abre `/shifts/<id>/candidates`): título «Tu turno volvió
    a buscar personal»; texto «La persona asignada a "X" ya no puede tomarlo.
    El turno volvió a buscar personal: elegí a otra persona entre los
    postulantes.»
  - Los turnos abiertos de un comercio suspendido sólo se ocultan: nadie
    recibe aviso, y tampoco se escalan (sin `urgent_shift_nearby`).
  - Si a uno de esos turnos ocultos se le pasa el horario, vence igual («no
    cubierto») pero **no sale `shift_not_covered`** a la cuenta suspendida: ni
    en la app, ni push, ni mail (decisión 22, 2026-11-18,
    `ShiftService.mark_not_covered`). Si la cuenta se reactiva después, tampoco:
    el comercio lo ve como «No cubierto» en su panel.
- **Un aviso rechazado por la base no rompe la sesión del pedido
  (2026-11-13):** el adaptador (`SqlAlchemyNotificationRepository`) la deja
  usable y propaga el error. Vale para todos los avisos: quien atrapa el
  error para que el aviso no rompa su acción puede seguir usando la sesión.
- **Destino de los avisos de cancelación:** al asignado, `/my-shifts` (el
  turno sigue en «Asignados», marcado como cancelado); al postulante,
  `/feed`: su postulación ya no figura en ninguna lista y lo útil son los
  otros turnos.
- **No son la fuente de verdad del estado:** son un reflejo. El estado real vive
  en el turno / la reseña. (Ver nota de "eventos" abajo.)

## Entidad

`Notification`: `user_id`, `type` (`NotificationType`), `title`, `message`,
`read`, `created_at`.

## "Eventos" (aclaración de arquitectura)

Staffya **no tiene un bus de eventos formal**. Estas notificaciones se crean como
**efecto dentro del caso de uso** que produce el hito (al asignar, confirmar,
etc., el servicio crea la `Notification` y la empuja por WebSocket). Si en el
futuro se introduce un bus/outbox para desacoplar estos efectos, debe registrarse
como **ADR** y documentarse en `EVENTS.md` (fase de reglas operativas). Ver
[ARCHITECTURE.md](../foundation/ARCHITECTURE.md#eventos).

## Fuera de alcance (hoy)

- **Push nativo** (más allá del WebSocket in-app), email, SMS, WhatsApp: son
  integraciones externas futuras (fase de integraciones).
