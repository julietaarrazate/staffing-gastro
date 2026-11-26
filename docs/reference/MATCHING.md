# MATCHING.md — El Match (dominio)

> Cómo se encuentran trabajador y turno. Combina el **lado trabajador** (se
> postula) y el **lado comercio** (recomienda + asigna). Modelo en
> [DOMAIN.md](../foundation/DOMAIN.md#match--shiftapplication--asignación).

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

- Un trabajador tiene **una sola postulación** por turno, y sólo se postula a
  **turnos abiertos**. Con la postulación activa (`pendiente` o `aceptada`) no
  puede postularse otra vez.
- Si la **retiró** (o se la retiró el sistema al confirmar otro turno del mismo
  horario) puede **volver a postularse** mientras el turno siga abierto: se
  reactiva la misma postulación (vuelve a `pendiente`, con fecha nueva), no nace
  otra, así que el comercio lo ve una sola vez entre sus postulantes. Una
  `rechazada` no se reactiva por pedido del trabajador.
- Al postularse, se **notifica al comercio** (`new_applicant`), también cuando
  es una vuelta.
- Estados: `pendiente`, `aceptada`, `rechazada`, `retirada`.
- El comercio ve la lista de postulantes enriquecida (nombre, foto, rating),
  **ya ordenada por el backend** ([ADR-0031](../adr/ADR-0031-orden-de-postulantes-y-reconfirmacion.md)).

### Orden de los postulantes (ADR-0031, P2)

Lo decide `matching/domain/orden_postulantes.py` (puro) y lo arma
`MatchingService.ordenar_postulantes`; la pantalla muestra la lista como
llega. Hay dos carriles (`es_carril_urgente`): **urgente** si el comercio lo
marcó (o la escalada) o si empieza en menos de 6 horas; si no, **programado**.

- **Programado.** Cada criterio sólo desempata al anterior:
  1. confianza del local (favorita del comercio, o ya terminó un turno ahí);
  2. sin ausencias;
  3. turnos terminados en Oído **en ese puesto** (los años declarados no cuentan);
  4. cumplimiento: turnos hechos sobre hechos más cancelaciones, por la
     puntualidad, en tramos de 10 puntos (sin compromisos, neutro: 0,5);
  5. calificación, en décimas y sólo con turnos hechos que la respalden;
  6. identidad verificada;
  7. quién se postuló antes.
- **Urgente.** El orden de antes de P2, hasta que P4 defina el suyo: primero
  quien tiene turnos hechos; después calificación, puntualidad y cantidad.
- En los dos, quien tuvo el turno y lo dejó va al final (ADR-0026).

La respuesta suma `es_favorito`, `trabajo_aca`, `turnos_en_el_puesto` y
`nuevo_verificado` (el sello «Nuevo en Oído · identidad verificada»: sin
turnos hechos, verificada y sin ausencias). Las ausencias y las cancelaciones
se usan para ordenar y no salen en esa respuesta.

## Motor de recomendación (scoring)

Independiente de las postulaciones, el motor **rankea candidatos** para un turno.
No persiste entidades; calcula un score puro y ordenable.

- **Elegibilidad:** el candidato debe estar **disponible** y **tener la habilidad**
  que pide el turno, y su cuenta tiene que ser de **trabajador** y estar
  **activa** (un admin con un perfil viejo de pruebas o un suspendido no
  salen como candidatos, ni en el mapa, ni reciben el aviso de turno cerca).
- **Factores y pesos del carril urgente** (`DEFAULT_WEIGHTS`; es también el
  puntaje del aviso «Turno cerca tuyo» al publicar):

  | Factor | Peso | Idea |
  |--------|------|------|
  | Distancia | **0.30** | más cerca, mejor (Haversine; radio máx. 25 km) |
  | Reputación (rating) | **0.25** | rating/5 |
  | Experiencia | 0.15 | años, con tope de 10 |
  | Puntualidad | 0.15 | tasa de puntualidad |
  | Desempeño | 0.15 | trabajos completados vs. cancelaciones + no-shows |

  Sin geolocalización en alguna punta, la distancia puntúa **neutral (0.5)**.
- **Recomendados de un turno programado** (`PROGRAMADO_WEIGHTS`, ADR-0031): la
  distancia **sólo filtra** (peso 0, el radio sigue cortando) y su 30 % se
  reparte en experiencia comprobada (0.15: turnos terminados en Oído en ese
  puesto, con tope de 10) y desempeño (pasa a 0.30). Reputación, experiencia
  declarada y puntualidad quedan igual.
- **El radio es un límite duro** (`is_within_radius`, 2026-11-13): fuera del
  radio el candidato no entra al ranking, por bien que puntúe en lo demás.
  Antes el radio sólo puntuaba, y con pocos candidatos quien estaba a más de
  1.000 km recibía «Turno cerca tuyo» y salía como recomendado. Los radios
  son constantes del dominio (`matching/domain/value_objects.py`):
  **25 km** (`DEFAULT_MAX_RADIUS_KM`) para el primer aviso y para los
  recomendados que ve el comercio, **40 km** (`ESCALATION_RADIUS_KM`) para
  la escalada a urgente. Cuando no hay distancia que medir (el trabajador no
  tiene ubicación o el turno no tiene coordenadas) cuenta sólo si la
  **ciudad** coincide, sin mayúsculas ni tildes (`app/core/geo.py::same_city`);
  sin ciudad en alguna de las dos puntas, no cuenta. Un turno publicado sin
  zona (ni coordenadas ni ciudad) se mide desde el local del comercio
  (`shift/domain/nearby.py::zone_of`), acá y en el feed. Vale también para los
  favoritos del comercio: el aviso dice «cerca tuyo». El corte usa la misma
  distancia con la que se puntúa: para el comercio, la pública (pin
  desplazado), nunca la real.
  El desempeño (`_performance_score`) es `events_completed / (events_completed
  + cancellations + 2×no_shows)`: un no-show (**[ADR-0007](../adr/ADR-0007-no-show-y-cancelacion-tardia.md)**,
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
