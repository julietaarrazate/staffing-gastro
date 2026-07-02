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
| GET | `/workers` | Listado/búsqueda de trabajadores |
| GET | `/{profile_id}` | Perfil público de un trabajador |

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
| GET | `/feed` | Feed de turnos abiertos (worker) |
| GET | `/mine` | Turnos del comercio |
| GET | `/me` | Turnos del trabajador |
| GET | `/{shift_id}` | Detalle |
| POST | `/{shift_id}/publish` | Publicar |
| POST | `/{shift_id}/assign` | Asignar a un trabajador |
| POST | `/{shift_id}/confirm` · `/reject` | Trabajador confirma/rechaza |
| POST | `/{shift_id}/check-in` · `/start-working` · `/depart` · `/check-out` | Asistencia geolocalizada |
| POST | `/{shift_id}/finish` | Finalizar |
| POST | `/{shift_id}/mark-paid` | Marcar pagado (ver [PAYMENTS.md](./PAYMENTS.md)) |
| POST | `/{shift_id}/cancel` | Cancelar |

### `application` — `/applications`
| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | `/applications` | Postularse a un turno |
| GET | `/mine` | Mis postulaciones (worker) |
| GET | `/shifts/{shift_id}` | Postulantes de un turno (comercio) |

### `matching` — `/shifts`, `/matching`
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/shifts/{shift_id}/candidates` | Ranking de candidatos para un turno |
| GET | `/matching/search` | Búsqueda de trabajadores por rol y radio (mapa) |

### `notification` — `/notifications`
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/notifications` | Listar avisos del usuario |
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
| GET | `/stats` | Métricas de la plataforma |
| GET | `/users` | Listar usuarios |
| POST | `/users/{id}/promote` · `/suspend` · `/activate` · `/verify` | Moderación |

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
> - **Paginación consistente:** revisar que los listados largos pagen (ver
>   [TECH_DEBT.md](./TECH_DEBT.md)).
> - **OpenAPI:** FastAPI genera `/docs` automáticamente; falta curar
>   descripciones/`response_model` uniformes.
