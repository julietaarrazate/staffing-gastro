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
| `shift_rejected` | el trabajador rechaza la asignación | comercio |
| `shift_checked_out` | el trabajador marca la salida (check-out) | comercio |
| `shift_paid` | el comercio marca el turno como pagado | trabajador |
| `shift_reopened` | el trabajador cancela su asignación ya confirmada ([ADR-0004](../adr/ADR-0004-cancelacion-trabajador-e-insignias.md)), o se suspende la cuenta de la persona asignada o confirmada ([ADR-0024](../adr/ADR-0024-efectos-de-una-suspension.md)); el turno vuelve a buscar personal | comercio |
| `shift_cancelled_late` | el comercio cancela un turno con el trabajador ya confirmado o en pleno turno (cancelación tardía, [ADR-0007](../adr/ADR-0007-no-show-y-cancelacion-tardia.md)) | trabajador asignado |
| `shift_no_show` | el comercio marca «No se presentó» (`manual`) o el sistema no vio su llegada pasado el plazo (`automatic`, scheduler de asistencia, [ADR-0008](../adr/ADR-0008-asistencia-simplificada-y-no-show-automatico.md)); el turno vuelve a buscar personal | trabajador ausente (el comercio no recibe aviso de este tipo); abre `/profile` |
| `shift_cancelled` | el comercio cancela un turno asignado que el trabajador todavía no había confirmado, o el turno se cancela porque se suspendió la cuenta del comercio ([ADR-0024](../adr/ADR-0024-efectos-de-una-suspension.md)) | trabajador asignado |
| `applied_shift_cancelled` | el comercio cancela un turno con postulaciones pendientes | cada persona con la postulación pendiente |
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
  - El comercio no recibe un aviso propio de la ausencia (decisión G3). Si tras
    la ausencia el turno termina en «no cubierto» (`shift_not_covered`), su
    aviso dice la verdad: «"X" quedó sin cubrir: una persona confirmada no se
    presentó y no se consiguió reemplazo a tiempo. Podés publicarlo de nuevo.»
    (mismo título, tipo y destinatario). Vale en todos los caminos con ausencia
    (`no_show_at` no se limpia): sin reemplazo, o con un reemplazo que no
    confirmó o canceló. Sin ausencia previa queda el de siempre: «Se agotó el
    tiempo para cubrir "X" sin que nadie confirmara. Podés publicarlo de nuevo.»
    Si tras la ausencia el turno se vuelve a cubrir, no hay texto que corregir.
  - En el perfil propio, con al menos una ausencia o cancelación se ve «¿Alguna
    no corresponde? Escribinos a Soporte» (link a `/support`).
- **Por usuario:** cada notificación pertenece a un usuario; sólo él la ve.
- **Entrega en tiempo real:** se empujan por **WebSocket** (`/notifications/ws`);
  si el usuario no está conectado, quedan para consultarse.
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
