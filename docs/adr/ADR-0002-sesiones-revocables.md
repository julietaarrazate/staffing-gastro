# ADR-0002 — Sesiones revocables: rotación de refresh tokens con tabla de `jti`

**Estado:** aceptado · **Fecha:** 2026-07-02 · **Actualizado:** 2026-11-19 (ventana de gracia, abajo)

## Contexto

`app/core/security.py` emitía access tokens (15 min) y refresh tokens (30
días) como JWT puramente **stateless**: cualquier refresh token firmado con
`JWT_SECRET_KEY` era válido hasta su `exp`, sin forma de invalidarlo antes.
Consecuencia documentada como deuda crítica
([TECH_DEBT.md#S1](../TECH_DEBT.md), [SECURITY.md](../reference/SECURITY.md#brechas-abiertas-a-cerrar--fase-de-seguridad)):

- **Sin logout server-side:** cerrar sesión en el cliente sólo borraba el
  token de `localStorage`; el token seguía siendo válido 30 días si alguien
  lo capturaba (XSS, dispositivo compartido, backup filtrado).
- **Sin rotación:** `IdentityService.refresh()` validaba el refresh token y
  emitía un par nuevo **sin invalidar el usado**. Un refresh robado convivía
  indefinidamente con el legítimo, sin señal de compromiso.
- **Sin forma de revocar en bloque** ante sospecha de robo (cambio de
  contraseña, reporte de dispositivo perdido, etc.).

El access token de 15 min ya acota el daño de un access token robado; el
problema real era el refresh de 30 días.

## Decisión

1. **Tabla `refresh_sessions`** (módulo `identity`, migración `0010`): cada
   refresh token emitido queda identificado por un claim **`jti`** (UUID v4)
   persistido junto a `user_id`, `expires_at`, `revoked_at` (nullable) y
   `created_at`. `jti` es **único e indexado**.
2. **Rotación en cada `/auth/refresh`:** se valida que el `jti` recibido
   exista y no esté revocado; si es válido, la sesión se **revoca** (queda
   inservible) y se emite + persiste un par nuevo con un `jti` nuevo. El
   cliente siempre debe usar el refresh token más reciente.
3. **Detección de reuso (posible robo):** si el `jti` recibido en
   `/auth/refresh` **ya estaba revocado** (alguien intenta reusar un refresh
   token que ya fue rotado), se interpreta como señal de que el token
   circuló fuera de control. Se revocan **todas** las sesiones activas del
   usuario (`revoke_all_for_user`) y se rechaza con 401 — fuerza un
   re-login, cortando cualquier sesión robada en paralelo. Desde el
   2026-11-19, salvo que el token se haya **rotado** hace 30 segundos o
   menos (ver «Actualización 2026-11-19»).
4. **Logout server-side:** nuevo endpoint `POST /auth/logout` con body
   `{"refresh_token": "..."}`. Revoca la sesión asociada; responde `204` si
   el token era válido, `401` si no lo era (no-disclosure: mismo mensaje que
   un refresh inválido).
5. **El access token sigue siendo stateless** (JWT sin tabla de sesión): la
   ventana de exposición de 15 min se considera aceptable y evita una
   consulta a DB en cada request autenticado (costo/beneficio: revocar el
   access requeriría blacklist consultada en cada `get_current_user`, que
   hoy no se justifica). El endurecimiento se concentra en el refresh, que
   es el activo de 30 días.
6. **Capas (hexagonal):** puerto `RefreshSessionRepository` en
   `identity/domain/repositories.py`, entidad `RefreshSession` en
   `identity/domain/entities.py`, excepción de dominio
   `RefreshTokenRevokedError`. Adaptador `SqlAlchemyRefreshSessionRepository`
   + `RefreshSessionModel` en `identity/infrastructure/`. La capa `api/`
   traduce `InvalidTokenError` / `RefreshTokenRevokedError` a `401` sin
   distinguir el motivo (no-disclosure).

## Consecuencias

- ✅ Un refresh token robado deja de valer 30 días "silenciosos": en cuanto
  el dueño legítimo (o el atacante) lo usa una vez, el otro queda cortado en
  el siguiente intento, y ese intento fallido revoca todo lo demás.
- ✅ Logout real: cerrar sesión invalida el refresh token en el servidor, no
  sólo en el cliente.
- ✅ Compatible con escalado horizontal: la tabla vive en la DB compartida
  (Postgres/Neon), no en memoria del proceso.
- ⚠️ `/auth/refresh` y `/auth/logout` agregan una consulta (y a veces un
  `UPDATE`) a `refresh_sessions` — costo aceptable frente a la ganancia de
  seguridad; no afecta el access token (sigue sin tocar DB en cada request).
- ⚠️ La tabla crece con cada login/refresh y no se purga todavía; queda como
  deuda menor (job de limpieza de sesiones expiradas/revocadas, no
  bloqueante para R1).
- ⚠️ El frontend actual no llama a `/auth/logout` (borra tokens de
  `localStorage` nada más); wiring del cliente queda fuera de este ADR —
  el backend ya soporta el flujo completo cuando se conecte.

## Actualización 2026-11-19 — rotación atómica y ventana de gracia de 30 s

### Qué fallaba

La pasada por clase de error del 2026-11-19 encontró tres caminos por los que
el punto 3 cerraba sesiones legítimas o dejaba pasar un reuso:

- **Dos pestañas (CON-02).** La cookie de renovación es una sola por
  navegador, pero cada pestaña (y la PWA instalada) renovaba por su cuenta.
  Si dos salían casi a la vez, la segunda llevaba la cookie que la primera
  acababa de rotar: el servidor lo tomaba por robo y cerraba la sesión en
  todos los dispositivos, también en el celular. Pasa sobre todo al
  despertar el equipo o al restaurar pestañas (todas renuevan juntas) y con
  pestañas en segundo plano, cuyos temporizadores el navegador agrupa.
- **Respuesta perdida (SES-01).** El servidor rota, pero la respuesta no
  llega (el celular se suspende, se corta la red). El reintento sale con la
  cookie vieja: mismo cierre en todos lados, y ese dispositivo además queda
  afuera, porque la cookie nueva se perdió.
- **Rotación no atómica (CON-03).** Rotar era leer la sesión y después
  marcarla. Dos pedidos con el mismo token que leían antes de que el otro
  escribiera ganaban los dos: dos sesiones de 30 días salidas del mismo
  token, sin que la detección de reuso se enterara.

### Decisión

1. **Rotación atómica, con la sucesora anotada.**
   `RefreshSessionRepository.rotate` marca la sesión con un solo `UPDATE
   refresh_sessions SET revoked_at = :now, rotated_at = :now, replaced_by =
   :sucesora WHERE jti = :jti AND revoked_at IS NULL`, mira `rowcount` y,
   sólo si ganó, guarda la sucesora en la misma transacción. El otro pedido
   vuelve a leer la fila y sigue las reglas del reuso (abajo). Columnas
   nuevas (migración `0059`): `rotated_at`, cuándo se revocó **por rotación**
   mientras la ventana siga sin usar, y `replaced_by`, el `jti` de la
   sucesora.
2. **Ventana de gracia de 30 s, de un solo uso.** Si un token rotado vuelve
   dentro de `REFRESH_ROTATION_GRACE` (`identity/domain/entities.py`), con
   la ventana sin usar y la sucesora todavía viva, no es robo.
   `use_rotation_grace` hace, en una transacción:
   - `UPDATE … SET rotated_at = NULL, replaced_by = :nueva WHERE jti = :jti
     AND replaced_by = :sucesora AND rotated_at >= :now - 30 s` (exige
     `rowcount = 1`: la ventana queda usada);
   - revoca la sucesora (`WHERE revoked_at IS NULL`, exige `rowcount = 1`):
     el cliente nunca la recibió, o en el caso de las dos pestañas la cookie
     es una sola y queda la nueva (el access token de la otra pestaña sigue
     valiendo sus 15 minutos);
   - guarda la sesión nueva, con el mismo claim `mfa` que traía el token.

   Si alguna condición falla no cambia nada y el pedido es robo. Las demás
   sesiones de la cuenta no se tocan. Así se recuperan la segunda pestaña y
   el dispositivo que perdió la respuesta.
3. **Sigue siendo robo** (revoca todas las sesiones y contesta 401, como el
   punto 3 original):
   - un token rotado que vuelve **pasados** los 30 s;
   - la ventana **ya usada**: un segundo reuso del mismo token, o dos pedidos
     a la vez dentro de la ventana (uno recibe el par y el otro corta todo,
     también ese par);
   - la sucesora **ya no está viva**: se salió con ella, se cambió la
     contraseña, se suspendió la cuenta, se activaron los dos pasos, se
     reclamó la cuenta con Google, saltó la detección de robo, o ya se rotó;
   - un token revocado **por otra causa**, aunque sea de hace un segundo
     (ninguno de esos caminos llena `rotated_at`).

   `revoke_all_for_user` además borra `rotated_at` de las rotadas dentro del
   plazo (las más viejas quedan como registro). Ya alcanzaría con la
   sucesora revocada; queda explícito.
4. **Candado entre pestañas en el frontend.** La renovación corre bajo
   `navigator.locks.request("oido-renovar-sesion", …)`
   (`frontend/lib/candado-renovacion.ts`, usado por `tryRefresh` en
   `frontend/lib/auth-context.tsx`): la pestaña que espera sale cuando la
   otra ya recibió su respuesta, con la cookie nueva. Al tomar el candado
   mira si mientras tanto se cerró la sesión o si otra pestaña ingresó con
   otra cuenta (`staffya_session_user`), sin esperar el evento `storage`; en
   ese caso no renueva. Sin `navigator.locks` (navegadores viejos), o si el
   pedido del candado falla por otra cosa, renueva como antes, y la ventana
   del servidor cubre el choque. Si el candado no se libera dentro del tope
   de la renovación (90 s), se contesta como un servidor que no respondió.

### Por qué 30 segundos, y lo que cuesta

- **Lo que tiene que cubrir:** el choque de dos pestañas (de milisegundos a
  pocos segundos) y el reintento después de un corte corto de red, que el
  frontend hace enseguida (al volver la conexión, la pestaña al frente o el
  próximo pedido con 401).
- **Lo que cuesta, de verdad:** dentro de los 30 s, quien tenga una copia del
  token viejo obtiene **una vez** una sesión, y no salta la detección en ese
  momento. Pero esa sesión le cuesta a la víctima la suya: la sucesora
  queda revocada, y en su próxima renovación (el intervalo es de 10
  minutos, o antes ante un 401) la víctima trae un token revocado sin
  ventana, salta la detección y se corta todo, también la sesión del
  atacante (que conserva lo que le quede de su access token, hasta 15
  minutos). Si la víctima llega segunda dentro de la ventana, la ventana ya
  está usada y se corta todo en el acto. O sea: una sola vez por token, sin
  cadena propia que dure más que la próxima renovación de la víctima. Es lo
  mismo que ya permitía el ADR original a quien usara el token robado
  **antes** que su dueño: la detección salta cuando el otro vuelve a
  renovar.
- **Por qué no más ni menos:** una ventana de minutos cubriría al celular
  que estuvo suspendido, pero dejaría abierta la puerta del token copiado
  mucho más tiempo; una de 5 s no alcanza para un reintento sobre red móvil.

### Descartado

- **Ventana reusable** (la primera versión de esta actualización, que no
  llegó a `main`): cada reuso dentro de los 30 s creaba una sesión nueva e
  independiente, sin revocar nada. La revisión de seguridad lo midió con 10
  pedidos a la vez en Postgres: 10 sesiones vivas de 30 días. Un atacante
  se quedaba con su propia cadena sin que saltara nunca la detección, y la
  sucesora perdida quedaba huérfana 30 días, lo que además ocultaba la
  cuenta al barrido de dispositivos push.
- **Contestar 401 sin revocar dentro de la ventana.** Salvaba a los otros
  dispositivos pero dejaba afuera al que perdió la respuesta (SES-01).
- **Reentregar el mismo par al reintento.** El refresh es un JWT firmado que
  no se guarda; habría que guardarlo (o volver a firmarlo igual) para el
  mismo efecto que emitir uno nuevo y revocar la sucesora.

### Consecuencias

- ✅ Dos pestañas, la PWA y una pestaña, o el reintento tras un corte corto
  ya no cierran la sesión en todos los dispositivos.
- ✅ De dos renovaciones simultáneas con el mismo token rota una sola; la
  otra pasa por las reglas del reuso.
- ✅ No quedan sesiones huérfanas por la ventana: la sucesora que el cliente
  no recibió se revoca al usarla, así que el barrido de dispositivos
  (`user_ids_ended_by_revocation`, ver
  [ACCESO_MODERNO.md](../reference/ACCESO_MODERNO.md)) ve a la cuenta cuando
  de verdad se queda sin sesiones. Si el dispositivo nunca reintenta, la
  sucesora es una sesión viva más, como cualquier otra.
- ⚠️ Dentro de los 30 s, un token copiado obtiene sesión una vez, hasta la
  próxima renovación de la víctima (ver «lo que cuesta»).
- ⚠️ Sin candado (navegadores sin `navigator.locks`), si las respuestas de
  las dos pestañas llegan desordenadas el navegador puede quedarse con la
  sucesora revocada, y la próxima renovación cierra todo.
- ⚠️ En iOS, una pestaña suspendida mientras tenía el candado lo retiene:
  la otra espera hasta el tope de 90 s y queda como sin servidor
  («Reconectando…» al abrir, «sin conexión» en una pantalla). No se cierra
  la sesión; el candado se libera cuando la pestaña vuelve o se descarta.
- ⚠️ Límite conocido: si el celular queda suspendido más de 30 s con la
  respuesta en el aire (o el pedido cuelga hasta el tope de 90 s después de
  que el servidor rotó), el reintento sigue cerrando todo.
- ⚠️ Límite conocido: un `revoke_all_for_user` (contraseña nueva,
  suspensión, robo) que cae entre la lectura del token y el guardado del par
  nuevo no alcanza a la sesión nueva, por la ventana igual que por la
  rotación normal (el hueco ya estaba en la rotación antes de esta
  actualización). No se cierra acá.
- Tests: `backend/tests/test_renovacion_de_sesion.py` (la ventana en el
  dominio; la respuesta perdida y las dos pestañas, con la sucesora
  revocada; la ventana de un solo uso; salir con la sucesora, el cierre de
  sesión y la contraseña nueva que no tienen gracia; el claim `mfa` que se
  conserva; la rotación y el uso de la ventana concurrentes, con dos
  sesiones de base y con dos pedidos a la vez),
  `test_refresh_reuse_revokes_all_sessions` en
  `backend/tests/test_identity.py` (fuera de la ventana sigue revocando
  todo), el barrido sin huérfanas en
  `backend/tests/test_baja_del_dispositivo.py`,
  `frontend/lib/candado-renovacion.test.ts` y «otra pestaña está
  renovando» en `frontend/lib/auth-context.test.tsx`.
