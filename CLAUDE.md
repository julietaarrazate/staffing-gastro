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
| `notification` | ✅ | In-app: asignación, confirmación, rechazo, check-out, pago. Polling, sin push. |
| `payment` | ⬜ | Pendiente. Hoy `mark-paid` sólo registra que el comercio pagó, no procesa cobro. |
| `chat` | ⬜ | Pendiente. |
| `ai` | ⬜ | Pendiente (recomendaciones, pricing, antifraude). |

## Qué falta (próximo valor)
1. **Chat** trabajador↔comercio (no depende de nada externo).
2. **Pagos reales** — probable **MercadoPago** (Argentina). Requiere decisión de proveedor.
3. **Panel de administración** (el rol `admin` existe pero no tiene pantallas).
- Futuro (Fase 3): afinidad local en matching, reseñas bidireccionales, push, app nativa (React Native), IA.

## Deuda técnica
- `payment` es placeholder (no procesa cobros).
- Sólo notificaciones in-app con polling (sin push ni chat en tiempo real).
- Rol `admin` sin panel.
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
