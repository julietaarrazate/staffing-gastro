# ADR-0026 — Quien tuvo el turno y lo dejó queda escrito: postulación `desasignada`

**Estado:** aceptado · **Fecha:** 2026-11-18 · **Decisiones de Julieta:** 13 y 14 del
[tablero de la beta](../planning/BETA_TABLERO.md) (2026-11-13) · Grupo G4 (U021, U123)

## Contexto

La postulación (`ShiftApplication`) tenía cuatro estados: `pendiente`,
`aceptada`, `rechazada` y `retirada`. Cuando el comercio asignaba el turno, la
postulación del elegido pasaba a `aceptada`. Si después esa persona rechazaba
la asignación, cancelaba ya confirmada o no se presentaba, el turno volvía a
buscar personal, pero **su postulación quedaba `aceptada` para siempre**: nada
registraba lo que había pasado. En la lista de postulantes aparecía como
cualquiera, con «Asignar» y sin ninguna marca (U021); con buena reputación,
incluso como «Mejor valorado». Y si había sido asignada sin postularse (desde
«Recomendados»), no quedaba rastro en ningún lado: volvía a salir como
recomendada.

## Decisión

1. **Estado nuevo `desasignada`, con su motivo** (`rechazo`, `cancelacion`,
   `ausencia`). Lo escriben los tres caminos que le sacan el turno a la
   persona por algo que hizo ella: `reject_assignment`, `worker_cancel` y
   `mark_no_show` (manual o automático), por el puerto de postulaciones que
   `ShiftService` ya usaba. El motivo va con ese estado y sólo con él (lo
   exige la entidad y un CHECK de la base).
2. **Si no había postulación, se crea ya `desasignada`.** A quien se asignó
   directo le queda la fila para que el hecho exista. Sigue habiendo una sola
   postulación por (turno, trabajador).
3. **El comercio la sigue viendo, al final de los postulantes y con su
   marca** («Rechazó este turno», «Canceló», «No se presentó»), nunca como
   destacada, y **se le puede volver a asignar**: `desasignada → aceptada`
   borra el motivo. No suma en el contador de postulantes (ni en la pestaña
   ni en el panel): cuentan los que están en carrera.
4. **Ella no puede postularse otra vez** a ese turno (409 con un texto
   propio). Ya está en la lista; volver a elegirla es decisión del comercio.
   En su Inicio, Buscar y Mapa el turno no se le ofrece, y el detalle dice
   «Ya tuviste este turno asignado».
5. **Quien retiró su postulación no aparece** en la lista de postulantes. Si
   el comercio igual la asigna desde «Recomendados», su postulación pasa a
   `aceptada` (antes quedaba `retirada` con el turno asignado).
6. **No vuelve como «Recomendada»**: `matching` saca del top a quien tiene
   una postulación `desasignada` en ese turno.
7. **La suspensión no deja marca** ([ADR-0024](./ADR-0024-efectos-de-una-suspension.md)):
   si el turno se le suelta a alguien porque se suspendió su cuenta, su
   postulación vuelve a `pendiente`. No fue una decisión suya; mientras esté
   suspendida la lista no la muestra, y si se reactiva vuelve como una
   postulante más.
8. **U123:** al confirmar un turno, la app retira las postulaciones pendientes
   de la persona a turnos del mismo horario. Ahora le manda **un solo aviso**
   (`applications_withdrawn`) que dice cuáles fueron, por qué, y que puede
   volver a postularse si el turno confirmado se cae.

## Datos que ya estaban (migración 0051)

En los turnos abiertos, una postulación `aceptada` de alguien que ya no es el
asignado pasa a `desasignada`/`ausencia` si el turno registra su ausencia
(`last_no_show_worker_profile_id`). Si no, no se puede saber si rechazó o
canceló y no se inventa: pasa a `retirada` (sale de la lista y puede volver a
postularse). En los turnos con alguien asignado, la `retirada` de esa persona
pasa a `aceptada` (punto 5).

## Consecuencias

- La lista de postulantes dice la verdad y el comercio decide con el dato:
  sirve a «cubrir rápido» sin esconder a nadie.
- `application_to_acceptance_rate` (panel de admin) deja de contar como
  aceptadas las postulaciones de quien después dejó el turno.
- Hay filas de postulación que no nacieron de una postulación (punto 2). Se
  aceptó para no sumar otra tabla: lo que la pantalla necesita es una fila
  por persona y turno con su estado.

## Descartado

- **Dejar que vuelva a postularse y pierda la marca:** el comercio volvería a
  verla arriba, sin saber que ya lo dejó plantado.
- **Sacarla de la lista:** en un urgente puede ser la única persona
  disponible; la decisión 13 es mostrarla con su marca.
- **Un motivo `suspension`:** mostraría al comercio una medida de la
  administración sobre otra cuenta (ADR-0024 no revela el motivo).
- **Inventar el motivo de los datos viejos** (`rechazo` por defecto): sería
  afirmar algo que no se sabe.
