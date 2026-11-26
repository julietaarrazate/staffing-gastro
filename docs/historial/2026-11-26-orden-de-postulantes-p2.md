# El orden de los postulantes pasa al backend (P2, ADR-0031) (#745)

**Pedido:** Julieta aprobó P2 el 2026-11-13 y aceptó el ADR-0031 el
2026-11-25: en un turno programado el comercio tiene que ver primero a quien
mejor calza, no a quien vive más cerca.

**Qué cambió:** en Candidatos, los postulantes de un turno programado llegan
en este orden: confianza del local (favorita, o ya trabajó ahí), sin
ausencias, turnos terminados en ese puesto, cumplimiento, calificación,
identidad verificada y quién se postuló antes. Quien no tiene turnos pero sí
la identidad verificada y ninguna ausencia lleva el sello «Nuevo en Oído ·
identidad verificada». La tarjeta del primero dice por qué va primero
(«Entre tus favoritos», «Ya trabajó en tu local», «Mejor calificación» o
«Con experiencia en el puesto»), y cada fila dice lo que explica su lugar
(«Entre tus favoritos», «Ya trabajó en tu local», «3 turnos en este puesto»;
`motivosDe` en `frontend/lib/applicants.ts`). En los recomendados de un turno programado
la distancia sólo filtra.

Técnico: el orden es una función pura
(`backend/app/modules/matching/domain/orden_postulantes.py`);
`MatchingService.ordenar_postulantes` junta los favoritos del comercio y los
turnos terminados (`ShiftRepository.count_finished_by_workers`, una consulta)
y la ruta `GET /applications/shifts/{id}` devuelve la lista ordenada con
`es_favorito`, `trabajo_aca`, `turnos_en_el_puesto` y `nuevo_verificado`.
`PROGRAMADO_WEIGHTS` en `matching/domain/value_objects.py`. En el frontend
se borró `rankApplicants` (`frontend/lib/applicants.ts`): la pantalla muestra
lo que llega. Tests: `backend/tests/test_orden_postulantes.py`.

**Por qué así:** un solo lugar para el orden. Los postulantes de un turno
urgente conservan el orden de antes (el carril urgente es de P4). El
cumplimiento y la calificación se comparan por tramos para que una diferencia
mínima no tape los criterios de abajo. Los números que el ADR no fijaba
quedaron anotados al final del ADR-0031.

**Queda abierto:** P3 (reconfirmación), en otro PR y apagada hasta que la
asesoría apruebe los textos. A decidir por Julieta: si el aviso «Turno cerca
tuyo» de un turno programado también deja de premiar la cercanía (hoy no se
tocó).
