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
| `payment` | ⬜ | Pendiente. Hoy `mark-paid` sólo registra que el comercio pagó, no procesa cobro. |
| `ai` | ⬜ | Pendiente (recomendaciones, pricing, antifraude). |

## Qué falta (próximo valor)
1. **Pagos reales** — probable **MercadoPago** (Argentina). Requiere decisión de proveedor.
2. **Pulir lo visual** del resto de pantallas (Turnos/Candidatos) al mismo lenguaje (tema claro, tarjetas, bottom nav).
3. **Migrar la DB a Neon** (el Postgres free de Render expira a los 90 días). Pasos en `backend/README.md`.
- Futuro (Fase 3): afinidad local en matching, reseñas bidireccionales, push, app nativa (React Native), IA.

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
