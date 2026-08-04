# SECURITY_CHANGES.md — Endurecimiento de seguridad (producción)

> Parte de PRODUCTION_HARDENING.md, Fase 1. Alcance: seguridad únicamente —
> sin cambios de comportamiento funcional salvo donde se indica explícitamente
> (verificación de email). Ver también [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md)
> e [INFRASTRUCTURE_REPORT.md](./INFRASTRUCTURE_REPORT.md) para las otras dos
> fases, y [PRODUCTION_HARDENING.md](./PRODUCTION_HARDENING.md) para el resumen
> ejecutivo conjunto.

## 1. Documentación de API cerrada en producción

**Antes:** `/docs` (Swagger UI), `/redoc` y `/openapi.json` quedaban expuestos
sin autenticación en cualquier entorno, incluida producción — cualquiera podía
ver el mapa completo de rutas, schemas de request/response y modelos de datos
del backend.

**Ahora** (`backend/app/main.py`): los tres quedan condicionados a
`not settings.is_production`. Siguen disponibles en desarrollo/staging para no
perder la herramienta de trabajo diario.

**Motivo:** no exponen datos en sí mismos, pero sí reducen el costo de
reconocimiento de un atacante (qué endpoints existen, qué campos esperan, qué
validaciones tienen) a cero. Es una medida estándar de "no facilitar el mapa".

## 2. Rate limiting extendido

**Antes:** sólo `login` (10/min) y `register` (5/min) tenían límite por IP.
`/auth/refresh`, el envío de mensajes de chat y el reenvío de verificación de
email no tenían ningún tope.

**Ahora:**
- `POST /auth/refresh` — 20/min por IP (`_refresh_rate_limit`,
  `backend/app/modules/identity/api/routes.py`). Un refresh token robado ya no
  se podía usar para renovar sesión sin ningún freno.
- `POST /chats/{shift_id}/messages` — 30/min **por usuario**, no por IP
  (`_send_message_rate_limit`, `backend/app/modules/chat/api/routes.py`): es
  un endpoint autenticado, tiene más sentido limitar por identidad que por IP
  (varios usuarios detrás del mismo NAT no se penalizan entre sí).
- `POST /auth/resend-verification` — 5/min por IP
  (`_resend_verification_rate_limit`), mismo criterio que
  `forgot-password`.

**Cambio de diseño en `RateLimiter`** (`backend/app/core/rate_limit.py`): se
separó la lógica de conteo en un método `check(key: str)` reusable, del que
`__call__(request)` (la dependencia de FastAPI que usa IP) es ahora un caso
particular. Esto permitió el límite por usuario del chat sin duplicar la
lógica de ventana deslizante.

**Motivo:** cerrar la asimetría entre endpoints protegidos y no protegidos del
mismo módulo — no tiene sentido limitar `login` y dejar `refresh` abierto
cuando ambos son superficie de fuerza bruta/abuso.

**Riesgo:** ninguno para el uso normal (los límites son generosos frente al
tráfico legítimo esperado). Sigue siendo **por proceso** (en memoria, no
distribuido) — ver brecha pendiente en `docs/reference/SECURITY.md`.

## 3. Tope de conexiones WebSocket concurrentes

**Antes:** `ConnectionManager.connect_chat`/`connect_notification`
(`backend/app/core/ws_manager.py`) aceptaban conexiones sin límite por
`shift_id`/`user_id`. Un cliente (o un script malicioso con credenciales
válidas) podía abrir conexiones WS sin tope, agotando memoria del proceso.

**Ahora:** `MAX_CONNECTIONS_PER_KEY = 8`. Al superarse, `connect_chat`/
`connect_notification` devuelven `False` y el caller
(`backend/app/modules/chat/api/routes.py`,
`backend/app/modules/notification/api/routes.py`) cierra el WebSocket con
`WS_1013_TRY_AGAIN_LATER` en vez de aceptar la conexión.

**Motivo:** 8 alcanza de sobra para varias pestañas/dispositivos del mismo
turno o usuario sin habilitar un flood real vía WebSocket (que no pasa por el
rate limiter HTTP normal).

**Tests:** `backend/tests/test_ws_manager.py` (4 casos, unitarios sobre la
lógica de tope con websockets falsos — no levantan conexión real).

## 4. Logging de eventos de seguridad

Antes no había ningún registro de eventos sensibles — un intento de fuerza
bruta, un abuso de permisos o una promoción a admin pasaban sin dejar rastro
en los logs. Ahora, reutilizando el logging JSON + `RequestIdMiddleware` ya
existentes:

- **Login fallido** (credenciales inválidas, cuenta inactiva) —
  `backend/app/modules/identity/api/routes.py`, `logger.warning` con la IP.
- **Refresh con `jti` revocado/reusado** (señal de robo de token) — mismo
  archivo, distinguido explícitamente de un simple "vencido" para poder
  priorizarlo en una alerta.
- **403 por permisos insuficientes** — `require_roles`
  (`backend/app/modules/identity/api/dependencies.py`): loguea `user_id` y
  rol (**no el email**, para no dejar PII en logs de acceso).
