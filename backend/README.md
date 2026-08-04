# Staffya — Backend

Backend de **Staffya**, la plataforma de staffing en tiempo real para gastronomía
y eventos. Construido con **FastAPI** siguiendo un enfoque de **monolito modular**:
un único servicio con módulos de dominio bien separados, listos para extraerse como
microservicios en el futuro.

## Arquitectura

Cada módulo (`app/modules/<modulo>`) sigue **arquitectura hexagonal / DDD** con cuatro capas:

```
modules/identity/
├── domain/           # Entidades, value objects, puertos (repositorios), excepciones
├── application/      # Casos de uso (servicios) y DTOs
├── infrastructure/   # Adaptadores: modelos ORM y repositorios SQLAlchemy
└── api/              # Rutas HTTP, esquemas Pydantic y dependencias de FastAPI
```

El núcleo compartido vive en `app/core/` (configuración, base de datos, seguridad, tipos).

### Módulos
- **identity** ✅ — Autenticación con email/password, JWT + refresh tokens, roles
  (Trabajador / Empleador / Administrador).
- **worker** ✅ — PerfilTrabajador: datos (foto, ciudad, habilidades, idiomas,
  experiencia, geolocalización), métricas e insignias.
- **company** ✅ — PerfilComercio: datos (logo, rubro, ubicación, capacidad, horarios)
  y métricas.
- **shift** ✅ — Publicación de turnos: entidad Turno con los estados del "Modo Uber",
  feed público con filtros y ciclo de vida completo (borrador → publicado →
  asignado → confirmado/rechazado → en_camino → check_in → trabajando →
  check_out → finalizado → pagado, o cancelado en cualquier punto no terminal).
  La asignación conecta con el top de candidatos del módulo matching: el
  comercio elige a quién ofrecerle el turno y el trabajador confirma o
  rechaza. El check-in/check-out del trabajador captura su ubicación
  geográfica.
- **matching** ✅ — Motor de scoring de candidatos para un turno: distancia (Haversine),
  experiencia, reputación, puntualidad e historial de desempeño. La afinidad con el
  local queda fuera hasta que exista historial de asignaciones (Fase 3+). No depende
  de las entidades de `worker`/`shift`: usa DTOs propios para mantenerse testeable.
- **notification** ✅ — Notificaciones in-app: se generan al asignar, confirmar o
  rechazar un turno, y se exponen para que cada usuario consulte las suyas y las
  marque como leídas. No incluye push ni chat en tiempo real (Fase 3+).
- **chat** ✅ — Mensajería trabajador↔comercio por turno: la conversación la
  integran el comercio y el trabajador asignado. Inbox con la última actividad y
  no leídos, y avisa al destinatario con una notificación. Polling, sin websockets.
- **admin** ✅ — Panel de administración (sólo rol ADMIN): métricas de la
  plataforma y moderación de usuarios (listar, suspender, reactivar, verificar,
  promover a admin). Reutiliza el repositorio de identidad. El primer admin se
  da de alta vía `ADMIN_EMAILS` (no hay auto-registro como admin).
- payment, ai — _pendientes (ver roadmap en [`../CLAUDE.md`](../CLAUDE.md)).
  El check-in/check-out geolocalizado (asistencia) ya vive dentro de `shift`;
  `payment` falta para procesar el cobro real, hoy `mark-paid` sólo registra que
  el comercio pagó._

## Requisitos
- Python 3.11+
- PostgreSQL
- Docker (opcional, recomendado)

## Puesta en marcha

### Con Docker (recomendado)
```bash
# Desde la raíz del repo
docker compose up --build
```
Esto levanta PostgreSQL y el backend en `http://localhost:8000`. (`docker-compose.yml`
usa `postgres:16-alpine` liso — el código no usa PostGIS hoy, ver
"Base de datos en producción" más abajo — ni Redis, que tampoco se usa;
sacados en PRODUCTION_HARDENING.md tras confirmar cero referencias en el
código.)

### Local
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # ajustar DATABASE_URL y JWT_SECRET_KEY

# Aplicar migraciones
alembic upgrade head

