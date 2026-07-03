# NOTIFICATIONS.md — Notificaciones (dominio)

> Avisos in-app por usuario. Modelo en
> [DOMAIN.md](./DOMAIN.md#notification--notification). Tiempo real en
> [ARCHITECTURE.md](./ARCHITECTURE.md#tiempo-real-websockets).

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
| `shift_reopened` | el trabajador cancela su asignación ya confirmada ([ADR-0004](./adr/ADR-0004-cancelacion-trabajador-e-insignias.md)); el turno vuelve a buscar personal | comercio |
| `chat_message` | llega un mensaje nuevo en el chat del turno | destinatario del mensaje |
| `review_received` | recibió una reseña | calificado |

## Reglas de negocio

- **Por usuario:** cada notificación pertenece a un usuario; sólo él la ve.
- **Entrega en tiempo real:** se empujan por **WebSocket** (`/notifications/ws`);
  si el usuario no está conectado, quedan para consultarse.
- **Leídas/no leídas:** se pueden marcar como leídas.
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
[ARCHITECTURE.md](./ARCHITECTURE.md#eventos).

## Fuera de alcance (hoy)

- **Push nativo** (más allá del WebSocket in-app), email, SMS, WhatsApp: son
  integraciones externas futuras (fase de integraciones).
