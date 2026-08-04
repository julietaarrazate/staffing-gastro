# MIGRATION_LOG.md — Registro de la reorganización (2026-08-04)

> Log completo de la reorganización estructural aprobada por Julieta el
> 2026-08-04, ejecutada sobre la rama `claude/staffya-evidence-audit-9d9pvh`.
> Todos los movimientos usaron `git mv` (historial preservado). Cero cambios
> de lógica de negocio, APIs, módulos de backend o nombres internos.

## 1. `backend/.venv-audit/` — sacado del tracking de git

- **Hallazgo:** un entorno virtual completo (3021 archivos, 82 MB) estaba
  trackeado por git desde el commit `c2458c4` (2026-07-13, un commit de
  suscripciones sin relación). Se coló porque `.gitignore` sólo cubría el
  nombre exacto `.venv/`, y este directorio se llama `.venv-audit/`
  (creado para correr `pip-audit` sin tocar el venv principal).
- **Acción:** `git rm -r --cached backend/.venv-audit` — se quita del
  tracking, **el archivo local no se toca** (verificado: sigue en disco,
  82 MB, intacto).
- **`.gitignore`:** se cambió el patrón `.venv/` por `.venv*/` (con
  comentario explicando el motivo), para que ningún venv con otro nombre
  vuelva a colarse.
- **Nota:** el commit `c2458c4` que lo introdujo **sigue existiendo en el
  historial de git** — esto no reescribe historia (fuera de alcance sin
  pedido explícito, y potencialmente destructivo para cualquiera con la
  rama ya clonada). El repo no vuelve a crecer por este motivo desde hoy,
  pero el peso histórico del commit viejo permanece hasta que alguien
  decida hacer una limpieza de historia aparte (`git filter-repo` o
  similar — riesgo alto, requiere coordinación, no se propone acá).

## 2. `docs/` — 42 archivos reorganizados en 5 subcarpetas temáticas

Todos movidos con `git mv` (uno por uno, no en bloque, para que el
historial de cada archivo individual quede como un rename detectable por
git). Mapeo completo:

| Archivo | Origen | Destino |
|---|---|---|
| PRODUCT.md | `docs/` | `docs/foundation/` |
| DOMAIN.md | `docs/` | `docs/foundation/` |
| ARCHITECTURE.md | `docs/` | `docs/foundation/` |
| PRINCIPLES.md | `docs/` | `docs/foundation/` |
| MODULES.md | `docs/` | `docs/foundation/` |
| ART_DIRECTION.md | `docs/` | `docs/design/` |
| COLOR_SYSTEM.md | `docs/` | `docs/design/` |
| TYPOGRAPHY_SYSTEM.md | `docs/` | `docs/design/` |
| ICONOGRAPHY_SYSTEM.md | `docs/` | `docs/design/` |
| DESIGN_TOKENS.md | `docs/` | `docs/design/` |
| BRIEF_IDENTIDAD_VISUAL.md | `docs/` | `docs/design/` |
| API.md | `docs/` | `docs/reference/` |
| DATABASE.md | `docs/` | `docs/reference/` |
| EVENTS.md | `docs/` | `docs/reference/` |
| SECURITY.md | `docs/` | `docs/reference/` |
| TESTING.md | `docs/` | `docs/reference/` |
| DEPLOY.md | `docs/` | `docs/reference/` |
| OBSERVABILITY.md | `docs/` | `docs/reference/` |
| MATCHING.md | `docs/` | `docs/reference/` |
| SHIFT.md | `docs/` | `docs/reference/` |
| WORKER.md | `docs/` | `docs/reference/` |
| EMPLOYER.md | `docs/` | `docs/reference/` |
| CHAT.md | `docs/` | `docs/reference/` |
| REPUTATION.md | `docs/` | `docs/reference/` |
| AVAILABILITY.md | `docs/` | `docs/reference/` |
| LOCATION.md | `docs/` | `docs/reference/` |
| NOTIFICATIONS.md | `docs/` | `docs/reference/` |
| PAYMENTS.md | `docs/` | `docs/reference/` |
| ACCESO_MODERNO.md | `docs/` | `docs/reference/` |
| MAPS_REDESIGN.md | `docs/` | `docs/reference/` |
| AUDIT_REPORT.md | `docs/` | `docs/audits/` |
| SECURITY_REPORT.md | `docs/` | `docs/audits/` |
| PERFORMANCE_REPORT.md | `docs/` | `docs/audits/` |
| PERFORMANCE_AUDIT_FRONTEND.md | `docs/` | `docs/audits/` |
| SCALABILITY_REPORT.md | `docs/` | `docs/audits/` |
| TESTING_REPORT.md | `docs/` | `docs/audits/` |
| PRODUCTION_READINESS.md | `docs/` | `docs/planning/` |
| RECOMMENDATIONS.md | `docs/` | `docs/planning/` |
| QUICK_WINS.md | `docs/` | `docs/planning/` |
| ROADMAP_IMPLEMENTATION.md | `docs/` | `docs/planning/` |
| PULIDO_ROADMAP.md | `docs/` | `docs/planning/` |
| LAUNCH_PLAN.md | `docs/` | `docs/planning/` |

