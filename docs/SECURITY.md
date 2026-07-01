# SECURITY.md — Autenticación, autorización y seguridad (arquitectura técnica)

> Cómo se autentica, autoriza y protege el backend. Amplía
> [ARCHITECTURE.md](./ARCHITECTURE.md#configuración-y-entornos). Las brechas
> abiertas se listan también en [TECH_DEBT.md](./TECH_DEBT.md).

## Autenticación (JWT)

- **Tokens** (`app/core/security.py`):
  - **Access token** — vida corta (**15 min** por defecto), viaja como
    `Authorization: Bearer <token>`.
  - **Refresh token** — vida larga (**30 días**), renueva el access sin re-login
    (`POST /api/v1/auth/refresh`).
  - Algoritmo **HS256**; claims: `sub`, `type` (`access`/`refresh`), `iat`, `exp`.
- **Contraseñas:** hash **bcrypt** (`passlib`). Nunca se guarda ni se loguea la
  contraseña en claro.
- **Frontend:** access + refresh en `localStorage`, renovado al cargar y
  periódicamente (sesión persistente; ver
  [ARCHITECTURE.md](./ARCHITECTURE.md#frontend-nextjs)).

## Autorización

- **Roles:** `worker`, `employer`, `admin`. El endpoint valida el rol requerido
  vía dependencias de FastAPI.
- **Admin bootstrap:** los emails de `ADMIN_EMAILS` se promueven a admin al
  arrancar la app (`promote_configured_admins`, idempotente) — permite crear el
  primer admin sin endpoint de auto-registro.
- **No-disclosure:** recurso ajeno o inexistente → **404**. Nunca se distingue
  "no existe" de "no es tuyo". Regla transversal de la capa `api/`.

## WebSockets

Los dos canales (chat, notificaciones) se **autentican por token** y validan
**participación**: en el chat sólo entran el comercio dueño y el trabajador
asignado del turno; en notificaciones, el propio usuario. Ver
[API.md](./API.md#tiempo-real-websocket).

## Configuración sensible

- Todo secreto entra por **variable de entorno** (`app/core/config.py`), nunca en
  el repo ni en el chat. En Render/Vercel se cargan como env vars; si se filtran,
  se **revocan**. Ver [CLAUDE.md](../CLAUDE.md#no-hacer).
- CORS restringido a los orígenes de `CORS_ORIGINS` (sólo el dominio de
  producción; sin `localhost` en config de producto).

## Endurecimiento ya aplicado

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

## Brechas abiertas (a cerrar — Fase de Seguridad)

> Deudas reales pendientes (ver [TECH_DEBT.md](./TECH_DEBT.md),
> [QUICK_WINS.md](./QUICK_WINS.md)):
>
> 1. **Sin revocación de refresh tokens** (no hay lista de invalidados / logout
>    server-side): un refresh robado vale 30 días. Requiere modelo de sesión →
>    **ADR**.
> 2. **Rotación de secretos** no documentada.
> 3. **Rate limiting por proceso**, no distribuido: al escalar horizontalmente
>    pierde efectividad (necesita store compartido + ADR).
>
> Priorización y pasos en [QUICK_WINS.md](./QUICK_WINS.md) y
> [RECOMMENDATIONS.md](./RECOMMENDATIONS.md).
