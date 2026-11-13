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
  activarlas ni se vuelve a pedir el permiso del navegador. Al cerrar sesión
  también se van de la bandeja los avisos que el dispositivo ya había
  mostrado.
- «Ver como»: mientras la admin mira la app como otra persona, su
  dispositivo sigue siendo suyo. En Ajustes el interruptor «Notificaciones
  push» queda deshabilitado, con una línea que dice por qué, y no se le
  ofrece activar las notificaciones. Antes, un toque ahí dejaba su
  dispositivo a nombre de la persona que estaba viendo, o le cancelaba las
  suyas.
- Admin con la verificación en dos pasos sin terminar: el registro del
  dispositivo espera a que la termine, y nada de esto la manda al alta ni le
  cierra la sesión por su cuenta.
- Salir y volver a entrar enseguida con la red trabada: el registro del
  dispositivo sale cuando terminó la baja de la sesión anterior. Antes podía
  llegar primero al servidor, y la baja borraba el registro nuevo: Ajustes
  decía «Activadas» y no llegaba ningún aviso hasta volver a cargar la app.

Lo técnico:

- `backend/app/modules/notification/infrastructure/repositories.py`,
  `SqlAlchemyPushSubscriptionRepository.add`: si el `endpoint` ya existe y
  llega con las claves que estaban guardadas, queda a nombre de quien lo
  suscribe ahora. Antes devolvía la fila tal cual aunque fuera de otra
  cuenta. Para la misma cuenta sigue siendo idempotente. Un `endpoint`, una
  fila (el índice único ya estaba: sin migración). Con otras claves no se
  toca nada y la respuesta es la misma. La comparación vive en el dominio
  (`PushSubscription.is_same_browser_as`, `domain/entities.py`, en tiempo
  constante). Se ajustaron los docstrings del puerto
  (`domain/repositories.py`) y de `PushService.subscribe`.
- `frontend/lib/push.ts`: dos helpers que nunca lanzan.
  `claimPushForAccount(token)` manda `POST /push/subscribe` con la
  suscripción que el navegador ya tiene, sólo si el permiso está concedido;
  no pide permiso, no instala el service worker ni crea una suscripción.
  `releasePushFromAccount(token)` manda `DELETE /push/subscribe` con el
  `endpoint` y no cancela la suscripción del navegador; además cierra los
  avisos que ese service worker ya había mostrado
  (`registration.getNotifications()`), sin esperar. El registro sale después
  de la última baja que salió de ese navegador, si sigue en camino, con un
  tope de 10 segundos (`CLAIM_WAITS_FOR_RELEASE_MS`); y no sale si en esa
  espera hubo otra baja, que es la de su propia sesión.
- `frontend/lib/api.ts`: `backgroundApi` (`post` y `del`), para los pedidos
  que la app hace por su cuenta. Salen como cualquier otro, pero un 403 del
  candado de dos pasos (ADR-0023) no avisa al manejador que lleva al alta o
  cierra la sesión. Lo usan sólo los dos helpers de arriba.
- `frontend/lib/auth-context.tsx`: un efecto único registra el dispositivo
  cuando hay sesión con usuario (cubre contraseña, Google, invitado, código
  de admin y la sesión recuperada al abrir la app), una vez por sesión.
  `logout` da de baja el dispositivo con el access token vigente
  (`resolveToken`: el `token` del contexto es el de cuando se abrió la
  sesión y a los 15 minutos ya venció) antes de soltar la sesión, sin
  esperar la respuesta. Mientras una admin está en «Ver como» no se registra
  ni se da de baja nada, y al volver a su cuenta tampoco. Con el alta de dos
  pasos pendiente (`twoFactorSetupPending`) el registro no se manda; sale
  cuando `adoptSession` o `completeTwoFactor` abren la sesión verificada.
- `frontend/components/PushToggle.tsx`: en «Ver como» el botón queda
  deshabilitado, `toggle()` no hace nada y debajo va la explicación
  (`aria-describedby`, `text-caption text-ink-soft`). El resaltado al pasar
  el mouse ahora es sólo para el botón habilitado.
- `frontend/lib/push-prompt-context.tsx`: en «Ver como» `requestOptIn` no
  abre el pedido y `accept` lo cierra sin registrar ni darlo por mostrado.
- Tests: `backend/tests/test_push.py` (tres casos nuevos),
  `frontend/lib/push.test.ts`, `frontend/lib/api.test.ts`,
  `frontend/lib/auth-context.test.tsx`,
  `frontend/lib/auth-context.two-factor-gate.test.tsx`,
  `frontend/components/PushToggle.test.tsx`,
  `frontend/lib/push-prompt-context.test.tsx` y
  `frontend/e2e/push-cuenta-actual.spec.ts` (cuatro recorridos).
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

Cosas que salieron de la revisión:

- La reasignación pide las mismas claves porque, sin eso, reabría por el
  alta lo que la revisión de seguridad del 2026-10-20 cerró para la baja:
  alcanzaba con conocer el `endpoint` de otra persona para quedárselo. El
  mismo navegador manda siempre las mismas claves para su `endpoint`, así
  que el caso real no cambia.
