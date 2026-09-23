# IDENTIFICACIÓN EXACTA DE LA VERSIÓN A REGISTRAR
## Datos definitorios de la obra para el expediente — Oído

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026

---

## 1. IDENTIFICADORES PRINCIPALES

| Parámetro | Valor |
|---|---|
| **Nombre de la obra** | Oído |
| **Nombre técnico del repositorio** | staffing-gastro |
| **Fecha de la versión documentada** | Septiembre de 2026 |

## 2. IDENTIFICADORES GIT

### 2.1 Commit del paquete de documentación

| Campo | Valor |
|---|---|
| **Hash SHA-1 completo** | `df1236272e442b9a7adb9202c4c49c3d397f1d38` |
| **Hash corto** | `df12362` |
| **Autor** | Julieta Arrazate \<julietaarrazate@gmail.com\> |
| **Rama** | `registro-obra-software-dnda` |
| **Mensaje** | `docs: paquete de registro de obra de software (DNDA) para Oído` |

**Verificación:**
```bash
git show df12362
```

### 2.1 bis Commit del código fuente depositado

Es la versión exacta del software que se entrega en el ZIP (la que estaba en
producción al armar el expediente).

| Campo | Valor |
|---|---|
| **Hash SHA-1 completo** | `e1c44b6b033a85750838db679210a7531710d104` |
| **Hash corto** | `e1c44b6` |
| **Rama** | `main` |
| **Fecha** | 23 de septiembre de 2026 |
| **Último cambio incluido** | Documentación sin comparaciones con otras apps (PR #355) |

**Verificación:**
```bash
git show e1c44b6
```

### 2.2 Rama para presentación

| Parámetro | Valor |
|---|---|
| **Rama de registro final** | `main` (post-merge del pull request) |
| **Rama temporal de documentación** | `registro-obra-software-dnda` |
| **Estrategia de merge** | Squash merge |

### 2.3 Tag de registro permanente

Ver `TAG_REGISTRO.md` para el procedimiento completo.

| Parámetro | Valor |
|---|---|
| **Tag** | `dnda-oido-2026-v1` |
| **Commit** | `e1c44b6b033a85750838db679210a7531710d104` (la versión depositada, §2.1 bis) |
| **Creado** | 23/09/2026, como release de GitHub publicado por la autora |
| **Enlace** | https://github.com/julietaarrazate/staffing-gastro/releases/tag/dnda-oido-2026-v1 |

## 3. CÓDIGO FUENTE INCLUIDO

### Backend (FastAPI, arquitectura DDD/hexagonal)
- 17 módulos de dominio, cada uno con `domain/`/`application/`/`infrastructure/`/`api/`.
- 17 routers HTTP/WebSocket.
- 14 modelos ORM con tabla propia.
- 33 migraciones Alembic.
- 512 tests automatizados.

### Frontend (Next.js, PWA)
- 31 páginas (App Router).
- 107 componentes.
- 56 módulos de utilidades y cliente HTTP/WebSocket.
- 39 specs E2E (111 tests, Playwright).

### Base de datos
- 33 migraciones (Alembic) sobre PostgreSQL (proveedor de PostgreSQL gestionado en producción, SQLite en tests).

## 4. ESTADO DEL SISTEMA

### 4.1 Compilabilidad

| Componente | Compilable | Comando |
|---|---|---|
| Backend | ✓ | `cd backend && pip install -r requirements.txt && python -m uvicorn app.main:app` |
| Frontend | ✓ | `cd frontend && npm install && npm run build` |

### 4.2 Tests

| Suite | Total | Estado |
|---|---|---|
| Backend (pytest) | 512 | Verde en CI |
| Frontend E2E (Playwright) | 111 (39 specs) | Verde en CI |
| Frontend unitarios (Vitest) | 14 archivos | Verde en CI |

### 4.3 Funcionalidad demostrada

- [x] Autenticación (JWT + refresh rotativo en cookie `httpOnly`, login con Google)
- [x] Perfiles de trabajador y comercio, con reputación derivada
- [x] Publicación de turnos, manual y por asistente de IA
- [x] Motor de matching con scoring multi-factor
- [x] Ciclo de vida completo del turno (11 estados) con asistencia geolocalizada
- [x] No-show automático y cancelación tardía, con penalización diferenciada
- [x] Sistema de verificación de identidad por niveles de garantía
- [x] Motor de insignias y niveles de gamificación
- [x] Chat en tiempo real por turno (WebSocket)
- [x] Notificaciones in-app y push (VAPID)
- [x] Reseñas bidireccionales
- [x] Suscripción mensual del comercio (planes, gating de capacidad)
- [x] Panel de administración con métricas y moderación
- [x] PWA instalable

## 5. FECHA DE CREACIÓN Y DESARROLLO

| Fase | Período | Descripción |
|---|---|---|
| Fundacional | Junio 2026 | Arquitectura DDD/hexagonal, identidad, perfiles, publicación de turnos |
| Motor de matching | Junio 2026 | Scoring multi-factor, asignación y confirmación |
| Tiempo real | Junio–Julio 2026 | Chat y notificaciones por WebSocket, asistencia geolocalizada |
| Confianza y reputación | Julio 2026 | No-show/cancelación tardía, insignias/niveles, verificación de identidad |
| Monetización | Julio 2026 | Suscripción mensual del comercio |
| Hardening de producción | Julio–Agosto 2026 | Migración a proveedor de PostgreSQL gestionado, seguridad de sesión, accesibilidad, tests unitarios |
| Inteligencia artificial | Agosto 2026 | Asistente de IA |
| Escalada y eficiencia | Agosto 2026 | Escalada automática de urgencia, scheduler por deadline dinámico |
| Identidad visual | Agosto–Septiembre 2026 | Rediseño de marca y auditoría de consistencia visual |

**Total de desarrollo:** más de 70 días continuos, desde el 21 de junio de 2026.

## 6. INTEGRIDAD DE CÓDIGO

**Para verificar que el código no ha sido modificado:**

```bash
git show df12362 --stat
git show df12362 | grep "REGISTRO_OBRA_SOFTWARE" | head -5
git diff-tree --no-commit-id --name-only -r df12362 | wc -l
```

**Historial de commits:**
```bash
git log --oneline | wc -l
# → 347 commits (al momento de este relevamiento) + los del presente expediente
```

## 7. DOCUMENTACIÓN INCLUIDA EN LA VERSIÓN

### 7.1 Documentación técnica (en el código)
- `README.md`, `LICENSE`, `NOTICE` (raíz).
- `backend/README.md`, `frontend/README.md`.
- `docs/foundation/` (PRODUCT.md, DOMAIN.md, ARCHITECTURE.md, PRINCIPLES.md).
- `docs/adr/` (15 Architecture Decision Records).

### 7.2 Documentación de registro (en `REGISTRO_OBRA_SOFTWARE/`)
- 30-31 archivos `.md` (expediente completo).

## 8. CHECKLIST DE IDENTIDAD

- [x] Obra identificada: Oído
- [x] Commit del expediente identificable: `df12362`
- [x] Tag permanente: `dnda-oido-2026-v1` sobre `e1c44b6` (creado el 23/09/2026)
- [x] Rama de registro final: `main`
- [x] Autora identificada: Julieta Arrazate
- [x] Fecha de la versión: Septiembre 2026
- [x] Código fuente completo: backend + frontend
- [x] Tests automatizados: 512 + 111, verdes
- [x] Documentación integral: 30-31 `.md`
- [x] Sincronizado con producción: Vercel + Render

---

*Documento de identificación de versión para expediente DNDA — Julieta Arrazate — Septiembre 2026*
