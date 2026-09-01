# ARCHITECTURE.md — Arquitectura de Staffya

> Cómo está construido el sistema. Complementa [DOMAIN.md](./DOMAIN.md) (qué
> modela) y [PRINCIPLES.md](./PRINCIPLES.md) (con qué criterios). El detalle
> técnico por área se profundiza en [MODULES.md](./MODULES.md),
> [API.md](../reference/API.md), [DATABASE.md](../reference/DATABASE.md), [EVENTS.md](../reference/EVENTS.md),
> [SECURITY.md](../reference/SECURITY.md), [TESTING.md](../reference/TESTING.md),
> [DEPLOY.md](../reference/DEPLOY.md) y [OBSERVABILITY.md](../reference/OBSERVABILITY.md).
>
> **Revisado y verificado contra el código real el 2026-08-31** (versiones
> exactas, módulos, integraciones e infraestructura). Si pasó mucho tiempo
> desde esta fecha, reverificar antes de citar una versión o un número —
> mismo criterio que `CLAUDE.md`.

## Stack

| Capa | Tecnología |
|------|-----------|
| **Backend** | FastAPI 0.141 · SQLAlchemy 2.0 **async** (asyncpg) · Alembic · Pydantic 2.10. Python 3.11, un solo worker Uvicorn (sin `--workers`). |
| **Frontend** | Next.js 16.3 (App Router) · React 19.2 · TypeScript · TailwindCSS · **PWA** instalable · `motion` (framer-motion) · MapLibre GL + `supercluster` (mapas, ADR-0001) · Lucide (íconos). |
| **DB** | PostgreSQL — **Neon** serverless en producción (`aws-us-east-2`, proyecto `staffya-us-east`). Tests con **SQLite en memoria**. |
| **Auth** | JWT (access 15 min, en `localStorage`) + refresh token (30 días) en **cookie `httpOnly`** (no en `localStorage` ni en el body — ver `SECURITY.md`). |
| **Tiempo real** | WebSocket (chat y notificaciones), en memoria de proceso — no hay Redis todavía. |
| **Trabajo en background** | Un loop `asyncio` dentro del propio proceso de FastAPI (no hay worker ni cola separada) — ver "Scheduler" abajo. |
| **Imágenes/archivos** | Cloudinary (foto de perfil/logo, subida firmada de CV). |
| **Deploy** | Backend en **Render** (Docker, auto-deploy desde `main`); Frontend en **Vercel** (auto-deploy desde `main`, previews por PR). |

## Backend: monolito modular (DDD + hexagonal)

Un único servicio FastAPI compuesto por **módulos de dominio** independientes en
`backend/app/modules/<modulo>/`, cada uno con **arquitectura hexagonal / DDD** en
cuatro capas:

```
modules/<modulo>/
├── domain/           # Entidades, value objects, PUERTOS (repositorios), excepciones
├── application/      # Casos de uso (servicios) y DTOs
├── infrastructure/   # Adaptadores: modelos ORM (SQLAlchemy) y repos concretos
└── api/              # Rutas HTTP/WS, schemas Pydantic y dependencias (DI de FastAPI)
```

El núcleo compartido vive en `backend/app/core/` (config, database, security,
rate limiting, WS manager, zona horaria, tipos). El punto de entrada es
`backend/app/main.py`, que registra el router de cada módulo bajo `/api/v1`.

### Responsabilidades por capa

