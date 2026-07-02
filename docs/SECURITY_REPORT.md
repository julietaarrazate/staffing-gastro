# SECURITY_REPORT.md — Auditoría de seguridad (Staffya)

> Auditoría puntual, basada en lectura directa del código a fecha 2026-07-02.
> No reemplaza [SECURITY.md](./SECURITY.md) (que describe el diseño vigente);
> este documento es una foto de auditoría con hallazgos citados a
> `archivo:línea` y un plan de cierre priorizado. Complementa
> [AUDIT_REPORT.md](./AUDIT_REPORT.md) y [TECH_DEBT.md](./TECH_DEBT.md), que a
> la fecha de esta auditoría están **desactualizados en la sección de
> seguridad**: registran como pendientes (`S1`-`S3`) rate limiting, security
> headers y el default inseguro de `JWT_SECRET_KEY`, que **ya están
> implementados** en el código actual (ver más abajo). Recomendación:
> actualizar `TECH_DEBT.md`/`AUDIT_REPORT.md` en un cambio aparte.

## 1. Autenticación — JWT y refresh

Implementado en `backend/app/core/security.py` y
`backend/app/modules/identity/`.

- **Emisión** (`backend/app/core/security.py:34-68`): `_create_token` firma
  con `jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)`
  (HS256, `backend/app/core/config.py:44`). Claims: `sub` (id de usuario),
  `type` (`access`/`refresh`), `iat`, `exp`. El access token además lleva
  `role` como *extra claim* (`backend/app/modules/identity/application/services.py:100-104`).
- **Expiración:** access 15 min (`access_token_expire_minutes`, default en
  `config.py:45`), refresh 30 días (`refresh_token_expire_days`,
  `config.py:46`). Coincide con lo documentado en `SECURITY.md:10-13`.
- **Validación:** `decode_token` (`security.py:71-77`) valida firma y `exp`
  vía PyJWT; el tipo de token se revalida explícitamente en cada caso de uso
  — `get_current_user` exige `type == "access"`
  (`identity/application/services.py:88-89`) y `refresh` exige
  `type == "refresh"` (`identity/application/services.py:71-72`). **Correcto**:
  descarta el bug común de "token confusion" (usar un refresh token como
  access token o viceversa).
- **Revocación: NO EXISTE.** No hay tabla/lista de tokens invalidados ni
  logout server-side. `POST /auth/refresh` (`identity/api/routes.py:90-104`)
  no verifica nada más que la firma/expiración/tipo/usuario activo — un
  refresh token nunca puede invalidarse antes de sus 30 días, ni siquiera
  cambiando la contraseña del usuario (no hay endpoint de cambio de
  contraseña, pero si existiera no invalidaría sesiones). Coincide con la
  brecha ya reconocida en `SECURITY.md:66-68`.
- **Claims insuficientes para rotación:** los tokens no llevan `jti` (id de
  token) ni versión de sesión — sin eso, cualquier futura revocación
  selectiva (vs. "banear todos los tokens del usuario") requiere primero
  añadir ese claim.
- **Password hashing:** bcrypt vía `passlib` (`security.py:15,23-30`).
  Correcto, sin costo configurable expuesto (usa el default de `passlib`,
  razonable).

## 2. Autorización — roles y no-disclosure

- **Roles:** `worker`, `employer`, `admin`
  (`backend/app/modules/identity/domain/value_objects.py`). Chequeo
  centralizado en `require_roles`
  (`backend/app/modules/identity/api/dependencies.py:68-81`): 403 si el rol no
  matchea.
- **Cobertura por endpoint** (verificado módulo por módulo):
  - `admin/api/routes.py:26` — todas las rutas exigen `UserRole.ADMIN` vía
    `AdminDep`. Auto-protección: `suspend_user` rechaza que un admin se
    suspenda a sí mismo (`CannotModifySelfError`,
    `admin/api/routes.py:44-49`).
  - `shift/api/dependencies.py:43-58` — `get_my_company_id` exige rol
    `EMPLOYER` y resuelve el perfil de comercio **del usuario autenticado**
    (no llega por parámetro), evitando que un employer opere turnos de otro
    comercio. Mismo patrón para trabajador en
    `get_my_worker_profile_id` (`shift/api/dependencies.py:61-73`).
  - `company/api/routes.py:32,46-96` — `/companies/me/profile` sólo
    `EMPLOYER`; `/companies/{profile_id}` (perfil público) sólo exige estar
    autenticado (correcto para un directorio público de comercios).
  - `matching/api/routes.py:23` — candidatos/búsqueda de mapa restringidos a
    `EMPLOYER` (validado también por test:
    `test_matching.py::test_worker_cannot_request_candidates`,
    `test_matching.py::test_worker_cannot_search_map`).
  - `worker/api/routes.py:29` — alta/edición de perfil de trabajador sólo
    `WORKER`.
