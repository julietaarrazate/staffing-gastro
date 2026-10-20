# Suscripciones push: sólo servicios conocidos, con timeout y por dueño

**Pedido:** Julieta, 2026-10-20, como parte de la revisión de seguridad
(ítem 11 de `../STATUS.md`, prioridad media).

**Qué cambió:** el backend le hace un POST al `endpoint` que manda el
navegador al activar los avisos. El endpoint era texto libre y el envío no
tenía timeout, así que cualquier usuario podía apuntarlo a una URL interna o
a un servidor que no responde, y cada aviso ocupaba un hilo del pool.
Además, `DELETE /push/subscribe` borraba por endpoint sin mirar de quién era.

- `backend/app/modules/notification/domain/value_objects.py`:
  `is_known_push_endpoint` exige `https` y host de FCM, Mozilla, Apple o
  Windows (o un subdominio suyo). Lo usa el validador de
  `PushSubscribeRequest` (`api/schemas.py`): otro endpoint da 422.
- `infrastructure/webpush_sender.py`: `timeout=10` segundos en `webpush`.
- `remove_by_endpoint(endpoint, user_id=...)` en el puerto, el repositorio
  y `PushService.unsubscribe`: sólo borra la suscripción propia.
- `backend/tests/test_push.py`: endpoints rechazados y que otro usuario no
  pueda borrar tu suscripción.

**Por qué así:** una lista de servicios es más simple y más segura que
intentar bloquear IPs internas (redirecciones, DNS). Si un navegador nuevo
usa otro servicio, se agrega a `_PUSH_SERVICE_HOSTS`.

**Queda abierto:** las suscripciones ya guardadas no se revisaron; si hubiera
alguna con otro host, seguiría recibiendo avisos hasta que el navegador la
renueve.
