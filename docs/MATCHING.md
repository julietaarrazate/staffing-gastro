# MATCHING.md — El Match (dominio)

> Cómo se encuentran trabajador y turno. Combina el **lado trabajador** (se
> postula) y el **lado comercio** (recomienda + asigna). Modelo en
> [DOMAIN.md](./DOMAIN.md#match--shiftapplication--asignación).

## El "match" tiene dos lados

Staffya es "Tinder para turnos": el match se materializa por la conjunción de
**dos acciones**, no por una entidad única `Match`.

1. **Lado trabajador — Postulación.** El trabajador desliza un turno abierto a la
   derecha y se **postula** (`ShiftApplication`, estado `pendiente`). Es una
   señal de interés de alta intención.
2. **Lado comercio — Asignación.** El comercio ve a sus **postulantes** y a los
   **candidatos recomendados** por el motor, y **asigna** el turno a uno. El
   trabajador **confirma** (o rechaza). Recién ahí hay match efectivo.

```
Trabajador: swipe derecha ─▶ Postulación (pendiente)
Comercio:   ve postulantes + recomendados ─▶ Asigna ─▶ Trabajador confirma ─▶ MATCH
```

## Postulación (`ShiftApplication`)

- Un trabajador se postula **una sola vez** por turno, y sólo a **turnos abiertos**.
- Al postularse, se **notifica al comercio** (`new_applicant`).
- Estados: `pendiente`, `aceptada`, `rechazada`, `retirada`.
- El comercio ve la lista de postulantes enriquecida (nombre, foto, rating).

## Motor de recomendación (scoring)

Independiente de las postulaciones, el motor **rankea candidatos** para un turno.
No persiste entidades; calcula un score puro y ordenable.

- **Elegibilidad:** el candidato debe estar **disponible** y **tener la habilidad**
  que pide el turno.
- **Factores y pesos (por defecto):**

  | Factor | Peso | Idea |
  |--------|------|------|
  | Distancia | **0.30** | más cerca, mejor (Haversine; radio máx. 25 km) |
  | Reputación (rating) | **0.25** | rating/5 |
  | Experiencia | 0.15 | años, con tope de 10 |
  | Puntualidad | 0.15 | tasa de puntualidad |
  | Desempeño | 0.15 | trabajos completados vs. cancelaciones + no-shows |

  Sin geolocalización en alguna punta, la distancia puntúa **neutral (0.5)**.
  El desempeño (`_performance_score`) es `events_completed / (events_completed
  + cancellations + 2×no_shows)`: un no-show (**[ADR-0007](./adr/ADR-0007-no-show-y-cancelacion-tardia.md)**,
  el comercio marcó "no se presentó") pesa el doble que una cancelación
  avisada — valor semilla (`NO_SHOW_PERFORMANCE_WEIGHT`) declarado ajustable.
- El resultado se ordena de mayor a menor score y se devuelve con nombre, foto y
  rating del candidato.

## Búsqueda por mapa (comercio)

Además del ranking por turno, el comercio puede **buscar trabajadores** por rol y
radio de distancia sobre un mapa (filtro + orden simple por cercanía, sin el
scoring ponderado). Respeta disponibilidad.

## Reglas de negocio

- La **reputación alimenta el match**: mejores reseñas → mejor score → más
  recomendado. Es el incentivo central del marketplace. **Verificado con un
  test de integración de punta a punta**
  (`backend/tests/test_full_shift_lifecycle.py`, batch
  `PRIMER_TURNO_REAL_SPEC.md`): el `rating` que devuelve
  `/shifts/{id}/candidates` es el real post-reseña (se lee directamente de
  `WorkerProfileModel.rating` en cada consulta, no un valor cacheado), y el
  candidato mejor calificado efectivamente ordena primero.
- La **cercanía** es el factor de mayor peso: el producto prioriza cubrir con
  gente cerca (coherente con la meta de < 10 minutos).
- El comercio tiene la **última palabra**: el motor recomienda, no asigna.

## Fuera de alcance (hoy)

- **Afinidad histórica** local↔trabajador (haber trabajado juntos antes): queda
  fuera hasta que exista historial de asignaciones. Es el paso natural del
  "marketplace inteligente" (Fase 10 del master plan).
- **Ranking dinámico / priorización automática**: futuro.

> **Nota:** para la búsqueda por mapa, el rol `bartender` incluye también el skill
> `barista` (solapamiento razonable de barra). Documentar cualquier otra
> equivalencia de roles en `BUSINESS_RULES.md` si se agregan.
