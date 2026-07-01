# REPUTATION.md — Reputación (dominio)

> Cómo se construye y usa la confianza en Staffya. Se apoya en
> [Review](./DOMAIN.md#review--review) y alimenta [MATCHING.md](./MATCHING.md).

## Por qué importa

La reputación es la **moneda del marketplace**: hace que elegir (comercio) y ser
elegido (trabajador) sea seguro, y reemplaza al "boca a boca" informal. Es
bidireccional: comercio y trabajador se califican mutuamente.

## Reseñas (`Review`)

- **Cuándo:** sólo sobre turnos **cerrados** (`finalizado` o `pagado`).
- **Quién:** el comercio y el trabajador **asignado** al turno.
- **Qué:** una calificación de **1 a 5** y un comentario opcional.
- **Unicidad:** una sola reseña por usuario por turno.
- **Efecto:** cada reseña **recalcula el rating promedio** del calificado y le
  genera una notificación (`review_received`).

## Métricas de reputación

### Trabajador
- `rating` — promedio de reseñas recibidas (impacta el matching).
- `punctuality_rate` — tasa de puntualidad.
- `events_completed` — trabajos completados.
- `cancellations` — cancelaciones.
- `badges` — insignias (catálogo `WorkerBadge`): `nunca_falto`, `top_mozo`,
  `top_bartender`, `eventos_premium`, `perfil_verificado`.
- `level` — nivel de gamificación (`bronce`, `plata`, `oro`, `platino`).

### Comercio
- `rating` — promedio de reseñas recibidas.
- `on_time_payment_rate` — tasa de pago a tiempo.
- `events_published` — turnos publicados.

## Reglas de negocio

- La reputación es **consecuencia del comportamiento**, no editable a mano.
- El **rating** se actualiza automáticamente con cada reseña.
- La reputación del trabajador **influye directamente en el score de matching**
  (peso 0.25 por reputación + 0.15 por puntualidad + 0.15 por desempeño).

## Inconsistencias a resolver

> Estas brechas deben cerrarse (definir reglas o marcar explícito lo pendiente):
>
> 1. **Insignias y niveles sin lógica de otorgamiento.** El catálogo de
>    `WorkerBadge` y los `GamificationLevel` existen, pero no hay reglas que las
>    asignen ni suban de nivel automáticamente. Hoy son presentacionales.
> 2. **Métricas derivadas sin fuente clara.** Sólo el `rating` se recalcula (por
>    reseñas). `punctuality_rate`, `events_completed`, `cancellations` y
>    `on_time_payment_rate` **no tienen aún un cálculo automático** a partir del
>    ciclo del turno (check-in a tiempo, no-shows, pagos). Debe definirse cómo y
>    cuándo se actualizan.
>
> Propuesta: derivar puntualidad/desempeño del ciclo de vida del turno (asistencia
> y cierres) y otorgar insignias/niveles por umbrales; documentarlo en
> `BUSINESS_RULES.md` y, si cambia el modelo, con un ADR.