- **No-disclosure (404):** aplicado de forma consistente — recurso ajeno o
  inexistente siempre devuelve 404, nunca 403 con detalle. Ejemplos:
  `shift/api/routes.py:71-72` (`_not_found`), `chat/api/routes.py:56-60`
  (`ConversationNotFoundError` → 404 tanto si el `shift_id` no existe como si
  el usuario no participa), `notification/api/routes.py:41-45`,
  `admin/api/routes.py:47-49` (usuario objetivo inexistente → 404, aunque acá
  el actor ya es admin, no aplica no-disclosure "ajeno"). Verificado también
  por tests: `test_shift.py::test_other_company_cannot_see_or_touch_shift`,
  `test_chat.py::test_outsider_cannot_access_conversation`,
  `test_notification.py::test_cannot_mark_someone_elses_notification_as_read`,
  `test_matching.py::test_other_company_cannot_see_candidates`.
- **Auto-registro de admin bloqueado:** `RegisterableRole` en
  `identity/api/schemas.py:16-24` excluye `ADMIN` del enum aceptado en
  `/auth/register`; el único camino a admin es `ADMIN_EMAILS` al arranque
  (`admin/bootstrap.py`) o promoción por otro admin
  (`admin/api/routes.py:78-87`). Test:
  `test_identity.py::test_register_cannot_self_assign_admin_role`.

**Conclusión de esta sección: sólida.** No se encontraron endpoints sin
protección de rol/pertenencia, ni fugas de "existe pero no es tuyo" vs "no
existe" en los módulos revisados (identity, worker, company, shift,
application, matching, notification, chat, review, admin).

## 3. Rate limiting, security headers, y default JWT en producción

Estos tres controles **ya están implementados** (contradice el estado
"pendiente" que figura en `TECH_DEBT.md:37-39` y `AUDIT_REPORT.md:101-107`):

- **Rate limiting** (`backend/app/core/rate_limit.py`): ventana fija en
  memoria por IP (`RateLimiter.__call__`, líneas 30-43). `login`: 10
  intentos/60s (`identity/api/routes.py:36`); `register`: 5 intentos/60s
  (`identity/api/routes.py:37-39`). Responde 429 con mensaje genérico (no
  filtra si el email existe). Configurable con `RATE_LIMIT_ENABLED`
  (`config.py:50`), desactivado en tests (`tests/conftest.py:19`) salvo el
  test dedicado (`test_identity.py::test_login_rate_limited`).
  - **Límite real:** es *por proceso* (`rate_limit.py:1-7`); el free tier de
    Render corre 1 worker, así que hoy es efectivo, pero no escala
    horizontalmente sin un store compartido (Redis) — ya documentado como
    deuda en `SECURITY.md:56-59`.
  - **Sin rate limiting en `/auth/refresh`** (`identity/api/routes.py:90`):
    a diferencia de `login`/`register`, el endpoint de refresh no tiene
    `RateLimiter` — un atacante con un refresh token robado (o probando
    fuerza bruta de tokens, aunque HS256 lo hace inviable por tamaño de
    clave) no tiene *throttle* ahí. Impacto bajo hoy (no es un vector de
    fuerza bruta de credenciales), pero es una asimetría a cerrar.
  - **Sin rate limiting en endpoints de negocio** (aplicar a turno, enviar
    mensaje de chat, etc.) — no es el foco típico de rate limiting pero
    permite *spam* (mensajes de chat ilimitados, por ejemplo) sin costo.
- **Security headers** (`backend/app/core/middleware.py`): `SecurityHeadersMiddleware`
  agrega en toda respuesta `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: geolocation=(self), microphone=(), camera=()`
  (`middleware.py:13-18`); HSTS sólo si `settings.is_production`
  (`middleware.py:32-36`, cableado en `backend/app/main.py` con
  `hsts=settings.is_production`). **Falta `Content-Security-Policy`** — no
  hay ningún header CSP en el middleware ni en el frontend (Next.js no define
  CSP en `next.config.ts`/headers). Sin CSP, los headers actuales mitigan
  clickjacking y MIME-sniffing pero no XSS por inyección de script si
  apareciera una vía (ver sección 4).
