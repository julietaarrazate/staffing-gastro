# RECOMMENDATIONS.md — Recomendaciones estratégicas (v2, post-auditoría integral)

> Versión 2 — reemplaza las recomendaciones de la Fase 0 (sus quick wins ya
> fueron implementados y verificados). Se apoya en
> [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) (veredicto y
> puntuaciones) y [ROADMAP_IMPLEMENTATION.md](./ROADMAP_IMPLEMENTATION.md)
> (plan por fases R0–R4).

## 1. Para salir al mercado: menos es más

La app ya tiene **más producto del que necesita una beta** (swipe, mapa, chat
en vivo, reseñas, gamificación visual). Lo que la separa del mercado no son
features: es **operación**. Recomendación central:

> **Congelar features nuevas hasta cerrar R0+R1** (DB durable, CI, Sentry,
> sesiones revocables, decisión de `quantity`). Son ~1–2 semanas y convierten
> la demo en un negocio que no pierde datos ni usuarios.

La única excepción razonable es Mapas F1–F3 (ya diseñado y aprobado), porque es
el diferencial visible del producto — puede correr **en paralelo** sin tocar
backend.

## 2. Lanzamiento por etapas (no big bang)

1. **Hoy — demo comercial:** el deploy actual sirve para mostrar a inversores y
   comercios piloto (con las cuentas demo). No requiere nada.
2. **Beta cerrada (post R0+R1):** 3–5 comercios reales + 20–50 trabajadores en
   1–2 barrios de CABA (Palermo primero: densidad gastronómica). El radio de
   25 km del matching ya sobra. Seed demo apagado, datos reales.
3. **Beta abierta (post R2):** paginación y N+1 resueltos, métricas de
   reputación reales — el marketplace ya "aprende".
4. **Escala (R4):** sólo cuando el tráfico lo pida, con ADRs.

## 3. Decisiones de producto que no puede tomar el código

Estas tres necesitan definición del negocio **antes de la beta cerrada**:

- **`quantity`**: ¿un turno = una persona (capar YA, honesto y barato) o
  soportar cuadrillas (asignación múltiple, más valor para eventos pero ~1
  semana de trabajo)? Recomendación: **capar a 1 para la beta**,
  multi-asignación en R2/R3 con ADR.
- **Pagos**: la beta puede vivir con "pago fuera de la app + marcar pagado"
  (como hoy). MercadoPago recién cuando haya liquidez real de turnos (R4) —
  integra costos regulatorios que una beta no amortiza.
- **Reglas de reputación**: definir umbrales de insignias/niveles y qué
  penaliza una cancelación (hoy son datos inertes). Sin esto, el matching
  pondera números que nunca cambian.

## 4. Higiene de ingeniería permanente

- **CI primero, todo lo demás después** (R0.3): con auto-deploy a producción
  desde `main`, cada PR sin gates es una ruleta.
- **Un ADR por decisión de infraestructura** (sesiones revocables, Redis,
  multi-asignación, pagos): ya es principio del repo; mantenerlo.
- **Doc↔código sincronizados**: la auditoría detectó y corrigió una
  inconsistencia (índices en DATABASE.md); mantener la regla de frenar cuando
  código y doc difieren.
- **Orquestación de modelos** (operativa de desarrollo con IA): usar el modelo
  grande sólo para arquitectura, síntesis y revisión; delegar implementación
  mecánica y auditorías de área a modelos medianos con instrucciones precisas y
  verificación central de gates. Es el esquema con el que se produjo esta
  auditoría.

## 5. Qué NO hacer ahora

- ❌ Microservicios, colas, Kafka, Kubernetes — la arquitectura modular actual
  escala de sobra para los próximos 2 órdenes de magnitud.
- ❌ Redis "por las dudas" — recién con 2+ workers (R4, con señal real).
- ❌ Apps nativas — la PWA cubre la beta; nativo es decisión post
  product-market-fit.
- ❌ Más gamificación visual sin lógica detrás — primero R2.4 (métricas
  reales), después brillo.
