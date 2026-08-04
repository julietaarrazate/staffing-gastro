# 02 — Arquitectura

> Fase 2 de la auditoría OÍDO. Foco: DDD/hexagonal, acoplamiento, dependencias
> circulares, duplicación, SOLID, modularidad, escalabilidad. Metodología:
> verificación empírica con `grep` sobre las 4 capas de cada módulo (no se
> repite de memoria lo que ya afirmaban `docs/foundation/ARCHITECTURE.md` ni
> `docs/audits/AUDIT_REPORT.md` — se contrasta contra el código real, fecha
> **2026-08-04**, commit base `812c114`). Sin cambios de código en esta fase.
>
> `docs/foundation/ARCHITECTURE.md` sigue siendo la referencia de diseño (capas,
> reglas de dependencia, flujo de datos) y **no se duplica acá**. Este
> documento aporta lo que esa referencia no tiene: verificación puntual
> con evidencia, y el diagnóstico de qué tan al día está la propia
> documentación de arquitectura.

## 1. `docs/foundation/ARCHITECTURE.md` está desactualizado en 3 puntos concretos

Hallazgo de coherencia doc↔código (checklist de `CLAUDE.md`, ítem 4 — "si el
código contradice la doc, frená"):

1. **Stack de mapas.** `docs/foundation/ARCHITECTURE.md:15` dice *"Leaflet (mapas)"*.
   El código real usa **MapLibre GL** vía `@vis.gl/react-maplibre`
   (`frontend/package.json:15`, confirmado en `01_INVENTORY.md`) desde
   ADR-0001. No hay `leaflet`/`react-leaflet` en `package.json`. Migración
   completa, doc no actualizada.
2. **Base de datos de producción.** `docs/foundation/ARCHITECTURE.md:149` dice *"DB:
   PostgreSQL de Render (free) — expira a los 90 días; migración a Neon
   prevista"*. Según `CLAUDE.md` la migración a Neon **ya se hizo y se
   verificó en producción el 2026-07-23**. El propio `ARCHITECTURE.md` no
   se actualizó tras ese incidente/migración (`docs/INCIDENTE_2026-07-23_BACKEND_CAIDO.md`
   sí lo documenta, pero `ARCHITECTURE.md` §Deploy quedó con el estado
   anterior).
3. **CI.** `docs/foundation/ARCHITECTURE.md` no menciona GitHub Actions en absoluto (ni
   en el stack ni en la sección de Tests). `docs/audits/AUDIT_REPORT.md:394`
   (auditoría anterior) registra explícitamente *"CI: ausente"* — hoy existe
   `.github/workflows/ci.yml` con 3 jobs obligatorios (backend/frontend/e2e,
   ver `01_INVENTORY.md §4`). Es una mejora real no reflejada en ninguno de
   los dos documentos de arquitectura/auditoría.

Corrección propuesta para `docs/foundation/ARCHITECTURE.md` (no aplicada en esta fase,
sólo diagnosticada — ver `13_ROADMAP.md`): actualizar la fila del stack
(`Leaflet` → `MapLibre GL`), la sección Deploy (`DB de Render` → `Neon`), y
agregar una línea sobre CI.

## 2. Módulos reales: 11, no 10

`docs/audits/AUDIT_REPORT.md:154` (auditoría anterior) cuenta **10 módulos**. El
árbol real (`01_INVENTORY.md §2`) tiene **11**: `admin`, `application`,
`chat`, `company`, `identity`, `matching`, `notification`, `review`,
`shift`, `subscription`, `worker`. La diferencia es `subscription`
(ADR-0005, posterior a esa auditoría) — no es un error, es que la auditoría
anterior quedó desactualizada por trabajo posterior. Se señala acá para que
`13_ROADMAP.md` no vuelva a arrastrar el número viejo.

## 3. Reglas de dependencia — verificación empírica

Comando ejecutado: para cada archivo en `*/domain/*.py` y `*/application/*.py`
de los 11 módulos, `grep` de imports `from app.modules.<otro>` que no sean el
propio módulo.

- **`application/` → `application/` de otro módulo: 0 casos.** Cada
  servicio de caso de uso importa exclusivamente `domain.repositories`
  (puertos) de otros módulos, nunca su capa de aplicación. Regla de
  `docs/foundation/ARCHITECTURE.md:58-67` **se cumple al 100%** hoy, igual que
  encontró la auditoría anterior — no hay regresión.
- **`domain/` → `domain/` de otro módulo: 4 casos, los mismos que la
  auditoría anterior, sin cambios:**
  - `shift/domain/entities.py:23`, `shift/domain/repositories.py:9`
  - `matching/domain/entities.py:11`, `matching/domain/repositories.py:6`

  Los 4 importan únicamente `WorkerSkill` (un `Enum`, sin lógica ni estado)
  desde `worker.domain.value_objects`. Es una violación literal de "el
  dominio no depende de nadie" (`docs/foundation/PRINCIPLES.md:21`), pero de bajo
  riesgo real: es un tipo de datos compartido de facto entre 3 dominios
  (`worker`, `shift`, `matching`) porque los tres necesitan modelar "puesto
  de trabajo" con el mismo vocabulario (mozo, bartender, etc.). **No es
  circular** (worker/domain no importa nada de shift ni matching) y no se
  filtra lógica de negocio ajena. Persiste sin resolver desde la auditoría
  anterior — dos salidas posibles, sin decidir todavía: (a) mover
  `WorkerSkill` a `app/core/` como tipo compartido explícito, o (b)
  documentar la excepción en `ARCHITECTURE.md` en vez de dejarla como
  contradicción silenciosa. Se prioriza en `13_ROADMAP.md` (quick win, bajo
  esfuerzo).

## 4. Duplicación — 2 hallazgos viejos ya resueltos, verificados con evidencia

La auditoría anterior (`docs/audits/AUDIT_REPORT.md:346-348`) marcaba Haversine
"duplicado... mismo cálculo en dos lenguajes, sin helper compartido". Se
verificó de nuevo con `grep -rn "def.*haversine"`:

- **Backend: una sola implementación**, `backend/app/core/geo.py:8`
  (`haversine_km`), importada por `matching/application/services.py:5` y
  `matching/domain/scoring.py:8`. Sin reimplementaciones.
- **Frontend: una sola implementación**, `frontend/lib/map/geo.ts:12`
  (`haversineKm`), con un comentario explícito en el propio archivo
  advirtiendo no reintroducir un duplicado ("único lugar del front con
  Haversine... evita reintroducir un `haversineKm` duplicado en
  `app/map/page.tsx`"). Los otros 3 archivos que mencionan Haversine
  (`app/map/page.tsx`, `lib/current-location.ts`, `lib/map/travel-time.ts`)
  **importan** la función, no la reimplementan — confirmado línea por
  línea.

Lo que la auditoría anterior señalaba como "mismo cálculo en dos lenguajes"
es simplemente el costo normal de un split backend Python / frontend
TypeScript (no hay forma de compartir código ejecutable entre ambos sin
introducir un paquete compartido, lo cual sería sobre-ingeniería para dos
funciones de \~10 líneas). **No hay duplicación real hoy en ninguno de los
dos lados.** Este hallazgo se da por **cerrado**, corrigiendo a
`docs/audits/AUDIT_REPORT.md`.

## 5. "Brecha dato-existe vs dato-se-actualiza" — estado real, 3 años después de la auditoría anterior

La auditoría anterior marcaba 3 huecos de negocio en `03. Backend`. Estado
verificado hoy:

| Hallazgo viejo | Estado hoy | Evidencia |
|---|---|---|
| `quantity` se persiste pero nunca se usa (bug de producto) | **Resuelto por decisión de producto**, no por código: [ADR-0003](../../adr/ADR-0003-quantity-single-assignment.md) fija "un turno = una persona" como decisión permanente. Ya no es un bug, es un contrato documentado. | `docs/adr/ADR-0003-quantity-single-assignment.md` |
| Insignias/niveles se leen pero nunca se escriben | **Resuelto.** `compute_badges`/`compute_level` (`worker/domain/rules.py:33,78`, funciones puras) se invocan desde `worker/infrastructure/repositories.py:120,128,136` (`_recompute_badges_and_level`) en cada `record_completed_event`/`record_cancellation`/`record_no_show`. | `backend/app/modules/worker/infrastructure/repositories.py` |
| Métricas de reputación derivadas no se actualizan (sólo `rating`) | **Resuelto para el trabajador** (`punctuality_rate`, `events_completed`, `cancellations`, `no_shows`) y **para el comercio** (`on_time_payment_rate`, `events_published`, `late_cancellations` — el propio `docs/reference/REPUTATION.md` fecha esto **2026-08-02**, dos días antes de esta auditoría). | `docs/reference/REPUTATION.md §Métricas de reputación` |

**Nota arquitectónica sobre el punto 2:** el recálculo de insignias/nivel
vive en la capa `infrastructure/` (dentro del repositorio concreto), no en
`application/` (el caso de uso). Es una decisión razonable — encapsula
"escribir + recalcular" como una operación atómica del adaptador de
persistencia — pero técnicamente es lógica de negocio (qué insignia
corresponde) ejecutándose disparada desde el borde equivocado según la
letra estricta de `docs/foundation/ARCHITECTURE.md:47-48` ("infrastructure/ es el
único lugar que sabe de la DB", no de reglas de negocio). Las funciones en
sí (`compute_badges`/`compute_level`) sí están correctamente en `domain/`
— el matiz es sólo *quién las invoca*. Bajo impacto, documentado acá para
que quede explícito en vez de implícito.

## 6. Errores HTTP — sigue sin handler central de dominio

Confirmado: `backend/app/main.py` sólo registra
`@app.exception_handler(IdempotencyReplay)` (línea 82) como handler global.
El resto de los ~10 módulos sigue mapeando excepciones de dominio a HTTP con
helpers locales por archivo (`_bad_request`/`_not_found`, patrón repetido,
ya señalado por la auditoría anterior). No hay regresión ni mejora en este
punto — sigue siendo una oportunidad de reducir repetición (no un bug).

## 7. Escalabilidad — nota de arquitectura (detalle completo en `04_PERFORMANCE.md`/`05_DATABASE.md`)

El motor de matching escanea candidatos en memoria Python en vez de empujar
el filtro/orden a SQL (confirmado en fases previas de `docs/audits/PERFORMANCE_REPORT.md`,
no re-verificado línea por línea acá para no duplicar la Fase 4). A nivel
arquitectónico esto no es una violación de capas — el cálculo de score vive
correctamente en `domain/scoring.py`, es "puro" y testeable — pero sí es una
decisión que no escala más allá de cientos de trabajadores activos por
zona. Se trata en profundidad en `04_PERFORMANCE.md`.

## 8. Veredicto de esta fase

La arquitectura hexagonal/DDD **se sostiene con disciplina real, no sólo
declarada**: 0 cruces `application`↔`application`, 100% de accesos
cross-módulo vía puertos inyectados, no-disclosure (404) consistente. El
único defecto de dependencia (`WorkerSkill` cruzando 3 dominios) es menor,
conocido desde la auditoría anterior, y no ha empeorado ni se ha resuelto.
Los tres hallazgos de "dato existe pero no se actualiza" de la auditoría
anterior **están efectivamente resueltos con evidencia verificable** — el
producto avanzó más rápido que su propia documentación de arquitectura, que
es el hallazgo más accionable de esta fase (§1).
