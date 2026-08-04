# 01 — Inventario del repositorio

> Fase 1 de la auditoría OÍDO. Metodología: lectura directa del repo
> (`find`/`grep`/`wc` sobre el árbol real, sin asumir nada de memoria),
> cruzada contra `CLAUDE.md` y `docs/`. Cada afirmación cuantitativa viene de
> un comando ejecutado sobre el working tree en la fecha de esta auditoría
> (**2026-08-04**, commit base `812c114`). No se modifica código en esta fase.
>
> Este documento **no duplica** `docs/AUDIT_REPORT.md` (arquitectura),
> `docs/SECURITY_REPORT.md` (seguridad) ni `docs/PERFORMANCE_REPORT.md`
> (performance) — esos ya existen y se referencian, actualizan o contradicen
> explícitamente en las fases siguientes (`02_ARCHITECTURE.md` en adelante).
> Esta fase es sólo el mapa: qué hay, dónde, y cuánto.

## 0. Identidad del proyecto — hallazgo previo

El producto se llama **"Oído"** de cara al usuario (`app_name: str = "Oído"`
en `backend/app/core/config.py:26`, marca completa desde PR #118
`e29a9f5` "Rebrand a Oído"). El **repositorio y el código siguen en
`staffya`**: nombre del repo (`staffing-gastro`), `README.md`, título del
`pyproject.toml` ("Backend de Staffya…"), nombre del servicio en Render
(`staffya-backend`, **intencional**, ver `render.yaml` — no tocar, rompe el
dominio), clases/tablas/variables internas. Esto es correcto y documentado
(`CLAUDE.md` es explícito: "el host de Render... es el nombre real del
servicio en producción — renombrarlo rompe la app"). Se retoma en detalle en
`10_REPOSITORY.md` (qué renombrar es seguro) y `12_DNDA.md` (con qué nombre
registrar).

## 1. Vista de alto nivel

| Área | Tecnología | Deploy |
|---|---|---|
| Backend | FastAPI (Python 3.11) · SQLAlchemy 2.0 async · Alembic | Render (`staffya-backend`, Docker, región `ohio`) |
| Frontend | Next.js 16.2.12 (App Router) · React 19.2.4 · TypeScript · Tailwind 4 | Vercel |
| Base de datos | PostgreSQL — **Neon** en producción (serverless, región `aws-us-east-2`) | Neon (no el Postgres gestionado de Render, ver `CLAUDE.md`) |
| Local dev DB | `postgis/postgis:16-3.4` vía `docker-compose.yml` | — |
| Auth | JWT (access 15 min + refresh 30 días revocable) · Google Identity Services opcional | — |
| Push | Web Push / VAPID (opcional, flag por ausencia) | — |
| Pagos | Mercado Pago (suscripción mensual al comercio, Fase 1 — ADR-0005) | — |
| Imágenes | Cloudinary (frontend, `NEXT_PUBLIC_CLOUDINARY_*`) | — |
| Observabilidad | Sentry (`@sentry/nextjs` + `sentry-sdk[fastapi]`, opcional) | — |
| Email transaccional | Resend (opcional, flag por ausencia) | — |
| CI | GitHub Actions (`pytest`, `tsc`, `next build`, Playwright) | — |

## 2. Backend (`backend/`)

- **193 archivos `.py`** en `backend/app/` (excluyendo `__pycache__`),
  **11.242 líneas**.
- **Monolito modular DDD/hexagonal**, 10 módulos bajo `backend/app/modules/`,
  cada uno con las 4 capas estándar (`domain/`, `application/`,
  `infrastructure/`, `api/`) salvo `admin` (sólo `api/`+`application/`, es
  un módulo de agregación de lectura, no dueño de entidades propias):

  `admin`, `application` (postulaciones — nombre de módulo coincide con la
  carpeta raíz `app/`, ver ambigüedad en `10_REPOSITORY.md`), `chat`,
  `company`, `identity`, `matching`, `notification`, `review`, `shift`,
  `subscription`, `worker`.
- **21 migraciones Alembic** (`backend/alembic/versions/`), lineales
  (`0001`…`0016` + 5 adicionales post-rebrand, ver `05_DATABASE.md` para el
  detalle de si hay *branching*).
- **Tests**: 27 archivos en `backend/tests/`, **245 funciones `test_*`**
  encontradas por `grep` (el número de referencia en `CLAUDE.md`, "~218
  tests", está desactualizado — recontar con `pytest --collect-only` antes de
  citarlo; puede incluir parametrización que infla el conteo de `grep` frente
  al de `pytest`, ver `08_BACKEND.md`).
- **Scripts standalone** (`backend/scripts/`): `seed_demo_data.py` (siembra
  demo idempotente), `startup_seed.py` (se corre en cada arranque del
  contenedor, ver `CMD` del `Dockerfile`).
- Config: `pyproject.toml` (metadata + `pytest.ini_options` + **config de
  `ruff` sin usar**, ver hallazgo §7), `alembic.ini`.

### Módulos y su tamaño relativo (archivos `.py` por módulo)

| Módulo | Archivos |
|---|---|
| `notification` | 23 |
| `subscription` | 19 |
| `identity` | 18 |
| `worker` | 17 |
| `shift` | 17 |
| `company` | 16 |
| `chat` | 15 |
| `application` (postulaciones) | 15 |
| `review` | 14 |
| `matching` | 14 |
| `admin` | 10 |

`notification` es el módulo más grande — no por ser el más central al
dominio (eso es `shift`), sino porque agrega push/in-app/WebSocket/enlaces
profundos por tipo de evento. Contraintuitivo a primera vista; se retoma en
`02_ARCHITECTURE.md` si el tamaño refleja responsabilidad excesiva (SRP) o
es simplemente el costo de soportar múltiples canales de entrega.

**Verificado con `pytest --collect-only -q` real (no `grep`): 255 tests**
recolectados en `backend/tests/` — corrige tanto el "~218" de `CLAUDE.md`
como el conteo por `grep` (245) del párrafo anterior; el `grep` sobreestima
porque cuenta funciones auxiliares con prefijo `test_` que no son tests de
`pytest` y subestima la parametrización real. **Verificado con
`npx playwright test --list` real: 25 tests en 14 specs** — corrige el "~19
tests en 10 specs" de `CLAUDE.md` (quedó desactualizado, se agregaron specs
sin actualizar la cifra). Ambas correcciones se trasladan a `CLAUDE.md` como
parte del cierre de esta auditoría (ver `ROADMAP.md`).

