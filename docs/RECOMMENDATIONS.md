# RECOMMENDATIONS.md — Recomendaciones estratégicas (Fase 0)

> Cierre de la auditoría: qué hacer y en qué orden, alineado al **Master
> Implementation Plan**. Basado en [AUDIT_REPORT.md](./AUDIT_REPORT.md) y
> [TECH_DEBT.md](./TECH_DEBT.md).

## Principio rector

Staffya tiene un **núcleo sano** (dominio + arquitectura) y una **presentación en
transición**. La recomendación central: **consolidar antes de expandir.** Cerrar
la deuda de diseño y endurecer para producción antes de sumar verticales o IA.

## Riesgos principales (atender primero)

1. 🔴 **Pérdida de datos por expiración del Postgres de Render (90 días).** Es el
   riesgo más grave y de causa externa. **Migrar a Neon ya** (no depende de
   ninguna fase; hacerlo cuanto antes).
2. 🔴 **Secreto JWT por defecto.** Si algún entorno arranca sin setear
   `JWT_SECRET_KEY`, la seguridad se cae. Blindar con validación (ver
   [QUICK_WINS.md](./QUICK_WINS.md) #1).
3. 🟠 **Deuda de diseño duplicada** (dos sistemas de componentes/estilos): cada
   pantalla nueva la multiplica. Cerrar la migración antes de rediseñar más.

## Orden recomendado sobre el master plan

El master plan es sólido. Ajustes de ejecución sugeridos:

- **Adelantar 2 quick wins de seguridad** (secret JWT + rate limit login) y la
  **migración a Neon** aunque formalmente sean de fases posteriores: son baratos
  y mitigan riesgos reales. Requieren tu OK por tocar infra/seguridad.
- **Fase 4 (Refactor):** que su primer objetivo sea **eliminar la duplicación de
  presentación** (unificar EmptyState/PageState, migrar `SKILL_STYLES`→`SKILL_ACCENT`,
  botones inline→`Button`). Es el mayor retorno de "limpieza".
- **Fase 5–6 (Design System / UX):** gran parte ya existe (DS v2 monocromático,
  Lucide, foto-first, mapas CARTO). Formalizar la doc (BRAND/DESIGN_SYSTEM/
  COMPONENT_LIBRARY) y **terminar la propagación** a Employer y Admin (hoy el
  Worker está casi migrado; Employer parcial; Admin sin migrar).
- **Fase 8 (Calidad):** introducir **tests de frontend + E2E** (hoy inexistentes)
  antes de crecer en funcionalidad. Es la mayor brecha de calidad.
- **Fase 10 (Marketplace inteligente):** el `matching` ya tiene scoring por
  factores; el paso natural es sumar la **afinidad histórica** (requiere historial
  de asignaciones) y ranking dinámico — encaja sin reescribir el dominio.
- **Fase 12 (Pagos):** desbloquea el placeholder de `payment`; alto valor de
  negocio pero con dependencia externa (MercadoPago) — planificar bien el flujo
  financiero y los estados.

## Qué NO hacer todavía

- No introducir **Redis/colas/PostGIS/microservicios** hasta que el volumen lo
  justifique (Fase 13). Mantener la simplicidad (principio #10).
- No sumar **IA/pagos/verticales** sobre una base con deuda de diseño y sin tests
  de frontend: consolidar primero.
- No cambiar decisiones arquitectónicas sin **ADR** (Fase 10 del plan de docs
  original / registro de decisiones).

## Métrica de éxito de la consolidación

Antes de pasar a expansión (IA/pagos/verticales), idealmente:
- Un solo sistema de componentes (cero `PageState`, cero `SKILL_STYLES`, cero
  botones inline).
- Seguridad de producción básica (secret validado, rate limit, headers).
- DB migrada a Neon.
- Tests de frontend + un flujo E2E crítico (match completo).
- Lighthouse > 90 (meta de la Fase 7).
