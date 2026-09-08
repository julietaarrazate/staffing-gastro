# EXCLUSIONES POR SEGURIDAD Y PRIVACIDAD
## Archivos y carpetas que NO deben incluirse en el expediente — Oído

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026

---

## 1. ARCHIVOS DE CONFIGURACIÓN CON CREDENCIALES

| Archivo | Razón | Riesgo |
|---|---|---|
| `.env` (backend, si existiera localmente) | Variables de entorno con credenciales reales | **CRÍTICO** — nunca versionado, no existe en el repositorio |
| `render.yaml` | Configuración de despliegue en Render | Información operativa interna (no contiene secretos en texto plano, pero se excluye por prudencia) |

**Verificación realizada:**
- ✓ El backend tiene `.env.example` (seguro, sin valores) versionado.
- ✓ El frontend tiene `.env.production` versionado, y contiene únicamente una variable pública (`NEXT_PUBLIC_API_URL`) — las variables `NEXT_PUBLIC_*` de Next.js se hornean en el build y son visibles en el navegador por diseño; no son secretas.
- ✓ Ningún archivo `.env` real (con secretos) está versionado — confirmado en `.gitignore` y con `git ls-files`.

## 2. DIRECTORIOS A EXCLUIR (NO SON CÓDIGO FUENTE)

| Directorio | Razón | Acción |
|---|---|---|
| `frontend/node_modules/` | Dependencias npm reinstalables | EXCLUIR |
| `backend/.venv/`, `backend/.venv-check/` | Entornos virtuales de Python reinstalables | EXCLUIR |
| `backend/app/__pycache__/`, `backend/tests/__pycache__/`, `backend/scripts/__pycache__/` | Caché compilado de Python | EXCLUIR |
| `backend/.pytest_cache/`, `backend/.ruff_cache/` | Caché de herramientas de test/lint | EXCLUIR |
| `frontend/.next/` | Build compilado de Next.js (se regenera) | EXCLUIR |
| `.git/` | Historial Git completo (voluminoso, no requerido por la DNDA) | EXCLUIR (se acompaña export del log) |
| `.github/` | Configuración de GitHub Actions | EXCLUIR |

## 3. ARCHIVOS DE DOCUMENTACIÓN INTERNA/OPERATIVA

**No forman parte del expediente de registro** (documentan proceso de desarrollo día a día, no la obra en sí):

| Archivo | Propósito | Acción |
|---|---|---|
| `docs/STATUS.md` | Bitácora viva de trabajo en curso | EXCLUIR |
| `docs/TECH_DEBT.md` | Deuda técnica conocida, priorizada | EXCLUIR |
| `docs/BUGS.md` | Catálogo de bugs ya resueltos | EXCLUIR |
| `docs/INCIDENTE_2026-07-23_BACKEND_CAIDO.md` | Postmortem de un incidente operativo | EXCLUIR |
| `CLEANUP_REPORT.md`, `DUE_DILIGENCE_REPORT.md`, `INFRASTRUCTURE_REPORT.md`, `MIGRATION_LOG.md`, `NEXT_IMAGE_ANALYSIS.md`, `PERFORMANCE_REPORT.md`, `PRODUCTION_HARDENING.md`, `REPOSITORY_CLEANUP.md`, `REPOSITORY_STRUCTURE.md`, `SECURITY_CHANGES.md` | Informes internos de auditoría/limpieza técnica | EXCLUIR |
| `CLAUDE.md` (raíz) | Guía operativa interna de cómo trabajar en el repositorio | EXCLUIR — es una guía de proceso, no documentación de la obra en sí |

**Incluir en cambio** (documentación técnica de la obra propiamente dicha): `docs/foundation/` y `docs/adr/`.

## 4. ARCHIVOS Y CARPETAS SENSIBLES (DATOS)

### 4.1 Base de datos

