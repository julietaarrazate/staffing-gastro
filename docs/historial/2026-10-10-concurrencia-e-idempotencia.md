# Dos acciones a la vez sobre un turno, e idempotencia que se trababa

**Pedido:** segundo arreglo de la auditoría del 2026-10-10 (ver
[`2026-10-10-auditoria-privacidad.md`](./2026-10-10-auditoria-privacidad.md)),
los dos hallazgos altos del backend que quedaban.

**Qué cambió:**

- **Bloqueo optimista del turno** ([ADR-0016](../adr/ADR-0016-bloqueo-optimista-del-turno.md)).
  Antes, si el comercio cancelaba mientras el trabajador confirmaba, el turno
  quedaba CONFIRMADO; dos asignaciones a la vez dejaban a uno solo sin que el
  otro se enterara. Ahora la segunda acción recibe 409 "El turno cambió
  mientras tanto" y no guarda nada. Columna `shifts.version` (migración
  0036), `version_id_col` en `ShiftModel`, la entidad transporta la versión
  leída y `SqlAlchemyShiftRepository.update` la compara antes de escribir.
  Handler global del 409 en `backend/app/main.py`.
- **El scheduler ya no pisa al usuario:** `get_by_id` relee la base en vez
  de devolver la copia de la sesión (una por pasada), y una acción que
  pierde la carrera o ya no aplica saltea ese turno en vez de cortar la
  pasada (`scheduler._act`).
- **Idempotencia:** una key cuyo primer intento falló ya no queda "en curso"
  24 h. La dependencia `idempotent` pasó a `yield` y libera la reserva si el
  handler termina sin guardar respuesta (`IdempotencyRecorder.release`).
  Caso real: "Llegué" antes de la ventana daba 400, y al reintentar más
  tarde daba 409 hasta recargar la página.

**Por qué así:** bloqueo optimista y no `FOR UPDATE` porque se puede probar
en SQLite y no obliga a separar lecturas de escrituras en los 19 caminos que
usan `get_by_id` (detalle y alternativas en el ADR). Liberar la key ante un
error es el contrato habitual: sólo un éxito se replica; un error se puede
reintentar.

**Tests:** `backend/tests/test_concurrencia_turno.py` y el caso nuevo de
`test_idempotency.py` (que falla sin el arreglo).

**Queda abierto:** atomicidad de los casos de uso (cada repositorio
commitea por su cuenta; un unit of work es la solución de fondo, ver el
ADR). El resto de la auditoría sigue en `STATUS.md`.
