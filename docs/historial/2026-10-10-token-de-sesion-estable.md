# La sesión ya no recarga las pantallas al renovar el token

**Pedido:** tercer arreglo de la auditoría del 2026-10-10 (ver
[`2026-10-10-auditoria-privacidad.md`](./2026-10-10-auditoria-privacidad.md)),
los dos hallazgos altos del frontend.

**Qué ve el usuario:**

- **"Va en camino" sigue llegando** después de los 15 minutos. Antes, al
  vencer el token, cada envío daba 401 sin aviso y el comercio veía una
  posición vieja mientras el trabajador leía "compartiendo". Ahora, si el
  backend rechaza el envío (el turno ya no está en viaje) se corta y lo
  dice, y si fallan tres envíos seguidos por red, avisa.
- **Los formularios no se pisan solos.** Perfil del trabajador, datos del
  comercio y "duplicar turno" se recargaban cada 10 minutos y borraban lo
  que se estaba escribiendo. Con ellos, otras ~30 pantallas que recargaban
  sin motivo, y el chat que se reconectaba.
- **Volver a la app después de un rato** (PWA suspendida más de 15 min) ya
  no muestra "Not authenticated": la primera request renueva y reintenta.
- **Admin, "Ver como":** al entrar y salir se limpia la caché de pantallas
  (antes se veía un instante lo de la cuenta anterior), y al volver a la
  cuenta admin su token vencido se renueva solo.

**Qué cambió (técnico):** `frontend/lib/api.ts` guarda el token que
identifica la sesión y el vigente (`bindSessionToken`,
`renewSessionToken`, `resolveToken`), y ante un 401 con el de la sesión
renueva una vez —compartida entre requests simultáneas— y reintenta
(`setUnauthorizedHandler`). `frontend/lib/auth-context.tsx` sólo cambia el
`token` del contexto al cambiar de sesión; la renovación periódica ya no.
`frontend/lib/useWebSocket.ts` conecta con el vigente.
`frontend/lib/use-en-route-sharing.ts` deja de tragarse los errores.

**Por qué así:** el bug no era de "Va en camino" ni de los formularios sino
de que el token del contexto cambiaba por mantenimiento; arreglarlo en la
raíz cubre las ~30 pantallas sin tocarlas. Impersonando no se renueva ante
un 401: el refresh traería un token de la admin real.

**Tests:** `frontend/lib/api.test.ts` (8 casos).

**Queda abierto:** lo que sigue de la auditoría está en `STATUS.md`.
