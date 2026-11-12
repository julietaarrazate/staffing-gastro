# Chat: la conversación es del comercio con la persona asignada, no del turno

**Pedido:** salida a beta, etapa 2 (arreglar lo que encontró la prueba de punta
a punta). Hallazgo U001, bloqueante: el chat se guardaba por turno, y la regla
de dominio dice que la conversación es entre el comercio y el trabajador
asignado. Al reasignarse un turno, las dos cosas dejaban de coincidir.

**Qué cambió:**

- Lo que se ve: cuando un turno se reasigna (rechazo, baja del trabajador o
  ausencia), quien lo recibe **arranca con la conversación vacía** y no la
  tiene en su lista de chats hasta que alguien escribe. El comercio, en el chat
  de ese turno, ve **sólo el hilo con la persona asignada ahora**. La persona
  anterior deja de tener acceso (404, como ya pasaba). Si el turno vuelve a la
  misma persona, retoma su propio hilo. Lista de conversaciones, vista previa
  del último mensaje, contador de no leídos, "visto" y avisos de mensaje nuevo
  son todos del hilo vigente.
- Los mensajes del hilo anterior **no se borran**: quedan guardados (soporte y
  auditoría), pero ninguna pantalla se los muestra a quien no fue parte.
- Dominio (`backend/app/modules/chat/domain/`): `ChatMessage` suma
  `worker_user_id` (la persona del hilo) y aparece el objeto de valor
  `Thread` (turno + trabajador). El puerto `ChatMessageRepository` lee siempre
  por hilo: `list_by_thread`, `mark_read(thread, …)`, `last_messages(threads)`,
  `unread_counts(threads, …)`. Se fueron `list_by_shift` y dos lecturas por
  turno que nadie usaba (`last_message`, `count_unread`): no queda ninguna
  forma de leer "todo el turno".
- Aplicación (`application/services.py`): `_authorize` devuelve el hilo vigente
  (comercio ↔ asignado hoy) y todo sale de ahí: cada mensaje nuevo se guarda en
  ese hilo, "marcar como leído" toca sólo lo recibido en ese hilo, y la bandeja
  pide último mensaje y no leídos por hilo (siguen siendo 3 consultas).
- Tiempo real (`backend/app/core/ws_manager.py`, `chat/api/routes.py`): cada
  conexión del chat queda registrada con el hilo sobre el que se abrió y
  `broadcast_chat` entrega sólo a las de ese hilo. Una conexión del mismo turno
  abierta sobre otro hilo (quedó de antes de una reasignación) no recibe nada y
  se corta: la de quien ya no está asignado no puede volver a abrirse; la del
  comercio se reconecta sola (el frontend ya reintenta y recarga) y queda sobre
  el hilo vigente, en vez de mezclar dos conversaciones en pantalla. El cierre
  sale en segundo plano para no frenar el envío de quien escribe.
- Datos: migración `0045` (`backend/alembic/versions/0045_chat_por_asignacion.py`)
  agrega `chat_messages.worker_user_id` (FK a `users`, `ON DELETE CASCADE`) y el
  índice `(worker_user_id, shift_id, created_at)`, y rellena lo que ya existía
  con una regla conservadora, explicada en su docstring: lo que escribió un
  trabajador es de su hilo; lo que escribió el comercio va al hilo de quien
  recibió el aviso `chat_message` de ese mismo mensaje (link al turno y comienzo
  del texto), sólo si ese aviso se identifica sin duda. Si el aviso ya no está
  (la limpieza borra los leídos de más de 90 días) o el texto se repite en el
  turno, queda sin hilo y no se le muestra a nadie.
- Sin cambios de frontend ni de textos legales (lo que dicen `/privacidad` y
  `/terminos` sobre el chat sigue siendo cierto).
- Tests: `backend/tests/test_chat_hilos.py` (9: los tres caminos que
  desasignan, hilo vacío para quien llega, 404 para quien se fue, el comercio
  ve sólo el hilo actual, no leídos y último mensaje por hilo, marcar leído no
  toca otro hilo, retomar el propio hilo, aviso sólo a la persona del hilo y el
  WebSocket), `backend/tests/test_chat_migracion_hilos.py` (corre las mismas
  sentencias SQL del relleno sobre doce casos, dos veces) y tres tests nuevos en
  `backend/tests/test_ws_manager.py`. Además se corrió a mano contra un
  Postgres 16 local: los tests de chat, `alembic upgrade head` desde cero,
  `downgrade 0044` y de nuevo `upgrade head` con datos, con el mismo resultado
  que en SQLite.
