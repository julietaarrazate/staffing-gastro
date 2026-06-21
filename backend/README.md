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
  feed público con filtros y ciclo de vida (borrador → publicado → ... / cancelado).
- **matching** ✅ — Motor de scoring de candidatos para un turno: distancia (Haversine),
  experiencia, reputación, puntualidad e historial de desempeño. La afinidad con el
  local queda fuera hasta que exista historial de asignaciones (Fase 3+). No depende
  de las entidades de `worker`/`shift`: usa DTOs propios para mantenerse testeable.
- attendance, payment, notification, ai — _pendientes (ver roadmap en `CLAUDE.md`)._

## Requisitos
- Python 3.11+
- PostgreSQL (con PostGIS para features de geolocalización futuras)
- Docker (opcional, recomendado)

## Puesta en marcha

### Con Docker (recomendado)
```bash
# Desde la raíz del repo
docker compose up --build
```
Esto levanta PostgreSQL (PostGIS), Redis y el backend en `http://localhost:8000`.

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
| GET    | `/api/v1/shifts/{id}`         | Ver un turno                                 |
| PUT    | `/api/v1/shifts/{id}`         | Editar un turno (BORRADOR / PUBLICADO)       |
| POST   | `/api/v1/shifts/{id}/publish` | Publicar un turno en borrador                |
| POST   | `/api/v1/shifts/{id}/cancel`  | Cancelar un turno                            |
| GET    | `/api/v1/shifts/{id}/candidates` | Top de candidatos recomendados para un turno propio (rol employer) |

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
