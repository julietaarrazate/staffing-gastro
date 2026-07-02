# PRODUCTION_READINESS.md — ¿Está Staffya lista para producción?

> Síntesis ejecutiva de la auditoría integral. Detalle por área en
> [AUDIT_REPORT.md](./AUDIT_REPORT.md) ·
> [SECURITY_REPORT.md](./SECURITY_REPORT.md) ·
> [TESTING_REPORT.md](./TESTING_REPORT.md) ·
> [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md) ·
> [SCALABILITY_REPORT.md](./SCALABILITY_REPORT.md) ·
> [TECH_DEBT.md](./TECH_DEBT.md). Plan de acción en
> [ROADMAP_IMPLEMENTATION.md](./ROADMAP_IMPLEMENTATION.md).

## Veredicto

**NO está lista para un lanzamiento comercial con usuarios reales — pero está
sorprendentemente cerca, y lista HOY para una beta demo controlada.**

La distancia a producción no es de meses de refactor: la arquitectura (88/100)
y el producto worker (78/100) están sanos. Lo que falta es **operación**: red
de seguridad de deploy (CI), durabilidad de los datos (DB que expira),
visibilidad (observabilidad casi nula) y el cierre de 3–4 brechas de seguridad
puntuales. Es trabajo de **1–3 semanas enfocadas**, no de rehacer nada.

## Puntuaciones por área

| Área | Puntaje | Lectura corta |
|------|:-------:|---------------|
| Arquitectura (DDD/hexagonal) | **88** | El activo más fuerte: módulos limpios, cero acoplamiento entre dominios |
| APIs | **85** | Consistentes, versionadas, no-disclosure sistemático |
| Backend | **80** | Servicios/repos prolijos; falta paginación y hay N+1 puntuales |
| Tiempo real | **80** | WS autenticados con reconexión; en memoria (1 worker) |
| Producto — Worker | **78** | Flujo completo y con onda; el swipe/map/check-in funcionan |
| Frontend | **75** | DS unificado post-quick-wins; accesibilidad a medias |
| Producto — Employer | **70** | Wizard y postulantes bien; gestión post-asignación mejorable |
| Geolocalización | **65** | Funciona (Haversine + check-in geo); rediseño MapLibre ya diseñado |
| Seguridad | **62** | Base sólida + endurecimiento reciente; faltan revocación, CSP, seed demo |
| Performance | **58** | Queries individuales bien; N+1 en chat/postulantes, matching full-scan, sin paginación |
| Producto — Admin | **55** | Moderación básica; suficiente para beta |
| Testing | **48** | 82 tests de integración verdes, pero sin CI, sin frontend, sin unit del matching |
| Escalabilidad | **45** | Diseño escala, deploy no: 1 worker, WS/rate-limit en memoria, DB con vencimiento |
| DevOps | **45** | Auto-deploy sin gates, sin staging, sin backups/rollback |
| Observabilidad | **30** | Healthcheck + logs de Render; sin errores capturados ni métricas |

**Global ponderado: ~65/100** — "beta sólida, producción no todavía".

## Fortalezas

1. **Arquitectura hexagonal real** — no de PowerPoint: capas respetadas,
   cruces por repos inyectados, migraciones disciplinadas. Escalar equipo acá
   es barato.
2. **Producto worker diferenciado** (swipe + mapa + check-in geolocalizado +
   chat en vivo) con Design System propio coherente.
3. **Ciclo de negocio completo de punta a punta**: publicar → postular →
   asignar → confirmar → asistir → cerrar → pagar (registro) → reseñar, todo
   con notificaciones en tiempo real.
4. **Higiene reciente verificada**: JWT blindado en prod, rate limiting,
   security headers, suite verde (82 tests), gates tsc/build.

## Debilidades / Riesgos (los que deciden el go/no-go)

| # | Riesgo | Severidad | Detalle |
|---|--------|-----------|---------|
| 1 | **DB de Render expira a los 90 días** | 🔴 Crítica | Pérdida total de datos por calendario, no por tráfico. Migrar a Neon **ya**. |
| 2 | **Cero CI con auto-deploy a producción** | 🔴 Crítica | Cualquier commit roto en `main` llega a usuarios. Un workflow de GitHub Actions lo frena. |
| 3 | **Seed demo en producción** | 🔴 Crítica al lanzar | ~24 cuentas con contraseña pública conocida en la DB productiva. Correcto para la demo de hoy; **apagar y purgar antes de usuarios reales**. |
| 4 | **Refresh tokens irrevocables 30 días + localStorage sin CSP** | 🟠 Alta | Un robo de token no se puede cortar. Modelo de sesión + logout server-side (ADR). |
| 5 | **Observabilidad casi nula** | 🟠 Alta | Un 500 en producción hoy es invisible. Sentry + logging estructurado con request_id. |
| 6 | **`quantity > 1` no funciona de verdad** | 🟠 Alta (producto) | Un turno puede pedir 10 personas pero solo se asigna 1. O se capa la UI a 1, o se implementa asignación múltiple. Engaña al comercio tal como está. |
| 7 | N+1 (chat inbox, postulantes) + matching full-scan + sin paginación | 🟡 Media | Invisible con datos demo; duele con los primeros cientos de usuarios. |
| 8 | WS y rate limit en memoria | 🟡 Media | Solo bloquea al escalar a 2+ workers (Redis + ADR entonces). |
| 9 | Métricas de reputación inertes (solo `rating` se actualiza) | 🟡 Media | El matching pondera datos que nunca cambian; la gamificación es decorativa. |

## Qué falta exactamente para producción (checklist go-live)

1. ☐ Migrar DB a Neon + backup automatizado (R0).
2. ☐ CI en GitHub Actions: `pytest` + `tsc` + `build` bloqueando PR (R0).
3. ☐ Apagar `SEED_DEMO_DATA` en prod / rotar credenciales demo (al lanzar).
4. ☐ Sentry + logging estructurado + request_id (R1).
5. ☐ Logout server-side + revocación de refresh (ADR de sesión) + CSP (R1).
6. ☐ Decisión de producto sobre `quantity`: capar a 1 o multi-asignación (R1).
7. ☐ Paginación en listados + fix N+1 de chat/postulantes + matching filtrado
   en SQL (R2).
8. ☐ Tests unitarios del scoring + 3–4 E2E Playwright de flujos críticos (R1–R2).

Con 1–6 cerrados, Staffya puede recibir **usuarios reales en una beta abierta**.
7–8 acompañan el crecimiento. El detalle con esfuerzo/dependencias está en
[ROADMAP_IMPLEMENTATION.md](./ROADMAP_IMPLEMENTATION.md).