# Levantar el servidor
uvicorn app.main:app --reload
```

## Documentación de la API
Con el servidor corriendo:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

### Endpoints actuales
| Método | Ruta                      | Descripción                       |
|--------|---------------------------|-----------------------------------|
| GET    | `/health`                 | Healthcheck                       |
| POST   | `/api/v1/auth/register`   | Registrar un usuario              |
| POST   | `/api/v1/auth/login`      | Iniciar sesión (devuelve tokens)  |
| POST   | `/api/v1/auth/refresh`    | Renovar el par de tokens          |
| GET    | `/api/v1/auth/me`         | Datos del usuario autenticado     |
| POST   | `/api/v1/workers/me/profile`   | Crear mi perfil de trabajador (rol worker)   |
| GET    | `/api/v1/workers/me/profile`   | Ver mi perfil de trabajador                  |
| PUT    | `/api/v1/workers/me/profile`   | Actualizar mi perfil de trabajador           |
| GET    | `/api/v1/workers/{id}`         | Ver perfil público de un trabajador          |
| POST   | `/api/v1/companies/me/profile` | Crear mi perfil de comercio (rol employer)   |
| GET    | `/api/v1/companies/me/profile` | Ver mi perfil de comercio                    |
| PUT    | `/api/v1/companies/me/profile` | Actualizar mi perfil de comercio             |
| GET    | `/api/v1/companies/{id}`       | Ver perfil público de un comercio            |
| POST   | `/api/v1/shifts`              | Publicar un turno (rol employer, crea en BORRADOR) |
| GET    | `/api/v1/shifts/feed`         | Feed de turnos abiertos (con filtros)        |
| GET    | `/api/v1/shifts/me`           | Mis turnos (comercio)                        |
| GET    | `/api/v1/shifts/mine`         | Mis turnos asignados (rol worker)            |
| GET    | `/api/v1/shifts/{id}`         | Ver un turno                                 |
| PUT    | `/api/v1/shifts/{id}`         | Editar un turno (BORRADOR / PUBLICADO)       |
| POST   | `/api/v1/shifts/{id}/publish` | Publicar un turno en borrador                |
| POST   | `/api/v1/shifts/{id}/cancel`  | Cancelar un turno                            |
| GET    | `/api/v1/shifts/{id}/candidates` | Top de candidatos recomendados para un turno propio (rol employer) |
| GET    | `/api/v1/matching/search`     | Buscar trabajadores disponibles por rol y distancia, para el mapa (rol employer) |
| POST   | `/api/v1/shifts/{id}/assign`  | Asignar el turno a un candidato (rol employer) |
| POST   | `/api/v1/shifts/{id}/confirm` | Confirmar la asistencia a un turno asignado (rol worker) |
| POST   | `/api/v1/shifts/{id}/reject`  | Rechazar un turno asignado (rol worker)      |
| POST   | `/api/v1/shifts/{id}/depart`  | Marcar salida hacia el turno (rol worker)    |
| POST   | `/api/v1/shifts/{id}/check-in` | Marcar llegada con ubicación (rol worker)   |
| POST   | `/api/v1/shifts/{id}/start-working` | Marcar inicio efectivo del turno (rol worker) |
| POST   | `/api/v1/shifts/{id}/check-out` | Marcar fin con ubicación (rol worker)      |
| POST   | `/api/v1/shifts/{id}/finish`  | Cerrar un turno trabajado (rol employer)     |
| POST   | `/api/v1/shifts/{id}/mark-paid` | Confirmar el pago de un turno (rol employer) |
| GET    | `/api/v1/notifications`       | Mis notificaciones                           |
| POST   | `/api/v1/notifications/{id}/read` | Marcar una notificación como leída       |
| GET    | `/api/v1/chats`               | Mis conversaciones (inbox)                   |
| GET    | `/api/v1/chats/{shift_id}/messages` | Mensajes de la conversación de un turno |
| POST   | `/api/v1/chats/{shift_id}/messages` | Enviar un mensaje en un turno           |
| GET    | `/api/v1/admin/stats`         | Métricas de la plataforma (rol admin)        |
| GET    | `/api/v1/admin/users`         | Listar usuarios (rol admin)                  |
| POST   | `/api/v1/admin/users/{id}/suspend`  | Suspender un usuario (rol admin)       |
| POST   | `/api/v1/admin/users/{id}/activate` | Reactivar un usuario (rol admin)       |
| POST   | `/api/v1/admin/users/{id}/verify`   | Verificar un usuario (rol admin)       |
| POST   | `/api/v1/admin/users/{id}/promote`  | Promover a admin (rol admin)           |

## Datos de prueba (locales y trabajadores de demo)
Para probar manualmente el matching, la búsqueda por mapa y los perfiles sin
crear cuentas a mano, hay un script que carga comercios y trabajadores de
ejemplo repartidos por distintos barrios de CABA (Palermo, Recoleta, San
Telmo, Belgrano, Caballito, Microcentro):
```bash
cd backend
source .venv/bin/activate
python -m scripts.seed_demo_data
```
Es idempotente (omite los emails que ya existan) y usa la `DATABASE_URL`
configurada en el entorno. La contraseña de todas las cuentas demo es
`staffyaDemo123`.

## Tests
```bash
cd backend
source .venv/bin/activate
pytest
```
Los tests usan SQLite en memoria, por lo que no requieren una base de datos externa.

## Migraciones
```bash
# Generar una nueva migración a partir de los modelos
alembic revision --autogenerate -m "descripcion"

# Aplicar
alembic upgrade head
```

## Base de datos en producción: Neon en vez del Postgres de Render

El Postgres free tier de Render **expira a los 90 días y se borra**, lo cual no
sirve para un proyecto en producción. [Neon](https://neon.tech) es Postgres
serverless, sin expiración, con branching de base de datos — esta migración
**ya se hizo y está verificada en producción** desde 2026-07-23 (ver
`docs/audits/2026-08-oido/06_INFRASTRUCTURE.md` y
`docs/INCIDENTE_2026-07-23_BACKEND_CAIDO.md`). El backend (FastAPI +
SQLAlchemy async + asyncpg) no necesitó ningún cambio de código: Neon entrega
una connection string `postgresql://` estándar y `Settings._force_asyncpg_driver`
(`app/core/config.py`) ya la convierte a `postgresql+asyncpg://` automáticamente.
PostGIS **no hace falta** — el matching por distancia usa Haversine en Python
(`app/core/geo.py`), no consultas espaciales.

Pasos que se siguieron (quedan documentados para una migración futura, ej. a
otro proveedor):
1. Crear un proyecto en [neon.tech](https://neon.tech) (plan free) y copiar la
   connection string que ofrece (con `?sslmode=require`).
2. En Render, abrir el servicio del backend → **Environment** → actualizar la
   variable `DATABASE_URL` con la connection string de Neon.
3. Aplicar las migraciones contra la base de Neon: con `DATABASE_URL` apuntando
   a Neon en el entorno local, correr `alembic upgrade head`.
4. Redeploy del servicio en Render para que tome la nueva variable.
5. Una vez confirmado que todo funciona, eliminar la instancia de Postgres
   vieja en Render para no dejar datos sensibles huérfanos.
