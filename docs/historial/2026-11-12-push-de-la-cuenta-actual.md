# Las notificaciones push de un dispositivo son de la cuenta que tiene la sesión abierta ahí

**Pedido:** salida a beta, etapa 2 (arreglar lo que encontró la prueba de
punta a punta y lo que reportó la herramienta externa Breken). Reporte
BK-9FB6E2BC2226: en un navegador compartido, o cuando una persona usa dos
cuentas en el mismo dispositivo, las notificaciones push quedaban atadas a
la cuenta que las activó primero. Es un problema de privacidad.

**Qué cambió:** lo que le pasa a la persona:

- Antes: alguien activaba las notificaciones, cerraba sesión, y el
  dispositivo seguía mostrando sus avisos (turno asignado, mensajes) a quien
  lo usara después. Si después entraba otra cuenta, veía el interruptor
  «Notificaciones push: Activadas» en Ajustes pero no le llegaba nada: los
  avisos seguían siendo los de la primera cuenta.
- Ahora: al cerrar sesión el dispositivo deja de recibir los avisos de esa
  cuenta, y la cuenta que entra queda con las notificaciones de ese
  dispositivo sin tener que hacer nada. Quien cierra sesión y vuelve a
  entrar en su propio celular las recupera sola. No cambia cuándo se ofrece
  activarlas ni se vuelve a pedir el permiso del navegador.

Lo técnico:

- `backend/app/modules/notification/infrastructure/repositories.py`,
  `SqlAlchemyPushSubscriptionRepository.add`: si el `endpoint` ya existe,
  queda a nombre de quien lo suscribe ahora y se actualizan las claves.
  Antes devolvía la fila tal cual aunque fuera de otra cuenta. Para la misma
  cuenta sigue siendo idempotente. Un `endpoint`, una fila (el índice único
  ya estaba: sin migración). Se ajustaron los docstrings del puerto
  (`domain/repositories.py`) y de `PushService.subscribe`.
- `frontend/lib/push.ts`: dos helpers que nunca lanzan.
  `claimPushForAccount(token)` manda `POST /push/subscribe` con la
  suscripción que el navegador ya tiene, sólo si el permiso está concedido;
  no pide permiso, no instala el service worker ni crea una suscripción.
  `releasePushFromAccount(token)` manda `DELETE /push/subscribe` con el
  `endpoint` y no cancela la suscripción del navegador.
- `frontend/lib/auth-context.tsx`: un efecto único registra el dispositivo
  cuando hay sesión con usuario (cubre contraseña, Google, invitado, código
  de admin y la sesión recuperada al abrir la app), una vez por sesión.
  `logout` da de baja el dispositivo con el access token vigente
  (`resolveToken`: el `token` del contexto es el de cuando se abrió la
  sesión y a los 15 minutos ya venció) antes de soltar la sesión, sin
  esperar la respuesta. Mientras una admin está en «Ver como» no se registra
  ni se da de baja nada, y al volver a su cuenta tampoco.
- Tests: `backend/tests/test_push.py` (dos casos nuevos),
  `frontend/lib/push.test.ts`, `frontend/lib/auth-context.test.tsx` y
  `frontend/e2e/push-cuenta-actual.spec.ts`.
- Docs: `docs/reference/ACCESO_MODERNO.md` (sección nueva «De quién es el
  push de un dispositivo»; decía «idempotente por `endpoint`», que ya no
  alcanza para describirlo), `docs/reference/API.md` y la fila de Push de
  `docs/reference/MAPA_DEL_CODIGO.md`.

**Por qué así:** la suscripción es del navegador, no de la persona, así que
la regla tiene que seguir a la sesión. Se arregla de los dos lados porque
ninguno alcanza solo: la baja al cerrar sesión puede fallar (sin red, token
vencido) y entonces la reasignación del backend lo corrige cuando entra otra
cuenta; y la reasignación sola dejaría al dispositivo recibiendo los avisos
de la cuenta anterior hasta que alguien más entre. Se descartó cancelar la
suscripción del navegador al cerrar sesión: obligaría a reactivar las
notificaciones en cada ingreso y quien vuelve a entrar en su celular las
perdería sin enterarse. Se descartó esperar la baja antes de cerrar: un
servidor lento no puede demorar ni bloquear el cierre de sesión. El registro
vive en un solo efecto y no en cada función de ingreso para que un ingreso
nuevo quede cubierto sin acordarse de llamarlo.

**Queda abierto:**

- Una sesión que vence sola (30 días sin abrir la app) no puede dar de baja
  el dispositivo, porque ya no tiene token: sigue a nombre de esa cuenta
  hasta que alguien entre ahí.
- Mientras una admin está en «Ver como», el interruptor de Ajustes y el
  pedido de activar notificaciones siguen funcionando con la cuenta que está
  viendo: si activa las notificaciones en ese momento, su dispositivo queda
  a nombre de esa persona hasta que vuelva a ingresar. Ya pasaba antes de
  este cambio y no se tocó acá.
