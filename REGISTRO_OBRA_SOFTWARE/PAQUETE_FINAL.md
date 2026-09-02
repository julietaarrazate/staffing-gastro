# CONTENIDO DEL PAQUETE FINAL
## Qué incluir y qué excluir del ZIP de registro — Oído

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026

---

## 1. QUÉ INCLUIR

### 1.1 Código fuente del backend

```
backend/
├── app/
│   ├── core/            ← todos los archivos .py
│   ├── modules/          ← los 17 módulos completos (domain/application/infrastructure/api)
│   └── main.py
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/          ← 30 migraciones
├── tests/                 ← 429 tests
├── scripts/                ← seed de datos demo
├── requirements.txt
├── pyproject.toml
├── .env.example
└── README.md
```

### 1.2 Código fuente del frontend

```
frontend/
├── app/                   ← 31 páginas
├── components/            ← 87 componentes
├── lib/                   ← 45 módulos de utilidades/cliente
├── e2e/                   ← 31 specs Playwright
├── public/
├── package.json
├── package-lock.json
├── tsconfig.json
├── next.config.*
├── .env.production        ← sólo variable pública NEXT_PUBLIC_API_URL
└── README.md
```

### 1.3 Documentación técnica de la obra

```
docs/
├── foundation/            ← PRODUCT.md, DOMAIN.md, ARCHITECTURE.md, PRINCIPLES.md
└── adr/                   ← 11 Architecture Decision Records
```

### 1.4 Documentación de registro

```
REGISTRO_OBRA_SOFTWARE/
└── (todos los archivos .md de este expediente)
```

### 1.5 Documentación técnica del repositorio (raíz)

```
README.md
LICENSE
NOTICE
```

---

## 2. QUÉ EXCLUIR

### 2.1 Dependencias instaladas (nunca incluir)

```
frontend/node_modules/
backend/.venv/
backend/.venv-check/
backend/app/__pycache__/
backend/tests/__pycache__/
backend/scripts/__pycache__/
```

### 2.2 Build / caché

```
frontend/.next/
backend/.pytest_cache/
backend/.ruff_cache/
```

### 2.3 Archivos de entorno y secretos — CRÍTICO

```
backend/.env               ← nunca versionado en el repositorio
frontend/.env.local
*.pem
*.key
```

### 2.4 Archivos de git y CI

```
.git/
.github/
```

**Excepción:** si el organismo solicita evidencia de historial, incluir un export del log:
```bash
git log --format="%H | %ad | %an | %s" --date=short > HISTORIAL_GIT.txt
```

### 2.5 Documentación operativa interna (proceso, no la obra)

```
docs/STATUS.md
docs/TECH_DEBT.md
docs/BUGS.md
docs/INCIDENTE_2026-07-23_BACKEND_CAIDO.md
docs/design/                (sistema de diseño visual — no imprescindible para el registro de software)
docs/reference/              (documentación de referencia detallada, opcional)
CLAUDE.md                    (guía operativa interna de cómo trabajar en el repositorio)
CLEANUP_REPORT.md, DUE_DILIGENCE_REPORT.md, INFRASTRUCTURE_REPORT.md,
MIGRATION_LOG.md, NEXT_IMAGE_ANALYSIS.md, PERFORMANCE_REPORT.md,
PRODUCTION_HARDENING.md, REPOSITORY_CLEANUP.md, REPOSITORY_STRUCTURE.md,
SECURITY_CHANGES.md
render.yaml
docker-compose.yml
```

### 2.6 Archivos de sistema

```
.DS_Store
Thumbs.db
*.swp
.idea/
.vscode/
```

---

## 3. ESTRUCTURA RECOMENDADA DEL ZIP

```
REGISTRO_OBRA_SOFTWARE_OIDO_2026_09.zip
│
├── DOCUMENTACION/
│   ├── README_REGISTRO.md
│   ├── MEMORIA_DESCRIPTIVA.md
│   ├── INVENTARIO_TECNICO.md
│   ├── DOCUMENTACION_TECNICA.md
│   ├── MANUAL_FUNCIONAL.md
│   ├── MODULOS_DEL_SISTEMA.md
│   ├── EVIDENCIA_AUTORIA.md
│   ├── RESUMEN_EJECUTIVO.md
│   ├── ACTIVOS_PI.md
│   ├── VERSION_A_REGISTRAR.md
│   └── EXPEDIENTE_FINAL.md
│
├── SOFTWARE/
│   ├── backend/        ← código fuente Python (sin .venv, sin __pycache__)
│   ├── frontend/       ← código fuente TypeScript (sin node_modules, sin .next)
│   └── docs/            ← foundation/ y adr/ solamente
│
├── CAPTURAS/           ← capturas de pantalla del sistema en uso
│   └── (ver DNDA_CAPTURAS.md)
│
├── DIAGRAMAS/          ← diagramas de arquitectura, BD, matching, ciclo del turno
│   └── (ver MATERIAL_COMPLEMENTARIO.md)
│
└── HISTORIAL_GIT.txt   ← export del log git (opcional pero recomendado)
```

---

## 4. COMANDO PARA GENERAR EL ZIP

```bash
# Desde la raíz del repositorio
cd /ruta/al/repositorio/staffing-gastro

# Generar el historial git
git log --format="%H | %ad | %an | %s" --date=short > HISTORIAL_GIT.txt

# Crear el ZIP excluyendo lo que no debe ir
zip -r REGISTRO_OBRA_SOFTWARE_OIDO_2026_09.zip \
  backend/app \
  backend/alembic \
  backend/tests \
  backend/scripts \
  backend/requirements.txt \
  backend/pyproject.toml \
  backend/.env.example \
  backend/README.md \
  frontend/app \
  frontend/components \
  frontend/lib \
  frontend/e2e \
  frontend/public \
  frontend/package.json \
  frontend/tsconfig.json \
  frontend/.env.production \
  frontend/README.md \
  docs/foundation \
  docs/adr \
  REGISTRO_OBRA_SOFTWARE \
  README.md LICENSE NOTICE \
  HISTORIAL_GIT.txt \
  -x "*/node_modules/*" "*/__pycache__/*" "*/.venv/*" "*/.venv-check/*" \
     "*/.next/*" "*/.pytest_cache/*" "*/.ruff_cache/*" "*/.git/*"
```

---

## 5. VERIFICACIÓN PREVIA AL ZIP

Antes de comprimir, verificar que NO existan en las carpetas incluidas:

- [ ] Ningún archivo `.env` (real, con secretos) o `.env.local`
- [ ] Ningún archivo `.key` o `.pem`
- [ ] Ningún directorio `node_modules/`
- [ ] Ningún directorio `.venv/` o `.venv-check/`
- [ ] Ningún directorio `__pycache__/`, `.pytest_cache/` o `.ruff_cache/`
- [ ] Ningún directorio `.next/`
- [ ] Ningún archivo con credenciales o tokens

---

*Documento elaborado para expediente de registro. Julieta Arrazate — Septiembre 2026*
