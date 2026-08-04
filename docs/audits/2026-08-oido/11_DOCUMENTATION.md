# 11 — Documentación

> Fase 11 de la auditoría OÍDO. Cubre: README, arquitectura, deploy,
> variables, API, diagramas. Esta fase es la **síntesis** de un patrón que
> ya se venía detectando fase a fase desde `02_ARCHITECTURE.md`: el código
> avanza más rápido que la documentación que lo describe. Acá se consolida
> ese patrón en una sola lista accionable, y se cubre lo que no tenía fase
> propia todavía: diagramas (ausentes) y el estado real de `docs/reference/API.md`.
> Sin cambios de código.

## 1. `docs/` es, en general, un activo real — no un adorno

Antes de listar lo que falta: **46 documentos técnicos** (`10_REPOSITORY.md
§3`), varios con metodología explícita (`grep`/lectura de código citada
`archivo:línea`, ejecución real de `pytest`/`tsc`/`next build`, mediciones
con benchmarks propios). No es documentación aspiracional ni copiada de un
template — es el tipo de documentación que **si se sigue actualizando**,
es exactamente lo que un due-diligence técnico o un registro DNDA
necesitan (ver `12_DNDA.md`). El problema encontrado por esta auditoría no
es de calidad de redacción ni de cobertura de temas — es de
**sincronización** con los cambios de infraestructura más recientes
(la migración a Neon, principalmente).

## 2. Consolidado: todo lo que quedó desactualizado por la migración a Neon (2026-07-23)

Un solo evento de infraestructura generó desfasaje en **cinco documentos
distintos**, cada uno detectado en su fase correspondiente de esta
auditoría (no se repite el detalle, sólo se listan para tener el
inventario completo en un lugar):

| Documento | Afirmación vencida | Detectado en |
|---|---|---|
| `docs/foundation/ARCHITECTURE.md` | "DB: PostgreSQL de Render (free) — expira a los 90 días" | `02_ARCHITECTURE.md §1` |
| `docs/reference/DATABASE.md` | "DB de Render (free) expira a los 90 días. Migración a Neon prevista" | `05_DATABASE.md §2` |
| `docs/audits/SCALABILITY_REPORT.md` | "un reloj corriendo real (expiración de la DB a los 90 días)" | `04_PERFORMANCE.md §3` |
| `docs/reference/OBSERVABILITY.md` | "Alertas sobre... la expiración de la DB (90 días...)" | `06_INFRASTRUCTURE.md §1` |
| `docs/reference/DEPLOY.md` | tabla de env vars: `DATABASE_URL \| fromDatabase (staffya-db)` | `06_INFRASTRUCTURE.md §2` |

**Patrón:** ninguno de los cinco está "abandonado" — todos tienen contenido
reciente y correcto en otras secciones (de hecho `DEPLOY.md` tiene una
sección entera, correcta y detallada, sobre Neon más abajo en el mismo
archivo). Lo que falló no fue "nadie actualiza esto", sino que **la
actualización de un evento de infra no se propagó a las 5 menciones
dispersas** del mismo hecho. Acción propuesta en `13_ROADMAP.md`: un solo
PR de documentación que busque la frase "expira a los 90 días"/"DB de
Render" en todo `docs/` y la corrija de una vez en los 5 lugares.

## 3. Consolidado: el resto de la documentación desactualizada encontrada

| Documento | Hallazgo | Detectado en |
|---|---|---|
| `docs/foundation/ARCHITECTURE.md` | "Leaflet (mapas)" → es MapLibre GL desde ADR-0001 | `02_ARCHITECTURE.md §1` |
| `docs/foundation/ARCHITECTURE.md` | No menciona CI (existe desde hace tiempo) | `02_ARCHITECTURE.md §1` |
| `docs/audits/AUDIT_REPORT.md` | Cuenta 10 módulos (falta `subscription`, posterior) | `02_ARCHITECTURE.md §2` |
| `docs/audits/AUDIT_REPORT.md` | "CI: ausente" — ya no es cierto | `02_ARCHITECTURE.md §1` |
| `docs/audits/SECURITY_REPORT.md` | Refresh sin revocación, sin CSP — ambos resueltos después | `03_SECURITY.md §1` |
| `docs/reference/DATABASE.md` | Documenta 10 migraciones de 21 reales | `05_DATABASE.md §1` |
| `docs/reference/DATABASE.md` | `quantity` "decisión pendiente" → decidida por ADR-0003 | `05_DATABASE.md §2` |
| `docs/reference/OBSERVABILITY.md` | Dice "sin logging estructurado ni Sentry" — ambos existen | `06_INFRASTRUCTURE.md §1` |
| `README.md` | Sigue en "Staffya" sin mencionar el rebrand; lista Redis/PostGIS reales sin serlo; no menciona PWA/push/Sentry/Cloudinary/Mercado Pago/Google Sign-In | `01_INVENTORY.md §7` |
| `CLAUDE.md` (encabezado) | El barrido de responsive quedó unos días detrás de `STATUS.md` (3 pantallas ya resueltas sin reflejar) | `07_FRONTEND.md §5` |
| `pyproject.toml` | Config de `ruff` sin usar en CI, sin mención en `CLAUDE.md`/`TECH_DEBT.md` | `01_INVENTORY.md §7` |

