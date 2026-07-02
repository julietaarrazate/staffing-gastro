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

## DB en Neon: backups y restore (R0.1/R0.2)

La DB productiva vive en **Neon** (la free de Render expiraba a los 90 días;
`DATABASE_URL` en Render apunta a Neon — el connection string con
`sslmode`/`channel_binding` se normaliza solo en `config.py`, PR #56).

- **Backups:** Neon guarda historial continuo (point-in-time restore) según el
  plan; en el free tier el retention es limitado (~24 h–7 días). Para respaldo
  frío adicional: `pg_dump "$DATABASE_URL" > staffya-$(date +%F).sql` (usar el
  connection string **sin** `+asyncpg`, el de la consola de Neon) — conviene
  correrlo antes de cualquier migración riesgosa.
- **Restore point-in-time:** consola de Neon → Branches → *Restore* al
  timestamp deseado (crea una branch con el estado pasado; se puede promover o
  copiar datos). Restore desde dump: `psql "$CONNECTION_STRING" < backup.sql`.
- **Verificación post-cambio de DB:** el deploy corre `alembic upgrade head` al
  arrancar; si falla, Render conserva el deploy anterior. Chequear
  `GET /health` y los logs del servicio.

## Runbook de lanzamiento: apagar el modo demo (R1.6)

`SEED_DEMO_DATA=true` siembra ~26 cuentas demo **con contraseña pública
conocida** — correcto para la etapa de demostración, inaceptable con usuarios
reales. Antes de abrir la beta:

1. **Apagar el seed:** en Render → Environment → `SEED_DEMO_DATA=false` (o
   borrar la variable). Redeploy automático; el arranque salta el seed (es
   idempotente pero ya no debe correr).
2. **Purgar las cuentas demo:** todas usan emails `demo.*@staffya.com` /
   `*.demo@staffya.com` (ver `scripts/seed_demo_data.py`). Borrarlas en cascada
   (turnos, postulaciones, chats, reseñas y sesiones cuelgan de ellas) desde un
   `psql` contra Neon, **después de un `pg_dump` de respaldo**. Verificar con
   `SELECT count(*) FROM users WHERE email LIKE '%@staffya.com'` → 0.
3. **Rotar secretos si hace falta:** si las credenciales demo aparecieron en
   material público (pitchs, videos), no basta con borrar las cuentas — revisar
   que no exista otra cuenta con esa misma contraseña.
4. **Smoke test:** login con una cuenta real, publicar un turno, postularse,
   chat. `GET /health` OK y sin errores en Sentry.

## Riesgos / pendientes

> - **Seed en producción:** sigue activo a propósito durante la demo; ver
>   runbook de lanzamiento arriba para apagarlo.
> - **Migraciones al arrancar:** una migración fallida bloquea el deploy
>   (deseable como fail-fast); el plan de rollback es el restore de Neon
>   (arriba).
