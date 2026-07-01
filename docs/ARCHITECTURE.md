# ARCHITECTURE.md — Arquitectura de Staffya

> Cómo está construido el sistema. Complementa [DOMAIN.md](./DOMAIN.md) (qué
> modela) y [PRINCIPLES.md](./PRINCIPLES.md) (con qué criterios). El detalle
> técnico por área se profundiza en la Fase 4 (MODULES.md, API.md, DATABASE.md,
> WEBSOCKETS.md, AUTH.md, DEPLOY.md, …).

## Stack

| Capa | Tecnología |
|------|-----------|
| **Backend** | FastAPI · SQLAlchemy 2.0 **async** · Alembic · Pydantic. Python 3.11+. |
| **Frontend** | Next.js (App Router) · React · TypeScript · TailwindCSS v4 · **PWA** instalable · `motion` (framer-motion) · Leaflet (mapas). |
| **DB** | PostgreSQL (PostGIS/Redis previstos). Tests con **SQLite en memoria**. |
| **Auth** | JWT (access 15 min) + refresh token (30 días). |
| **Tiempo real** | WebSocket (chat y notificaciones). |
| **Imágenes** | Cloudinary (foto de perfil/logo). |
| **Deploy** | Backend en **Render** (Docker, auto-deploy desde `main`); Frontend en **Vercel** (auto-deploy desde `main`). |

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
tipos). El punto de entrada es `backend/app/main.py`, que registra el router de
cada módulo.

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
     `NotificationRepository`).
   - La **capa `api/`** enriquece respuestas inyectando el repo de otro módulo
     (ej. las rutas de `shift` suman nombre/logo del comercio vía
     `CompanyProfileRepository`; se resuelve `full_name`/`owner_full_name` vía
     `UserRepository`).
3. **No-disclosure** como regla de API: recurso ajeno o inexistente → **404**.

### Estado de los módulos

| Módulo | Estado | Rol |
|--------|--------|-----|
| `identity` | ✅ | Login/registro, JWT + refresh, roles. |
| `worker` / `company` | ✅ | Perfiles + reputación. |
| `shift` | ✅ | Publicación, feed y ciclo de vida completo (asistencia geolocalizada). |
| `application` | ✅ | Postulaciones del trabajador (lado worker del match). |
| `matching` | ✅ | Ranking de candidatos + búsqueda por mapa. |
| `notification` | ✅ | Avisos in-app en tiempo real (WebSocket). |
| `chat` | ✅ | Mensajería por turno en tiempo real (WebSocket). |
| `review` | ✅ | Reseñas bidireccionales; recalculan reputación. |
| `admin` | ✅ | Métricas y moderación (sólo rol admin). |
| `payment` | ⬜ | **Placeholder** (no procesa cobros). |
| `ai` | ⬜ | Pendiente (asistente por voz, pricing, antifraude). |

## Flujo de datos (request típico)

```
Cliente (Next.js) ──HTTP/JSON──▶ api/ (FastAPI router + schema Pydantic)
                                   │  (Depends → arma servicio con repos concretos)
                                   ▼
                              application/ (caso de uso)
                                   │  (usa puertos del domain/)
                                   ▼
                         infrastructure/ (repo SQLAlchemy) ──▶ PostgreSQL
```

La respuesta vuelve como schema Pydantic. Las excepciones de dominio se mapean a
HTTP en `api/`.

## Tiempo real (WebSockets)

Dos canales, además del REST:

- **Chat:** `WS /api/v1/chats/{shift_id}/ws` — mensajes del turno en vivo.
- **Notificaciones:** `WS /api/v1/notifications/ws` — avisos del usuario en vivo.

Reemplazan el polling anterior (chat 5s, notificaciones 30s). El frontend
reconecta con backoff exponencial. Detalle en `WEBSOCKETS.md` (Fase 4).

## "Eventos"

No hay un bus de eventos formal (event sourcing / broker) — es un punto a
**no asumir**. Lo que hoy llamamos "eventos" son **efectos de dominio dentro del
caso de uso**: al asignar/confirmar/rechazar/cerrar/pagar un turno o recibir una
reseña, el servicio **crea una `Notification`** (y la empuja por WebSocket). Si en
el futuro se introduce un bus/outbox, debe registrarse como ADR (Fase 10) y
documentarse en `EVENTS.md` (Fase 3).

## Frontend (Next.js)

- **App Router** (`frontend/app/*`), componentes cliente donde hay estado/gestos.
- **Design System** propio en `frontend/components/ui/*` (ver Fase 6:
  DESIGN_SYSTEM.md / COMPONENT_LIBRARY.md). Íconos **Lucide**.
- **API remota** por `NEXT_PUBLIC_API_URL` (sin `localhost` en config).
- **Sesión persistente:** access token + **refresh token** en `localStorage`,
  renovado al cargar y periódicamente.
- **Mapas:** Leaflet + tiles CARTO (look de app), sin API key.

## Configuración y entornos

- Backend configurado por variables de entorno (`app/core/config.py`,
  pydantic-settings). Claves: `DATABASE_URL`, `JWT_SECRET_KEY`, `CORS_ORIGINS`,
  `ADMIN_EMAILS`, `SEED_DEMO_DATA`.
- **Sin `localhost`** en configuración de producto; CORS sólo con el dominio de
  producción.
- **Credenciales nunca en el repo ni en el chat**: se configuran como env vars en
  Render/Vercel.
- Detalle en `ENVIRONMENT.md` / `DEPLOY.md` (Fase 4).

## Deploy

- **Backend:** contenedor Docker en Render. El `CMD` corre
  `alembic upgrade head` (migraciones) → `scripts.startup_seed` (seed demo
  idempotente si `SEED_DEMO_DATA=true`) → `uvicorn`. Auto-deploy desde `main`.
- **Frontend:** Vercel, auto-deploy desde `main`, previews por PR.
- **DB:** PostgreSQL de Render (free) — **expira a los 90 días**; migración a
  **Neon** prevista (pasos en `backend/README.md`).

## Tests

- Backend: `pytest` con **SQLite en memoria** (sin DB externa); las tablas se
  crean con `Base.metadata.create_all` desde `tests/conftest.py`.
- Frontend: `npx tsc --noEmit` + `npm run build`.
- Ver `TESTING.md` (Fase 5).
