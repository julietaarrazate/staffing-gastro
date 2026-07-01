# EMPLOYER.md — El Comercio (dominio)

> Comportamiento de negocio del **comercio / employer**. Modelo en
> [DOMAIN.md](./DOMAIN.md#employer--companyprofile). Describe reglas del dominio,
> no implementación.

## Qué es

El comercio (`employer`) es quien **publica turnos** y contrata trabajadores
eventuales: bar, restaurante, cafetería, salón de eventos, catering o empresa
gastronómica (`CompanyCategory`). Es la **demanda** del marketplace.

> El producto habla de "comercio"; el código lo modela como **PerfilComercio**
> (`CompanyProfile`). **No existe una entidad `Organization`** separada: el
> employer *es* el comercio. Un employer administra **un** perfil de comercio.

## Perfil

Un comercio tiene un perfil (uno por cuenta) con: nombre, logo, **categoría**,
descripción, dirección, ciudad, coordenadas, capacidad, horarios, y reputación
(rating, turnos publicados, tasa de pago a tiempo).

**Regla:** para publicar turnos, el comercio **debe tener el perfil creado**.

## Qué puede hacer

1. **Publicar un turno** (se crea en `borrador` y se publica) — ver [SHIFT.md](./SHIFT.md).
2. **Gestionar sus turnos:** editar (mientras esté en borrador/publicado),
   cancelar, ver el estado.
3. **Ver postulantes** de cada turno (los que se postularon por swipe) y
   **candidatos recomendados** por el motor de matching — ver [MATCHING.md](./MATCHING.md).
4. **Asignar** el turno a un trabajador (postulante o recomendado). El trabajador
   debe confirmar.
5. **Buscar trabajadores por mapa** (rol + radio) para su zona.
6. **Chatear** con el trabajador asignado (ver [CHAT.md](./CHAT.md)).
7. Al terminar el trabajo: **cerrar el turno** (finalizar) y **marcar como
   pagado** (ver [PAYMENTS.md](./PAYMENTS.md)).
8. **Calificar** al trabajador al cerrarse el turno (ver [REPUTATION.md](./REPUTATION.md)).

## Reglas de negocio

- **Pertenencia:** un comercio sólo ve/edita/cancela **sus** turnos y **sus**
  postulantes. Turno ajeno o inexistente = **404** (no-disclosure).
- **Edición limitada:** un turno sólo es editable en `borrador` o `publicado`;
  una vez que avanza el ciclo, no se edita.
- **Asignación:** puede asignar a un postulante o a un candidato recomendado; la
  asignación deja el turno `asignado` a la espera de confirmación del trabajador.
- **Rechazo del trabajador:** si el asignado rechaza, el turno vuelve a
  `buscando_personal` y el comercio puede asignar a otro.
- **Cierre y pago:** el comercio cierra el turno una vez trabajado y registra el
  pago (hoy sólo marca `pagado`; el cobro real es roadmap).

## Invariantes

- A lo sumo **un** `CompanyProfile` por cuenta con rol `employer`.
- Un turno pertenece a exactamente **un** comercio.
- Sólo el comercio dueño ejecuta las transiciones de su lado
  (publicar/cancelar/asignar/finalizar/marcar pagado).

> **Escalabilidad futura:** si un employer necesitara administrar **varios
> locales** (multi-sucursal), sería un cambio de modelo (introducir
> `Organization`) y debe registrarse como **ADR** (Fase 10 del plan de docs).
