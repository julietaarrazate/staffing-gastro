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
- **La conversación es con una persona (hilo):** es del comercio con **la persona
  asignada**, no del turno a secas. Cada mensaje queda atado al trabajador con
  quien se estaba hablando cuando se escribió: un hilo por *(turno, trabajador)*.
- **Participantes:** sólo el **comercio dueño** del turno y el **trabajador
  asignado hoy** a ese turno. Cualquier otro no puede leer ni escribir (se valida
  participante; ajeno o inexistente = 404).
- **Si el turno se reasigna** (rechazo, baja del trabajador, ausencia):
  - quien recibe el turno **arranca con la conversación vacía** y no la tiene en
    su lista hasta que alguien escribe;
  - el comercio, en el chat de ese turno, ve **sólo el hilo con la persona
    asignada ahora**;
  - la persona anterior **deja de tener acceso** (404), también en vivo;
  - los mensajes del hilo anterior **no se borran** (soporte y auditoría), pero
    no se le muestran a nadie que no haya sido parte. Si el turno vuelve a la
    misma persona, retoma su propio hilo.
- **Prerrequisito:** existe conversación una vez que hay un trabajador asignado al
  turno (antes de la asignación no hay con quién chatear).
- **Tiempo real:** los mensajes se entregan por **WebSocket**; al enviar un
  mensaje se **notifica** al destinatario (`chat_message`), que es la otra parte
  del hilo. Cada conexión queda atada al hilo sobre el que se abrió: si el turno
  se reasigna, la conexión que quedó abierta no recibe nada del hilo nuevo y se
  corta (la de quien ya no está asignado no puede volver a abrirse; la del
  comercio se reconecta sola sobre el hilo vigente).
- **No leídos:** el inbox muestra la última actividad y el conteo de no leídos
  **del hilo vigente**; abrir la conversación marca como leído sólo lo recibido
  en ese hilo.

## Entidad

`ChatMessage`: `shift_id`, `worker_user_id` (la persona del hilo),
`sender_user_id` (quién lo escribió: el comercio o esa persona), `body`, `read`,
`created_at`.

`Thread` (objeto de valor): `shift_id` + `worker_user_id`. Todas las lecturas del
repositorio son por hilo (`list_by_thread`, `mark_read`, `last_messages`,
`unread_counts`); no existe una lectura "por turno".

## Invariantes

- Un mensaje pertenece a un hilo (turno + persona asignada) y su emisor es una
  de las dos partes de ese hilo.
- No se puede chatear en un turno del que no se es participante hoy.
- Nada de lo que se muestra o se avisa cruza de un hilo a otro: mensajes, lista
  de conversaciones, último mensaje, no leídos, marcar como leído, avisos y push
  en vivo.

## Mensajes anteriores a la separación por hilo

La migración `0045` agregó `chat_messages.worker_user_id` y rellenó lo que ya
existía con una regla conservadora (detalle en el docstring de
`backend/alembic/versions/0045_chat_por_asignacion.py`): lo que escribió un
trabajador es de su hilo; lo que escribió el comercio entra a un hilo sólo si el
turno tuvo una única persona; ante la duda el mensaje queda **sin hilo**
(`worker_user_id` nulo): sigue guardado y la app no se lo muestra a nadie.

## Fuera de alcance (hoy)

- Envío de **imágenes, ubicación o audio** dentro del chat (el rediseño lo
  contempla como objetivo de UX, pero el dominio hoy sólo maneja texto).
- Llamadas.

> Si se agregan tipos de mensaje (imagen/ubicación/audio), es una extensión del
> dominio del chat: definir el modelo y documentarlo acá.