## 3. Frontend (`frontend/`)

- **24 rutas** (`page.tsx`) bajo `frontend/app/` — App Router de Next.js,
  server + client components mixtos (detalle en `07_FRONTEND.md`):
  `/`, `/admin`, `/bienvenida`, `/chats`, `/chats/[shiftId]`, `/companies/[id]`,
  `/feed`, `/login`, `/map`, `/my-shifts`, `/privacidad`, `/profile`,
  `/recuperar`, `/register`, `/restablecer`, `/search`,
  `/shifts`, `/shifts/[id]/candidates`, `/shifts/new`, `/shifts/new-event`,
  `/subscription`, `/terminos`, `/turno/[id]`, `/workers/[id]`.
- **68 componentes** (`.tsx`) en `frontend/components/` (incluye
  `components/ui/` como Design System propio, más subcarpetas `candidate/`,
  `landing/`, `map/`, `subscription/`, `worker/`).
- **24 archivos** en `frontend/lib/` (`api.ts`, `types.ts`, helpers,
  `lib/map/`).
- **E2E**: 14 specs Playwright en `frontend/e2e/` (`CLAUDE.md` cita "~19
  tests en 10 specs" — desactualizado en specs, ver `08_BACKEND.md`/
  `TESTING_REPORT.md` equivalente para frontend; recontar con
  `npx playwright test --list`).
- PWA: `frontend/public/sw.js` (service worker propio, no
  `next-pwa`/Workbox), manifest e íconos (`icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png`, `apple-icon.png`, `favicon.ico`) + logos SVG
  (`logo.svg`, `logo-mark.svg`, `logo-figure*.svg`, `oido-isotipo.svg` — el
  propio `CLAUDE.md` marca el isotipo vectorial como **pendiente del
  diseñador**, hoy placeholder).
