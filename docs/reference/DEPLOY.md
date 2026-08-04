# DEPLOY.md — Despliegue y entornos (arquitectura técnica)

> Cómo llega Staffya a producción. Amplía
> [ARCHITECTURE.md](../foundation/ARCHITECTURE.md#deploy). Arranque local en
> `backend/README.md` y `frontend/README.md`.

## Topología

| Componente | Plataforma | Trigger |
|------------|-----------|---------|
| **Backend** (FastAPI) | **Render** (contenedor Docker, región `ohio`) | auto-deploy desde `main` |
| **Frontend** (Next.js) | **Vercel** | auto-deploy desde `main` + preview por PR |
| **DB** (PostgreSQL) | **Neon** (serverless, `aws-us-east-2`) | connection string manual en Render, **no** gestionada por `render.yaml` (ver comentario en el propio archivo) |

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
| `DATABASE_URL` | Manual (`sync: false` en `render.yaml`) | Connection string de **Neon**, cargada a mano en el dashboard — `render.yaml` nunca la sobrescribe; se normaliza a `+asyncpg` en `config.py` |
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

## Dominio propio: `staffya.com.ar` (futuro, no arrancado)

Cloudflare **no se usa hoy** (no hay nada que configurar en el código para
él); es para el día que se conecte el dominio propio en vez de
`staffing-gastro.vercel.app`. El código **ya asume ese dominio** en varios
lugares (`app/layout.tsx` `metadataBase`, `app/sitemap.ts`, `app/robots.ts`,
todos con `https://staffya.com.ar` hardcodeado) — no hace falta tocar nada
ahí, sólo conectar el dominio de verdad.

Rol de cada pieza: **Vercel** sirve el sitio y emite el certificado HTTPS;
**Cloudflare** sólo resuelve el DNS (decide a qué IP/host apunta el dominio).
No son alternativas entre sí — Cloudflare no aloja el frontend, Vercel sí.

Pasos, en orden:

1. **Vercel primero**: Project → Settings → Domains → agregar
   `staffya.com.ar` (y `www.staffya.com.ar` si se va a usar). Vercel muestra
   los registros DNS exactos a crear (típicamente un `A` a su IP para el
   apex y un `CNAME` a `cname.vercel-dns.com` para `www`).
2. **Cloudflare**: agregar el dominio (si el registrador no es Cloudflare,
   cambiar los nameservers del dominio a los que da Cloudflare) y cargar ahí
   los registros que pidió Vercel.
   - **Importante**: dejar esos registros en **"DNS only"** (nube gris, no
     naranja) al conectar. El proxy de Cloudflare (nube naranja) es lo que
     da CDN/WAF gratis, pero puede chocar con el certificado SSL que emite
     Vercel al validar el dominio la primera vez. Una vez que Vercel
     confirma el dominio como válido (tilde verde en su panel), se puede
     probar a activar el proxy; si algo se rompe, volver a "DNS only".
3. **Backend (Render) — `CORS_ORIGINS`**: hoy sólo tiene
   `https://staffing-gastro.vercel.app` (`render.yaml`). Es una lista
   separada por comas (`cors_origins_list` en `app/core/config.py`): agregar
   `https://staffya.com.ar` (y `https://www.staffya.com.ar` si aplica) **sin
   sacar** la URL de Vercel — conviene dejarla como fallback.
4. **Google OAuth**: si el login con Google ya está activo, sumar
   `https://staffya.com.ar` a los "Authorized JavaScript origins" del
   Client ID en Google Cloud Console (Credentials) — si no, el botón tira
   error de origen no autorizado desde el dominio nuevo.
5. **CSP del frontend**: **no hay que tocar nada**. La política en
   `next.config.ts` usa `'self'` para script/style/imagen propia (resuelve
   solo al origen que sirve la página) y sólo lista orígenes *externos*
   (backend, mapas, Google, Sentry) — ninguno depende del dominio del
   frontend.
6. **Verificación**: `https://staffya.com.ar/health`-equivalente no existe en
   el frontend, pero sirve entrar a `/login` y confirmar que el candado
   HTTPS es válido (lo emite Vercel, no Cloudflare) y que el login con
   Google (si está activo) sigue funcionando desde el dominio nuevo.

## Riesgos / pendientes

> - **Seed en producción:** sigue activo a propósito durante la demo; ver
>   runbook de lanzamiento arriba para apagarlo.
> - **Migraciones al arrancar:** una migración fallida bloquea el deploy
>   (deseable como fail-fast); el plan de rollback es el restore de Neon
>   (arriba).
