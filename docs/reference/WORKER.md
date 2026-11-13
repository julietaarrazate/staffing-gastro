# WORKER.md — El Trabajador (dominio)

> Comportamiento de negocio del **trabajador eventual**. Modelo en
> [DOMAIN.md](../foundation/DOMAIN.md#worker--workerprofile); reputación en
> [REPUTATION.md](./REPUTATION.md); disponibilidad en
> [AVAILABILITY.md](./AVAILABILITY.md); ubicación en [LOCATION.md](./LOCATION.md).
> Describe **reglas del dominio**, no implementación.

## Qué es

El trabajador (`worker`) es la persona que ofrece su trabajo por turno: mozo,
bartender, barista, cocinero, runner, cajero, recepcionista, personal de eventos,
ayudante de cocina, personal de salón. Es la **oferta** del marketplace.

## Perfil

Un trabajador tiene un **perfil** (uno solo por cuenta) con:
- **Identidad y presentación:** foto, nombre, bio.
- **Aptitudes:** una o más habilidades (`WorkerSkill`), años de experiencia,
  idiomas, certificaciones, CV.
- **Ubicación:** zona (ciudad/barrio) y coordenadas (ver LOCATION).
- **Disponibilidad:** disponible / no disponible (ver AVAILABILITY).
- **Reputación:** rating, puntualidad, trabajos completados, cancelaciones,
  insignias y nivel (ver REPUTATION).

**Regla:** para postularse o ser asignado, el trabajador **debe tener el perfil
creado**.

## Qué puede hacer

1. **Ver oportunidades** cerca suyo (feed tipo Tinder y mapa) — sólo turnos
   abiertos (ver [SHIFT.md](./SHIFT.md)) y a 40 km o menos de la zona de su
   perfil; para mirar otras zonas está Buscar, que muestra todo
   (ver [LOCATION.md](./LOCATION.md)).
2. **Postularse** a un turno (swipe derecha) → crea una postulación
   (ver [MATCHING.md](./MATCHING.md)). Tiene **una sola postulación por turno**;
   puede **retirarla** y, si el turno sigue abierto, **volver a postularse**.
3. **Descartar** un turno (swipe izquierda) — acción local, sin efecto de negocio.
4. **Marcar disponibilidad** (disponible/no).
5. Una vez **asignado** por un comercio: **confirmar** o **rechazar** el turno.
6. Durante el turno confirmado: **salir hacia el turno**, **check-in** (con
   ubicación), **empezar a trabajar**, **check-out** (con ubicación).
7. **Chatear** con el comercio del turno asignado (ver [CHAT.md](./CHAT.md)).
8. **Calificar** al comercio al cerrarse el turno (ver [REPUTATION.md](./REPUTATION.md)).

## Reglas de negocio

- **Elegibilidad:** un trabajador es candidato para un turno sólo si está
  **disponible** y **tiene la habilidad** que el turno pide.
- **Postulación única:** hay una sola postulación por turno. Con la postulación
  activa (pendiente o aceptada) no puede postularse otra vez; si la retiró,
  postularse de nuevo reactiva esa misma. En la app, "ya me postulé" es tener
  una postulación activa (`appliedShiftIds`, `frontend/lib/applications.ts`): un
  turno abierto con la postulación retirada vuelve a aparecer en Inicio, Buscar
  y el Mapa, y su detalle vuelve a ofrecer "Postularme".
- **Sólo a turnos abiertos:** no puede postularse a un turno que no está en el
  feed (borrador, ya asignado, cerrado, etc.).
- **Confirmación:** sólo el trabajador **asignado** puede confirmar/rechazar; si
  rechaza, el turno vuelve a búsqueda (no queda a medias).
- **Asistencia geolocalizada:** check-in y check-out capturan su ubicación como
  prueba de asistencia.
- **Reputación como consecuencia:** su comportamiento (confirmar, presentarse,
  puntualidad, reseñas recibidas) alimenta su reputación, que a su vez lo hace más
  o menos recomendado por el matching.

## Invariantes

- A lo sumo **un** `WorkerProfile` por cuenta con rol `worker`.
- No puede haber postulación sin trabajador ni turno válidos.
- Un trabajador no puede estar asignado a dos turnos que se solapan en horario
  **(regla deseable; ver inconsistencia).**

> **Inconsistencia a resolver:** hoy no se observa una validación explícita que
> impida a un trabajador confirmar **turnos solapados en horario**. Debe
> definirse la regla (rechazar solapamiento o permitirlo con aviso) y
> documentarse en `BUSINESS_RULES.md` (Fase de reglas operativas).