- **Acciones de admin** (`backend/app/modules/admin/api/routes.py`):
  suspender/activar/promover quedan en `logger.warning` (afectan a otro
  usuario), verificar en `logger.info` (menor impacto). `promote_user` deja
  además una nota explícita ("→ ADMIN") por ser la de mayor sensibilidad del
  router — quien reciba el log no tiene que inferir el impacto.
- **429 de rate limit** — centralizado en `RateLimiter.check()`
  (`backend/app/core/rate_limit.py`): un solo punto de log para todos los
  limitadores (login, register, refresh, chat, resend-verification), con el
  nombre del limitador y la key (IP o user id) que lo disparó.

**Motivo:** sin esto, no había forma de investigar un incidente después del
hecho (¿alguien intentó fuerza bruta contra una cuenta puntual? ¿quién promovió
a quién a admin y cuándo?). Es visibilidad, no bloqueo — ningún log cambia el
comportamiento de la request.

**Riesgo:** ninguno funcional. Cuidado explícito de no loguear PII (email,
contraseña) en ningún punto nuevo.

## 5. Verificación de email (feature nueva, no sólo hardening)

**Antes:** el registro con email+contraseña dejaba la cuenta operativa de
inmediato, sin confirmar que el email fuera real/propio. `User.is_verified`
existía en el dominio pero sólo se seteaba `True` automáticamente para cuentas
de Google (que ya vienen verificadas por Google) o manualmente por un admin
(`POST /admin/users/{id}/verify`) — no había manera de que el propio usuario
lo completara.

**Ahora:**
- Al registrarse con email+contraseña, se genera un token de un solo uso
  (`secrets.token_urlsafe(32)`, hasheado con sha256 antes de guardarse —
  nunca se persiste en claro, mismo patrón que la recuperación de
  contraseña) con vencimiento a **48 horas**, y se manda un email con el link
  `{frontend_url}/verificar-email?token=...` — **best-effort**: si el envío
  falla, no rompe el registro (mismo contrato que
  `request_password_reset`).
- `POST /auth/verify-email` (`{token}`) — 204 si es válido, 400 genérico
  ("Enlace inválido o vencido") si no existe, venció o ya se usó
  (no-disclosure: mismo error para las tres causas, no se distingue cuál).
- `POST /auth/resend-verification` (`{email}`) — 202 siempre, exista o no el
  email, esté o no ya verificado (anti-enumeración, idéntico a
  `forgot-password`), con el mismo rate-limit silencioso de negocio (no
  reenvía si hay un token sin usar de menos de 5 minutos).
- Frontend: `frontend/app/verificar-email/page.tsx` — confirma automáticamente
  al cargar con el token de la URL; si falla, ofrece reenviar con el email.
- Tabla nueva `email_verification_tokens` (migración `0023`), mismo diseño que
  `password_reset_tokens` (sólo se guarda el hash del token).

**No bloquea nada todavía:** el login sigue funcionando igual esté o no
verificado el email — no hay gating funcional en este PR (habría sido un
cambio de comportamiento que la consigna pedía frenar y confirmar antes de
implementar; no se pidió gating, sólo "verificación de email").

**Coherencia con el dominio existente:** `is_verified` ya se usaba con este
mismo significado ("propiedad del email confirmada") en el alta por Google —
la nueva feature es una extensión consistente, no una redefinición. El badge
`perfil_verificado` (trust badge de reputación, `WorkerBadge`) está
deliberadamente **desacoplado** de `is_verified` desde antes (ver comentario
en `backend/app/modules/worker/domain/rules.py`), así que esta feature no le
cambia el significado a nada que ya existiera.

**Regresión detectada y corregida durante el desarrollo:** al quedar
`email_verification_tokens` siempre cableado en `get_identity_service`, el
registro de cualquier usuario en tests ahora dispara también un envío de
email (best-effort). Esto rompió 6 tests preexistentes que asumían que el
único email capturado por `FakeEmailSender` en el test era el de recuperación
de contraseña o el de aceptación de turno (`fake_email_sender.sent[0]` /
`len(...) == 1`). Se corrigieron los 6 (`tests/test_password_reset.py` ×5,
`tests/test_shift.py` ×1) para contar el email de verificación del registro
además del que el test realmente ejercita — la suite completa quedó en verde
(270 tests) después del fix.

**Tests nuevos:** `backend/tests/test_email_verification.py` (9 casos): envío
al registrar, verificación válida, token inválido/vencido/reusado, reenvío
con email inexistente/ya verificado/rate-limitado/tras la ventana.

## Resumen de riesgo

Todos los cambios de esta fase son **aditivos o restrictivos** (agregan un
límite, cierran una puerta abierta, agregan visibilidad) — ninguno relaja una
regla existente ni cambia el contrato de un endpoint ya usado por el
frontend, salvo la verificación de email, que es una feature nueva
explícitamente pedida, sin gating de login (o sea, sin romper compatibilidad
con clientes existentes).
