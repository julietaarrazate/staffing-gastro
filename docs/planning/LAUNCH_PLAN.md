# LAUNCH_PLAN.md — Re-baseline de production-readiness + plan de beta cerrada

> Síntesis de orquestador, 2026-07-02. Re-evalúa el veredicto de
> [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) (que quedó viejo: fue
> escrito **antes** de mergear todo R0–R3) y baja a un plan concreto y
> secuenciado para abrir la **beta cerrada en Palermo**. No reemplaza al
> roadmap ([ROADMAP_IMPLEMENTATION.md](./ROADMAP_IMPLEMENTATION.md)); lo
> traduce a una decisión de lanzamiento.

## Veredicto actualizado

> **2026-08-15 — sin bloqueantes.** Los 2 ítems de la tabla de abajo ya
> están resueltos (Neon+Sentry confirmados por Julieta; `SEED_DEMO_DATA`
> apagado desde el 06-08). El puntaje re-baseado de este doc es del
> 2026-07-02 — quedó viejo (150+ PRs desde entonces). Para el estado
> técnico ACTUAL, ver las auditorías más recientes:
> `docs/audits/2026-08-oido/ROADMAP.md` (13/08) y
> `docs/audits/2026-08-15-delta-superficie-nueva.md` (15/08, todos sus
> hallazgos F1-F5 ya resueltos). **La beta arrancó (fase B1) el
> 2026-08-15** — reclutamiento de comercios/trabajadores reales en
> Palermo, en curso.

**Staffya está lista para una beta cerrada con usuarios reales acotados,
apenas Julieta confirme dos cosas operativas (Neon + apagar seed).** No es
"1–3 semanas de trabajo" como decía la evaluación vieja: ese trabajo **ya se
hizo** (13 PRs de endurecimiento, #46–#62). Lo que queda para el go-live no es
ingeniería, es **operación y una decisión de negocio**.

## Puntuaciones re-baseladas (qué cambió desde el ~65/100)

| Área | Antes | **Ahora** | Qué lo movió |
|------|:----:|:--------:|--------------|
| Arquitectura | 88 | **88** | sin cambios — sigue siendo el activo más fuerte |
| APIs | 85 | **86** | paginación consistente + contrato documentado |
| Backend | 80 | **85** | N+1 resueltos, matching en SQL, sesiones revocables |
| Tiempo real | 80 | **80** | igual (en memoria, 1 worker — ok para beta) |
| Producto — Worker | 78 | **82** | mapas MapLibre premium + tiempos por modo + reputación real |
| Frontend | 75 | **80** | DS v2 completo (incluye admin/employer), CSP |
| Producto — Employer | 70 | **74** | DS v2 + `quantity` honesto (ADR-0003) |
| Geolocalización | 65 | **82** | Leaflet→MapLibre vectorial, clustering, deep-link rutas |
| Seguridad | 62 | **82** | sesiones revocables (ADR-0002), CSP, JWT blindado, rate limit |
| Performance | 58 | **80** | fix N+1 chat/postulantes, paginación, matching acotado |
| Producto — Admin | 55 | **62** | DS v2; sigue básico pero suficiente para beta |
| Testing | 48 | **74** | 25 unit del scoring + 3 E2E + CI obligatorio |
| Escalabilidad | 45 | **55** | Neon (durable) resuelve el vencimiento; WS/rate-limit en memoria sigue (ok < ~1 worker) |
| DevOps | 45 | **72** | CI con 4 checks, runbooks de lanzamiento y restore |
| Observabilidad | 30 | **68** | Sentry (opcional) + logging JSON con `request_id` |

**Global ponderado: ~78/100** — de "beta sólida, producción no todavía" a
**"beta abierta lista; producción a escala pendiente sólo de R4 (con demanda)"**.

## Lo único entre hoy y la beta (2 ítems, ambos de Julieta) — ✅ ambos resueltos, 2026-08-15

| # | Qué | Quién | Bloquea |
|---|-----|-------|---------|
| 1 | ~~Confirmar que el deploy de Render quedó verde contra **Neon**~~ | Julieta | ✅ Resuelto — Neon confirmado en variables de entorno |
| 2 | ~~Apagar `SEED_DEMO_DATA` y purgar cuentas demo~~ | Julieta | ✅ Resuelto — `render.yaml` en `"false"` desde el 06-08 (#160) |

Todo lo demás (Sentry —ya encendido también—, imágenes propias, decisiones
de producto con ADR) es **mejora, no bloqueante** de la beta. Pagos
MercadoPago quedaron diferidos por decisión explícita de Julieta (no por
falta de tiempo): la beta cobra "fuera de la app + marcar pagado", como
este mismo doc ya recomendaba más abajo.

## Plan de beta cerrada — Palermo

**Por qué Palermo:** máxima densidad gastronómica de CABA → más chance de
cumplir la meta de < 10 min con pocos usuarios. El radio de matching (25 km) ya
cubre toda la ciudad; no hace falta tocar nada geográfico.

### Fase B0 — Pre-lanzamiento (Julieta, ~1 día)
1. Confirmar Neon verde (ítem 1 arriba) + `pg_dump` de respaldo inicial.
2. (Opcional pero recomendado) cargar los DSN de Sentry: sin esto, un error en
   producción sólo se ve en los logs de Render — con la beta chica es
   tolerable, pero Sentry es 5 minutos de setup y evita volar a ciegas.

### Fase B1 — Reclutamiento (semana 1)
- **3–5 comercios** piloto en Palermo (bares/cafés con rotación alta de
  eventuales). Onboarding manual: crear su cuenta employer, cargar perfil.
- **20–50 trabajadores** (mozos/bartenders/baristas). Difusión acotada
  (grupos gastronómicos, referidos). Apagar el seed demo **antes** de esto.

### Fase B2 — Operación asistida (semanas 2–4)
- Publicar turnos reales; medir la métrica que importa: **tiempo de
  publicación → cobertura** (¿se acerca a < 10 min?).
- Acompañamiento humano: estar en el chat, resolver fricción a mano, anotar
  cada punto de abandono. La beta es para **aprender el funnel**, no para
  escalar.
- Señales a vigilar para saber cuándo activar R4: si aparecen 2+ workers de
  backend por carga, o el matching se siente lento con muchos perfiles.

### Fase B3 — Decisión (fin de mes)
Con datos reales del funnel, decidir: iterar producto, o abrir beta pública
(dispara R2.4 completo — insignias ya reales — y las mejoras de conversión que
el funnel revele).

## Qué NO hacer para la beta (evitar sobre-ingeniería)
- ❌ Redis / multi-worker (R4.1): innecesario con < ~50 usuarios; se activa con
  señal real.
- ❌ Pagos MercadoPago (R4.4): la beta vive con "pago fuera de la app + marcar
  pagado". Integrar pagos antes de validar el funnel es quemar tiempo.
- ❌ Multi-ciudad / bbox (R4.2): un solo barrio es el punto.
- ❌ Apps nativas: la PWA cubre la beta.

## Riesgo residual honesto
- **WS/rate-limit en memoria**: si por éxito inesperado hubiera que subir a 2+
  workers, el realtime y el rate-limit se degradan hasta meter Redis (ADR-0004
  ya previsto). No es un problema de beta chica, sí una barrera dura de escala.
- **`cancellations`/insignias**: en implementación (ADR-0004, agente en curso)
  — no bloquea la beta, la enriquece.
- **Accesibilidad frontend a medias**: aceptable para beta; deuda para pública.
