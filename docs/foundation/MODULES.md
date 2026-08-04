# MODULES.md — Mapa de módulos (arquitectura técnica)

> Detalla la estructura de módulos anticipada en
> [ARCHITECTURE.md](./ARCHITECTURE.md#backend-monolito-modular-ddd--hexagonal).
> Acá: qué módulo hay, qué contiene y cómo se cruzan sin acoplarse.

## Monolito modular

Un único servicio FastAPI (`backend/app/main.py`) compuesto por **módulos de
dominio** independientes en `backend/app/modules/<modulo>/`. Cada módulo es una
rebanada vertical con las **cuatro capas** hexagonales:

```
modules/<modulo>/
├── domain/           # entities.py, exceptions.py (+ value objects, puertos)
├── application/      # services.py, dtos.py (casos de uso)
├── infrastructure/   # models.py (ORM), repositories.py (adaptadores)
└── api/              # routes.py, schemas.py, dependencies.py
```

El núcleo compartido está en `backend/app/core/` (ver [SECURITY.md](../reference/SECURITY.md),
[DATABASE.md](../reference/DATABASE.md)).

## Módulos reales

| Módulo | Prefijo API | Responsabilidad | Doc de dominio |
|--------|-------------|-----------------|----------------|
| `identity` | `/auth` | Registro, login, JWT + refresh, roles | — |
| `worker` | `/workers` | Perfil y reputación del trabajador | [WORKER.md](../reference/WORKER.md) |
| `company` | `/companies` | Perfil del comercio | [EMPLOYER.md](../reference/EMPLOYER.md) |
| `shift` | `/shifts` | Publicación, feed y ciclo de vida del turno | [SHIFT.md](../reference/SHIFT.md) |
| `application` | `/applications` | Postulaciones (lado worker del match) | [MATCHING.md](../reference/MATCHING.md) |
| `matching` | `/shifts`, `/matching` | Ranking de candidatos + búsqueda por mapa | [MATCHING.md](../reference/MATCHING.md) |
| `notification` | `/notifications` | Avisos in-app en tiempo real | [NOTIFICATIONS.md](../reference/NOTIFICATIONS.md) |
| `chat` | `/chats` | Mensajería por turno en tiempo real | [CHAT.md](../reference/CHAT.md) |
| `review` | `/reviews` | Reseñas bidireccionales | [REPUTATION.md](../reference/REPUTATION.md) |
| `admin` | `/admin` | Métricas y moderación (sólo admin) | — |

Todos se montan bajo `/api/v1` en `main.py`. No hay módulos `payment` ni `ai`:
son **placeholders/pendientes** (ver [PAYMENTS.md](../reference/PAYMENTS.md) y
[ARCHITECTURE.md](./ARCHITECTURE.md#estado-de-los-módulos)).

## Reglas de dependencia (intra-módulo)

Las dependencias apuntan **hacia el dominio**:

```
api ──▶ application ──▶ domain ◀── infrastructure
```

- `domain/` no importa de nadie (sin framework, sin SQL).
- `application/` orquesta casos de uso sobre **puertos** del dominio; recibe
  repos por constructor.
- `infrastructure/` implementa los puertos con SQLAlchemy.
- `api/` traduce HTTP/WS ↔ caso de uso, arma la DI y mapea excepciones.

## Cruces entre módulos (sin acoplar dominios)

Cuando un caso de uso necesita datos de otro módulo, se **inyecta el repositorio
del otro módulo**; nunca se importan las entrañas de otro dominio. Dos patrones
vigentes en el código:

1. **Servicio con repos de terceros por constructor.** Ej.: `ShiftService`
   recibe `CompanyProfileRepository`, `WorkerProfileRepository` y
   `NotificationRepository` para publicar, asignar y notificar en un turno.
2. **Enriquecimiento en `api/`.** La capa de rutas suma datos de presentación de
   otro módulo (ej.: las rutas de `shift`/`application` agregan nombre y logo del
   comercio vía `CompanyProfileRepository`, y `full_name` vía `UserRepository`).

> Regla: **un módulo expone su repositorio (puerto) como superficie de
> integración**; el resto lo consume por inyección. Ver
> [PRINCIPLES.md](./PRINCIPLES.md).

## Núcleo compartido (`app/core/`)

| Archivo | Qué provee |
|---------|-----------|
| `config.py` | `Settings` (pydantic-settings): única fuente de configuración |
| `database.py` | `Base`, `engine` async, `get_session` (dependencia por request) |
| `security.py` | hashing bcrypt + emisión/validación de JWT |
| `ws_manager.py` | registro en memoria de conexiones WebSocket (chat/notif) |
| `geo.py` | distancia Haversine (usada por matching) |
| `types.py` | tipos compartidos |

## Cómo agregar un módulo

Ver el flujo canónico en [CLAUDE.md](../../CLAUDE.md#implementar-una-funcionalidad-nueva):
modelar en `domain/` → caso de uso en `application/` → adaptadores en
`infrastructure/` + **migración Alembic** + registrar el modelo en
`tests/conftest.py` → exponer en `api/` → tests → actualizar `docs/`.
