# CHAT.md — Chat (dominio)

> Mensajería trabajador↔comercio. Modelo en
> [DOMAIN.md](../foundation/DOMAIN.md#chat--chatmessage). Aspectos de tiempo real en
> [ARCHITECTURE.md](../foundation/ARCHITECTURE.md#tiempo-real-websockets).

## Qué es

Un canal de mensajería simple **por turno** para que el comercio y el trabajador
asignado coordinen los detalles (llegada, uniforme, dudas). Estilo WhatsApp: una
conversación por turno, en tiempo real.

## Reglas de negocio

- **Ámbito por turno:** cada conversación pertenece a **un turno**. No hay chat
  general ni entre usuarios sin un turno de por medio.
- **Participantes:** sólo el **comercio dueño** del turno y el **trabajador
  asignado** a ese turno. Cualquier otro no puede leer ni escribir (se valida
  participante; ajeno = 404 / rechazo).
- **Prerrequisito:** existe conversación una vez que hay un trabajador asignado al
  turno (antes de la asignación no hay con quién chatear).
- **Tiempo real:** los mensajes se entregan por **WebSocket**; al enviar un
  mensaje se **notifica** al destinatario (`chat_message`).
- **No leídos:** el inbox muestra la última actividad y el conteo de no leídos;
  los mensajes se marcan leídos.

## Entidad

`ChatMessage`: `shift_id`, `sender_user_id`, `body`, `read`, `created_at`.

## Invariantes

- Un mensaje pertenece a un turno y tiene un emisor que es participante de ese
  turno.
- No se puede chatear en un turno del que no se es participante.

## Fuera de alcance (hoy)

- Envío de **imágenes, ubicación o audio** dentro del chat (el rediseño lo
  contempla como objetivo de UX, pero el dominio hoy sólo maneja texto).
- Llamadas.

> Si se agregan tipos de mensaje (imagen/ubicación/audio), es una extensión del
> dominio del chat: definir el modelo y documentarlo acá.
