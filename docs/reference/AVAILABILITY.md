# AVAILABILITY.md — Disponibilidad (dominio)

> Si un trabajador está listo para tomar turnos **ahora**. No es una entidad: es
> un **estado del perfil** (`WorkerProfile.is_available`). Condiciona
> [MATCHING.md](./MATCHING.md#motor-de-recomendación-scoring) y la búsqueda.

## Qué es

La disponibilidad es el interruptor **online/offline** del trabajador, al estilo
de un conductor de Uber: cuando está **disponible**, entra en las
recomendaciones y búsquedas de los comercios; cuando no, queda fuera del radar
sin perder su perfil ni su historial.

Es el mecanismo más simple que sostiene el "tiempo real" del marketplace: los
comercios sólo ven a quien puede trabajar.

## Forma del dato

- Un booleano en el perfil del trabajador: `is_available`.
- Lo **enciende/apaga el propio trabajador** desde su home (control directo,
  sin aprobación de nadie).

## Cómo se usa

- **Elegibilidad de matching:** el motor sólo considera candidatos con
  `is_available = true` (junto con tener la habilidad que pide el turno). No
  disponible ⇒ **no se recomienda**, cualquiera sea su reputación. Ver
  [MATCHING.md](./MATCHING.md#motor-de-recomendación-scoring).
- **Búsqueda por mapa (comercio):** respeta la disponibilidad: los no disponibles
  no aparecen en la exploración.

## Reglas de negocio

- La disponibilidad es **autogestionada**: es control del trabajador sobre su
  propia oferta de trabajo.
- Es **independiente de la asignación**: es una intención de "estoy para
  trabajar", no un compromiso con un turno puntual (el compromiso se materializa
  al **postularse** y **confirmar** — ver [MATCHING.md](./MATCHING.md)).
- Estar disponible **no garantiza match**: sólo habilita a ser recomendado.

## Inconsistencias / pendientes

> - **No hay agenda ni franjas horarias.** Hoy la disponibilidad es un booleano
>   "ahora sí / ahora no", no un calendario ("disponible sáb 20–24 h"). Coincide
>   con la meta de inmediatez, pero limita la planificación anticipada.
> - **No se apaga sola.** No existe lógica que ponga `is_available = false` al
>   asignarse/confirmar un turno solapado; la coherencia depende del trabajador.
>   Esto se cruza con la falta de **validación de solapamiento** señalada en
>   [WORKER.md](./WORKER.md). Definir la regla (¿la asignación baja la
>   disponibilidad?) corresponde a `BUSINESS_RULES.md` y, si cambia el modelo
>   (agenda por franjas), a un **ADR**.

## Fuera de alcance (hoy)

- **Disponibilidad por franjas / calendario recurrente** (días y horarios
  habituales): futuro.
- **Pausa automática** por turno en curso o por límite de horas: futuro.