- El registro y la baja no avisan al candado de dos pasos porque nadie los
  pidió desde una pantalla. Con el arreglo a medias, a una admin con el alta
  pendiente el registro la mandaba al alta antes de su primer pedido, y la
  baja, que contesta con la sesión ya cerrada, la llevaba de la landing al
  alta y de vuelta (visto en el navegador con el backend contestando con
  demora). Se descartó consultar antes el estado de la verificación: es un
  pedido más en cada ingreso de admin para algo que el backend ya rechaza.
- En «Ver como» se deshabilita en vez de ocultar: el interruptor sigue
  mostrando el estado real del dispositivo y la línea explica por qué no se
  puede tocar.
- El acceso invitado registra el dispositivo como cualquier cuenta. Las
  cuentas invitadas son compartidas, así que ese dispositivo recibe avisos
  que generan otras personas; se dejó así y quedó escrito en
  `ACCESO_MODERNO.md`, porque no registrarlo dejaría el dispositivo a nombre
  de la cuenta real anterior cuando su baja no llegó.
- El registro espera a la baja en camino porque `DELETE` borra la fila si es
  de quien lo pide: una baja que llega tarde no le saca el dispositivo a
  otra cuenta, pero a la misma sí (visto en el navegador con la baja
  retenida: el registro nuevo llegaba antes). Se descartó esperar sin tope:
  una baja colgada dejaría el dispositivo a nombre de la cuenta que salió
  con otra ya adentro, que es lo que este cambio vino a cerrar. Se descartó
  cortar la baja a los 10 segundos: ordena igual, pero pierde bajas en una
  red lenta. Y se descartó poner los dos pedidos en una sola fila: demoraría
  la baja del cierre de sesión, que hoy sale en el momento. El registro que
  quedó esperando se descarta si la sesión se vuelve a cerrar; mandarlo
  dejaría el dispositivo a nombre de una cuenta que ya salió.

**Queda abierto:**

- Dos pestañas con cuentas distintas (visto en la tercera revisión; no es una
  regresión): si en una pestaña la cuenta A cierra sesión y entra B, y después
  alguien toca «Cerrar sesión» en otra pestaña que todavía mostraba a A, las dos
  quedan sin sesión y la fila de B sigue: el dispositivo recibe los avisos de B
  hasta que alguien entre. Se cierra con el cambio de servidor ya previsto (que
  `POST /auth/logout` reciba el `endpoint` y borre la fila de la cuenta dueña de
  la cookie de refresco).
- Una sesión que termina sin «Cerrar sesión» no da de baja el dispositivo,
  porque no hay token con el que pedirlo: sigue recibiendo los avisos de esa
  cuenta hasta que alguien entre ahí. Pasa cuando la sesión vence sola (30
  días sin abrir la app) y cuando el servidor la revoca
  (`revoke_all_for_user`: contraseña restablecida, cuenta sin verificar
  reclamada con Google, alta de la verificación en dos pasos, refresh token
  reutilizado, suspensión desde el panel). El segundo grupo es el más serio:
  quien restablece la contraseña para sacar a alguien de un dispositivo deja
  a ese dispositivo recibiendo sus avisos. Se cierra del lado del servidor,
  en un PR aparte: al revocar todas las sesiones de una cuenta, borrar
  también sus suscripciones push por un puerto inyectado. Los dispositivos
  donde alguien cerró sesión antes de este cambio están igual: siguen a
  nombre de esa cuenta hasta que alguien entre ahí, y no hay limpieza. Ese
  PR puede incluir una, por única vez, al desplegar; la más simple es vaciar
  la tabla, porque el registro automático repone cada dispositivo la próxima
  vez que la app se carga con sesión. El costo: hasta entonces ese
  dispositivo no recibe avisos, tampoco el de quien nunca cerró sesión.
- Una baja que no llega al cerrar sesión (access token vencido justo en ese
  momento, sin red, o admin a la que el candado de dos pasos le rechaza el
  pedido) deja el dispositivo a nombre de la cuenta que salió hasta que
  entre otra en ese navegador. Un registro que falla por un corte justo al
  abrir la sesión no se reintenta en esa sesión: si hacía falta crear o
  reasignar la fila, Ajustes dice «Activadas» y no llega nada hasta que la
  app se vuelve a cargar. Quedan sin ordenar dos carreras poco probables:
  una baja que tarda más de 10 segundos y llega después del registro de la
  misma cuenta, y un cierre de sesión con el registro de esa sesión todavía
  en camino. Detalle en `ACCESO_MODERNO.md`.
- El texto de `/privacidad` dice «Notificaciones: si las activás, guardamos
  el identificador que tu navegador nos da para mandarte avisos. Se borra al
  desactivarlas.» Con este cambio, a quien entra en un navegador donde otra
  persona ya las había activado (y a quien entra como invitada) se le guarda
  ese identificador sin que las haya activado ella, y también se borra al
  cerrar sesión. No se tocó acá: cambiar un texto legal es decisión de
  Julieta, y va con `LEGAL_TERMS_VERSION` en backend y en
  `frontend/lib/legal.ts`. Hay una redacción posible en `ACCESO_MODERNO.md`.