**Sin mover** (quedan en `docs/` raíz, a propósito — ver
`REPOSITORY_STRUCTURE.md`): `STATUS.md`, `TECH_DEBT.md`, `BUGS.md`,
`INCIDENTE_2026-07-23_BACKEND_CAIDO.md`. Tampoco se tocó `docs/adr/` ni
`docs/mockups/` (ya estaban organizados).

## 3. `AUDIT/` → `docs/audits/2026-08-oido/`

13 archivos (fases 1-12 + `ROADMAP.md` de la auditoría OÍDO de esta misma
sesión), movidos con `git mv` a una subcarpeta fechada dentro de
`docs/audits/`, consistente con el resto de auditorías puntuales del
repo.

## 4. Referencias actualizadas

Reorganizar 55 archivos rompe cualquier referencia que apunte a su
ubicación vieja. Se corrigieron en 3 pasadas, cada una verificada antes
de la siguiente:

### 4.1 Enlaces markdown (`[texto](ruta)`)

**162 enlaces** reescritos en 20 archivos, resolviendo cada uno contra la
ubicación **vieja** del archivo que lo contiene (no la nueva) para no
romper la resolución relativa, y recalculando la ruta relativa correcta
desde la ubicación **nueva**. Cubre `CLAUDE.md`, `README.md`, y todos los
`.md` dentro de `docs/` (incluida la nueva `docs/audits/2026-08-oido/`).

### 4.2 Menciones en comentarios de código

**93 reemplazos** en 72 archivos `.py`/`.ts`/`.tsx` (comentarios que citan
`docs/ARCHIVO.md` como referencia — patrón usado en todo el backend y
frontend para explicar el "por qué" de una decisión). Reemplazo directo de
la ruta vieja por la nueva (estas menciones siempre usan la forma
relativa-a-la-raíz `docs/ARCHIVO.md`, sin ambigüedad de resolución).

### 4.3 Menciones sueltas en otros formatos

**129 reemplazos adicionales** en 28 archivos que el paso 4.2 no cubría:
menciones en texto plano/backticks dentro de `.md` que no eran enlaces
markdown propiamente dichos (ej. `` `docs/LAUNCH_PLAN.md` `` en prosa),
más comentarios en `.yml` (`​.github/workflows/ci.yml`), `.js`
(`frontend/public/sw.js`), `.css` (`frontend/app/globals.css`) y `.txt`
(`backend/requirements.txt`) que los pasos anteriores no cubrían por
extensión de archivo.

### 4.4 Verificación

- **Barrido final de residuos:** búsqueda de `docs/<NOMBRE-VIEJO>.md` y
  `AUDIT/<NOMBRE>.md` en todo el repo (excluyendo `node_modules`/`.venv`/
  `.git`) → **0 resultados**.
- **Verificador de enlaces rotos:** script que resuelve los **262**
  enlaces internos `.md`/`.html` de todo el repo contra el sistema de
  archivos real → **0 rotos**.

### 4.5 Incidente durante la ejecución (transparencia)

El script de reescritura de enlaces markdown se corrió **dos veces por
error** en el primer intento — la segunda corrida reprocesó enlaces ya
corregidos, perdiendo anclas (`#sección`) y calculando rutas relativas
incorrectas en algunos casos. Se detectó antes de commitear nada,
revirtiendo con `git restore --worktree` todo el contenido no confirmado
(los `git mv` de movimiento de archivos no se vieron afectados, sólo el
contenido de texto), y se re-ejecutó el script exactamente una vez. El
resultado final fue verificado con el script de chequeo de enlaces (0
rotos) antes de continuar.

## 5. Qué no se tocó

- Ningún archivo de código de producto (`backend/app/**`,
  `frontend/app/**`, `frontend/components/**`, `frontend/lib/**`) más
  allá de comentarios que citaban rutas de documentación.
- Ninguna referencia a "Staffya" como nombre técnico (hosts,
  `localStorage`, fixtures de test, `pyproject.toml`) — protegidas a
  propósito, ver `REPOSITORY_CLEANUP.md`.
- El módulo `application` del backend (ambigüedad de nombre ya señalada
  en la auditoría) — renombrarlo es refactor de código, fuera de alcance
  de esta reorganización.
- Los 3 componentes del Design System sin uso (`SearchInput`, `FAB`,
  `Chip`) — borrarlos es cambio de código, no de estructura documental.

## 6. Verificación final

| Gate | Resultado |
|---|---|
| `pytest -q` (backend) | ✅ 255 passed |
| `npx tsc --noEmit` (frontend) | ✅ sin errores |
| `npm run build` (frontend) | ✅ 24 rutas compiladas |
| Playwright (E2E) | ⚠️ no ejecutable en este sandbox (falta el binario de Chromium en la ruta que Playwright espera — mismo problema de entorno ya diagnosticado antes en esta sesión, sin relación con este cambio); se verifica en CI al pushear |
| Enlaces markdown rotos | ✅ 0 de 262 |
| Menciones residuales a rutas viejas | ✅ 0 |

Detalle completo de qué se sacó/preservó y por qué, en
[`REPOSITORY_CLEANUP.md`](./REPOSITORY_CLEANUP.md).
