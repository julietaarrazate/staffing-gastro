# REPOSITORY_CLEANUP.md — Resumen de limpieza (2026-08-04)

> Qué se buscó, qué se encontró y qué se hizo (o deliberadamente no se
> hizo) en la reorganización del 2026-08-04, siguiendo el checklist
> pedido: carpetas obsoletas, archivos temporales, documentación
> duplicada, nombres inconsistentes, referencias antiguas del proyecto,
> referencias a "Competencias", referencias antiguas a "Staffya".

## 1. Carpetas/archivos obsoletos

| Encontrado | Acción | Evidencia |
|---|---|---|
| `backend/.venv-audit/` — venv completo (82 MB, 3021 archivos) trackeado por git por error desde 2026-07-13 | ✅ Sacado del tracking (`git rm -r --cached`); `.gitignore` corregido para que no se repita | `MIGRATION_LOG.md §1` |
| Carpeta `AUDIT/` en la raíz | ✅ Movida a `docs/audits/2026-08-oido/`, consolidada con el resto de auditorías | `MIGRATION_LOG.md §3` |

No se encontró ninguna otra carpeta obsoleta (`old/`, `tmp/`, `backup/`,
`v2/`, etc.) — confirmado en `AUDIT/10_REPOSITORY.md` y re-verificado acá.

## 2. Archivos temporales

- `frontend/playwright-report/` y `frontend/test-results/` — **ya
  correctamente ignorados** por `frontend/.gitignore` (`/playwright-report/`,
  `/test-results/`), confirmado con `git ls-files` → 0 resultados. No hacía
  falta ninguna acción (ya verificado en `AUDIT/09_CLEANUP.md §3`).
- `frontend/tsconfig.tsbuildinfo` — build artifact, ya cubierto por el
  patrón `*.tsbuildinfo` de `frontend/.gitignore`, no trackeado.
- No se encontraron archivos `.bak`, `.orig`, `*~`, ni carpetas `tmp/`.

## 3. Documentación duplicada

No se encontró contenido **duplicado** (mismo texto en dos archivos). Sí
había **superposición temática** entre los `_REPORT.md` de performance/
seguridad/escalabilidad — cada uno con fecha y alcance propios, por lo que
fusionarlos perdería detalle histórico. Se optó por **agruparlos**
físicamente en `docs/audits/` en vez de fusionarlos — ver
`REPOSITORY_STRUCTURE.md`.

## 4. Nombres inconsistentes

No se encontraron nombres de archivo inconsistentes (mayúsculas/minúsculas
mezcladas, convenciones distintas). Toda la documentación sigue
`ALL_CAPS_SNAKE.md`; los ADRs siguen `ADR-000N-slug-en-minúsculas.md`
consistentemente. Único hallazgo de nomenclatura (no de archivo, de
módulo de código): el módulo `application` del backend (postulaciones)
tiene un nombre ambiguo por coincidir con la capa DDD homónima que cada
módulo tiene — **no se toca**, es refactor de código, no reorganización de
carpetas (ver `AUDIT/10_REPOSITORY.md §4`).

## 5. Referencias a "Competencias"

**Búsqueda exhaustiva, cero resultados.** El término no aparece en
ningún archivo, nombre de archivo, ni carpeta de este repositorio — no es
un residuo aplicable a Staffya/Oído. Verificado con `grep` recursivo
sobre todo el código y la documentación.

## 6. Referencias antiguas a "Staffya"

Se catalogaron **~100 archivos** que mencionan "Staffya" y se clasificaron
antes de decidir si tocar algo:

| Categoría | Ejemplos | Decisión |
|---|---|---|
| **Protegido — rompe producción** | Hostname `staffya-backend.onrender.com` (`render.yaml`, `next.config.ts`), claves de `localStorage` (`staffya_token`, `staffya_refresh`, `staffya_current_location`) | **Sin tocar** — `CLAUDE.md` ya lo marca explícitamente como intocable |
| **Protegido — fixtures de test** | Emails `*.staffya.com` en ~20 archivos de `backend/tests/`, `seed_demo_data.py` | **Sin tocar** — ya protegido en un rebrand anterior por el mismo motivo (ruido sin valor real) |
| **Nombre técnico intencional** | `pyproject.toml` (`name = "staffya-backend"`), título de `backend/README.md` | **Sin tocar** — nombre técnico del repo, coexiste a propósito con la marca "Oído" (documentado en `CLAUDE.md`) |
| **Prosa de documentación** | La mayoría de `docs/**/*.md` menciona "Staffya" en el texto | **Sin tocar** — mismo patrón que `CLAUDE.md`/`README.md` usan deliberadamente ("Staffya es un marketplace... marca 'Oído'") |

**No se ejecutó ningún find-and-replace de "Staffya".** La gran mayoría de
las referencias son correctas y están protegidas explícitamente por
`CLAUDE.md` o por convención ya establecida en un rebrand anterior — no
son residuos a limpiar, son el nombre técnico del proyecto conviviendo a
propósito con la marca comercial. Instrucción explícita de Julieta para
esta ronda: mantener fuera de alcance cualquier migración Staffya/Oído.

## 7. Qué se generó como parte de esta limpieza

- **`NOTICE`** (sesión anterior, no de esta reorganización): autoría y
  titularidad — Julieta Arrazate.
- **`LICENSE`** (sesión anterior): licencia propietaria "All Rights
  Reserved".
- **`.gitignore`** corregido: patrón `.venv*/` en vez de sólo `.venv/`.

## 8. Resumen

| Categoría del checklist | Encontrado | Acción |
|---|---|---|
| Carpetas obsoletas | `.venv-audit/` trackeado, `AUDIT/` en la raíz | Sacado del tracking / consolidado en `docs/audits/` |
| Archivos temporales | Ninguno sin ignorar | Sin acción (ya correcto) |
| Documentación duplicada | Ninguna (sólo superposición temática) | Agrupada, no fusionada |
| Nombres inconsistentes | Ninguno en archivos; 1 en código (`application`) | Sin acción (fuera de alcance, es refactor) |
| Referencias a "Competencias" | Ninguna | N/A |
| Referencias a "Staffya" | ~100, casi todas protegidas/intencionales | Sin acción (instrucción explícita) |

No se eliminó ningún archivo funcional ni documentación — el único caso de
remoción fue `backend/.venv-audit/` del **tracking de git**, tal como se
confirmó antes de ejecutar.
