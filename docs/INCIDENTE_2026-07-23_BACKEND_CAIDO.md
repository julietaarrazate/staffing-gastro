# Incidente 2026-07-23 — "La app no carga / no puedo entrar" ✅ RESUELTO

> **Resolución (2026-07-23):** Julieta cargó la connection string de Neon
> (directa, sin `-pooler` — el repo no configura `statement_cache_size=0`,
> requisito del pooling en modo transacción de Neon con asyncpg) en
> `DATABASE_URL` del dashboard de Render y redeployó. Verificado en vivo
> contra la base: `alembic_version` pasó de `0011` a **`0015`** y el backend
> quedó conectado y sirviendo. Se deja el documento como registro del
> diagnóstico y del runbook.

Diagnóstico basado en evidencia obtenida en vivo (Vercel, Neon, repo) el
2026-07-23. **El frontend está sano; el backend de Render está caído porque
nunca llegó a conectarse a Neon.** La reparación es operativa (dashboard de
Render), no de código.

## Síntoma

La app en `https://staffing-gastro.vercel.app` muestra la landing pero no se
puede iniciar sesión ni usar nada que hable con la API ("no carga, no puedo
entrar").

## Evidencia (qué se verificó y dónde)

| # | Evidencia | Fuente |
|---|-----------|--------|
| 1 | La landing de producción responde y es la página real de Staffya (HTML completo con el hero "Personal gastronómico, ya."). | Fetch en vivo de `staffing-gastro.vercel.app` vía Vercel |
| 2 | Los últimos 20 deploys de Vercel están `READY`, incluido el de `main` con el hotfix #97 (2026-07-23 ~00:42 UTC). El frontend deploya bien. | API de Vercel, proyecto `staffing-gastro` |
| 3 | El cómputo de Neon del proyecto `staffya` (`summer-mountain-00840427`, endpoint `ep-withered-scene-acjs328c`) está **suspendido desde 2026-07-18 19:13 UTC** y sin actividad desde 2026-07-18 19:08 UTC. Cualquier intento de conexión lo despertaría: **nadie intentó conectarse en 5 días.** | API de Neon (`suspended_at`, `last_active`) |
| 4 | La base Neon tiene el esquema en la migración **`0011`**, pero el código en `main` va por **`0015`** (faltan `0012` password reset, `0013` push subscriptions, `0014` no-show/cancelación tardía, `0015` idempotency keys). | SQL en vivo (`alembic_version`) vs `backend/alembic/versions/` |
| 5 | Los datos en Neon son un snapshot viejo: 26 usuarios, 16 turnos, último usuario creado 2026-07-02. Sin re-siembra demo desde entonces, pese a `SEED_DEMO_DATA=true` en cada arranque en frío. | SQL en vivo (`users`, `shifts`) |
| 6 | El contenedor del backend arranca con `alembic upgrade head && python -m scripts.startup_seed && uvicorn ...`: si `DATABASE_URL` apunta a una base muerta o mal escrita, **el contenedor muere antes de levantar el servidor** y toda la API queda abajo. | `backend/Dockerfile` (CMD) |
| 7 | PostGIS ya está activo en la base Neon (`spatial_ref_sys` presente) y `Settings._force_asyncpg_driver` convierte solo la connection string estándar de Neon. No hay bloqueo de código para el switch. | SQL en vivo + `backend/app/core/config.py` |
| 8 | Sentry no registra errores (el DSN nunca se cargó en producción — pendiente conocido), por eso el incidente fue invisible hasta que se notó a mano. | API de Sentry (org `cuadra-yq`, sin issues) |

Sin acceso al dashboard de Render desde una sesión de agente (limitación ya
documentada en `CLAUDE.md`, pendiente operadora #4), no se puede ver el log
exacto del deploy; pero las evidencias 3–6 sólo son compatibles con un backend
que no logra completar su arranque contra la base configurada.

## Reconstrucción (inferencia marcada como tal)

- Hasta el 22/7, producción seguía apuntando al Postgres free de Render (que
  expira a los 90 días, motivo de la migración a Neon — `backend/README.md`).
- La base Neon se pobló y migró hasta `0011` alrededor del 2–18/7 y quedó
  lista, esperando el switch.
- El 22/7 se mergeó #93 (`DATABASE_URL` pasa a `sync: false`, a cargar a mano
  en el dashboard de Render). **La evidencia 3 muestra que ese paso manual no
  quedó efectivo**: ninguna conexión llegó a Neon desde entonces.
- La lentitud reportada el 22/7 y la caída total del 23/7 son consistentes con
  la base vieja de Render agonizando/expirando mientras el backend seguía (o
  intentaba seguir) atado a ella.

## Reparación — pasos de Julieta (en orden, ~10 minutos)

1. **Neon** → proyecto `staffya` → botón **Connect**: copiar la connection
   string (la que termina en `?sslmode=require`). No hace falta editarla: el
   backend la convierte solo a `asyncpg`.
2. **Render** → servicio `staffya-backend` → **Environment** → pegar ese valor
   en `DATABASE_URL` → **Save** (dispara redeploy solo; si no, **Manual
   Deploy → Deploy latest commit**).
3. Mirar el log del deploy: deben verse las migraciones `0012 → 0015`
   aplicándose y después `Uvicorn running`. El seed demo corre solo
   (`SEED_DEMO_DATA` sigue en `true` — recordar apagarlo antes de comercios
   reales, pendiente operadora #2).
4. Verificar: `https://staffya-backend.onrender.com/health` debe responder OK,
   y el login en `staffing-gastro.vercel.app` debe funcionar.
5. Si el deploy falla igual, copiar las últimas ~30 líneas del log de Render a
   una sesión de Claude: con ese log el resto se diagnostica al toque.

Mientras `DATABASE_URL` no se corrija, **ningún deploy de código va a arreglar
nada**: el frontend ya está bien y el backend muere antes de arrancar.

## Y la "auditoría completa" que sugirió ChatGPT

El prompt de auditoría en 6 fases era genérico (pide revisar Redis, Dockerfiles
múltiples, CSRF, etc. que este proyecto no tiene o ya tiene documentado) y no
habría encontrado esto más rápido: el problema no estaba en el código sino en
una variable de entorno de un dashboard. El repo ya tiene auditorías reales y
vivas: `PRODUCTION_READINESS.md` (puntajes), `PERFORMANCE_REPORT.md`
(mediciones antes/después), `TECH_DEBT.md` (deuda priorizada), `BUGS.md`
(patrones ya resueltos) y los ADRs. Cuando el backend vuelva, lo que más paga
no es re-auditar: es **encender Sentry** (`SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`,
código ya listo) para que la próxima caída avise sola en vez de descubrirse
intentando entrar.
