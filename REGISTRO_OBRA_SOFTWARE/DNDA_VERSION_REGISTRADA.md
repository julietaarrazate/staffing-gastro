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
| **Tipo** | Anotado |
| **Rama recomendada** | `main` (post-merge) |

## 3. CÓDIGO FUENTE INCLUIDO

### Backend (FastAPI, arquitectura DDD/hexagonal)
- 17 módulos de dominio, cada uno con `domain/`/`application/`/`infrastructure/`/`api/`.
- 17 routers HTTP/WebSocket.
- 14 modelos ORM con tabla propia.
- 30 migraciones Alembic.
- 429 tests automatizados.

### Frontend (Next.js, PWA)
- 31 páginas (App Router).
- 87 componentes.
- 45 módulos de utilidades y cliente HTTP/WebSocket.
- 31 specs E2E (75 tests, Playwright).

### Base de datos
- 30 migraciones (Alembic) sobre PostgreSQL (Neon en producción, SQLite en tests).

## 4. ESTADO DEL SISTEMA

### 4.1 Compilabilidad

| Componente | Compilable | Comando |
|---|---|---|
| Backend | ✓ | `cd backend && pip install -r requirements.txt && python -m uvicorn app.main:app` |
| Frontend | ✓ | `cd frontend && npm install && npm run build` |

### 4.2 Tests

| Suite | Total | Estado |
|---|---|---|
| Backend (pytest) | 429 | Verde en CI |
| Frontend E2E (Playwright) | 75 (31 specs) | Verde en CI |
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
| Hardening de producción | Julio–Agosto 2026 | Migración a Neon, seguridad de sesión, accesibilidad, tests unitarios |
| Inteligencia artificial | Agosto 2026 | Asistente con Gemini |
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
# → 303 commits (al momento de este relevamiento) + los del presente expediente
```

## 7. DOCUMENTACIÓN INCLUIDA EN LA VERSIÓN

### 7.1 Documentación técnica (en el código)
- `README.md`, `LICENSE`, `NOTICE` (raíz).
- `backend/README.md`, `frontend/README.md`.
- `docs/foundation/` (PRODUCT.md, DOMAIN.md, ARCHITECTURE.md, PRINCIPLES.md).
- `docs/adr/` (11 Architecture Decision Records).

### 7.2 Documentación de registro (en `REGISTRO_OBRA_SOFTWARE/`)
- 30-31 archivos `.md` (expediente completo).

## 8. CHECKLIST DE IDENTIDAD

- [x] Obra identificada: Oído
- [x] Commit del expediente identificable: `df12362`
- [ ] Tag permanente: `dnda-oido-2026-v1` (a crear post-merge)
- [x] Rama de registro final: `main`
- [x] Autora identificada: Julieta Arrazate
- [x] Fecha de la versión: Septiembre 2026
- [x] Código fuente completo: backend + frontend
- [x] Tests automatizados: 429 + 75, verdes
- [x] Documentación integral: 30-31 `.md`
- [x] Sincronizado con producción: Vercel + Render

---

*Documento de identificación de versión para expediente DNDA — Julieta Arrazate — Septiembre 2026*
