# El canal de avisos sigue el estado de la sesión y lo que la persona vio

**Pedido:** pasada por clase de error del 2026-11-19 (hallazgos PRI-04, VIE-04, CON-10 y ESC-04, que son la misma causa que CON-10). Una causa común: el socket y la lista de avisos no seguían ni el estado de la sesión ni lo que la persona había visto.

**Qué cambió:**
- **PRI-04, el socket autoriza una sola vez.** `WS /notifications/ws` y `WS /chats/{id}/ws` se cortan con 1008 cuando vence el access token con el que se conectaron (`backend/app/core/ws_vigencia.py`, `receive_text_until`; el vencimiento sale de `AuthenticatedSession.token_expires_at` y la dependencia `get_current_ws_session`). `ws_manager.close_user_connections` ahora corta también los sockets de chat de la persona (guarda quién abrió cada uno) y lo llama `IdentityService._revoke_everything` (puerto `LiveConnectionCloser` en `identity/application/ports.py`, adaptador en `identity/api/dependencies.py`) desde el reset de contraseña, el reclamo por Google y el alta de dos pasos. No se tocó `revoke_all_for_user` del repositorio (otra rama lo edita). Cliente: si el token con el que reconecta ya venció, `useWebSocket` lo renueva con un `GET /auth/me` antes de abrir (el access token sólo se renueva con un pedido HTTP; sin esto el corte por vencimiento dejaba el socket rechazado en cada intento).
- **VIE-04, la campanita se relee al reanudar.** `NotificationBell.tsx` vuelve a pedir la lista en `visibilitychange` (a visible) y en `online`, con el mismo piso de 30 s que la reconexión (un solo contador). En `online` además avisa a las pantallas (`emitLiveRefresh`); al volver a primer plano ellas ya se actualizan solas.
- **CON-10 / ESC-04, «Marcar todas» marca sólo lo visto.** `POST /notifications/read-all` recibe `{"ids": [...]}` (hasta 500) y marca sólo esos, los no leídos y propios; el cliente manda los ids sin leer que tiene en pantalla. Sin cuerpo (cliente viejo en caché) marca todo, como antes: es el mismo comportamiento de hoy y sólo dura lo que tarde la PWA en actualizarse; que el botón no hiciera nada habría sido peor. La forma de la respuesta no cambió: no hizo falta regenerar el contrato.
- Tests: `backend/tests/test_socket_vigencia.py`, `backend/tests/test_notificaciones_leer_todo.py`, `frontend/lib/useWebSocket.test.tsx`, `frontend/components/NotificationBell.reanudar.test.tsx` y `.test.tsx`, e2e `frontend/e2e/avisos-marcar-todo.spec.ts`.
- Docs: `docs/reference/NOTIFICATIONS.md`, `docs/reference/API.md`.

**Por qué así:** `ids` y no «hasta la fecha X»: un corte por fecha igual marca los de más de 50 que no se mostraron. Cerrar desde el caso de uso por un puerto, como la suspensión, y no desde el repositorio de sesiones.

**Queda abierto:**
- Un access token no se puede revocar (dura 15 min): tras cambiar la contraseña, quien tenga el token todavía vigente puede reconectar hasta que venza; el corte por vencimiento lo acota a eso. Cerrarlo del todo pide una lista de revocación o atar el token a la sesión (ADR).
- El reuso de un refresh revocado (`refresh`, el borrado de todas las sesiones por posible robo) sigue sin cortar sockets: la rama `claude/sesion-renovacion` reescribe ese método; al integrarla, `_reject_reused_refresh` debería llamar a `_revoke_everything`.
- Con más de 50 avisos sin leer, los de más atrás no se muestran ni se marcan hasta que haya paginación en la campanita.