- **domain/** — el negocio puro. Entidades y value objects sin dependencias de
  framework ni DB. Define **puertos** (interfaces de repositorio, `abc.ABC`) y
  las excepciones del dominio. No importa de `infrastructure` ni de `api`.
- **application/** — orquesta casos de uso sobre los puertos del dominio. No
  conoce HTTP ni SQL; recibe repos por constructor (inversión de dependencias).
- **infrastructure/** — implementa los puertos con SQLAlchemy (modelos ORM +
  repos concretos). Es el único lugar que sabe de la DB.
- **api/** — traduce HTTP/WS ↔ casos de uso. Define los schemas Pydantic, arma
  las dependencias (inyecta los repos concretos en los servicios) y mapea
  excepciones de dominio a códigos HTTP.

### Reglas de dependencia

1. `domain` no depende de nadie. `application` depende sólo de `domain`.
   `infrastructure` y `api` implementan/consumen hacia adentro. **Las
   dependencias apuntan al dominio**, nunca al revés.
2. **Cross-módulo:** cuando un caso de uso necesita datos de otro módulo, se
   inyecta el **puerto/repositorio del otro módulo** — no se acopla el dominio.
   Dos patrones vigentes:
   - Un **servicio** recibe repos de otros módulos por constructor (ej.
     `ShiftService` recibe `CompanyProfileRepository`, `WorkerProfileRepository`,
     `NotificationRepository`, `CandidateRepository`).
   - La **capa `api/`** enriquece respuestas inyectando el repo de otro módulo
     (ej. las rutas de `shift` suman nombre/logo del comercio vía
     `CompanyProfileRepository`; se resuelve `full_name`/`owner_full_name` vía
     `UserRepository`).
3. **No-disclosure** como regla de API: recurso ajeno o inexistente → **404**
   (nunca 403, para no confirmar que el recurso existe).

### Estado de los módulos (17)

| Módulo | Estado | Rol |
|--------|--------|-----|
| `identity` | ✅ | Login/registro, JWT + refresh rotativo, roles, logout server-side. |
| `worker` / `company` | ✅ | Perfiles + reputación derivada del ciclo real del turno. |
| `shift` | ✅ | Publicación, feed, ciclo de vida completo (asistencia geolocalizada, no-show automático, escalada de urgencia). |
| `application` | ✅ | Postulaciones del trabajador (lado worker del match). |
| `matching` | ✅ | Ranking de candidatos + búsqueda por mapa. |
| `notification` | ✅ | Avisos in-app en tiempo real (WebSocket + push VAPID). |
| `chat` | ✅ | Mensajería por turno en tiempo real (WebSocket). |
| `review` | ✅ | Reseñas bidireccionales; recalculan reputación. |
| `admin` | ✅ | Métricas y moderación (sólo rol admin). |
| `subscription` | ✅ (backend) | Mensualidad al comercio (ADR-0005 Fase 1): plan + gating de capacidad al publicar turnos. `BillingGateway`/Mercado Pago detrás de feature-flag, **apagado** (`subscriptions_enforced=false`). |
| `verification` | ✅ | Verificación de identidad (DNI/selfie), cola de revisión manual para el admin. |
| `favorite` | ✅ | Comercios/trabajadores favoritos. |
| `saved_shift` | ✅ | Turnos guardados por el trabajador. |
| `upload` | ✅ | Subida firmada de archivos (CV) a Cloudinary vía backend. |
| `assistant` | ✅ | Asistente con IA (Gemini) para interpretar texto libre al publicar un turno — `503` si no hay `GEMINI_API_KEY`. |
| `support` | ✅ | Canal de soporte/contacto. |

No hay módulo `payment` separado: el cobro real comercio→trabajador
(ADR-0005 Fase 2) no está construido — `mark-paid` sigue siendo manual.

## Flujo de datos (request típico)

```
Cliente (Next.js) ──HTTP/JSON──▶ api/ (FastAPI router + schema Pydantic)
                                   │  (Depends → arma servicio con repos concretos)
                                   ▼
                              application/ (caso de uso)
                                   │  (usa puertos del domain/)
                                   ▼
                         infrastructure/ (repo SQLAlchemy) ──▶ PostgreSQL (Neon)
```

La respuesta vuelve como schema Pydantic. Las excepciones de dominio se mapean a
HTTP en `api/`.

## Tiempo real (WebSockets)

Dos canales, además del REST:

- **Chat:** `WS /api/v1/chats/{shift_id}/ws` — mensajes del turno en vivo.
- **Notificaciones:** `WS /api/v1/notifications/ws` — avisos del usuario en vivo.

`ConnectionManager` (`app/core/ws_manager.py`) vive en memoria del proceso —
tope de conexiones concurrentes por turno/usuario y límite de frames por
minuto (120/min) para evitar abuso. Escalar a 2+ workers requeriría mover este
estado a Redis (no implementado; ver "Escalabilidad" abajo). El frontend
reconecta con backoff exponencial. Detalle en
[API.md](../reference/API.md#tiempo-real-websocket).

## Scheduler (trabajo en background)

No hay Cron Job ni worker separado — el plan free de Render sólo tiene un web
service. `backend/app/modules/shift/application/scheduler.py` corre un loop
`asyncio` arrancado en el `lifespan` de FastAPI (gateado a
`settings.is_production`, no corre en tests) con dos responsabilidades:

1. **Asistencia (ADR-0008):** recordatorio de check-in y no-show automático
   sobre turnos `CONFIRMADO`/`EN_CAMINO`.
2. **Escalada de urgencia (ADR-0009):** sube prioridad y amplía el aviso de un
   turno abierto que no se cubre rápido (`ESCALATION_DELAY` = 8 minutos, fijado
   a propósito antes de los 10 minutos de la misión del producto).

**Desde el 2026-08-27 el loop despierta por deadline, no por reloj fijo:**
cada pasada calcula cuándo es la próxima acción real posible y duerme
exactamente hasta ahí (piso 30s, techo 6h de latido de seguridad) en vez de
sondear la base cada 5 minutos las 24 horas. `notify_scheduler()`
(`scheduler_signal.py`, un `asyncio.Event` compartido) lo despierta antes de
tiempo cuando `publish_shift`/`confirm_assignment` crean una deadline nueva.
Motivo del cambio: un sondeo fijo cada 5 minutos, combinado con conexiones de
base de datos sostenidas, agotó la cuota de cómputo del plan free de Neon el
2026-08-26 (bitácora completa en `STATUS.md`).

## "Eventos"

No hay un bus de eventos formal (event sourcing / broker) — es un punto a
**no asumir**. Lo que hoy llamamos "eventos" son **efectos de dominio dentro del
caso de uso**: al asignar/confirmar/rechazar/cerrar/pagar un turno o recibir una
reseña, el servicio **crea una `Notification`** (y la empuja por WebSocket). Si en
el futuro se introduce un bus/outbox, debe registrarse como ADR y documentarse en
[EVENTS.md](../reference/EVENTS.md).

## Frontend (Next.js)

- **App Router** (`frontend/app/*`), componentes cliente donde hay estado/gestos.
- **Design System** propio en `frontend/components/ui/*`. Íconos **Lucide**.
- **API remota** por `NEXT_PUBLIC_API_URL` (sin `localhost` en config).
- **Sesión:** el access token (15 min) vive en `localStorage`; el refresh
  token **no** — viaja sólo como cookie `httpOnly` (`Secure`+`SameSite=None`
  en producción, requiere `ENVIRONMENT=production` en Render). El frontend
  manda `credentials: "include"` en cada request.
- **Mapas:** MapLibre GL vectorial + clustering (`supercluster`), sin API key
  de pago — reemplazó a Leaflet/CARTO (ADR-0001).
- **PWA** instalable, con tokens de "safe area" (`--chrome-top`/`--chrome-bottom`)
  para el cromo con notch.

## Integraciones de terceros

Todas detrás de un **feature-flag por ausencia de credencial** — sin la env
var correspondiente, la integración se apaga sola (no-op o `503` explícito)
sin romper el resto del sistema. Ninguna es una dependencia dura hoy:

| Servicio | Uso | Flag |
|---|---|---|
| Cloudinary | Foto de perfil/logo, subida firmada de CV | `CLOUDINARY_*` |
| Resend | Email transaccional (plantillas HTML de marca) | `RESEND_API_KEY` (sin ella, `NullEmailSender` sólo loguea) |
| Google Identity Services | Login con Google (ID token, sin client secret) | `GOOGLE_CLIENT_ID` |
| Web Push / VAPID | Notificaciones push | `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` |
| Sentry | Error tracking backend + frontend | `SENTRY_DSN` |
| Gemini | Asistente IA para interpretar texto libre al publicar un turno; modelo en `GEMINI_MODEL` (env var, no hardcodeado en la URL) | `GEMINI_API_KEY` |
| Mercado Pago | Suscripción recurrente del comercio (ADR-0005 Fase 1) | `MERCADOPAGO_ACCESS_TOKEN` — **construido, no activado** |
| Nominatim / OpenStreetMap | Geocoding gratuito para alta de local con pin arrastrable | ninguna (gratis, sin key) |

## Configuración y entornos

- Backend configurado por variables de entorno (`app/core/config.py`,
  pydantic-settings). Claves: `DATABASE_URL`, `JWT_SECRET_KEY`, `CORS_ORIGINS`,
  `ADMIN_EMAILS`, `SEED_DEMO_DATA`, `ENVIRONMENT`.
- **Sin `localhost`** en configuración de producto; CORS sólo con el dominio de
  producción.
- **Credenciales nunca en el repo ni en el chat**: se configuran como env vars en
  Render/Vercel.
- Detalle en [DEPLOY.md](../reference/DEPLOY.md) y [SECURITY.md](../reference/SECURITY.md).

## Base de datos y pool de conexiones

- **Neon** (Postgres serverless), connection string **directa** (sin sufijo
  `-pooler` — el repo no configura `statement_cache_size=0`, que el pooler en
  modo transacción exige con asyncpg).
- `create_async_engine`: `pool_size=1`, `max_overflow=10`, `pool_pre_ping=True`,
  `pool_recycle=280`. `pool_size` bajó de 5 a 1 el 2026-08-26: Neon (plan free)
  suspende el cómputo — y deja de consumir cuota — sólo con cero conexiones
  activas; 5 conexiones ociosas sostenidas todo el día, junto al sondeo fijo
  del scheduler, agotaron la cuota mensual (ver incidente en `STATUS.md`).
- **Retención de point-in-time recovery nativo de Neon: 6 horas**
  (`history_retention_seconds=21600`, verificado contra la API de Neon) — corta,
  no reemplaza un backup independiente ensayado.

## Deploy

- **Backend:** contenedor Docker en Render. El `CMD` corre
  `alembic upgrade head` (migraciones) → `scripts.startup_seed` (seed demo
  idempotente si `SEED_DEMO_DATA=true`, hoy `false`) → `uvicorn`. Auto-deploy
  desde `main`. Sin entorno de staging: cada push a `main` despliega directo.
- **Frontend:** Vercel, auto-deploy desde `main`, previews por PR.
- **DB:** **Neon** (serverless, `aws-us-east-2`) — reemplazó al Postgres
  gestionado de Render (ese plan free expiraba a los 90 días). Migración
  verificada en vivo el 2026-07-23, ver
  [INCIDENTE_2026-07-23_BACKEND_CAIDO.md](../INCIDENTE_2026-07-23_BACKEND_CAIDO.md).

## CI

GitHub Actions (`.github/workflows/ci.yml` y workflows asociados), con
detección de cambios por área (backend/frontend no corren si no cambió esa
carpeta). Gates obligatorios en cada PR y push a `main`:

- `pytest -q` (backend) — 429 tests a la fecha de esta revisión.
- `tsc --noEmit` + `npm run build` (frontend).
- Playwright (E2E, API mockeada).
- Secret scanning (gitleaks) y GitGuardian.
- Dependency audit (`pip-audit`, `npm audit`).

Nada entra a `main` — que despliega automáticamente a Render/Vercel — sin
pasar por estos gates. `npm run lint` sigue sin correr en CI (deuda conocida,
ver `TECH_DEBT.md`).

## Seguridad (resumen — detalle completo en `SECURITY.md`)

- Rate limiting en memoria de proceso: 10/min login, 5/min registro, 120
  frames/min por WebSocket.
- Security headers: HSTS, CSP, X-Frame-Options, Referrer-Policy,
  Permissions-Policy.
- Refresh token en cookie `httpOnly`, rotación + detección de reuso
  (`refresh_sessions`), logout server-side.
- Idempotencia (`Idempotency-Key`) en mutaciones críticas.

## Escalabilidad — límite conocido

Rate limiting, WebSocket manager y el scheduler viven **en memoria de un solo
proceso**. Con un solo worker Uvicorn (configuración actual) esto es
correcto y suficiente. Si se necesitara escalar a 2+ workers, estos tres
subsistemas requieren migrar a un store compartido (Redis) — no implementado,
sin ADR escrito todavía. No priorizar sin señal real de carga.

## Tests

- Backend: `pytest` con **SQLite en memoria** (sin DB externa); las tablas se
  crean con `Base.metadata.create_all` desde `tests/conftest.py`.
- Frontend: Vitest + Testing Library (unitarios) + `npx tsc --noEmit` +
  `npm run build` + Playwright (E2E, API mockeada).
- Ver [TESTING.md](../reference/TESTING.md).
