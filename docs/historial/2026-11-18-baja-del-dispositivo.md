# La baja del dispositivo llega aunque no haya red, token ni «Cerrar sesión»

**Pedido:** coordinación de la beta (privacidad). `/privacidad` dice que el
identificador del dispositivo «se borra al desactivarlas y al cerrar sesión
en ese dispositivo», y había casos en que no se borraba.

**Qué cambió:** quien cierra sesión deja de recibir en ese dispositivo los
avisos de su cuenta también si en ese momento no tenía conexión o su sesión
ya había vencido, y también cuando la sesión termina sola (vencida, revocada
o cuenta suspendida). Nada cambia a la vista; el interruptor de Ajustes
sigue igual.

Antes la baja era un solo intento con el token de la sesión
(`DELETE /push/subscribe`): sin red o con el token vencido, la fila quedaba
en `push_subscriptions`. No corría cuando la sesión terminaba sola ni al
suspender.

- **Backend, baja sin sesión:** `POST /api/v1/push/release`
  (`backend/app/modules/notification/api/routes.py`), sin autenticar, cuerpo
  `{endpoint, auth, user_id}`. Borra sólo si coinciden el `endpoint`, la
  clave `auth` de la suscripción (tiempo constante) y la cuenta
  (`PushService.release`, `PushSubscription.is_released_by`). 204 siempre.
  Mismo validador de servicio push conocido que el alta; límite por IP.
- **Backend, suspensión:** `AdminService.suspend_user` borra los dispositivos
  de la cuenta por el puerto `AccountDeviceRemover`
  (`backend/app/modules/admin/application/ports.py`), después de marcarla;
  si falla, se registra y la suspensión queda hecha (ADR-0024, sección
  nueva).
- **Backend, barrido:** la pasada de retención del scheduler
  (`backend/app/modules/shift/application/scheduler.py`) acepta pasos de
  afuera (`retention_steps`, los pasa `app/main.py`). El primero,
  `backend/app/modules/notification/infrastructure/device_sweep_job.py`,
  borra los dispositivos de las cuentas que se quedaron sin sesión por una
  revocación: ninguna sesión viva, alguna fila en `refresh_sessions`, y la
  más reciente revocada. notification le pregunta a identity por el puerto
  `SessionRevocations` (`notification/application/ports.py`); la consulta es
  `RefreshSessionRepository.user_ids_ended_by_revocation`. Corre antes de
  que la misma pasada borre las sesiones vencidas hace más de 7 días.
- **Frontend:** `releasePushFromAccount(accountId)` (`frontend/lib/push.ts`)
  manda la baja sin token, con el `endpoint` y `keys.auth` del navegador. La
  anota como pendiente en `localStorage` (`staffya_push_release_pending`,
  sólo ids de cuenta) antes de mandarla y la borra cuando el servidor la
  confirma. `retryPendingPushReleases` la reintenta al montar
  `AuthProvider`, en `online` y al volver la pestaña.
  `claimPushForAccount(token, accountId)` descarta la pendiente de la cuenta
  que entra y reintenta las de otras. En `frontend/lib/auth-context.tsx`, la
  pestaña que detecta el fin de la sesión (`endSession`, y el cierre que
  fuerza el candado de dos pasos) da de baja el dispositivo; la que sólo
  refleja el cierre de otra pestaña, no. `backgroundApi.post` acepta
  `token: null` y un tope de espera; `backgroundApi.del` se fue (ya no lo
  usaba nadie).

**Por qué así:**

- *La prueba es la clave `auth`, no un token.* Es el secreto que sólo
  conocen el navegador y el servidor. `user_id` no prueba nada: hace que una
  baja vieja no borre el registro de otra cuenta que ya entró ahí, y por eso
  el orden de llegada entre cuentas distintas no importa.
- *La pendiente se anota antes de mandar, no al fallar.* El pedido decía
  «si falla, deja una baja pendiente». Anotarla antes da lo mismo en esos
  casos y además cubre a quien toca «Cerrar sesión» y cierra la app con el
  pedido en camino, donde nadie se entera de la falla.
- *La pendiente es una lista corta de ids, no uno solo.* En un dispositivo
  compartido sin conexión pueden salir dos cuentas seguidas; con un solo
  lugar, la segunda pisaba a la primera y su fila quedaba.
