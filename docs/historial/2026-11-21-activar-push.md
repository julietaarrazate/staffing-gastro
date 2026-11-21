# Activar las notificaciones push desde Ajustes (#720)

**Pedido:** Julieta, desde su celular (Android, Chrome): «las push no se pueden activar» en Ajustes → «Notificaciones push».

**Qué cambió:** lo que ve la persona no cambia de texto: activar ahora pide el permiso al toque; el interruptor pasa a «Activadas» recién cuando contestan la clave y el alta (`POST /push/subscribe`), pero el diálogo ya no depende de esa demora. Técnico, en `frontend/lib/push.ts` (`subscribeToPush`): (1) el permiso se pide primero, antes de cualquier espera de red; la clave VAPID y el registro del worker salen en paralelo; (2) se espera al service worker activo (`navigator.serviceWorker.ready`); un solo tope, `WORKER_READY_TIMEOUT_MS` = 15 s, cubre bajar `/sw.js`, registrar y activar (`sin-worker (tiempo)`) antes de `pushManager.subscribe`; (3) cada falla deja un motivo corto en Sentry (`push-activar: sin-clave | sin-worker | suscripcion | servidor-<status> | servidor-red`, etiqueta `push_activar`), sin endpoint ni datos personales, y con el nombre del error entre paréntesis para distinguir `register` fallando (`sin-worker (registro-<Error>)`), worker que no queda activo (`sin-worker (tiempo)`) y `subscribe` rechazando (`suscripcion (<Error>)`); rechazar o cerrar el diálogo de permiso no se registra (es decisión de la persona); sin DSN no hace nada. Tests: `frontend/lib/push.test.ts` (12 casos nuevos de `subscribeToPush`) y `frontend/e2e/push-avisos-explica.spec.ts` (activar con backend lento y con la clave al instante; worker real).

**Por qué así:** `register` resuelve mientras el worker se instala y Chrome rechaza `subscribe` sin worker activo; y la activación del toque dura pocos segundos, menos que un arranque en frío de Render. Se descartó pedir el permiso desde `PushToggle`: la regla queda en un solo lugar, `lib/push.ts`. El registro usa `import()` dinámico de `sentry-client` para no sumar el SDK al bundle.

**Revisado y descartado:** backend (`POST /push/subscribe` valida `https`, host de FCM/Mozilla/Apple/Windows y largos; `expirationTime` extra se ignora), cabeceras de `/sw.js` (sin reglas especiales en `scripts/cf-headers.mjs`), `worker-src` de la CSP.

**Evidencia de producción:** los logs de Render muestran `GET /push/public-key` 200 y ningún `POST /push/subscribe` en cada intento: la falla es del navegador, antes del alta; el backend valida `https` + host de FCM/Mozilla/Apple/Windows y largos, y no se descubrió causa ahí.

**Causa no confirmada:** el arreglo es de la hipótesis más probable (worker sin activar y permiso tarde); no se reprodujo en un Android real. Evidencia: `GET /push/public-key` 200 sin `POST /push/subscribe`, y al reintentar se activó.

**Conocido, se deja así:** con el permiso sin decidir, se pide el permiso aunque el servidor no tenga clave VAPID (queda el diálogo y después el aviso de falla).

**Queda abierto:** si sigue fallando, el motivo ya queda en Sentry.
