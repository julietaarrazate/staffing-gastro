# La app siempre sabe si hay sesión (G7: U112, U096, U114, U115)

**Pedido:** salida a beta, etapa 2, grupo G7 del diseño de los graves
(`docs/planning/BETA_DISENO_GRAVES.md`). Cuatro hallazgos de la prueba de
punta a punta con la misma causa: la app no se enteraba de que la sesión
había terminado, o creía que había terminado cuando el servidor sólo estaba
dormido.

**Qué cambió:**

- **Sesión vencida a mitad de algo (U112, U096).** Antes salía «No
  autorizado» y la pantalla se quedaba ahí. Ahora la app lleva al ingreso,
  que dice «Tu sesión venció, volvé a ingresar», y al ingresar vuelve a la
  pantalla en la que estaba la persona.
- **Servidor dormido al abrir (U114).** Antes, a los 12 segundos la cabecera
  pasaba a la de visitante («Ingresar», «Crear cuenta») aunque la sesión
  seguía guardada. Ahora dice «Reconectando…», nadie es mandado al ingreso y
  la app vuelve a probar sola (a los 2, 5 y 10 segundos, después cada 15,
  sólo con la pestaña a la vista o al volver la conexión).
- **Cerrar sesión en una pestaña cierra las otras (U115).**

Lo técnico:

- `frontend/lib/auth-context.tsx`: `endSession(motivo)` deja el contexto sin
  `token` ni `user` cuando la renovación es rechazada (antes sólo borraba lo
  guardado). Estados nuevos `sessionEnded` (`vencida` | `suspendida`) y
  `reconnecting`. `restoreOnce()` reemplaza a `restoreSession()` y la usa
  también el bucle de reconexión. Un contador de sesión (`sessionEpoch`)
  evita que una recuperación que quedó esperando pise a quien ingresó
  mientras tanto. Escucha el evento `storage` de la marca
  `staffya_has_session`; la clave nueva `staffya_session_end` le dice a las
  otras pestañas si fue una salida o un vencimiento.
- `frontend/lib/api.ts`: un 401 con el token de la sesión que no se pudo
  renovar ya no devuelve el texto del servidor. Si el servidor no contestó,
  es un error de conexión (la sesión sigue); si la renovación fue rechazada,
  «Tu sesión venció. Volvé a ingresar.» (`session_expired`). Viendo como
  otra persona, un mensaje propio, sin tocar la sesión de la admin.
- `frontend/lib/safe-next.ts` (nuevo): `safeNext` valida que `next` sea una
  ruta interna (una sola `/` al inicio, sin `\`, sin caracteres de control,
  mismo origen después de resolver, y no el propio `/login`); `loginHref`
  arma la dirección del ingreso; los textos por motivo son fijos.
- `frontend/lib/use-require-auth.ts`: manda a
  `/login?motivo=…&next=<ruta actual>`; no redirige mientras se reconecta.
- `frontend/app/login/page.tsx`, `components/TwoFactorLoginStep.tsx`: el
  aviso del motivo y la vuelta a `next` (contraseña, Google con cuenta
  existente y código de dos pasos).
- `frontend/components/Navbar.tsx`, `components/landing/LandingGate.tsx`: el
  estado neutro.

**Por qué así:**

- El motivo viaja como una palabra (`?motivo=vencida`) y el texto lo pone la
  app: un link armado por otro no puede hacerle decir cualquier cosa al
  ingreso.
- `suspendida` depende de que el servidor mande el código
  `account_suspended` en el 403, que suma G6. Hasta entonces una cuenta
  suspendida se trata como sesión vencida y el ingreso responde lo de hoy.
- Reconectando, `loading` pasa a `false` como antes (las pantallas pintan lo
  que tengan guardado) en vez de dejar la app esperando: lo nuevo es que
  queda dicho que hay una sesión por confirmar.
- El token de acceso sigue valiendo en el servidor hasta 15 minutos después
  de cerrar sesión: no se cambió (decisión del diseño).

**Lo que encontró la revisión independiente (arreglado en este mismo PR):**

- `safeNext` validaba lo que entraba pero devolvía la ruta ya resuelta, y
  resolver los `.` y `..` de adelante podía dejar una `//` al inicio:
  `/login?next=/.//otro.sitio` mandaba a otro sitio después de ingresar.
  Ahora rechaza cualquier `//` en la ruta y valida también lo que devuelve.
- La respuesta de una renovación se aplicaba aunque la sesión hubiera
  cambiado de manos mientras esperaba (ingresar con otra cuenta durante la
  reconexión, o cerrar sesión con una renovación en vuelo): podía quedar una
  persona con el token de otra, o revivir una sesión recién cerrada. Ahora la
  renovación es una sola a la vez, compara el contador de sesión antes de
  aplicar nada, un ingreso espera a la que esté en vuelo (hasta 15 segundos)
  y no arranca otra mientras dura, y la salida le avisa al servidor después
  de que termine.
- La renovación ya no se corta a los 12 segundos al abrir la app: el
  servidor rota la cookie al contestar, y un pedido cortado y repetido se
  toma por un robo y cierra todas las sesiones de la cuenta. La app deja de
  esperar, pero el pedido sigue y los reintentos lo reusan.

**Queda abierto:**

- Al recuperarse la conexión, las pantallas que ya habían fallado («Error al
  cargar tus turnos») no se vuelven a pedir solas hasta que entre G1
  (`lib/live-refresh.ts`).
- `next` sólo se usa en el ingreso; el registro, Google con cuenta nueva y
  la bienvenida son G16.
- Si en otra pestaña se ingresa con **otra** cuenta, ésta no se entera hasta
  su próxima renovación.
- `/login?message=…` sigue mostrando el texto que venga en la dirección.
