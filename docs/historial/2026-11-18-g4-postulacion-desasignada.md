# G4: quien tuvo el turno y lo dejó queda al final, con su marca (#629)

**Pedido:** Julieta, salida a beta, etapa 2, lo que quedó «para revisar con
Fable»: el grupo G4 (U021, U123) según `planning/BETA_DISENO_GRAVES.md`, con
las decisiones 13 y 14 del tablero.

**Qué cambió:**

- En «Postulantes» de un turno, quien lo tuvo asignado y lo rechazó, canceló
  o no se presentó va **al final, con su marca** («Rechazó este turno»,
  «Canceló», «No se presentó»). No es nunca el destacado, no suma en la
  pestaña ni en el panel, y se le puede volver a asignar. Quien retiró su
  postulación ya no aparece. Tampoco vuelve como «Recomendada» para ese
  turno.
- A esa persona el turno no se le ofrece otra vez (Inicio, Buscar, Mapa) y el
  detalle le dice «Ya tuviste este turno asignado. Si el comercio te vuelve a
  elegir, te avisamos.» Si igual intenta postularse, 409 con ese texto.
- U123: al confirmar un turno, **un solo aviso** con las postulaciones que la
  app retiró por ser del mismo horario, y que puede volver a postularse si el
  confirmado se cae.
- Backend: `ApplicationStatus.DESASIGNADA` y `MotivoDesasignacion`
  (`backend/app/modules/application/domain/`), con `unassign`, `accept`
  (ahora también desde `desasignada` y `retirada`) y `release` (suspensión,
  sin marca). `ShiftService._mark_unassigned` lo escribe en
  `reject_assignment`, `worker_cancel` y `mark_no_show`; crea la fila si la
  persona fue asignada sin postularse. Migración `0051` (columna `motivo`,
  CHECK, y los datos viejos). `list_by_shift_enriched` saca las retiradas y
  ordena las desasignadas al final. `MatchingService` las saca de los
  recomendados. Aviso nuevo `applications_withdrawn`.
- Frontend: `lib/applicants.ts` (`rankApplicants`, `standoutApplicant`,
  `unassignedLabel`, `activeApplicantCount`), `app/shifts/[id]/candidates/page.tsx`,
  `lib/applications.ts` (`unassignedShiftIds`) y `components/ShiftDetail.tsx`.
- De paso: el aviso «N postulantes para…» contaba todas las postulaciones del
  turno, también las retiradas; ahora cuenta las que están en carrera, como
  el panel.

**Por qué así:** [ADR-0026](../adr/ADR-0026-postulacion-desasignada.md). Lo
que el diseño no decía y se resolvió acá:

- *Asignación directa:* no había postulación que marcar; se crea ya
  `desasignada`. Sin eso, la mitad de los casos (asignar desde
  «Recomendados») seguía sin dejar rastro.
- *¿Puede volver a postularse?* No: seguiría en la lista y perdería la marca.
  Es lo que pide la decisión 13 (queda al final y el comercio decide).
- *Suspensión:* no es un motivo. La postulación vuelve a `pendiente`
  (ADR-0024 actualizado).
- *Datos viejos:* la ausencia se puede reconstruir desde el turno; el resto
  de las `aceptada` huérfanas de turnos abiertos pasa a `retirada`, porque no
  se sabe si fue rechazo o cancelación.

**Revisión independiente y prueba en la app:** otro agente intentó romperlo
y encontró dos cosas que se corrigieron antes del merge: el `try/except` de
la marca no protegía nada (una escritura rechazada dejaba la sesión rota y el
pedido terminaba en 500, sin contar la cancelación ni avisar al comercio:
ahora el repositorio recupera la sesión y hay una segunda vuelta), y la
migración sólo arreglaba los turnos abiertos (ahora también los que hoy tiene
otra persona). También: no marcar a quien volvió a tener el turno en el
hueco, y el 409 nuevo con la pestaña vieja. Recorrido con `tools/e2e-local`
(comercio y dos trabajadoras, claro y oscuro, backend y Postgres reales):
lista, marcas, reasignar desde la pantalla, detalle de la trabajadora, 409 y
el aviso de U123; la migración se probó de ida y vuelta sobre una copia de la
base.

**Queda abierto:** nada de G4. La decisión 7 (cancelar desde «llegada
marcada») todavía no está hecha: cuando se haga tiene que pasar por
`worker_cancel`, que es quien deja la marca. Siguen U081, U080 y U072.