- *El reintento no manda la de la cuenta que tiene la sesión abierta.* Ese
  dispositivo es suyo; la descarta su propio registro.
- *El barrido no borra por inactividad* (decisión de coordinación, el mismo
  día). La primera versión borraba los dispositivos de toda cuenta sin
  sesión viva, también la de quien sólo dejó vencer la sesión por no abrir
  la app en 30 días. Se cambió: `/privacidad` promete el borrado al
  desactivar y al cerrar sesión, no por inactividad; a quien no entra hace
  un mes, el aviso de un turno urgente cerca es lo que lo trae de vuelta; y
  el primer barrido tras el deploy habría borrado en masa datos de
  producción más allá de lo prometido. La sesión vencida con la app cerrada
  se cubre cuando la persona abre la app (la pestaña la detecta y da de
  baja).
- *Una sesión revocada hace menos de 15 minutos cuenta como viva para el
  barrido.* No estaba en el diseño: salió de verificar los ingresos. Todos
  crean su sesión de refresh (`IdentityService._issue_tokens`), pero renovar
  (y el alta de dos pasos, y reclamar una cuenta con Google) revoca primero
  y guarda la nueva después: por un instante la cuenta no tiene ninguna fila
  viva con la sesión abierta. El margen es lo que dura un access token.
  Costo: quien cierra todas sus sesiones menos de 15 minutos antes del
  barrido espera al del día siguiente.
- *El barrido entra por `app/main.py`*, no como import nuevo del scheduler a
  otro módulo (candado de capas). Un paso que falla se registra y la pasada
  se da por hecha: reintenta mañana, no cada pocos minutos (cuota de Neon).
- *Se descartó* borrar los dispositivos dentro de `revoke_all_for_user`
  (identity → notification): el barrido cubre los mismos casos sin acoplar
  el camino de autenticación. No es del todo cierto y queda dicho: el
  barrido es por cuenta, así que no ve a quien restablece la contraseña y
  vuelve a entrar enseguida (la cuenta ya tiene una sesión viva y el
  dispositivo de la sesión vieja sigue registrado hasta que se abre la app
  ahí), ni a la cuenta inactiva hace más de 37 días que la restablece (ya
  no tiene filas que revocar). Ese camino sí los vería.
- *No se tocó el texto legal.* Lo que promete sigue siendo cierto.

**Tras la revisión independiente** (aprobada con observaciones, con prueba en
la app sobre Postgres real: los siete pasos pasaron): el `endpoint` de las
tres rutas de push tiene tope de 2048 caracteres (sin tope, la baja sin
sesión llevaba a la base un cuerpo de decenas de MB); al suspender, los
dispositivos se borran después de la segunda pasada de efectos, porque
comparten la sesión de la base; y la baja trata un 404 o 405 como pasajero
(queda pendiente), porque el frontend puede publicarse antes que el backend.

**Datos de producción:** la primera pasada del barrido borra los
dispositivos de las cuentas que ya tenían todas sus sesiones revocadas.
Julieta lo aprobó antes del merge (2026-11-18, «mergealo entero»).

**Corrige otro doc:** `docs/reference/ACCESO_MODERNO.md` citaba un texto
viejo de `/privacidad` («Se borra al desactivarlas.») y daba por abiertos los
casos que este cambio cierra; quedó reescrito en «Baja del dispositivo».

**Queda abierto:** sesión vencida por inactividad con la app cerrada: el
dispositivo sigue registrado hasta que se abre la app ahí (límite conocido y
a propósito, con el motivo de arriba). El barrido es por cuenta, no por
dispositivo (límite aceptado): con una sesión viva en otro dispositivo, el
que cerró sesión sin que llegara la baja se da de baja recién cuando se abre
la app ahí. Entre la revocación y el barrido puede pasar un día. Las
carreras que quedan (baja colgada más de 10 segundos y reingreso de la misma
cuenta; dos pestañas), los dos bordes de una revocación que el barrido no
llega a ver, la contraseña restablecida seguida de un ingreso (el barrido
no la cubre: habría que borrar los dispositivos al revocar todas las
sesiones), y la primera oración de `/privacidad` («si las activás») están
en `ACCESO_MODERNO.md` → «Baja del dispositivo» → «Lo que queda abierto».