- **Default JWT blindado en producción**
  (`backend/app/core/config.py:76-85`): `_reject_insecure_defaults` es un
  `model_validator(mode="after")` que hace `raise ValueError` si
  `environment == "production"` y `jwt_secret_key` sigue siendo
  `_DEFAULT_JWT_SECRET` (`"cambiar-esto-en-produccion"`, `config.py:15`). Esto
  **falla el arranque del proceso** (fail-fast), no sólo loguea un warning.
  En Render, `render.yaml:20-21` genera el secreto (`generateValue: true`),
  así que el path de producción real está cubierto. **No hay control de
  longitud/entropía mínima del secreto** más allá de "no es el default
  literal" — un `JWT_SECRET_KEY` corto seteado a mano (ej. en un despliegue
  fuera de Render) pasaría el validador.

## 4. XSS

- **Frontend (React/Next.js):** `grep -rn "dangerouslySetInnerHTML"` sobre
  `frontend/` (excluyendo `node_modules`) **no arrojó resultados** — no hay
  ningún punto donde se inyecte HTML crudo sin sanitizar. El contenido
  dinámico (mensajes de chat, nombres, descripciones de turno) se renderiza
  vía JSX, que escapa por defecto. **Riesgo de XSS reflejado/almacenado por
  este vector: bajo**, en tanto se mantenga esa disciplina.
- **Sin CSP** (ver sección 3): es la capa de defensa en profundidad que
  faltaría si en el futuro se introdujera un `dangerouslySetInnerHTML`, un
  `<script>` de terceros, o una librería de markdown/rich-text sin sanitizar
  (el chat es candidato natural a evolucionar a "texto enriquecido").

## 5. SQL injection

- `grep -rn "text(\|\.execute(\"" backend/app` sólo encontró coincidencias
  falsas positivas (`websocket.receive_text()`, `CryptContext(...)`); **no
  hay ningún uso de `sqlalchemy.text()` con SQL crudo ni interpolación de
  strings en queries** en ninguno de los repositorios de infraestructura
  revisados. Todo el acceso a datos pasa por el ORM de SQLAlchemy 2.0 async
  con Core/`select()` parametrizado. **Riesgo de SQLi: prácticamente nulo**
  dado el patrón actual — se mantiene así en la medida en que no se introduzca
  SQL crudo en `infrastructure/repositories.py` de ningún módulo.

## 6. CORS

- Configurado en `backend/app/main.py` vía `CORSMiddleware`, orígenes desde
  `settings.cors_origins_list` (`config.py:53-57`, split por coma).
  `allow_credentials=True` + `allow_methods=["*"]` + `allow_headers=["*"]`
  (`main.py:41-46`). En producción, `render.yaml:26-27` fija
  `CORS_ORIGINS=https://staffing-gastro.vercel.app` — un único origen,
  correcto y sin `localhost` en el valor de producción. El **default de
  desarrollo** (`config.py:53`, `"http://localhost:3000"`) es apropiado sólo
  para dev; si `ENVIRONMENT` se dejara mal configurado en un despliegue no
  gestionado por `render.yaml`, el CORS por defecto seguiría abierto sólo a
  localhost (fail-closed razonable, no fail-open).
- **Nota:** `allow_credentials=True` con `allow_methods/headers=["*"]` no es
  un problema per se (el origen sigue siendo explícito y no `"*"`, que
  además el spec de CORS prohíbe combinar con credentials), pero conviene
  revisar si realmente se necesitan credentials (cookies) — hoy la app
  autentica por header `Authorization: Bearer`, no por cookie
  (`frontend/lib/api.ts:19-26`), así que `allow_credentials=True` parece
  vestigial y podría bajarse a `False` (reduce superficie sin costo
  funcional aparente, a confirmar antes de tocar).

## 7. Content-Security-Policy (CSP)

**No existe.** Ni en `backend/app/core/middleware.py` ni en la configuración
de Next.js (`frontend/next.config.ts` no define headers). Ver sección 3.

## 8. Gestión de secretos

