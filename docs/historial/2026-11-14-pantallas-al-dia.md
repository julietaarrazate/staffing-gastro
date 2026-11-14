# Pantallas al día con los avisos (G1: U013, U014, U016; #560)

**Pedido:** salida a beta, grupo G1 (`docs/planning/BETA_DISENO_GRAVES.md`). Cada
pantalla cargaba una vez al entrar: el trabajador confirmaba y el panel del
comercio seguía en «Asignado»; el comercio cancelaba y «Mis turnos» seguía
ofreciendo «Llegué»; una conversación nueva no figuraba en la lista y su
encabezado quedaba vacío.

**Qué cambió:**
- `frontend/lib/live-refresh.ts` (nuevo): `emitLiveRefresh()` y
  `useLiveRefresh(load, { paused })`. Llama a `load({ silent: true })` cuando
  (1) llega un aviso por el WebSocket de la campanita, (2) se toca un aviso que
  apunta a la pantalla en la que ya se está, (3) la pestaña vuelve a verse o
  vuelve la conexión, (4) el WebSocket se reconecta. Varios avisos juntos valen
  una recarga (400 ms), con la pestaña oculta queda pendiente hasta volver a
  verla, volver a la pestaña no recarga si hubo una recarga hace menos de 5 s,
  y una recarga en curso no se pisa con otra.
- `components/NotificationBell.tsx` emite en (1), (2) y (4).
- Se suscriben `app/shifts/page.tsx` (panel), `app/shifts/[id]/candidates/page.tsx`,
  `app/my-shifts/page.tsx`, `components/ShiftDetail.tsx` y `app/chats/layout.tsx`;
  los que no tenían `silent` lo ganaron (sin esqueleto, sin pisar con un error
  pasajero). Cada una pasa `paused` mientras hay un diálogo abierto o una
  acción en curso (la lista no se mueve debajo de lo que la persona decide).
- Chat (U016): `app/chats/[shiftId]/page.tsx` pide de nuevo la lista (en
  silencio, vía `ConversationsControlContext`) al mandar el primer mensaje, y
  si la lista ya cargó y no trae la conversación, pide el turno y arma el
  encabezado con eso.
- Pruebas: `frontend/lib/live-refresh.test.tsx` (unidad del hook) y
  `frontend/e2e/pantallas-al-dia.spec.ts` (aviso por WebSocket que actualiza el
  panel y «Mis turnos», y encabezado de un chat nuevo).

**Por qué así:**
- **Sin consulta periódica nueva:** cada pedido despierta la base (Neon, con
  cuota); el disparador es el aviso. Se conserva el refresco de 30 s de «va en
  camino» del panel, pero sin su propio `visibilitychange` (ahora lo cubre el
  hook, para no pedir dos veces).
- **Campanita en todas las pantallas:** está en el `Navbar` del layout raíz
  (visible en celular y escritorio, salvo en `/bienvenida`, la landing sin
  sesión e `/historia`), así que no hizo falta subir el WebSocket a un
  proveedor. El hook no depende de dónde esté la campanita: sólo de `emit`.
- **Tocar un aviso emite sólo si el destino es la misma ruta:** si es otra, esa
  pantalla carga sola al abrirse y emitir sería un pedido de más.
- **Pausa en vez de descartar:** lo que llega durante un diálogo o una acción
  queda pendiente y se pide al soltarse.

**Ajustes tras la revisión independiente (PR #560):**
- **Bucle de recargas con el socket que abre y cierra enseguida** (el backend
  acepta y cierra con 1013/1008): `useWebSocket.ts` reiniciaba el backoff en
  cada `onopen`, así que reintentaba cada ~1 s para siempre y, con G1, cada
  reapertura recargaba todas las pantallas. Ahora el backoff sólo se reinicia
  al cerrarse una conexión que vivió al menos 5 s (`WS_STABLE_AFTER_MS`); una
  que abre y cierra enseguida sigue creciendo hasta los 15 s. En
  `NotificationBell.tsx` una reapertura sólo recarga la campanita y emite si
  pasaron 30 s desde la última que lo hizo (`RECONNECT_REFRESH_MIN_GAP_MS`), y
  la «primera apertura» se reinicia al cambiar el token. Tests en
  `lib/useWebSocket.test.tsx` y `components/NotificationBell.reconexion.test.tsx`.
- **Respuestas viejas pisando a las nuevas:** `ShiftDetail.tsx` ahora cancela
  al cambiar de turno o desmontar, aplica «último pedido gana» y una lista de
  postulaciones que salió antes de postularse nunca baja de «applied»/«applying»
  a «can_apply» (test en `ShiftDetail.test.tsx`). `app/shifts/page.tsx` y
  `app/my-shifts/page.tsx` tienen la misma guarda en `load` (el último pedido
  gana y es el único que baja el esqueleto).
- **Una carga normal descartada por una silenciosa que falla:** el panel, Mis
  turnos, candidatos y el detalle del turno ahora pasan `paused` mientras corre
  la primera carga (o una carga normal), así la recarga por aviso espera y,
  si la primera falla, se ve el error con «Reintentar» (o el botón de
  postularse) en vez de un esqueleto o un vacío falso. Test en
  `ShiftDetail.test.tsx`; el mecanismo común (`paused` difiere y retoma) está en
  `live-refresh.test.tsx`. Además, `e2e/saved-shifts.spec.ts` espera el
  `DELETE` con `expect.poll` (carrera del spec).

**Queda abierto:** el encabezado del chat, cuando la lista no trae la
conversación, le dice al comercio «Trabajador asignado» porque `GET /shifts/{id}`
no incluye el nombre del trabajador (sólo `/shifts/me`); mostrar el nombre
pediría un cambio de backend. No se agregó el aviso de «finalizado» (el diseño
dice que no se suma).