## 4. `docs/reference/API.md` — verificado, sin hallazgos nuevos

Cubre los 13 routers reales (incluye `subscription` y el segundo router de
`notification` para push), documenta paginación (`limit`/`offset`),
WebSockets, y tiene su propia sección "Pendientes/a mejorar" honesta
(versionado sin política de deprecación, envelope de paginación con
`total`/cursor pendiente si el volumen lo pide). Es, junto con `DEPLOY.md`
y la familia `REPUTATION.md`/`SHIFT.md`, de los documentos técnicos mejor
mantenidos del repo — no se encontró ninguna sección vencida.

## 5. Diagramas — ausencia total, hallazgo nuevo de esta fase

`grep` de bloques ```mermaid```/```plantuml```/`graph TD` en todo `docs/*.md`,
y búsqueda de archivos `.png`/`.svg`/`.drawio` dentro de `docs/`: **cero
resultados en ambos casos.** No hay ningún diagrama en todo el repositorio
— ni de arquitectura de módulos, ni de la máquina de estados del turno
(que sí está descrita en prosa detallada, `shift/domain/entities.py`,
suficientemente compleja como para beneficiarse de un diagrama), ni de
flujo de datos, ni de infraestructura (Render↔Vercel↔Neon↔Cloudinary).
`docs/foundation/ARCHITECTURE.md` sí tiene un diagrama de flujo **en ASCII** (líneas
89-97, "Flujo de datos (request típico)") — es funcional pero mínimo.

- **Impacto:** para un due-diligence técnico o una presentación a
  inversores (`docs/planning/LAUNCH_PLAN.md` ya apunta a esa audiencia), un
  diagrama de arquitectura de una página comunica en segundos lo que hoy
  requiere leer varios documentos en prosa. No es urgente para el
  funcionamiento del producto, pero es exactamente el tipo de artefacto
  que un lector externo (inversor, auditor DNDA) espera encontrar primero.
- **Prioridad:** Media (valor alto de comunicación, esfuerzo bajo con
  Mermaid — soportado nativamente en GitHub, no requiere herramienta
  externa ni archivo binario).
- **Propuesta concreta para `13_ROADMAP.md`:** 2-3 diagramas Mermaid
  embebidos en Markdown (no archivos aparte): (1) mapa de módulos +
  dependencias cross-módulo (los mismos 4 cruces de `WorkerSkill` que
  documentó `02_ARCHITECTURE.md §3` serían visualmente obvios), (2) máquina
  de estados del turno (`Shift`, ya completamente especificada en
  `domain/entities.py`, sólo falta transcribirla a `stateDiagram-v2`), (3)
  diagrama de infraestructura (Render/Vercel/Neon/Cloudinary/GitHub
  Actions) para `docs/reference/DEPLOY.md`.

## 6. Veredicto de esta fase

La documentación de Staffya/Oído es, en volumen y metodología, **superior
a la de la mayoría de los proyectos en etapa beta** — la práctica de citar
`archivo:línea` y ejecutar los gates de calidad antes de escribir un
hallazgo es poco común y valiosa. El costo de mantener 46 documentos
técnicos vivos es real y se nota: un solo evento de infraestructura dejó
rastro desactualizado en 5 lugares. La ausencia total de diagramas es la
única brecha de contenido genuinamente nueva encontrada en esta fase (el
resto son afirmaciones vencidas, no temas sin cubrir). Ninguno de estos
hallazgos requiere una reescritura — son correcciones puntuales, ya
listadas con su ubicación exacta, que se consolidan como acción concreta
en `13_ROADMAP.md`.
