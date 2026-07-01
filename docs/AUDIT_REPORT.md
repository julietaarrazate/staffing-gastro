# AUDIT_REPORT.md — Auditoría inicial de Staffya (Fase 0)

> Estado real del proyecto a la fecha de la auditoría. Insumo de
> [TECH_DEBT.md](./TECH_DEBT.md), [QUICK_WINS.md](./QUICK_WINS.md) y
> [RECOMMENDATIONS.md](./RECOMMENDATIONS.md). Contexto de dominio/arquitectura en
> [PRODUCT.md](./PRODUCT.md), [DOMAIN.md](./DOMAIN.md), [ARCHITECTURE.md](./ARCHITECTURE.md).

## Resumen ejecutivo

Staffya es un producto **maduro para su etapa**: el ciclo de vida del turno y el
loop de match (postulación → asignación → confirmación) funcionan de punta a
punta, con reputación, chat/notificaciones en tiempo real y una arquitectura DDD/
hexagonal limpia en el backend. La suite de tests del backend está verde.

Los principales focos de mejora son: **deuda de diseño en transición** (dos
lenguajes visuales conviviendo), **componentes/estados duplicados** en el
frontend, **endurecimiento de seguridad para producción** (rate limiting,
headers, secretos) y **piezas de negocio incompletas** (pagos, insignias/niveles).

Tamaño: ~157 archivos Python (backend), ~69 archivos TS/TSX (frontend). `0`
marcadores `TODO/FIXME` en el código.

## Arquitectura

- **Backend:** monolito modular FastAPI, DDD/hexagonal, 4 capas por módulo
  (`domain`/`application`/`infrastructure`/`api`). Reglas de dependencia
  respetadas; cruces entre módulos por puerto/repo inyectado. **Bien.**
- **Frontend:** Next.js App Router + Design System propio (`components/ui/`).
- Detalle en [ARCHITECTURE.md](./ARCHITECTURE.md). No hay bus de eventos formal
  (los "eventos" son efectos dentro del caso de uso que crean notificaciones).

## Backend

- **Módulos:** identity, worker, company, shift, application, matching,
  notification, chat, review, admin (✅) · payment, ai (⬜).
- **Fortalezas:** separación de capas consistente; puertos de repositorio;
  no-disclosure (404) aplicado; matching con scoring testeable por DTOs.
- **A mejorar:**
  - `payment` es placeholder (no procesa cobro).
  - Insignias (`WorkerBadge`) y niveles (`GamificationLevel`) existen como
    catálogo pero **sin lógica de otorgamiento**.
  - Helper de tests `_auth_headers` **duplicado en ~18 archivos** de test (debería
    ser fixture de `conftest.py`).

## Modelo de datos

- SQLAlchemy 2.0 async; migraciones Alembic (hasta `0009_create_shift_applications`).
- Entidades: users, worker_profiles, company_profiles, shifts, shift_applications,
  reviews, chat_messages, notifications. Claves foráneas con `ON DELETE CASCADE`.
- **Riesgo operativo:** el Postgres free de Render **expira a los 90 días**;
  migración a **Neon** pendiente (pasos en `backend/README.md`).
- PostGIS/Redis están "previstos" pero **no en uso**; la distancia se calcula por
  Haversine en Python.

## APIs

- REST versionado bajo `/api/v1`. Schemas Pydantic. Errores de dominio mapeados a
  HTTP con no-disclosure. **Consistente.**
- Falta documentación formal de endpoints como fuente de verdad → `API.md` (Fase 3
  del plan de docs).

## WebSockets

- Dos canales: chat (`/chats/{shift_id}/ws`) y notificaciones
  (`/notifications/ws`).
- **Autenticados:** usan `get_current_user_ws`; el chat además valida
  participante (`assert_participant`). **Bien.** Reconexión con backoff en el
  frontend.
- A endurecer: límites de conexión/mensajes por usuario (ver
  [TECH_DEBT.md](./TECH_DEBT.md)).

## Autenticación

- JWT access (15 min) + refresh (30 días); sesión persistente en el frontend.
- **Riesgos:** `jwt_secret_key` tiene default `"cambiar-esto-en-produccion"` (en
  prod se sobrescribe con `generateValue` de Render, pero el default es peligroso
  si no se setea). Warning `InsecureKeyLength` con la clave corta por defecto.
  No hay rate limiting en login (fuerza bruta).

## Frontend / Mobile / PWA

- PWA instalable, viewport bloqueado (sensación app), bottom nav, gestos (swipe
  deck con `motion`), mapas Leaflet + tiles CARTO, sesión persistente.
- Íconos **Lucide** (unificado vía barrel). Imágenes con `loading="lazy"`.
- **Deuda de diseño (en transición):**
  - Conviven dos lenguajes: el DS v2 monocromático nuevo y restos del anterior
    (gradientes por rubro `SKILL_STYLES` todavía usados en `search`, `shifts/new`,
    `workers/[id]`).
  - **Duplicación de estados/encabezados:** `components/PageState.tsx`
    (EmptyState/PageHeader/CardSkeletons/ErrorBanner) **conviven** con
    `components/ui/` (EmptyState/Skeleton). Dos sistemas para lo mismo.
  - **~23 botones inline** con estilos ad-hoc en vez del `Button` del DS.
- **Performance:** se usa `<img>` (7 usos) en vez de `next/image` (0 usos) — sin
  optimización de imágenes de Next. Bundle con `motion` + `leaflet` (mapas ya
  lazy por `next/dynamic`).

## Seguridad (panorama)

| Área | Estado |
|------|--------|
| JWT / refresh | ✅ implementado; ⚠️ secret por defecto, clave corta, sin rate limit en login |
| WebSocket | ✅ autenticado + validación de participante |
| No-disclosure | ✅ 404 para ajeno/inexistente |
| CORS | ✅ configurable; default `localhost` |
| Rate limiting | ❌ ausente |
| Security headers / CSP | ❌ ausentes |
| Gestión de secretos | ⚠️ por env vars (bien), pero default de JWT inseguro |
| Auditoría/logs | ❌ sin logging estructurado |

## Performance (panorama)

- Sin medición Lighthouse formal aún (meta del plan: >90).
- Oportunidades: `next/image`, revisar bundle/`motion`, `Suspense`/streaming,
  caché de datos, virtualización de listas largas.

## Conclusión

El proyecto está **sano en su núcleo** (dominio y arquitectura) y **en
transición en la presentación**. Antes de sumar funcionalidades conviene: cerrar
la migración del Design System (eliminar duplicados), endurecer seguridad para
producción y planificar la migración de DB. Ver
[RECOMMENDATIONS.md](./RECOMMENDATIONS.md).