- Docs del área: `docs/reference/CHAT.md`, `docs/foundation/DOMAIN.md` (Chat),
  y las líneas del chat en `docs/foundation/ARCHITECTURE.md`,
  `docs/reference/API.md` y `docs/reference/DATABASE.md`.

**Por qué así:**

- *La persona del hilo se guarda en cada mensaje* (y no se calcula al leer con
  quien está asignado hoy): es lo único que no cambia cuando el turno cambia de
  manos. Un mensaje enviado justo mientras se reasigna queda en el hilo de quien
  lo tenía en pantalla.
- *`worker_user_id` y no el perfil:* el chat ya habla en `user_id`
  (`sender_user_id`, participantes, avisos), y así el relleno de lo que escribió
  un trabajador no necesita deducir nada.
- *No borrar el hilo anterior al reasignar:* se descartó porque perdería lo que
  soporte necesita ante un reclamo, y porque obligaría a que el módulo de turnos
  toque el chat en cada transición. Con el hilo en el mensaje, las transiciones
  de `Shift` no cambian.
- *Relleno por mensaje, con el aviso como prueba:* no hay historial de
  asignaciones guardado. La primera versión decidía por turno (si en el turno
  aparecía una sola persona, todo lo del comercio era de ella), pero alguien
  asignado directo desde «Recomendados» que no escribe ni se postula no deja
  más rastro que los avisos que recibió, y lo que el comercio le escribió
  terminaba en el hilo de quien vino después. El aviso de cada mensaje dice a
  quién se le mandó; si no se lo puede identificar sin duda, el mensaje queda
  sin hilo: se prefiere que deje de verse antes que mostrárselo a la persona
  equivocada.
- *Tope de conexiones por hilo:* las 8 conexiones en vivo se cuentan por hilo,
  no por turno; las que quedaron abiertas sobre un hilo anterior no le quitan
  lugar a quien tiene el turno ahora mientras esperan su corte.
- *Cortar la conexión en vivo en vez de sólo filtrar:* quien ya no participa no
  tiene por qué conservar un canal abierto, y para el comercio el corte es lo que dispara la recarga
  al hilo vigente sin tocar el frontend.
- *Índice con `worker_user_id` adelante:* sirve igual a las lecturas por hilo
  (siempre filtran por las dos columnas) y además cubre la clave foránea nueva;
  el `(shift_id, created_at)` de la 0040 se queda para la de `shifts`.

**Queda abierto:**

- El comercio no tiene una pantalla para volver a leer el hilo con una persona
  que ya no está asignada (los mensajes están guardados). Si hace falta para
  soporte, es una vista de admin aparte.
- Lo que el relleno deja sin hilo deja de verse para las dos partes: mensajes
  del comercio cuyo aviso ya se borró (leídos de más de 90 días) o con un texto
  repetido en el mismo turno (un «Hola» a dos personas). Siguen guardados.
- **Paso de deploy.** El contenedor nuevo corre `alembic upgrade head` al
  arrancar mientras el viejo todavía atiende: un mensaje enviado con el código
  anterior en esa ventana queda sin hilo. Deployar en un horario sin uso. Si
  igual entró alguno, contar los de la ventana
  (`SELECT COUNT(*) FROM chat_messages WHERE worker_user_id IS NULL AND
  created_at >= '<inicio del deploy>'`) y, si hay, volver a correr las dos
  sentencias de `RELLENO` de la 0045: sólo tocan mensajes sin hilo y exigen el
  aviso de cada mensaje, así que no mueven nada que ya tenga hilo ni le dan a
  nadie un mensaje que no recibió (el test las corre dos veces). No escribir a
  mano otra regla de reparación.
- Una pestaña del comercio que quedó abierta en el chat mientras el turno se
  reasignaba desde otro lado sigue mostrando el hilo anterior hasta que llega
  el primer mensaje o "visto" del hilo nuevo (ahí se reconecta y recarga). Si
  el comercio escribe antes desde esa pestaña, el mensaje va a la persona
  asignada ahora. Cerrarlo del todo pide que el frontend sepa en qué hilo está.
- El ítem de la salida a beta en `docs/STATUS.md` vive en otro PR; este no lo
  toca.
