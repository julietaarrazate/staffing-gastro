# Beta etapa 3, Grupo F: chat y soporte
2026-11-17

## Pedido
Hallazgos U012, U017, U092, U099 y U130 (parcial) del triaje de la etapa 3.
U110 queda aparte (lleva migración).

## Qué cambió
- **U012**: `POST /chats/{shift}/messages`, `POST /support/tickets` y
  `POST /support/tickets/{id}/messages` usan `RecorderDep` (`idempotent`), igual
  que application, review, shift y subscription. Un reintento con la misma
  `Idempotency-Key` devuelve el mismo 201 sin duplicar mensaje, ticket ni aviso.
  El front manda la key con `useIdempotencyKeys` (acción = id + texto, así un
  texto editado es otro pedido y lleva key nueva; se limpia al éxito).
- **U017**: `NotificationBell` marca como leídos (y deja de contar) los avisos
  `chat_message` cuyo `link` es la conversación abierta, los que ya estaban y los
  que llegan en vivo, sólo con la pestaña visible. Reusa `POST /notifications/{id}/read`.
- **U092**: «Cerrar ticket» abre un `Modal` de confirmación («Sí, cerrar» / «Volver»).
- **U099**: si la conversación no carga y no hay mensajes (404 de turno ajeno,
  inexistente o sin asignado) se oculta el formulario de envío.
- **U130**: `GET /support/tickets/{id}` agrega `opened_by` (id, nombre, rol) sólo
  si quien consulta es admin (`null` para el resto). El detalle muestra «Abierto
  por <nombre> (rol)» con link a `/admin/personas/<id>`.

## Por qué así
La key del front incluye el texto para no chocar con el 422 «misma clave, pedido
distinto». El aviso del chat se resuelve en la campanita (no en el backend)
porque el mensaje llega por socket sin pasar por el GET que marca leídos.
`opened_by` sale por un puerto nuevo del repositorio (`get_opener`), sin cruzar módulos.

## Queda abierto
- U110 (migración) en otro PR.
- Un aviso de mensaje que llega con la pestaña oculta se marca leído recién al
  volver a verla en esa conversación; en la campanita seguirá contando hasta entonces.
