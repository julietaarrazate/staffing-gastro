# 10 — Repositorio

> Fase 10 de la auditoría OÍDO. Mandato: reorganizar para que el repo
> "parezca un proyecto mantenido por una empresa de software" —
> documentación, carpetas, nombres inconsistentes, referencias viejas
> (tmp/backup/demo/experimentos). **No se ejecuta ninguna reorganización en
> esta fase** (mandato explícito de mantener historial y no romper nada
> hasta el plan de acción de `13_ROADMAP.md`); esta fase diagnostica y
> propone. Sin cambios de código.

## 1. Veredicto general: el repo ya se ve profesional

Comparado contra el checklist del mandato (nombres poco profesionales,
referencias a "experimentos"/"tmp"/"backup"/"viejo"/"demo" fuera de lugar,
archivos inconsistentes): **no se encontró prácticamente nada que
corregir**. `09_CLEANUP.md` ya confirmó cero archivos de backup/temporales
versionados. La raíz del repo es mínima y estándar (`README.md`,
`LICENSE`, `CLAUDE.md`, `docker-compose.yml`, `render.yaml`, `.mcp.json`,
`.gitignore`, más `backend/`/`frontend/`/`docs/`) — nada de carpetas
sueltas tipo `old/`, `misc/`, `v2/`. `backend/app/` sólo tiene `main.py` +
`__init__.py` en su raíz, todo lo demás vive ordenadamente en
`modules/`/`core/`. No hay nombres de archivo tipo `helper2.py`,
`final.tsx`, `misc.ts` en ningún lado del código fuente.

Las únicas menciones a "demo" en el repo son **intencionales y
documentadas** (`SEED_DEMO_DATA`, `seed_demo_data.py`) — no son residuos
de desarrollo, son una feature real (poder probar la app sin registrarse).
No se tocan acá; su implicancia de seguridad ya se cubrió en
`03_SECURITY.md §2`.

## 2. La dualidad `staffya`/`Oído` es intencional — no es un hallazgo de esta fase

Ya documentado con evidencia completa en `01_INVENTORY.md §0`: el nombre
de marca (`Oído`) y el nombre técnico (`staffya`, en repo, hosts, DB,
variables) coexisten a propósito, y `CLAUDE.md` **prohíbe explícitamente**
tocar el nombre del servicio de Render (rompería la app en producción). Se
reitera acá sólo para que quede claro que esta fase **no propone** ningún
find-and-replace de `staffya`→`oido` en código/infra — sería contradecir
una instrucción explícita del propio repo. Lo único potencialmente
mejorable sin ese riesgo es cosmético y de cara afuera: `README.md`
(cubierto en `11_DOCUMENTATION.md`) y el nombre visible del repositorio en
GitHub (`staffing-gastro` — fuera del alcance de esta auditoría de
código, es configuración de la organización de GitHub, no del repo en sí).

## 3. `docs/` — 46 archivos en un solo directorio plano, candidato real a reorganizar

Es el hallazgo más concreto de esta fase. `docs/` tiene 46 archivos `.md`
en su raíz (más `docs/adr/` con 9 ADRs y `docs/mockups/` con 1 HTML, esos
dos ya están bien organizados en subcarpetas). Para alguien nuevo —
inversor, auditor externo, desarrollador que se suma— 46 archivos al mismo
nivel, sin agrupar, es el tipo de cosa que hace que un repo técnicamente
sano **se sienta** desprolijo, aunque no lo sea. Clasificación de lo que
hay hoy (diagnóstico, no ejecutado):