- Todo secreto se lee de entorno vía `pydantic-settings`
  (`backend/app/core/config.py:19-23`, `env_file=".env"`).
- `backend/.env.example` está commiteado (sólo placeholders, revisado — no
  contiene valores reales) y `frontend/.env.production` está commiteado con
  **un único valor no sensible**: `NEXT_PUBLIC_API_URL` (URL pública del
  backend, `frontend/.env.production:1`) — no es un secreto, es correcto que
  esté en el repo (variable pública `NEXT_PUBLIC_*`, se inyecta client-side de
  todos modos).
- `.gitignore` excluye `.env` (raíz) — revisado, no hay archivos `.env` reales
  (con secretos) trackeados en git (`git ls-files | grep -i "\.env"` sólo
  devuelve los dos `.example`/`.production` de arriba).
- `render.yaml:20-21` genera `JWT_SECRET_KEY` automáticamente
  (`generateValue: true`), no queda hardcodeado en ningún lado del repo.
- **Hallazgo real — credenciales demo hardcodeadas y sembradas en
  producción:** `backend/scripts/seed_demo_data.py:47` define
  `DEMO_PASSWORD = "staffyaDemo123"` en texto plano, commiteada al repo. Ese
  script crea ~12 comercios y ~12 trabajadores demo (`demo.palermo@staffya.com`,
  `demo.mozo.palermo@staffya.com`, etc. — ver
  `backend/scripts/seed_demo_data.py:68-347`) todos con esa misma contraseña.
  `backend/scripts/startup_seed.py:14-21` ejecuta ese seed **en el arranque
  del contenedor si `SEED_DEMO_DATA=true`**, y `render.yaml:30-31` **fija
  `SEED_DEMO_DATA: "true"` en el servicio de producción real**. Esto significa
  que en el backend de producción (`staffya-backend.onrender.com`) existen
  cuentas reales, con contraseña pública y conocida (está en el historial de
  git y en el código fuente), que cualquiera puede usar para autenticarse
  como esos ~24 usuarios demo — publicar turnos, aplicar a turnos, chatear
  con trabajadores/comercios reales que interactúen con ellos, etc. No es un
  secreto filtrado por error: es un secreto **de diseño**, publicado a
  propósito para la demo, corriendo contra la base de datos real de
  producción. Es el hallazgo más concreto y accionable de esta auditoría.

## 9. Tokens en localStorage

- `frontend/lib/auth-context.tsx:29-30` guarda `access` y `refresh` en
  `localStorage` (`staffya_token`, `staffya_refresh`). Confirmado: no se usan
  cookies `httpOnly`.
