# Staffya — Contexto del proyecto

Documento corto para que cualquier sesión (nueva o en curso) tenga el contexto
del proyecto de un vistazo. Para el *cómo* (arquitectura y arranque) ver los
README de `backend/` y `frontend/`.

## Qué es
Plataforma estilo **Uber + Tinder** que conecta comercios gastronómicos y
organizadores de eventos con trabajadores eventuales **en tiempo real**.
**Misión: cubrir una posición eventual en menos de 10 minutos.**

- Roles: **trabajador** (`worker`), **comercio** (`employer`), **admin**.
- Idioma del producto y de la comunicación: **español** (Argentina/LATAM).

## Stack y deploy
- **Backend:** FastAPI · SQLAlchemy async · Alembic · monolito modular (DDD / hexagonal).
  Deploy en **Render** (auto-deploy desde `main`). URL: `https://staffya-backend.onrender.com`.
- **Frontend:** Next.js · TypeScript · TailwindCSS · PWA instalable.
  Deploy en **Vercel** (auto-deploy desde `main`). URL: `https://staffing-gastro.vercel.app`.
- **DB:** PostgreSQL (+ PostGIS/Redis previstos). Tests con SQLite en memoria.

## Ciclo de vida del Turno ("Modo Uber")
```
BORRADOR → PUBLICADO → BUSCANDO_PERSONAL → ASIGNADO → CONFIRMADO →
EN_CAMINO → CHECK_IN → TRABAJANDO → CHECK_OUT → FINALIZADO → PAGADO
(CANCELADO alcanzable desde cualquier estado no terminal)
```
check-in y check-out capturan geolocalización. `reject` vuelve a `BUSCANDO_PERSONAL`.

## Estado de los módulos
| Módulo | Estado | Nota |
|--------|--------|------|
| `identity` | ✅ | Login/registro, JWT + refresh, roles. No se permite auto-registro como admin. |
| `worker` / `company` | ✅ | Perfiles + métricas (rating, puntualidad, etc.). |
| `shift` | ✅ | Publicación, feed y ciclo de vida completo (incluye asistencia geolocalizada). |
| `matching` | ✅ | Ranking de candidatos (distancia, experiencia, reputación, puntualidad, desempeño). Devuelve nombre, foto y rating. |
| `notification` | ✅ | In-app: asignación, confirmación, rechazo, check-out, pago, mensaje de chat. Polling, sin push. |
| `chat` | ✅ | Mensajería trabajador↔comercio por turno. Inbox tipo Rappi + vista de conversación con burbujas. |
| `admin` | ✅ | Panel sólo-admin: métricas y moderación de usuarios (suspender, reactivar, verificar, promover). Primer admin vía `ADMIN_EMAILS`. |
| `review` | ✅ | Reseñas bidireccionales trabajador↔comercio al finalizar un turno (rating + comentario). Actualiza el rating promedio del perfil calificado y notifica (`REVIEW_RECEIVED`). UI completa: picker de estrellas en turnos finalizados/pagados y listado de reseñas recibidas en el perfil propio. |
| `payment` | ⬜ | Pendiente. Hoy `mark-paid` sólo registra que el comercio pagó, no procesa cobro. |
| `ai` | ⬜ | Pendiente (recomendaciones, pricing, antifraude). |

## Qué falta (próximo valor)
1. **Pagos reales** — probable **MercadoPago** (Argentina). Requiere decisión de proveedor.
2. **Pulir lo visual** del resto de pantallas (Turnos/Candidatos) al mismo lenguaje (tema claro, tarjetas, bottom nav).
3. **Migrar la DB a Neon** (el Postgres free de Render expira a los 90 días). Pasos en `backend/README.md`.
- Futuro (Fase 3): afinidad local en matching, push, app nativa (React Native), IA.

## Novedades recientes (2026-06-23)
- **UI de reviews**: `ReviewBox` (estrellas + comentario) en `/my-shifts` y `/shifts` para turnos `finalizado`/`pagado`, una sola reseña por usuario por turno. `ReceivedReviews` lista las reseñas recibidas en `/profile`. Componente `StarRating` reutilizable (picker interactivo y display de sólo lectura).
- **Perfiles públicos estilo OkCupid**: páginas `/workers/[id]` y `/companies/[id]` (foto/logo grande, nombre, edad o rubro, ubicación, rating, bio/descripción, skills, métricas). Enlazadas desde el feed de turnos, los candidatos, el mapa de búsqueda (`/search`) y los turnos asignados/publicados.

## Novedades anteriores (2026-06-22)
- **Reviews/reputación** (`backend/app/modules/review/`): módulo nuevo completo (domain/application/infrastructure/api) + migración `0008_create_reviews_table`.
- **`full_name`/`owner_full_name`** expuestos en `WorkerProfileResponse`/`CompanyProfileResponse`, resueltos en la capa `api/` vía `UserRepository` inyectado (no acopla el dominio a identity).
- **Búsqueda de trabajadores por mapa**: nuevo endpoint `GET /api/v1/matching/search` (rol employer) — filtra por rol (suma el skill `barista`) y radio de distancia (Haversine), sin usar el scoring ponderado de `matching` (es un filtro+orden simple). Frontend: página `/search` con mapa Leaflet/OSM (sin API key, sin `localhost`), geolocalización del navegador con fallback al Obelisco.
- **Datos de demo**: `backend/scripts/seed_demo_data.py`, idempotente, siembra 6 comercios y 8 trabajadores repartidos por barrios de CABA (Palermo, Recoleta, San Telmo, Belgrano, Caballito, Microcentro). Contraseña demo: `staffyaDemo123`.
- Todo mergeado vía PR #27 (draft) a `claude/staffya-platform-spec-40hf7l`. Gates verdes: `pytest -q` (73 passed), `tsc --noEmit`, `npm run build`.

## Deuda técnica
- `payment` es placeholder (no procesa cobros).
- Notificaciones y chat son in-app con polling (sin push ni websockets en tiempo real).
- DB en Render expira a los 90 días (free tier) — migrar a Neon.
- Algunos warnings de lint pre-existentes en el frontend (`setState` síncrono en `useEffect`).

## Convenciones de trabajo (importante para mantener consistencia)
- **Todo en español**, incluido el código de cara al usuario y los mensajes.
- **Sin `localhost`** en configuración: el frontend apunta al backend remoto por
  variables de entorno; CORS sólo con el dominio de producción.
- **Credenciales nunca en el chat**: se configuran como variables de entorno en
  Render/Vercel. Si se pegan por error, revocarlas de inmediato.
- **Git:** desarrollar en la rama de feature; commits descriptivos; abrir PR en
  **draft**, mergear con **squash**. No `git add -A` (stagear archivos puntuales).
- **Arquitectura por módulo:** `domain/` (entidades, value objects, puertos,
  excepciones) · `application/` (servicios/casos de uso) · `infrastructure/`
  (ORM + repos) · `api/` (rutas, schemas Pydantic, dependencias).
- **No-disclosure:** "existe pero no es tuyo" se trata como 404, nunca 403.
- Antes de commitear: backend `pytest -q`, frontend `npx tsc --noEmit` + `npm run build`.
