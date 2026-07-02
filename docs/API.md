# API.md — Superficie HTTP + WebSocket (arquitectura técnica)

> El contrato REST/WS del backend. Todas las rutas cuelgan de **`/api/v1`**.
> Esquemas de request/response = schemas Pydantic en cada `api/schemas.py`.
> Convenciones de auth en [SECURITY.md](./SECURITY.md).

## Convenciones

- **Base:** `/api/v1/<prefijo-del-módulo>` (los prefijos se montan en `main.py`).
- **Formato:** JSON. Schemas Pydantic (validación de entrada y forma de salida).
- **Auth:** `Authorization: Bearer <access_token>` salvo endpoints públicos
  (registro, login, refresh, `/health`). Ver [SECURITY.md](./SECURITY.md).
- **No-disclosure:** recurso ajeno o inexistente → **404** (nunca se revela que
  existe algo de otro usuario). Es una regla transversal, no por endpoint.
- **Errores:** las excepciones de dominio se mapean a HTTP en la capa `api/`
  (400/403/404/409 según el caso).
- **Healthcheck:** `GET /health` (sin prefijo `/api/v1`) → `{"status":"ok"}`.

## Endpoints por módulo

Rutas relativas al prefijo del módulo (todas bajo `/api/v1`).

### `identity` — `/auth`
| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | `/register` | Alta de usuario (worker/employer) |
| POST | `/login` | Login → access + refresh token |
| POST | `/refresh` | Renueva tokens con el refresh token (rota la sesión, ADR-0002) |
| POST | `/logout` | Revoca la sesión del refresh token dado (204) |
| GET | `/me` | Usuario autenticado |

### `worker` — `/workers`
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET/PUT | `/me/profile` | Ver/editar el propio perfil de trabajador |
| GET | `/{profile_id}` | Perfil público de un trabajador |

> El listado/búsqueda de trabajadores vive en `matching` (`GET
> /matching/search`, ver más abajo) y no en este módulo: no hay `GET
> /workers` (fila corregida; era una inconsistencia doc↔código).

### `company` — `/companies`
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET/PUT | `/me/profile` | Ver/editar el propio perfil de comercio |
| GET | `/{profile_id}` | Perfil público de un comercio |

### `shift` — `/shifts`
Publicación y **ciclo de vida** del turno (ver [SHIFT.md](./SHIFT.md)):
| Método | Ruta | Transición |
|--------|------|-----------|
| POST | `/shifts` | Crear turno (borrador) |
| GET | `/feed` | Feed de turnos abiertos (worker) — **paginado** |
| GET | `/me` | Turnos publicados por el comercio propio — **paginado** |
| GET | `/mine` | Turnos asignados al trabajador propio — **paginado** |
| GET | `/{shift_id}` | Detalle |
| POST | `/{shift_id}/publish` | Publicar |
| POST | `/{shift_id}/assign` | Asignar a un trabajador |
| POST | `/{shift_id}/confirm` · `/reject` | Trabajador confirma/rechaza |
| POST | `/{shift_id}/check-in` · `/start-working` · `/depart` · `/check-out` | Asistencia geolocalizada |
| POST | `/{shift_id}/finish` | Finalizar |
| POST | `/{shift_id}/mark-paid` | Marcar pagado (ver [PAYMENTS.md](./PAYMENTS.md)) |
| POST | `/{shift_id}/cancel` | Cancelar |

> `/me` y `/mine` estaban documentados al revés (fila corregida): `/me` son
> los turnos publicados por **el comercio propio**, `/mine` los asignados
> **al trabajador propio**.

### `application` — `/applications`
| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | `/applications` | Postularse a un turno |
| GET | `/mine` | Mis postulaciones (worker) — **paginado** |
| GET | `/shifts/{shift_id}` | Postulantes de un turno (comercio) |