- **Riesgo:** cualquier XSS (hoy con superficie baja, ver sección 4) tendría
  acceso de lectura a `localStorage` y podría exfiltrar el refresh token,
  válido por **30 días**, sin necesidad de mantener una sesión activa del
  atacante — es el escenario de mayor impacto potencial de un XSS en esta
  app, precisamente porque no hay revocación de refresh tokens (sección 1).
  Con cookies `httpOnly` + `SameSite`, un XSS no podría leer el token
  directamente (aunque igual podría hacer requests autenticadas "en nombre
  de" la víctima mientras el XSS esté activo). Migrar a cookies `httpOnly`
  requeriría manejar CORS+credentials distinto (hoy `Authorization: Bearer`
  cross-origin entre Vercel y Render) y es un cambio de arquitectura, no un
  quick win.

## 10. WebSockets

- **Chat** (`backend/app/modules/chat/api/routes.py:89-110`): autentica con
  `get_current_user_ws` (token por query param, ver
  `identity/api/dependencies.py:49-65`) y **valida participación** antes de
  aceptar la conexión — `await service.assert_participant(current_user.id,
  shift_id)` (`chat/api/routes.py:98`); si el usuario no es el comercio dueño
  ni el trabajador asignado del turno, cierra con `WS_1008_POLICY_VIOLATION`
  antes de `websocket.accept()`. Cubierto por test:
  `test_chat.py::test_chat_websocket_pushes_new_messages` (único test WS de
  todo el backend).
- **Notificaciones** (`backend/app/modules/notification/api/routes.py:48-62`):
  autentica igual, y la conexión se asocia directamente a
  `current_user.id` (`ws_manager.connect_notification(current_user.id, ...)`)
  — no hay parámetro de usuario objetivo que pudiera falsificarse, así que no
  aplica una validación de "pertenencia" adicional: el propio token ya fija
  el canal. **No tiene test dedicado** (el único test WS del repo es de
  chat).
- **Token por query string:** el token viaja como `?token=...` en la URL del
  WebSocket (`identity/api/dependencies.py:52`, comentario explica que no hay
  header `Authorization` disponible en el handshake WS del browser). Es un
  patrón común pero tiene un riesgo conocido: las URLs con querystring quedan
  en logs de acceso (servidor, proxies, CDN) y en el historial del navegador.
  Con TLS el token no viaja en claro por red, pero sí puede terminar
  persistido en logs de infraestructura (Render, cualquier proxy intermedio)
  con vida útil de 15 minutos (es el access token, no el refresh) — impacto
  acotado pero no nulo.
- **Sin límite de conexiones/mensajes por usuario o por turno**
  (`backend/app/core/ws_manager.py`): `ConnectionManager` no aplica cuotas;
  ya señalado como deuda en `TECH_DEBT.md:41` (`S5`). Un cliente podría abrir
  N conexiones WS o floodear el chat sin límite del lado del servidor (el
  rate limiting de la sección 3 no cubre WebSockets ni el endpoint HTTP de
  enviar mensaje).

## 11. Validaciones Pydantic

- **Password:** `RegisterRequest.password: str = Field(min_length=8,
  max_length=128)` (`identity/api/schemas.py:29`). Sólo longitud mínima — **sin
  requisito de complejidad** (mayúsculas/minúsculas/dígitos/símbolos) ni
  verificación contra contraseñas comunes/breached (tipo HaveIBeenPwned). Es
  una decisión de producto válida (UX vs. seguridad), pero conviene que sea
  explícita y no un olvido — no está mencionada en `docs/SECURITY.md`.
- **Email:** `EmailStr` de Pydantic en `RegisterRequest`/`LoginRequest`
  (`identity/api/schemas.py:28,35`) — valida formato pero no existencia real
  del buzón.
- **Sin verificación de email:** el campo `is_verified` existe en el modelo
  (`identity/domain/entities.py:24`, default `False`) pero **el único camino
  para ponerlo en `True` es que un admin lo haga manualmente**
  (`admin/api/routes.py:71-80`, `User.verify()` en
  `identity/domain/entities.py:34`). No hay flujo de verificación por email
  (sin envío de correo, sin token de verificación, sin endpoint
  `/auth/verify`). Cualquiera puede registrarse con un email que no le
  pertenece sin que nadie lo confirme — no es una vulnerabilidad de acceso
  (no compromete cuentas ajenas), pero sí una brecha de confianza/abuso
  (suplantación de identidad de bajo esfuerzo, spam de cuentas) relevante
  para un marketplace donde ambas partes confían en la identidad de la otra.
- **Geolocalización acotada correctamente:** `latitude`/`longitude` con
  `ge=-90/le=90` y `ge=-180/le=180` tanto en `ShiftInput`
  (`shift/api/schemas.py:27-28`) como en `GeoCheckRequest`
  (`shift/api/schemas.py:76-77`) — sin esto, check-in/check-out con
  coordenadas inválidas podría romper cálculos de distancia Haversine aguas
  abajo.
- **Montos:** `pay_amount: Decimal = Field(ge=0, max_digits=12,
  decimal_places=2)` (`shift/api/schemas.py:20`) — correcto, usa `Decimal` (no
  `float`) para dinero.

## 12. Auditoría / logs de acciones sensibles

- **No existe logging estructurado de eventos de seguridad.** Único uso de
  `logging` en todo `backend/app`: `admin/bootstrap.py:16,29,35`, que loguea
  la promoción de admins configurados por `ADMIN_EMAILS` al arrancar — no es
  auditoría en runtime.
- **No se loguean:** logins fallidos, activaciones de rate limit (429), 403
  por rol insuficiente, acciones de moderación de admin (suspender/activar/
  verificar/promover usuarios — `admin/api/routes.py`), ni refresh de
  tokens. No hay `request_id`/correlación, ni un módulo de auditoría (tabla
  `audit_log` o similar) — confirmado, no existe en ninguna migración de
  `backend/alembic/versions/` (última es `0009_create_shift_applications_table.py`).
- Esto coincide con lo ya señalado en `TECH_DEBT.md:40` (`S4`) y
  `AUDIT_REPORT.md:108`.

---

## 13. Qué falta exactamente para producción

| # | Problema | Descripción | Impacto | Riesgo | Prioridad | Esfuerzo | Dependencias | Propuesta de solución |
|---|----------|--------------|---------|--------|-----------|----------|---------------|------------------------|
| 1 | Credenciales demo hardcodeadas sembradas en prod | `DEMO_PASSWORD = "staffyaDemo123"` (`backend/scripts/seed_demo_data.py:47`) crea ~24 usuarios reales en la DB de producción vía `SEED_DEMO_DATA=true` (`render.yaml:30-31`) | Cualquiera con el repo (público o no) puede autenticarse como esas cuentas y operar turnos/chats reales | **Crítico** — acceso no autorizado directo, con contraseña conocida, contra datos reales | **Crítica** | Baja (horas) | Ninguna | Apagar `SEED_DEMO_DATA` en prod o mover el seed a un entorno de staging separado; si se necesita demo pública, usar cuentas de solo-lectura sin poder de escritura sobre datos de usuarios reales, o rotar la contraseña por env var no commiteada |
| 2 | Sin revocación de refresh tokens | No hay lista de invalidación ni logout server-side (`identity/application/services.py:64-79`) | Un refresh token robado (ej. vía XSS, ver #4) vale hasta 30 días sin forma de cortarlo | Alto — ventana de exposición larga ante robo de token | **Alta** | Media (2-4 días: modelo de sesión + tabla + chequeo en `refresh`/`get_current_user`) | Migración Alembic nueva, ADR (por `CLAUDE.md`) | Tabla `refresh_sessions` (o claim `jti` + denylist); endpoint `/auth/logout`; invalidar todas las sesiones al cambiar contraseña |
| 3 | Tokens en `localStorage` sin defensa en profundidad (CSP ausente) | Refresh de 30 días accesible por JS; sin CSP que mitigue un XSS futuro (`frontend/lib/auth-context.tsx:29-30`; sin CSP en `middleware.py`/`next.config.ts`) | Un XSS (hoy de baja probabilidad, sin `dangerouslySetInnerHTML`) tendría alto impacto: robo de sesión de 30 días | Medio-alto (probabilidad baja hoy, impacto alto si ocurre) | **Alta** | Baja para CSP (horas) / Alta para migrar a cookies httpOnly (días, cambia arquitectura CORS) | CSP: ninguna. Cookies httpOnly: rediseño de auth + CORS `credentials` | Corto plazo: agregar `Content-Security-Policy` restrictiva en `SecurityHeadersMiddleware`. Mediano plazo: evaluar cookies `httpOnly`+`SameSite=Strict` con CSRF token, vía ADR |
| 4 | Sin rate limiting en `/auth/refresh` y endpoints de negocio | Sólo `login`/`register` tienen `RateLimiter` (`identity/api/routes.py:36-39`) | Abuso/spam en refresh y en endpoints como enviar mensajes de chat | Bajo-medio | **Media** | Baja (reusar `RateLimiter` existente) | Ninguna | Agregar `RateLimiter` a `/auth/refresh` y considerar límites en `POST /chats/{id}/messages` |
| 5 | Rate limiting y WS sin cuota, no distribuidos | `rate_limit.py` y `ws_manager.py` son en memoria, por proceso, sin límite de conexiones WS por usuario | Al escalar a >1 worker/instancia, rate limiting pierde efectividad; sin cuota WS, un cliente puede floodear | Medio (hoy 1 worker, no es explotable aún) | **Media** | Media-Alta (Redis + ADR) | Redis (infra nueva) + ADR requerido por `CLAUDE.md` | Store compartido (Redis) para rate limiting y pub/sub para WS multi-instancia; cuota de conexiones/mensajes por usuario |
| 6 | Sin CSP | No hay `Content-Security-Policy` en ningún lado (`middleware.py`, `next.config.ts`) | Sin defensa en profundidad ante XSS | Medio | **Alta** | Baja (horas, con ajuste iterativo por falsos positivos) | Ninguna | Agregar CSP restrictiva (`default-src 'self'`, permitir sólo orígenes de API/tiles de mapa/imágenes necesarias) en `SecurityHeadersMiddleware` |
| 7 | Sin verificación de email | `is_verified` sólo lo cambia un admin manualmente (`admin/api/routes.py:71-80`) | Registro con emails ajenos, sin confirmación; impacta confianza del marketplace, no seguridad de acceso | Bajo (no es vulnerabilidad de acceso) | **Media** | Media (requiere envío de email — infraestructura nueva) | Proveedor de email (SendGrid/SES) + ADR si se introduce cola/worker | Flujo `/auth/verify-email` con token de un solo uso, envío por proveedor transaccional |
| 8 | Sin auditoría/logs de acciones sensibles | No hay logging de logins fallidos, 403, 429, ni acciones de admin (`admin/api/routes.py`) | Sin trazabilidad ante incidente; no se detecta abuso en curso | Medio | **Media** | Media (2-3 días: logging estructurado + posible tabla de auditoría para acciones de admin) | Ninguna, aunque conviene decidir destino de logs (Render logs vs. servicio externo) | `logging` estructurado con contexto (usuario, IP, acción) en middleware + tabla `audit_log` para acciones de admin |
| 9 | Contraseña sin requisito de complejidad | Sólo `min_length=8` (`identity/api/schemas.py:29`) | Contraseñas débiles tipo `"12345678"` son válidas | Bajo-medio | **Baja** | Baja (horas, validador Pydantic) | Ninguna | `field_validator` que exija al menos una letra y un número, o integrar `zxcvbn` para medir fuerza |
| 10 | Token WS en query string | `?token=...` en el handshake (`identity/api/dependencies.py:52`) puede quedar en logs de acceso/proxies | Exposición del access token (vida 15 min) en logs de infraestructura | Bajo | **Baja** | Media (requiere que el cliente WS soporte header custom o subprotocolo) | Ninguna, pero cambia el contrato del cliente WS | Migrar a subprotocolo `Sec-WebSocket-Protocol` con el token, o a un token de intercambio de un solo uso y corta vida específico para WS |
| 11 | `TECH_DEBT.md`/`AUDIT_REPORT.md` desactualizados en seguridad | Listan como pendientes controles ya implementados (rate limit, headers, default JWT) | Riesgo de duplicar trabajo o de que un futuro colaborador confíe en info vieja | Bajo (higiene de documentación) | **Baja** | Baja (actualizar dos tablas) | Ninguna | Actualizar `TECH_DEBT.md` S1-S3 y la tabla de `AUDIT_REPORT.md:97-108` a "✅ implementado" |

## 14. Puntuación del área: **62/100**

**Justificación.** Se parte de una base sólida: capas de dominio limpias, ORM
parametrizado sin rastro de SQL crudo, no-disclosure aplicado de forma
consistente y verificado por tests, autorización por rol correctamente
cableada en cada endpoint revisado, y tres controles "recién agregados" que
efectivamente están bien implementados y activos en producción (rate
limiting en login/registro, security headers, y el fail-fast del secreto JWT
por defecto). Esto descarta las categorías de vulnerabilidad más comunes y
más graves (inyección, bypass de autorización, XSS por inyección directa).

Lo que baja la nota de forma concreta:

- Un hallazgo **crítico y real**, no hipotético: cuentas demo con contraseña
  hardcodeada y pública, sembradas en la base de datos de producción por
  configuración explícita de `render.yaml`. Esto por sí solo justifica no
  calificar por encima de ~65, porque es explotable hoy, sin necesidad de
  encontrar ningún otro bug.
- Ausencia total de revocación de sesión (refresh de 30 días sin forma de
  cortarlo) combinada con almacenamiento en `localStorage` sin CSP de
  respaldo: es una combinación de "impacto alto si algo falla" sin ninguna
  mitigación de profundidad.
- Cero auditoría/logging de seguridad: en caso de incidente, no hay manera de
  reconstruir qué pasó.
- Brechas menores pero reales de higiene (CSP ausente, sin verificación de
  email, password sin requisito de complejidad, rate limiting no cubre
  refresh ni WS).

No es un 0-40 porque los cimientos (arquitectura, ORM, autorización, tests
que efectivamente ejercitan las reglas de acceso) están bien hechos y la
lista de pendientes es ejecutable en días/semanas, no meses, y ya está en
buena medida catalogada por el propio equipo en `SECURITY.md` y
`TECH_DEBT.md`. No llega a 80+ porque el hallazgo #1 (credenciales demo en
producción) es de gravedad real y con impacto en datos de usuarios reales,
no un defecto teórico de "buenas prácticas".