- `frontend/playwright-report/` y `frontend/test-results/` están en el
  working tree (no en `.gitignore` — ver hallazgo §7 y `09_CLEANUP.md`):
  son *output* de correr Playwright localmente, no fuente.

## 4. CI/CD

Un solo workflow, `.github/workflows/ci.yml`, 3 jobs paralelos en cada PR y
push a `main`:

| Job | Qué corre | Gate real |
|---|---|---|
| `backend` | `pip install -r requirements.txt` + `pytest -q` | Sí |
| `frontend` | `npm ci` + `npx tsc --noEmit` + `npm run build` | Sí |
| `e2e` | `npm ci` + Playwright Chromium + `npm run build` + `npm run test:e2e` | Sí |

No hay job de `lint` (ni `ruff` para backend, ni `eslint` para frontend) —
confirmado como deuda conocida en `CLAUDE.md`/`TECH_DEBT.md` T5 para
frontend; para backend **no está documentado en ningún lado** que `ruff` no
corre pese a tener config dedicada (ver hallazgo §7). No hay job de
`pip-audit`/`npm audit` (auditoría de dependencias es manual, ver
`docs/TECH_DEBT.md` S3). Deploy es automático desde `main` vía Render/Vercel
(fuera de este workflow, integraciones nativas de esas plataformas).

## 5. Infraestructura y despliegue

- **Render** (`render.yaml`): un solo servicio web, Docker, plan free,
  región `ohio` (fijada a propósito, ver comentario in-line — colocación
  junto a Neon `us-east-2`). `healthCheckPath: /health`. Variables
  gestionadas: `DATABASE_URL` (manual, Neon), `JWT_SECRET_KEY` (autogenerada),
  `ENVIRONMENT`, `DEBUG`, `CORS_ORIGINS`, `SEED_DEMO_DATA` (**hoy `"true"` en
  producción** — pendiente de Julieta apagarlo, ver `CLAUDE.md`), `SENTRY_DSN`
  (manual).
- **Vercel**: no versionado en el repo (sin `vercel.json`) — configuración
  vía dashboard, fuera del alcance de esta auditoría de código.
- **Docker local** (`docker-compose.yml`): 3 servicios — `db`
  (`postgis/postgis:16-3.4`), `redis:7-alpine`, `backend` (build local). Ver
  hallazgo crítico §7: **ni PostGIS ni Redis se usan en el código real**.
- **`backend/Dockerfile`**: imagen `python:3.11-slim`, un solo stage (sin
  build multi-stage), `CMD` encadena `alembic upgrade head` + siembra +
  `uvicorn` en un solo proceso (sin `--workers`, un solo worker Uvicorn —
  retomado en `04_PERFORMANCE.md`/`06_INFRASTRUCTURE.md`).
- No hay `Dockerfile` para el frontend (Vercel no lo necesita, build nativo
  de Next.js).

## 6. Variables de entorno (superficie completa)

Extraídas de `backend/app/core/config.py` (única fuente de verdad declarada
en el propio archivo) + equivalentes `NEXT_PUBLIC_*` del frontend:

**Backend** (`Settings`, todas con default seguro salvo `jwt_secret_key` en
producción): `DATABASE_URL`, `JWT_SECRET_KEY`, `JWT_ALGORITHM`,
`ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`,
`RATE_LIMIT_ENABLED`, `SENTRY_DSN`, `LOG_JSON`, `CORS_ORIGINS`,
`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_BASE_URL`, `SUBSCRIPTIONS_ENFORCED`,
`RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT_EMAIL`,
`ADMIN_EMAILS`, `ENVIRONMENT`, `DEBUG`.

