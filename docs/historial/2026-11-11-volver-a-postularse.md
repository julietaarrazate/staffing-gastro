# Volver a postularse después de retirar la postulación

**Pedido:** Julieta, salida a beta (etapa 2: arreglar lo que encontró la prueba
de punta a punta). Hallazgo bloqueante: al cancelar una postulación la app dice
"si sigue abierto, podés volver a postularte más adelante", pero no se podía.

**Qué cambió:** quien retira su postulación puede volver a postularse mientras
el turno siga abierto. El turno vuelve a aparecer en Inicio, en Buscar y en el
Mapa, y su detalle (`/turno/[id]`) vuelve a ofrecer "Postularme" en vez de
decir "Ya te postulaste". Vale igual para las postulaciones que la app retira
sola cuando el trabajador confirma otro turno del mismo horario. El comercio
recibe el aviso de siempre ("N postulantes para…") y ve a la persona una sola
vez entre sus postulantes, otra vez como pendiente.

- Backend: `ShiftApplication.reapply()` (RETIRADA → PENDIENTE, renueva la
  fecha) en `backend/app/modules/application/domain/entities.py`;
  `ApplicationService.apply` (`application/services.py`) reactiva la
  postulación retirada en vez de responder 409, y el repositorio
  (`infrastructure/repositories.py`) guarda la fecha renovada. Sigue habiendo
  una sola fila por (turno, trabajador): no hizo falta migración. El evento
  `application.submitted` suma `reapplied` (verdadero cuando es una vuelta).
- Frontend: `appliedShiftIds` en `frontend/lib/applications.ts` es la única
  definición de "ya me postulé" (postulación `pendiente` o `aceptada`). La
  usan `app/feed/page.tsx`, `app/buscar/page.tsx`, `app/map/page.tsx` y
  `components/ShiftDetail.tsx`; antes cada una armaba su cuenta con todas las
  postulaciones, sin mirar el estado.
- Tests: `backend/tests/test_application.py` (retirar y volver: misma
  postulación, pendiente, fecha nueva, aviso al comercio, una sola vez en
  postulantes; dos veces seguidas sigue siendo 409; rechazada no se reactiva;
  turno ya asignado no acepta; retirada por la regla de doble turno),
  `backend/tests/test_business_events.py` (`reapplied`),
  `frontend/lib/applications.test.ts`, `frontend/components/ShiftDetail.test.tsx`
  y `frontend/e2e/volver-a-postularse.spec.ts` (retirar → el turno reaparece →
  postularse de nuevo, con la API simulada).
- Docs corregidos: `docs/foundation/DOMAIN.md` (Match), `docs/reference/MATCHING.md`
  y `docs/reference/WORKER.md` decían "se postula una sola vez por turno";
  `docs/reference/OBSERVABILITY.md` (`reapplied`); fila nueva en
  `docs/reference/MAPA_DEL_CODIGO.md`. En `docs/reference/API.md` la fila de
  postularse tenía mal la ruta (`/applications` en vez de `/shifts/{shift_id}`).

**Por qué así:** había que elegir entre cumplir lo que el cartel promete o
cambiar el cartel; se cumple la promesa. Se reactiva la misma postulación en
vez de crear otra porque la tabla tiene una sola fila por (turno, trabajador)
y de eso dependen la lista de postulantes del comercio y el paso a "aceptada"
al asignar: con dos filas la misma persona saldría repetida. La fecha se
renueva (se reusa `created_at`, sin columna nueva) porque para el comercio es
una postulación nueva y el listado de postulantes sale ordenado por esa fecha. Una postulación
rechazada no se reactiva: la rechaza el comercio al elegir a otra persona, y
vuelve sola a pendiente si el turno se reabre. Las demás reglas no cambian
(el turno tiene que estar abierto; la superposición de horarios se sigue
chequeando al confirmar el turno).

**Queda abierto:**
- Las métricas que cuentan postulaciones por fecha toman la fecha renovada: una
  vuelta cuenta en el período en que se volvió a postular, no en el original.
- El título del aviso al comercio ("N postulantes para…") cuenta todas las
  postulaciones del turno, también las retiradas. Ya era así; no se tocó.
- Las postulaciones retiradas siguen figurando en la lista de postulantes del
  comercio: es otro hallazgo de la misma prueba y va en su propio PR.
