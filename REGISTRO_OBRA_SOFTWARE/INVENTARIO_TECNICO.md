# INVENTARIO TÉCNICO
## Oído — Estructura y componentes técnicos del sistema

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026
**Versión relevada:** commit de la rama de registro sobre `main`, Septiembre 2026

---

## 1. ÁRBOL DE DIRECTORIOS (nivel superior)

```
staffing-gastro/
├── backend/                    # API FastAPI (monolito modular DDD/hexagonal)
│   ├── app/
│   │   ├── core/                # Config, DB, seguridad, rate limit, WS manager, tz, geo
│   │   ├── modules/              # 17 módulos de dominio (ver detalle abajo)
│   │   └── main.py               # Punto de entrada, registra routers bajo /api/v1
│   ├── alembic/versions/         # 33 migraciones
│   ├── tests/                    # 512 tests (pytest, SQLite en memoria)
│   ├── scripts/                  # Seed de datos demo, utilidades operativas
│   └── requirements.txt
├── frontend/                    # App Next.js (App Router)
│   ├── app/                      # 31 páginas
│   ├── components/               # 107 componentes (ui/, worker/, admin/, map/, landing/, candidate/, subscription/, illustrations/)
│   ├── lib/                      # 56 módulos (cliente HTTP, hooks, utilidades)
│   ├── e2e/                      # 39 specs Playwright (111 tests)
│   └── package.json
├── docs/                        # Documentación viva de producto, dominio y arquitectura
│   ├── foundation/                # PRODUCT.md, DOMAIN.md, ARCHITECTURE.md, PRINCIPLES.md
│   ├── design/                    # Sistema de diseño (color, tipografía, iconografía, tokens)
│   ├── reference/                 # API.md, DATABASE.md, SECURITY.md, TESTING.md, DEPLOY.md, etc.
│   ├── adr/                       # 15 Architecture Decision Records
│   └── STATUS.md, TECH_DEBT.md, BUGS.md
├── docker-compose.yml            # Entorno local (Postgres, Redis/PostGIS previstos no adoptados)
└── LICENSE, NOTICE
```

## 2. BACKEND — DETALLE POR MÓDULO

17 módulos de dominio, cada uno con la misma estructura interna (`domain/`, `application/`, `infrastructure/`, `api/`):

| Módulo | Router | Persistencia propia | Rol |
|---|---|---|---|
| `identity` | ✓ | ✓ | Login/registro, JWT + refresh rotativo, roles, logout server-side |
| `worker` | ✓ | ✓ | Perfil de trabajador y reputación derivada |
| `company` | ✓ | ✓ | Perfil de comercio y reputación derivada |
| `shift` | ✓ | ✓ | Publicación, feed, ciclo de vida completo del turno |
| `application` | ✓ | ✓ | Postulaciones del trabajador (lado worker del match) |
| `matching` | ✓ | — (lectura compuesta) | Ranking de candidatos + búsqueda por mapa |
| `notification` | ✓ | ✓ | Avisos in-app en tiempo real (WebSocket + push VAPID) |
| `chat` | ✓ | ✓ | Mensajería por turno en tiempo real (WebSocket) |
| `review` | ✓ | ✓ | Reseñas bidireccionales; recalculan reputación |
| `admin` | ✓ | — | Métricas y moderación (rol admin) |
| `subscription` | ✓ | ✓ | Mensualidad al comercio: plan + gating de capacidad |
| `verification` | ✓ | ✓ | Verificación de identidad (DNI/selfie), cola de revisión manual |
| `favorite` | ✓ | ✓ | Comercios/trabajadores favoritos |
| `saved_shift` | ✓ | ✓ | Turnos guardados por el trabajador |
| `upload` | ✓ | — | Subida firmada de archivos (CV) al servicio de almacenamiento de archivos |
| `assistant` | ✓ | ✓ (log de consultas) | Asistente con IA para publicar turnos por texto libre |
| `support` | ✓ | ✓ | Canal de soporte/contacto |

**Totales backend:** 17 routers · 14 modelos ORM con tabla propia · 33 migraciones Alembic · 512 tests · ~19.100 líneas de código Python.

### Núcleo compartido (`backend/app/core/`)

`config.py` (configuración por variables de entorno, pydantic-settings), `database.py` (engine async), `security.py` (hashing, JWT), `middleware.py` (headers de seguridad), `rate_limit.py` (rate limiting en memoria), `ws_manager.py` (gestor de conexiones WebSocket), `idempotency.py` (claves de idempotencia), `tz.py`/`dt.py` (zona horaria Argentina para fechas de negocio), `geo.py` (Haversine), `gemini.py` (cliente del asistente IA), `cloudinary.py`, `observability.py` (logging estructurado + monitoreo de errores).

## 3. FRONTEND — DETALLE

