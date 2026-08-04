# REPOSITORY_STRUCTURE.md — Estructura del repositorio

> Mapa de referencia de cómo está organizado el repo después de la
> reorganización documental del 2026-08-04. Complementa
> [`AUDIT/10_REPOSITORY.md`](docs/audits/2026-08-oido/10_REPOSITORY.md)
> (el diagnóstico que motivó este cambio) y
> [`MIGRATION_LOG.md`](./MIGRATION_LOG.md) (el detalle de cada movimiento).
> Esta reorganización fue **exclusivamente documental/estructural**: cero
> cambios de lógica de negocio, APIs, módulos del backend o nombres
> internos del código.

## Árbol de la raíz

```
.
├── .github/workflows/ci.yml   Pipeline de CI (pytest, tsc+build, Playwright)
├── .gitignore
├── .mcp.json
├── CLAUDE.md                  Guía operativa para trabajar en el repo
├── LICENSE                    Licencia propietaria — todos los derechos reservados
├── MIGRATION_LOG.md           Detalle de cada movimiento de esta reorganización
├── NOTICE                     Autoría y titularidad
├── README.md                  Punto de entrada del proyecto
├── REPOSITORY_CLEANUP.md      Resumen de limpieza (qué se sacó y por qué)
├── REPOSITORY_STRUCTURE.md    Este archivo
├── backend/                   API FastAPI — monolito modular DDD/hexagonal
├── docker-compose.yml         Entorno local (Postgres + backend)
├── docs/                      Toda la documentación del proyecto (ver abajo)
├── frontend/                  App Next.js (App Router)
└── render.yaml                Config de deploy en Render
```

## `docs/` — antes y después

**Antes:** 46 archivos `.md` en un único directorio plano, más `adr/` y
`mockups/` ya organizados aparte. Encontrar un documento requería conocer
su nombre exacto de memoria o buscar entre 46 opciones sin agrupar.

**Después:** 6 subcarpetas temáticas + los 4 documentos "vivos" que
`CLAUDE.md` manda leer primero, en la raíz de `docs/` para que sigan siendo
lo primero que se ve:

```
docs/
├── STATUS.md                          Bitácora viva — leer primero en cada sesión
├── TECH_DEBT.md                       Deuda técnica vigente, priorizada
├── BUGS.md                            Patrones de bugs ya resueltos
├── INCIDENTE_2026-07-23_BACKEND_CAIDO.md   Postmortem del incidente de DB
│
├── foundation/                        Qué es el producto y cómo está construido
│   ├── PRODUCT.md
│   ├── DOMAIN.md
│   ├── ARCHITECTURE.md
│   ├── PRINCIPLES.md
│   └── MODULES.md
│
├── design/                            Identidad visual y sistema de diseño
│   ├── ART_DIRECTION.md
│   ├── COLOR_SYSTEM.md
│   ├── TYPOGRAPHY_SYSTEM.md
│   ├── ICONOGRAPHY_SYSTEM.md
│   ├── DESIGN_TOKENS.md
│   └── BRIEF_IDENTIDAD_VISUAL.md
│
├── reference/                         Documentación técnica vigente, se corrige in-place
│   ├── API.md
│   ├── DATABASE.md
│   ├── EVENTS.md
│   ├── SECURITY.md
│   ├── TESTING.md
│   ├── DEPLOY.md
│   ├── OBSERVABILITY.md
│   ├── MATCHING.md
│   ├── SHIFT.md
│   ├── WORKER.md
│   ├── EMPLOYER.md
│   ├── CHAT.md
│   ├── REPUTATION.md
│   ├── AVAILABILITY.md
│   ├── LOCATION.md
│   ├── NOTIFICATIONS.md
│   ├── PAYMENTS.md
│   ├── ACCESO_MODERNO.md
│   └── MAPS_REDESIGN.md
│
├── audits/                            Auditorías puntuales — foto fechada, no se corrige in-place
│   ├── AUDIT_REPORT.md
│   ├── SECURITY_REPORT.md
│   ├── PERFORMANCE_REPORT.md
│   ├── PERFORMANCE_AUDIT_FRONTEND.md
│   ├── SCALABILITY_REPORT.md
│   ├── TESTING_REPORT.md
│   └── 2026-08-oido/                  Auditoría OÍDO de 13 fases (2026-08-04)
│       ├── 01_INVENTORY.md … 12_DNDA.md
│       └── ROADMAP.md
│
├── planning/                          Síntesis y plan de acción
│   ├── PRODUCTION_READINESS.md
│   ├── RECOMMENDATIONS.md
│   ├── QUICK_WINS.md
│   ├── ROADMAP_IMPLEMENTATION.md
│   ├── PULIDO_ROADMAP.md
│   └── LAUNCH_PLAN.md
│
├── adr/                                Architecture Decision Records (sin cambios)
│   └── ADR-0001 … ADR-0009
│
└── mockups/                            Mockups HTML de referencia (sin cambios)
```

## Por qué esta taxonomía

Las 6 categorías ya existían **conceptualmente** — `CLAUDE.md` agrupaba
"Fundación" e "Identidad visual" en su propio índice, y varios documentos
se autodescribían como "foto de auditoría a fecha X" (no vigentes) frente a
otros que se corrigen in-place. Esta reorganización sólo hace **física**
una categorización que ya existía en la prosa. Regla de decisión usada
para cada carpeta:

- **`foundation/`** — qué es el producto y cómo está construido a nivel
  conceptual (los 4 documentos que `CLAUDE.md` cita primero, más
  `MODULES.md`).
- **`design/`** — identidad visual, sistema de diseño, todo lo que
  consume el equipo de diseño/frontend para mantener consistencia.
- **`reference/`** — documentación técnica **vigente**, que se actualiza
  in-place cuando el código cambia (contrato de API, esquema de datos,
  seguridad, deploy, dominio por módulo).
- **`audits/`** — el opuesto de `reference/`: fotos de un momento
  específico, con fecha, que **no se corrigen** — se reemplazan por una
  siguiente ronda si hace falta. Incluye la carpeta fechada
  `2026-08-oido/` de esta misma auditoría.
- **`planning/`** — síntesis ejecutivas y hojas de ruta derivadas de las
  auditorías (veredictos, prioridades, fases de implementación).
- **`adr/`** y **`mockups/`** — sin cambios, ya estaban bien organizados.

## Qué NO cambió (fuera de alcance a propósito)

- `backend/app/modules/*` — estructura DDD/hexagonal intacta.
- `frontend/app/*` — rutas de Next.js intactas (moverlas cambiaría URLs).
- `frontend/components/`, `frontend/lib/` — sin cambios de organización.
- Ningún nombre de módulo, clase, función, endpoint o variable.
- Ningún comportamiento de negocio, performance o contrato de API.
- Las referencias a "Staffya" como nombre técnico (repo, hosts, DB,
  fixtures de test) — siguen intencionalmente sin tocar, ver
  [`REPOSITORY_CLEANUP.md`](./REPOSITORY_CLEANUP.md).
