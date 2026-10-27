# SECURITY.md — Autenticación, autorización y seguridad (arquitectura técnica)

> Cómo se autentica, autoriza y protege el backend. Amplía
> [ARCHITECTURE.md](../foundation/ARCHITECTURE.md#configuración-y-entornos). Las brechas
> abiertas se listan también en [TECH_DEBT.md](../TECH_DEBT.md).

## Autenticación (JWT)

- **Tokens** (`app/core/security.py`):
  - **Access token** — vida corta (**15 min** por defecto), viaja como
    `Authorization: Bearer <token>`, **stateless** (no hay tabla de sesión).
  - **Refresh token** — vida larga (**30 días**), renueva el access sin re-login
    (`POST /api/v1/auth/refresh`). **Revocable server-side** (tabla
    `refresh_sessions`, ADR-0002): cada refresh se identifica por un claim
    `jti` único, se **rota** en cada `/auth/refresh` (el usado queda
    revocado) y `POST /api/v1/auth/logout` lo revoca explícitamente. Reusar
    un `jti` ya revocado se trata como robo: revoca **todas** las sesiones
    del usuario.
  - Algoritmo **HS256**; claims: `sub`, `type` (`access`/`refresh`), `iat`,
    `exp`, `jti` sólo en el refresh, y `mfa: true` (en los dos) cuando la
    sesión pasó por la verificación en dos pasos (ADR-0023, abajo).
- **Contraseñas:** hash **bcrypt** (librería `bcrypt` directa, 12 rondas; `passlib` se sacó el 2026-10-21 por estar sin mantenimiento). Nunca se guarda ni se loguea la
  contraseña en claro. En los casos de uso, bcrypt corre en un hilo
  (`hash_password_async` / `verify_password_async`, 2026-10-23) para no
  congelar el único proceso de uvicorn.
- **Frontend:** access + refresh en `localStorage`, renovado al cargar y
  periódicamente (sesión persistente; ver
  [ARCHITECTURE.md](../foundation/ARCHITECTURE.md#frontend-nextjs)).

## Autorización

- **Roles:** `worker`, `employer`, `admin`. El endpoint valida el rol requerido
  vía dependencias de FastAPI.
- **Admin bootstrap:** los emails de `ADMIN_EMAILS` se promueven a admin al
  arrancar la app (`promote_configured_admins`, idempotente) — permite crear el
  primer admin sin endpoint de auto-registro.
- **No-disclosure:** recurso ajeno o inexistente → **404**. Nunca se distingue
  "no existe" de "no es tuyo". Regla transversal de la capa `api/`.

## Verificación en dos pasos (admin, ADR-0023)

- **Obligatoria para el rol admin**; trabajadores y comercios no cambian.
  TOTP (RFC 6238, implementación propia en `identity/domain/two_factor.py`),
  6 dígitos, ventana ±1 paso, **anti-replay** con el último paso usado.
- **Secreto cifrado** con Fernet y `TWO_FACTOR_ENCRYPTION_KEY` (varias
  claves separadas por coma para rotar). **Códigos de recuperación:** 10, de
  un solo uso, sólo su sha256 en la base, se muestran una vez.
- **Login:** admin con la verificación activa → `/auth/login` y
  `/auth/google` devuelven un desafío (5 min, un uso, se quema a los 5
  errores; sólo su hash en `two_factor_challenges`) y la sesión sale de
  `POST /auth/2fa/verify`. Límite por IP (10/min) y por cuenta en la base
  (10 errores en 15 min → 429).
- **Candado:** `get_current_user` responde 403 con `detail.code`
  (`two_factor_setup_required` / `two_factor_required`) a toda sesión admin
  sin `mfa`, en cualquier endpoint (también el WebSocket). Sólo `/auth/me` y
  el alta usan `get_current_user_allow_pending_2fa`. Activarla cierra las
  demás sesiones de la cuenta.
- **Cambiar de celular / códigos nuevos:** sesión verificada + un código
  actual. **Plan B:** `scripts/disable_two_factor.py` (dry-run por defecto).
  Pasos de la operadora en
  [PENDIENTE_OPERATIVO.md](./PENDIENTE_OPERATIVO.md), "Verificación en dos
  pasos del admin".

## WebSockets

Los dos canales (chat, notificaciones) se **autentican por token** y validan
**participación**: en el chat sólo entran el comercio dueño y el trabajador
asignado del turno; en notificaciones, el propio usuario. Ver
[API.md](./API.md#tiempo-real-websocket).

## Configuración sensible

- Todo secreto entra por **variable de entorno** (`app/core/config.py`), nunca en
  el repo ni en el chat. En Render/Vercel se cargan como env vars; si se filtran,
  se **revocan**. Ver [CLAUDE.md](../../CLAUDE.md#no-hacer).
- CORS restringido a los orígenes de `CORS_ORIGINS` (sólo el dominio de
  producción; sin `localhost` en config de producto).

## Endurecimiento ya aplicado

- **`Origin` verificado en `/auth/refresh` y `/auth/logout`** (cookie de refresh
  con SameSite=None): si el header viene y no está en `CORS_ORIGINS`, 403. Sin
  `Origin` pasa (`app/core/origin.py`).
- **422 sin eco del input:** el handler de `RequestValidationError` en
  `app/main.py` devuelve solo `type`, `loc` y `msg` (sin `input`, `ctx` ni `url`).
- **`POST /shifts/{id}/assign` con trabajador inexistente** responde 404, no 500
  (existencia verificada por el puerto de trabajadores).
- **`JWT_SECRET_KEY` no puede quedar en el default en producción.** Un validador
  de configuración (`Settings._reject_insecure_defaults`) **falla el arranque**
  si `ENVIRONMENT=production` y el secreto sigue siendo el valor por defecto. En
  Render el secreto se genera (`generateValue: true`).
- **Security headers en toda respuesta** (`SecurityHeadersMiddleware`):
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, y `Strict-Transport-Security` (HSTS) **sólo en
  producción** (no en desarrollo local por HTTP).
- **Rate limiting por IP** en `login` (10/min) y `register` (5/min), en memoria
  (`app/core/rate_limit.py`); superar el límite responde **429**. Configurable
  con `RATE_LIMIT_ENABLED`. Es por proceso: escalar a varios workers requeriría
  un store compartido (Redis) y un **ADR**.
- **Content-Security-Policy** (R1.3, `frontend/next.config.ts`, sólo en
  producción): restringe scripts/estilos/conexiones al propio origen + backend
  + tiles vectoriales de CARTO (ADR-0001) + Cloudinary; sin `frame-ancestors`
  (mitiga XSS/clickjacking). Mitiga el impacto de un eventual XSS dado que los
  tokens viven en `localStorage` (ver brecha abajo).
- **Verificación de email** (PRODUCTION_HARDENING.md): al registrarse con
  email+contraseña se manda un link de confirmación de un solo uso (vence en
  48h, hash sha256 en `email_verification_tokens`), mismo patrón que la
  recuperación de contraseña — `POST /auth/verify-email` y
  `POST /auth/resend-verification` (este último con el mismo rate-limit
  silencioso de 5 min y anti-enumeración que `/auth/forgot-password`). No
  bloquea el login (no hay gating funcional todavía, sólo el flag
  `is_verified` en `User`); las cuentas de Google entran ya verificadas
  (`is_verified=true` desde el alta, ver
  [ACCESO_MODERNO.md](./ACCESO_MODERNO.md)).
- **URLs que carga el usuario sólo `https://`** (auditoría del 2026-10-14):
  fotos, logo, portada, CV y evidencias de verificación usan el tipo
  `HttpsUrl` (`backend/app/core/url.py`), que rechaza `javascript:`, `data:`,
  `http:` y texto suelto. El frontend además pasa por `safeHttpsUrl`
  (`frontend/lib/safe-url.ts`) toda URL de usuario que pone en un `href`, para
  cubrir lo guardado antes.
- **CSP sin `vercel.live` en producción:** se agrega sólo cuando
  `VERCEL_ENV=preview` (`frontend/next.config.ts`).
- **Backend detrás de Cloudflare y Turnstile** (código listo, apagado; ADR-0018):
  con `EDGE_SHARED_SECRET`, lo que no viene por Cloudflare recibe 403 y el
  límite de intentos usa la IP real (`app/core/edge.py`); con
  `TURNSTILE_SECRET_KEY`, login y registro piden el token anti-robots
  (`app/core/turnstile.py`). Cómo prenderlo: DEPLOY.md, "Etapa 3".
- **Todas las subidas a Cloudinary son firmadas** (2026-10-15): fotos de
  perfil, logo, portada, DNI y selfie usan `POST /uploads/sign-image?kind=…`
  (rol según el tipo), igual que el CV y la constancia. La firma fija formatos,
  carpeta, un `public_id` al azar y `overwrite=false`. El preset unsigned
  (`staffya-profile`) queda sin uso y se apaga en el panel de Cloudinary.
- **Documentos de identidad privados y borrados al decidir** (ADR-0021): DNI,
  selfie y constancia de AFIP suben `type=private` (firmado); el admin los ve
  con un link que vence a los 5 minutos, y al aprobar o rechazar se borran de
  Cloudinary (`destroy` con `invalidate=true`; si falla, la cola
  `identity_evidence_file_deletions` reintenta desde el scheduler).

- **Análisis estático del código en CI** (2026-10-21, job `static-analysis`
  de `.github/workflows/security.yml`): Semgrep con las reglas de Python,
  TypeScript, React, Next.js y secretos. Falla el PR con hallazgos de
  severidad ERROR. Complementa a pip-audit y npm audit, que sólo miran las
  librerías. No es CodeQL porque en un repo privado eso es pago.

## Brechas abiertas (a cerrar — Fase de Seguridad)

> Deudas reales pendientes (ver [TECH_DEBT.md](../TECH_DEBT.md),
> [QUICK_WINS.md](../planning/QUICK_WINS.md)):
>
> 1. ~~Sin revocación de refresh tokens~~ — **resuelto** (R1.2, ADR-0002):
>    tabla `refresh_sessions` con rotación y logout server-side.
> 2. **Rotación de secretos** no documentada.
> 3. **Rate limiting por proceso**, no distribuido: al escalar horizontalmente
>    pierde efectividad (necesita store compartido + ADR).
>
> Priorización y pasos en [QUICK_WINS.md](../planning/QUICK_WINS.md) y
> [RECOMMENDATIONS.md](../planning/RECOMMENDATIONS.md).