| Categoría propuesta | Archivos (46 total) |
|---|---|
| **Fundación** (ya listada así en `CLAUDE.md`) | `PRODUCT`, `DOMAIN`, `ARCHITECTURE`, `PRINCIPLES` |
| **Identidad visual** (ya listada así en `CLAUDE.md`) | `ART_DIRECTION`, `COLOR_SYSTEM`, `TYPOGRAPHY_SYSTEM`, `ICONOGRAPHY_SYSTEM`, `DESIGN_TOKENS`, `BRIEF_IDENTIDAD_VISUAL` |
| **Referencia técnica por área** (diseño vigente, se actualiza in-place) | `API`, `DATABASE`, `EVENTS`, `SECURITY`, `TESTING`, `DEPLOY`, `OBSERVABILITY`, `MATCHING`, `SHIFT`, `WORKER`, `EMPLOYER`, `CHAT`, `REPUTATION`, `AVAILABILITY`, `LOCATION`, `NOTIFICATIONS`, `PAYMENTS`, `MODULES`, `ACCESO_MODERNO`, `MAPS_REDESIGN` |
| **Auditorías puntuales** (foto fechada, no se actualiza in-place, se reemplaza por una v-siguiente) | `AUDIT_REPORT`, `SECURITY_REPORT`, `PERFORMANCE_REPORT`, `PERFORMANCE_AUDIT_FRONTEND`, `SCALABILITY_REPORT`, `TESTING_REPORT` |
| **Síntesis y plan** | `PRODUCTION_READINESS`, `RECOMMENDATIONS`, `QUICK_WINS`, `ROADMAP_IMPLEMENTATION`, `PULIDO_ROADMAP`, `LAUNCH_PLAN` |
| **Operativo/bitácora** | `STATUS`, `TECH_DEBT`, `BUGS`, `INCIDENTE_2026-07-23_BACKEND_CAIDO` |

La distinción entre "referencia técnica" (vigente, se corrige in-place) y
"auditoría puntual" (foto de un momento, con fecha, no se corrige, se
reemplaza) **ya existe implícitamente** en cómo está escrito cada
documento (varios de los `_REPORT.md` se auto-declaran como "foto de
auditoría a fecha X" en su propio encabezado) — el problema no es la
convención, es que no está **visible en la estructura de carpetas**, sólo
en la prosa de cada archivo.

**Propuesta para `13_ROADMAP.md` (no ejecutada acá):** subcarpetas
`docs/reference/` (la fila 3), `docs/audits/` (la fila 4) y
`docs/planning/` (la fila 5), dejando `docs/` raíz sólo con fundación +
identidad visual + bitácora operativa (que son los documentos que
`CLAUDE.md` manda leer primero) + `adr/`/`mockups/` ya existentes. Es un
`git mv` masivo con actualización de links relativos entre docs — mayor
esfuerzo que cualquier otro hallazgo de esta auditoría por el volumen de
links a corregir (46 archivos que se referencian entre sí constantemente),
pero mecánico y de bajo riesgo real (no toca código de producto).

## 4. Nombre de módulo `application` — ambigüedad menor, ya señalada en `01_INVENTORY.md`

`backend/app/modules/application/` (postulaciones del trabajador) comparte
nombre con el concepto genérico "aplicación" (la app entera) y con la capa
`application/` que **cada módulo tiene por convención DDD**
(`modules/<x>/application/services.py`). No es un bug ni genera colisión
de imports (los paths completos son inequívocos:
`app.modules.application.application.services` es válido y sin ambigüedad
real para Python), pero sí es fricción de lectura para quien recorre el
árbol por primera vez. Alternativas más claras (`applications`,
`postulaciones`, `job_applications`) existen, pero renombrar un módulo
completo (carpeta + todos los imports + tabla de DB si el nombre se refleja
ahí + migraciones ya escritas referenciando el módulo en comentarios) es
un cambio grande para un beneficio puramente de legibilidad — se deja como
ítem de esfuerzo medio, prioridad baja en `13_ROADMAP.md`, no urgente.

## 5. Veredicto de esta fase

El repositorio **ya parece mantenido por un equipo profesional**: sin
residuos, sin nombres descuidados, con una convención de documentación
coherente (aunque no reflejada en subcarpetas). El único cambio
estructural que vale la pena considerar es reorganizar `docs/` en
subcarpetas temáticas — no por higiene (no hay archivos "sucios"), sino
por **navegabilidad** para un lector externo, que es exactamente lo que
pide el mandato de esta fase ("que parezca... fácil de auditar"). Se dejan
0 acciones ejecutadas y 2 propuestas concretas para `13_ROADMAP.md`
(subcarpetas de `docs/`, y considerar el renombre de `application` en un
momento de baja actividad).