### `matching` — `/shifts`, `/matching`
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/shifts/{shift_id}/candidates` | Ranking de candidatos para un turno (tope `limit`, no es paginación) |
| GET | `/matching/search` | Búsqueda/listado de trabajadores por rol y radio (mapa) — **paginado** |

### `notification` — `/notifications`
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/notifications` | Listar avisos del usuario — **paginado** |
| POST | `/{notification_id}/read` | Marcar leído |
| WS | `/notifications/ws` | Avisos en vivo |

### `chat` — `/chats`
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/chats` | Inbox (conversaciones con no-leídos) |
| GET | `/{shift_id}/messages` | Historial del turno |
| WS | `/{shift_id}/ws` | Mensajes en vivo |

### `review` — `/reviews`
| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | `/reviews` | Dejar una reseña de un turno cerrado |
| GET | `/received` | Reseñas recibidas |
| GET | `/shifts/{shift_id}` | Reseñas de un turno |

### `admin` — `/admin` (sólo rol admin)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/stats` | Métricas de la plataforma (usa la tabla completa de usuarios; no pagina — ver P5 en [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md), fuera de alcance de R2.1) |
| GET | `/users` | Listar usuarios — **paginado** |
| POST | `/users/{id}/promote` · `/suspend` · `/activate` · `/verify` | Moderación |

## Paginación

**R2.1** (`docs/ROADMAP_IMPLEMENTATION.md`). Los listados largos marcados
**paginado** arriba aceptan query params `limit`/`offset`:

- `limit`: default **50**, mínimo 1, máximo **100** (rechaza con 422 fuera de
  rango).
- `offset`: default **0**, mínimo 0.
- La paginación se aplica en SQL (`ORDER BY` estable + `LIMIT`/`OFFSET`), no
  como slicing de una lista ya traída completa a memoria — salvo la excepción
  de `/matching/search` (ver abajo).
- **Shape de la respuesta sin cambios**: sigue siendo una lista simple
  (`[...]`), no un envelope con `total`/`has_more`/cursor. Es una decisión
  deliberada para no romper a los consumidores actuales del frontend (que no
  mandan `limit`/`offset` y hoy reciben, como mucho, el seed completo — 12
  comercios / 14 turnos / 14 trabajadores — muy por debajo del default de 50).
  Si el volumen real lo pide, un envelope de paginación (con `total` y/o
  cursor) es un cambio de contrato aparte, a versionar.
- **Excepción — `/matching/search`:** el orden final es por distancia
  (Haversine en Python; no hay PostGIS todavía), calculada después de traer
  los candidatos filtrados por SQL. Ahí `limit`/`offset` se aplican **después**
  de ordenar (slice en Python), porque paginar antes de ordenar por distancia
  devolvería una página con los trabajadores equivocados. Documentado en
  `matching/application/services.py`.
- **`GET /admin/stats`** es la única excepción que no pagina: necesita el
  total real de usuarios para las métricas agregadas (queda como P5 de
  [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md), no resuelto en R2.1).

## Tiempo real (WebSocket)

Dos canales, autenticados por token:

- **Chat:** `WS /api/v1/chats/{shift_id}/ws` — sólo participantes del turno.
- **Notificaciones:** `WS /api/v1/notifications/ws` — avisos del propio usuario.

El registro de conexiones es **en memoria** (`app/core/ws_manager.py`): un solo
worker las ve todas; escalar horizontalmente requeriría pub/sub (Redis) y un
**ADR**. Reemplazaron el polling anterior; el frontend reconecta con backoff.
Ver [ARCHITECTURE.md](./ARCHITECTURE.md#tiempo-real-websockets).

## Pendientes / a mejorar

> - **Versionado:** hoy sólo `v1`; no hay política de deprecación documentada.
> - **Paginación:** los listados largos ya paginan (`limit`/`offset`, ver
>   [sección Paginación](#paginación), R2.1). Pendiente: envelope con
>   `total`/cursor si el volumen real lo pide, y paginar `/admin/stats`
>   (P5 de [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md)).
> - **OpenAPI:** FastAPI genera `/docs` automáticamente; falta curar
>   descripciones/`response_model` uniformes.
