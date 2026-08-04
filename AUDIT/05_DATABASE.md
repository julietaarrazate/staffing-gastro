# 05 — Base de datos

> Fase 5 de la auditoría OÍDO. Cubre: modelo, constraints, FK, índices,
> migraciones, tipos, normalización, transacciones, consistencia.
> Metodología: lectura directa de las 21 migraciones reales de
> `backend/alembic/versions/` contra lo que documenta
> [`docs/DATABASE.md`](../docs/DATABASE.md). No se repite lo ya cubierto en
> `04_PERFORMANCE.md` (índices faltantes, `CHECK` faltantes, commit por
> repositorio) — se referencia. Sin cambios de código.

## 1. `docs/DATABASE.md` documenta 10 migraciones; existen 21

La tabla de migraciones de `docs/DATABASE.md:30-41` llega hasta `0010`
(`refresh_sessions`, ADR-0002). El repo real tiene **21**
(`01_INVENTORY.md §2`). Las 11 no documentadas:

| Revisión | Tabla / cambio | Motivo (ADR/feature) |
|---|---|---|
| `0011` | `subscriptions` | ADR-0005 (suscripciones Fase 1) |
| `0012` | `password_reset_tokens` | Recuperación de contraseña |
| `0013` | `push_subscriptions` | Web Push / VAPID |
| `0014` | no-show + cancelación tardía (columnas) | ADR-0007 |
| `0015` | `idempotency_keys` | Idempotencia en mutaciones críticas |
| `0016` | `notification_link` (columna) | Notificaciones con deep-link a pantalla |
| `0017` | agrupación de turnos por evento (`event_id`/`event_name`) | Publicación masiva por evento |
| `0018` | `company_profiles.payments_recorded` | Reputación real del comercio |
| `0019` | `shifts.checkin_reminder_sent_at` | Scheduler de recordatorio de check-in |
| `0020` | métrica de cobertura del turno | Panel admin, tiempo real de cobertura |
| `0021` | `shifts.escalated_at` | ADR-0009 (escalada automática de urgencia) |

Es una brecha de documentación pura, no de esquema — cada migración
individual está bien escrita (ver §3), simplemente nadie actualizó la
tabla resumen de `DATABASE.md` en los últimos ~11 cambios de esquema. Se
prioriza en `13_ROADMAP.md` como quick win (transcribir la tabla real, bajo
esfuerzo).

## 2. `docs/DATABASE.md §Inconsistencias/pendientes` tiene 2 afirmaciones vencidas

1. **`quantity` "decisión de producto pendiente"** — `DATABASE.md:57-63`
   describe la mitigación R1.4 (`quantity` capado a 1) pero cierra diciendo
   "cubrir varios cupos... decisión de producto pendiente". **Ya no está
   pendiente**: [ADR-0003](../docs/adr/ADR-0003-quantity-single-assignment.md)
   (2026-07-02) decide "un turno = una persona, para siempre" — la
   multi-asignación **no se va a construir**. Mismo hallazgo que
   `02_ARCHITECTURE.md §5` para la capa de dominio; acá aplica a la capa de
   datos: el propio ADR-0003 dice que `quantity` **se elimina del modelo en
   la próxima migración que toque `shifts` por otro motivo** — no ocurrió
   todavía (verificado: `quantity` sigue en el modelo, ninguna de las
   migraciones `0011`-`0021` la toca), lo cual es consistente con lo que
   dice el propio ADR ("no amerita una migración dedicada" sólo para eso).
2. **"DB de Render (free) expira a los 90 días. Migración a Neon
   prevista"** — vencida. Confirmado migrada y verificada en producción el
   2026-07-23 (`CLAUDE.md`, `docs/INCIDENTE_2026-07-23_BACKEND_CAIDO.md`).
   Mismo hallazgo que `02_ARCHITECTURE.md §1` y `04_PERFORMANCE.md §3` para
   `ARCHITECTURE.md`/`SCALABILITY_REPORT.md` — es el tercer documento que
   arrastra esta misma frase desactualizada. Se prioriza en
   `13_ROADMAP.md` como un solo quick win que corrija las tres menciones a
   la vez (buscar "expira a los 90 días"/"DB de Render" en todo `docs/`).

## 3. Migraciones nuevas (`0011`-`0021`) — calidad verificada, buena higiene