**NO incluir:** dumps de PostgreSQL, archivos `.sqlite3`/`.db`, cualquier exportación de datos de producción.

**Verificación:** no existen en el repositorio — la base de datos vive en Neon (servidor externo), nunca en archivos versionados. ✓

### 4.2 Datos de usuarios reales de la beta

**NO incluir** ningún export de datos de trabajadores o comercios reales de la fase de beta cerrada (nombres, teléfonos, ubicaciones, fotos de DNI, historial de turnos reales). El código fuente que se presenta es el programa, no la base de datos con datos personales de terceros.

### 4.3 Datos de prueba en tests y seed

**Verificación realizada:**
- ✓ Los datos de demostración (`backend/scripts/`) usan nombres de comercio genéricos por rubro + barrio (por ejemplo "Bar Palermo Soho", "Café Núñez"), sin corresponder a ningún comercio real.
- ✓ Los tests (`backend/tests/`) usan fixtures con datos ficticios (emails de ejemplo, nombres inventados).
- ✓ OK incluir `/backend/scripts/` y `/backend/tests/` — no exponen datos de terceros reales.

## 5. ARCHIVOS CON TOKENS O CLAVES SECRETAS

**Búsqueda realizada:** patrones de claves de API, tokens y contraseñas en texto plano en todo el código fuente versionado.

**Resultado:**
- ✓ No se encontraron tokens, claves de API ni contraseñas hardcodeadas en el código.
- ✓ Todos los secretos se leen de variables de entorno (`ADMIN_EMAILS`, `JWT_SECRET_KEY`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `SENTRY_DSN`, `VAPID_*`, `CLOUDINARY_*`, `GEMINI_API_KEY`, `MERCADOPAGO_ACCESS_TOKEN`), configuradas únicamente en los paneles de Render/Vercel — nunca en el repositorio.
- ✓ El repositorio tiene además escaneo de secretos automático en CI (gitleaks + GitGuardian) en cada PR y push a `main`.

## 6. ARCHIVOS DE TERCEROS O DEPENDENCIAS

**NO incluir:** `node_modules/`, librerías de terceros empaquetadas, fuentes o iconos de terceros distribuidos como paquete — ya están especificados por versión en `package.json` y `requirements.txt`/`pyproject.toml`, todas dependencias de código abierto bajo licencias permisivas (MIT, Apache 2.0, BSD).

## 7. ARCHIVOS DE CONFIGURACIÓN DE IDE/EDITOR Y SISTEMA

**NO incluir** (ya cubiertos por `.gitignore`): `.vscode/`, `.idea/`, `.DS_Store`, `Thumbs.db`, archivos de swap de editores.

## 8. CHECKLIST FINAL DE EXCLUSIONES

- [ ] NO incluir `backend/.env` real (sólo `.env.example`)
- [ ] NO incluir `frontend/node_modules/`, `backend/.venv/`, `backend/.venv-check/`
- [ ] NO incluir `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`
- [ ] NO incluir `.git/`, `.github/`
- [ ] NO incluir `frontend/.next/`
- [ ] NO incluir `render.yaml`, `docker-compose.yml`
- [ ] NO incluir los informes internos de auditoría/limpieza técnica listados en la sección 3
- [ ] NO incluir `docs/STATUS.md`, `docs/TECH_DEBT.md`, `docs/BUGS.md`, el postmortem de incidente, ni `CLAUDE.md` raíz
- [ ] NO incluir ningún dato real de usuarios de la beta
- [ ] INCLUIR `backend/scripts/`, `backend/tests/` (datos ficticios/genéricos, seguro)
- [ ] INCLUIR `REGISTRO_OBRA_SOFTWARE/` completo
- [ ] INCLUIR `docs/foundation/` y `docs/adr/`
- [ ] INCLUIR `README.md`, `LICENSE`, `NOTICE` de la raíz

---

*Documento de exclusiones para expediente DNDA — Julieta Arrazate — Septiembre 2026*
