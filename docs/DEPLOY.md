# DEPLOY.md — Despliegue y entornos (arquitectura técnica)

> Cómo llega Staffya a producción. Amplía
> [ARCHITECTURE.md](./ARCHITECTURE.md#deploy). Arranque local en
> `backend/README.md` y `frontend/README.md`.

## Topología

| Componente | Plataforma | Trigger |
|------------|-----------|---------|
| **Backend** (FastAPI) | **Render** (contenedor Docker) | auto-deploy desde `main` |
| **Frontend** (Next.js) | **Vercel** | auto-deploy desde `main` + preview por PR |
| **DB** (PostgreSQL) | **Render** (plan free) | provisionada en `render.yaml` |

Config declarativa en `render.yaml` (raíz del repo).

## Backend en Render

- **Runtime Docker**, `backend/Dockerfile` (Python 3.11 slim). Contexto
  `./backend`; instala `requirements.txt` y copia la app.
- **Comando de arranque** (secuencia, `CMD` del Dockerfile):
  1. `alembic upgrade head` — aplica migraciones (ver [DATABASE.md](./DATABASE.md)).
  2. `python -m scripts.startup_seed` — **seed demo idempotente** si
     `SEED_DEMO_DATA=true` (comercios/trabajadores/turnos de prueba, para poder
     usar la app sin registrarse).
  3. `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- **Healthcheck:** `GET /health` (`healthCheckPath: /health`).

### Variables de entorno (Render)

| Var | Origen | Nota |
|-----|--------|------|
| `DATABASE_URL` | `fromDatabase` (staffya-db) | se normaliza a `+asyncpg` en `config.py` |
| `JWT_SECRET_KEY` | `generateValue: true` | generado por Render, **no** en el repo |
| `ENVIRONMENT` | `production` | |
| `DEBUG` | `"false"` | |
| `CORS_ORIGINS` | dominio Vercel de producción | sin `localhost` |
| `SEED_DEMO_DATA` | `"true"` | seed demo al arrancar |
| `ADMIN_EMAILS` | (opcional) | promueve admins al bootstrap |

> **Credenciales:** nunca en el repo ni en el chat; siempre env vars en
> Render/Vercel. Si se filtran, revocar. Ver [SECURITY.md](./SECURITY.md).

## Frontend en Vercel

- Auto-deploy desde `main`; **preview por PR** (comentario de Vercel con la URL).
- API remota vía `NEXT_PUBLIC_API_URL` (sin `localhost` en config de producto).

## Entornos

- **development:** `DEBUG=true`, DB local, CORS a `localhost:3000` (default de
  `config.py`). No es config de producto.
- **production:** Render + Vercel con las env vars de arriba.

## Riesgos / pendientes

> - **DB free de Render expira a los 90 días** → pérdida de datos. Migración a
>   **Neon** prevista (pasos en `backend/README.md`). Ver
>   [TECH_DEBT.md](./TECH_DEBT.md).
> - **Seed en producción:** `SEED_DEMO_DATA=true` está pensado para la etapa demo;
>   apagarlo antes de datos reales de usuarios.
> - **Migraciones al arrancar:** una migración fallida bloquea el deploy (deseable
>   como fail-fast, pero conviene plan de rollback).
> - **CI/CD:** validar si hay gates obligatorios por PR (ver
>   [TESTING.md](./TESTING.md)); si no, es una mejora de la Fase de Calidad.