Se revisó `sa.ForeignKey`/`unique=True`/`create_index`/`UniqueConstraint`
en las migraciones de tablas nuevas (`0011`, `0012`, `0013`, `0015`):
todas usan `ForeignKey(..., ondelete="CASCADE")` consistente con el resto
del esquema, `id` como UUID, e índices explícitos — `subscriptions` con
`ix_subscriptions_company_id` **único** (correcto: una suscripción activa
por comercio), `password_reset_tokens`/`push_subscriptions`/
`idempotency_keys` con índice único adicional sobre su campo de
deduplicación natural (hash de token / endpoint / clave de idempotencia).
**No hay regresión de calidad respecto a las migraciones `0001`-`0010`** —
el patrón se mantuvo sin degradarse a medida que el equipo (o el agente)
cambió entre features.

**Lo que sigue sin existir, en ninguna migración, vieja o nueva:** ningún
`CheckConstraint` más allá del único que ya señalaba
`docs/PERFORMANCE_REPORT.md §2.2` (`ck_reviews_rating_range`). Las tablas
nuevas con campos numéricos/de rango (`subscriptions.period_start/end`,
`idempotency_keys.response_status`) tampoco suman `CHECK` — mismo patrón
(validación sólo en dominio Python), mismo veredicto que ya dio
`PERFORMANCE_REPORT.md`: riesgo bajo mientras todo el acceso pase por el
dominio, red de seguridad barata de agregar cuando se decida tocar el
esquema por otro motivo. No se repite la lista completa acá.

## 4. Normalización — un caso deliberado de desnormalización, ya documentado

`worker_profiles.skills` es `JSON` (lista de `WorkerSkill`), no una tabla
puente `worker_skills (worker_profile_id, skill)`. Es la raíz de que el
filtro de habilidad no pueda indexarse con un índice B-tree normal (ya
analizado en `04_PERFORMANCE.md`/`PERFORMANCE_REPORT.md` P4, no se repite
el análisis de performance acá). Desde el ángulo de **modelo de datos**: es
una desnormalización razonable para un array pequeño y de bajo cambio
(catálogo cerrado de \~5-8 skills), el tipo de caso donde JSON es
defendible en vez de una tabla N-N — el costo (filtro en Python) es
conocido, medido y aceptado, no un descuido.

## 5. Transacciones y consistencia

Remite a `04_PERFORMANCE.md §1.5`/`PERFORMANCE_REPORT.md §1.5` (commit por
repositorio en vez de por caso de uso) — es el hallazgo de consistencia más
relevante del área y ya está bien diagnosticado ahí, con ejemplo concreto
(`ShiftService.assign_worker`) y solución propuesta (`Unit of Work`
explícito o mover el commit a la capa `api/`). No se duplica acá.

## 6. Tests — sin base real, con las salvedades ya conocidas

`backend/tests/conftest.py` crea el esquema con SQLite en memoria
(`Base.metadata.create_all`), no contra Postgres real — implica que
**ningún `CHECK`/`UniqueConstraint` específico de dialecto Postgres se
verifica en CI** (SQLite es más permisivo con tipos; por ejemplo, no
impone las mismas garantías de `JSON`/`UUID` nativos que Postgres). Es una
decisión de velocidad de test bien conocida y aceptada en todo el repo
(`docs/TESTING.md`), no un hallazgo nuevo — se deja anotado porque OÍDO
pide "consistencia" como ítem explícito de checklist: la consistencia
**declarada** (constraints en la migración) puede no ser exactamente la
consistencia **testeada** (SQLite), aunque en la práctica los tipos usados
(`String`, `Integer`, `DateTime`, `UUID`, `JSON`) se comportan igual en
ambos motores para los casos de uso actuales.

## 7. Veredicto de esta fase

El esquema es sólido y consistente: FKs correctas con política de borrado
explícita, índices en las columnas de filtro reales, unicidad aplicada a
nivel de base (no sólo de aplicación) donde importa (email, postulación
duplicada, reseña duplicada, suscripción por comercio). El único patrón
sistemático ausente son los `CHECK` de rango numérico/fecha, de riesgo bajo
dado que el 100% del acceso a datos pasa por el dominio hoy. El problema
real de esta fase es el mismo que ya venía apareciendo en fases
anteriores: **la documentación (`DATABASE.md`) no siguió el ritmo del
código** — 11 migraciones sin registrar y dos afirmaciones vencidas
(`quantity` "pendiente", DB de Render). Ninguno de los dos es un problema
de datos; ambos son de higiene documental, ya capturados como acción
concreta en `13_ROADMAP.md`.
