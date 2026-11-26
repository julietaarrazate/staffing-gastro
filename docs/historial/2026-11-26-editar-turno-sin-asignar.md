# Editar un turno mientras nadie esté asignado (#PR)

**Pedido:** Julieta preguntó (2026-11-26) qué pasa si el comercio se
equivoca al publicar: si tiene que eliminar el turno y armar otro, o si
conviene un plazo para corregir. Pidió que se decida con criterio de producto
y sin complicar a los trabajadores.

**Qué cambió:** en «Más» de un turno del Panel aparece «Editar turno»
mientras nadie esté asignado (publicado, o reabierto sin persona). Se corrige
el horario, el pago y la vestimenta. Si ya hay postulantes y cambia el
horario o baja el pago, cada uno recibe «Cambió un turno al que te
postulaste» y decide si sigue; subir el pago o tocar la vestimenta no avisa.
Con postulantes no se puede cambiar el puesto. Con alguien asignado o
confirmado no se edita, y la pantalla lo explica. Hasta hoy el backend dejaba
editar sólo un borrador o un publicado, y la app no tenía pantalla para
hacerlo: corregir un error obligaba a cancelar y publicar de nuevo.

Técnico: `Shift.is_editable` y `Shift.cambio_importante`
(`backend/app/modules/shift/domain/entities.py`); `ShiftService.update_shift`
avisa con el tipo nuevo `applied_shift_changed`; la respuesta del turno suma
`is_editable`. Pantalla `frontend/app/shifts/[id]/edit/page.tsx`, acceso en
`frontend/components/ShiftActions.tsx`. Tests:
`backend/tests/test_editar_turno.py`, `frontend/e2e/editar-turno.spec.ts`.

**Por qué así:** lo que decide si se puede editar no es cuánto tiempo pasó
sino si alguien ya se comprometió. Un plazo permitiría cambiarle el horario a
quien ya aceptó; sin plazo, un turno sin nadie se puede corregir aunque lleve
días publicado. Se descartó editar directo un turno confirmado.

**Queda abierto:** con alguien asignado o confirmado, «proponer un cambio de
horario» que la persona acepta o no con un toque (si no acepta, no cambia
nada ni le cuenta en contra). Va después de la puntualidad real, con su ADR.