| Área | Contenido |
|---|---|
| `app/` (31 páginas) | login, register, recuperar/restablecer contraseña, verificar-email, bienvenida (onboarding), feed, buscar, map, search, shifts (panel + wizard de publicación + candidatos), my-shifts, turno/[id], profile, workers/[id], companies/[id], chats/[shiftId], favorites, subscription, admin, assistant, support, privacidad, terminos |
| `components/ui/` | Design System propio: botones, campos de formulario, tarjetas, modales/sheets, toggles, badges, skeletons, empty states |
| `components/worker/`, `components/admin/`, `components/map/`, `components/landing/`, `components/candidate/`, `components/subscription/`, `components/illustrations/` | Componentes específicos por área de producto |
| `lib/` (56 módulos) | Cliente HTTP centralizado, hooks (dictado de voz, geolocalización, tema), helpers de fecha/formato, cliente WebSocket con reconexión por backoff exponencial |
| `e2e/` (39 specs, 111 tests) | Playwright, API mockeada, sin backend real, corre en CI en cada PR/push a `main` |
| Tests unitarios (14 archivos) | Vitest + Testing Library — lógica con valor real de romperse en silencio (zona horaria Argentina, tabla de "única acción" del panel del comercio, cálculo Haversine/tiempos de viaje, componentes con estado real) |

**Totales frontend:** 31 páginas · 107 componentes · 56 módulos en `lib/` · ~25.700 líneas de código TypeScript/TSX.

## 4. BASE DE DATOS

- **Motor:** PostgreSQL gestionado en la nube (serverless) en producción; SQLite en memoria en tests.
- **Migraciones:** 30 (Alembic), desde el baseline hasta la más reciente (creación de la cola de soporte, log de consultas del asistente y turnos guardados).
- **Modelos principales (14, uno por módulo con persistencia):** `User` (+ sesiones de refresh revocables), `WorkerProfile`, `CompanyProfile`, `Shift`, `ShiftApplication`, `Notification`, `ChatMessage`, `Review`, `Subscription`, `VerificationClaim`, `Favorite`, `SavedShift`, `SupportTicket`, `AssistantQueryLog`.
- **Retención de point-in-time recovery del proveedor de base de datos:** 6 horas — corta, no reemplaza un backup independiente ensayado.

## 5. STACK TECNOLÓGICO COMPLETO

| Capa | Tecnología |
|---|---|
| Backend | FastAPI 0.141 · SQLAlchemy 2.0 async (asyncpg) · Alembic · Pydantic 2.10 · Python 3.11, un solo worker Uvicorn |
| Frontend | Next.js 16.3 (App Router) · React 19.2 · TypeScript · TailwindCSS · `framer-motion` · MapLibre GL + `supercluster` · Lucide |
| Base de datos | PostgreSQL gestionado, serverless (producción) · SQLite en memoria (tests) |
| Autenticación | JWT (access 15 min, `localStorage`) + refresh token (30 días, cookie `httpOnly`, rotación + detección de reuso) |
| Tiempo real | WebSocket (chat y notificaciones), en memoria de proceso |
| Trabajo en background | Loop `asyncio` dentro del proceso FastAPI (sin cola ni worker separado) |
| Imágenes/archivos | Servicio de almacenamiento de imágenes y archivos (foto de perfil/logo, subida firmada de CV) |
| Email transaccional | Servicio de email transaccional (plantillas HTML de marca) |
| Login social | Inicio de sesión con cuenta de Google (token de identidad, sin secreto de cliente) |
| Notificaciones push | Web Push / VAPID |
| Observabilidad | Monitoreo de errores (backend + frontend), logging estructurado |
| IA | Modelo de lenguaje de IA de terceros (asistente de publicación de turnos por texto libre) |
| Pagos | Pasarela de pagos (suscripción del comercio — construido, no activado) |
| Geocoding | Geocodificador de datos abiertos (gratuito, sin clave de API) |
| CI | Integración continua: pytest, tsc + build, Playwright, escaneo automático de secretos, pip-audit + npm audit |
| Deploy | Backend: contenedor Docker en la nube (auto-deploy desde `main`) · Frontend: hosting web (auto-deploy desde `main`, previews por PR) |

Todas las integraciones externas están detrás de un feature-flag por ausencia de credencial: sin la variable de entorno correspondiente, la integración se desactiva sola (no-op o `503` explícito) sin romper el resto del sistema.

## 6. TAMAÑO DEL PAQUETE DE CÓDIGO FUENTE

| Componente | Tamaño aproximado |
|---|---|
| Backend (sin `.venv`, `__pycache__`, `.pytest_cache`, `.ruff_cache`) | ~19.100 líneas / código fuente Python |
| Frontend (sin `node_modules`, `.next`) | ~25.700 líneas / código fuente TypeScript |
| Documentación (`docs/`) | ~40 documentos vivos + 15 ADRs |
| Migraciones | 30 archivos Python |
| Tests | 512 (backend) + 111 (E2E) + tests unitarios de frontend |

---

*Documento elaborado para expediente de registro de obra de software — Julieta Arrazate — Septiembre 2026*