**Frontend** (`NEXT_PUBLIC_*`, se hornean en build time — riesgo operativo
documentado en `CLAUDE.md`): `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_SENTRY_DSN`,
`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
(estas dos últimas **sin configurar en Vercel hoy**, bloquean la foto de
perfil — ítem 7 de "Pendiente de la operadora" en `CLAUDE.md`).

Todas siguen el mismo patrón "flag por ausencia" (feature no-op sin su env
var) — sin excepciones encontradas. Detalle línea por línea en
`06_INFRASTRUCTURE.md`.

## 7. Hallazgos de esta fase (a resolver en fases posteriores)

1. **`docker-compose.yml` declara infraestructura que el código no usa.**
   `redis:7-alpine` — cero referencias a `redis` en `backend/app` (`grep`
   vacío); rate limiting es en memoria (`app/core/rate_limit.py`, confirmado
   en `06_INFRASTRUCTURE.md`/`03_SECURITY.md`). `postgis/postgis:16-3.4` —
   cero referencias a PostGIS/`Geography`/`geoalchemy` en el código;
   distancia se calcula en Python sobre columnas `Float` planas
   (`latitude`/`longitude`), confirmado explícitamente en un comentario del
   propio código (`matching/application/services.py:69`: "Python (no hay
   PostGIS todavía)"). Impacto: confunde a cualquiera que lea
   `docker-compose.yml` o el `README.md` (que lista "PostgreSQL · PostGIS ·
   Redis" en el stack) creyendo que son dependencias reales. Ver
   `09_CLEANUP.md`.
2. **`README.md` está desactualizado** respecto a `CLAUDE.md`: sigue
   llamando al producto "Staffya" sin mencionar el rebrand a "Oído", no
   menciona PWA/push/Sentry/Cloudinary/Mercado Pago/Google Sign-In, y lista
   Redis/PostGIS como stack real (hallazgo anterior). `CLAUDE.md` es la
   fuente de verdad operativa hoy; `README.md` es la primera puerta de
   entrada de cualquier lector externo (inversor, auditor DNDA) y no
   refleja el producto actual. Ver `11_DOCUMENTATION.md`.
3. **`pyproject.toml` declara config de `ruff`** (`[tool.ruff]`,
   `[tool.ruff.lint]`) **que no se usa**: `ruff` no está en
   `requirements.txt`, no corre en CI, y no hay mención en `CLAUDE.md` de
   que sea deuda conocida (a diferencia de `npm run lint`, que sí está
   documentado como no-gate en CI). Es config muerta o aspiracional sin
   seguimiento. Ver `08_BACKEND.md`/`09_CLEANUP.md`.
4. **`frontend/playwright-report/` y `frontend/test-results/` están en el
   working tree**, son artefactos de ejecución local de Playwright (no
   fuente). Confirmar si están trackeados por git o sólo presentes sin
   trackear en este entorno — ver `09_CLEANUP.md` para el veredicto y
   `.gitignore` actual (no los lista explícitamente, sólo genéricos como
   `node_modules/`, `.next/`, `dist/`, `build/`).
5. ~~Licencia Apache 2.0 en un producto propietario en camino a registro
   DNDA~~ — **resuelto** (2026-08-04): `LICENSE` reemplazado por una licencia
   propietaria de código cerrado ("All Rights Reserved"), con Julieta
   Arrazate como única titular. Ver `12_DNDA.md §1-2` para el detalle.
6. **Los conteos citados en `CLAUDE.md`** ("~218 tests" backend, "~19 tests
   en 10 specs" E2E) **no coinciden con el conteo bruto de esta fase** (245
   funciones `test_*` backend vía `grep`, 14 specs E2E). Puede ser
   parametrización de `pytest` inflando el conteo real más bajo, o
   simplemente que `CLAUDE.md` no se actualizó en el último tramo de
   trabajo — a verificar con `pytest --collect-only -q` real en
   `08_BACKEND.md` antes de corregir la cifra en `CLAUDE.md`.

## 8. Qué NO se cubre en esta fase

Contenido específico de seguridad, performance, base de datos, limpieza y
documentación se trata en su fase dedicada — esta fase es deliberadamente
un mapa, no un diagnóstico. Los números de líneas/archivos de arriba son
reproducibles con los comandos citados; no se citó ningún número sin haber
corrido el comando correspondiente sobre el repo real.
