# QUÉ INCLUIR EN EL EXPEDIENTE DNDA
## Identificación de carpetas y archivos a presentar — Oído

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026

---

## 1. ESTRUCTURA DEL PAQUETE A ENTREGAR

```
EXPEDIENTE_DNDA_2026_09/
│
├── SOFTWARE/                          # Código fuente compilado y funcional
│   ├── backend/                       # API FastAPI + Python 3.11
│   ├── frontend/                      # Aplicación web Next.js + TypeScript
│   └── REGISTRO_OBRA_SOFTWARE/        # Documentación de registro
│
├── DOCUMENTACION/                     # PDFs principales
├── CAPTURAS/                          # Screenshots del sistema funcionando
└── DIAGRAMAS/                         # Diagramas de arquitectura
```

## 2. CARPETA SOFTWARE/ — QUÉ INCLUIR

### 2.1 Backend (FastAPI + Python 3.11)

**Incluir:**
- `/backend/app/` — código fuente completo: `core/` (config, DB, seguridad), `modules/` (17 módulos con sus 4 capas cada uno), `main.py`.
- `/backend/alembic/` — sistema de migraciones (30 archivos en `versions/`).
- `/backend/tests/` — suite de 429 tests automatizados.
- `/backend/scripts/` — utilidades operativas (seed de datos demo idempotente).
- `/backend/requirements.txt` y `pyproject.toml` — dependencias.
- `/backend/.env.example` — plantilla de variables de entorno, sin valores reales.
- `/backend/README.md`.

**NO incluir:**
- `/backend/.venv/`, `/backend/.venv-check/` — entornos virtuales (reinstalables).
- `/backend/app/__pycache__/`, `/backend/tests/__pycache__/`, `/backend/scripts/__pycache__/` — caché de Python.
- `/backend/.pytest_cache/`, `/backend/.ruff_cache/` — caché de herramientas.
- `/backend/.env` (real, si existiera localmente) — nunca versionado.

### 2.2 Frontend (Next.js + TypeScript + PWA)

**Incluir:**
- `/frontend/app/` — 31 páginas (App Router).
- `/frontend/components/` — 87 componentes.
- `/frontend/lib/` — 45 módulos de utilidades y cliente HTTP/WebSocket.
- `/frontend/e2e/` — 31 specs de Playwright.
- `/frontend/public/` — manifest PWA, íconos.
- `/frontend/package.json`, `package-lock.json`, `tsconfig.json`, `next.config.*`.
- `/frontend/.env.production` — sólo contiene una variable pública (`NEXT_PUBLIC_API_URL`), sin secretos.
- `/frontend/README.md`.

**NO incluir:**
- `/frontend/node_modules/` — dependencias (reinstalables con `npm install`).
- `/frontend/.next/` — build compilado (se regenera con `npm run build`).
- Cualquier `.env.local` con configuración personal del entorno de desarrollo.

### 2.3 Documentación de Registro

**Incluir carpeta `/REGISTRO_OBRA_SOFTWARE/`** — todos los documentos `.md` de este expediente (Grupo A imprescindibles, Grupo B de respaldo, Grupo C de guías operativas — ver `README_REGISTRO.md`).

## 3. ARCHIVOS RAÍZ A INCLUIR

**Incluir en la raíz del SOFTWARE/:**
- `README.md` — descripción general del proyecto.
- `LICENSE` — licencia de la obra (propietaria, todos los derechos reservados).
- `NOTICE` — declaración de autoría y titularidad.
- `.gitignore` — archivo de control de Git (no sensible, sólo lista de patrones).

**NO incluir:**
- `.git/` — historial completo de Git (voluminoso, no requerido por la DNDA; se acompaña un export del log en `HISTORIAL_GIT.txt`, ver `PAQUETE_FINAL.md`).
- `.github/` — configuración de GitHub Actions (no necesaria para la DNDA).
- `render.yaml` — configuración de despliegue (no contiene secretos, pero es información operativa interna; se excluye por prudencia).
- `docker-compose.yml` — configuración de entorno local de desarrollo.
- Reportes internos de auditoría técnica y limpieza del repositorio (`CLEANUP_REPORT.md`, `DUE_DILIGENCE_REPORT.md`, `INFRASTRUCTURE_REPORT.md`, `MIGRATION_LOG.md`, `NEXT_IMAGE_ANALYSIS.md`, `PERFORMANCE_REPORT.md`, `PRODUCTION_HARDENING.md`, `REPOSITORY_CLEANUP.md`, `REPOSITORY_STRUCTURE.md`, `SECURITY_CHANGES.md`) — documentación interna de proceso, no oficial del expediente.

## 4. CARPETA `docs/` — QUÉ INCLUIR

**Incluir** (refuerza la evidencia técnica, opcional pero recomendado):
- `docs/foundation/` (PRODUCT.md, DOMAIN.md, ARCHITECTURE.md, PRINCIPLES.md).
- `docs/adr/` (11 Architecture Decision Records).

**NO incluir:**
- `docs/STATUS.md`, `docs/TECH_DEBT.md`, `docs/BUGS.md` — bitácora operativa interna, con detalle de incidentes y estado del día a día que no aporta al registro y podría exponer información operativa innecesaria.
- `docs/INCIDENTE_2026-07-23_BACKEND_CAIDO.md` — postmortem operativo interno.

## 5. TAMAÑO ESTIMADO DEL PAQUETE

| Componente | Tamaño aproximado |
|---|---|
| Backend (código fuente) | ~1–2 MB |
| Frontend (código fuente) | ~2–3 MB |
| REGISTRO_OBRA_SOFTWARE/ (documentación) | ~500–700 KB |
| DOCUMENTACION/ (PDFs) | ~10–12 MB |
| CAPTURAS/ (27 screenshots) | ~12–16 MB |
| DIAGRAMAS/ (4 diagramas) | ~500 KB |
| **TOTAL ESTIMADO** | **~27–35 MB** |

**Cumple el requisito DNDA:** < 2 GB. ✓

## 6. REQUISITOS DE INCLUSIÓN VERIFICADOS

| Requisito DNDA | Cumple | Evidencia |
|---|---|---|
| Código fuente completo | ✓ | Backend (17 routers, 17 módulos), Frontend (31 páginas) |
| Software compilado/ejecutable | ✓ | Backend con `uvicorn`, Frontend con `npm run build` |
| Software terminado | ✓ | En producción, 429 + 75 tests pasando, 303 commits históricos |
| Documentación de autoría | ✓ | `EVIDENCIA_AUTORIA.md` |
| Originalidad acreditada | ✓ | `ACTIVOS_PI.md` (5 algoritmos/sistemas propios, 4 reglas de negocio) |
| Migraciones de base de datos | ✓ | 30 migraciones Alembic |
| Tests automatizados | ✓ | 429 (backend) + 75 (E2E) |
| Tecnologías documentadas | ✓ | `INVENTARIO_TECNICO.md` y `DOCUMENTACION_TECNICA.md` |

---

*Documento de inclusión para expediente DNDA — Julieta Arrazate — Septiembre 2026*
