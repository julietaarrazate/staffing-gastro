# Segunda mirada a las cuentas suspendidas: seis arreglos (#PRG6)

**Pedido:** auditoría de «qué pasa al suspender una cuenta» (ADR-0024): seis hallazgos verificados, todos chicos.

**Qué cambió:** nada visible en pantallas salvo que «Mis postulaciones» ya no muestra el turno oculto de un comercio suspendido (el frontend ya toleraba `shift: null`). Técnico:
- `shift/application/services.py`: `_finish_reopen` y `_finish_half_reopened` (la cola de reabrir es repetible y un fallo no impide el aviso); `assign_worker` valida el turno antes que la cuenta con `Shift.admits_assignment` (`shift/domain/entities.py`).
- `chat/application/services.py`: `send_message` rechaza (404 como chat ajeno) si la otra parte está suspendida.
- `admin/application/ports.py` (`LiveConnectionCloser`), `admin/api/dependencies.py` y `core/ws_manager.py` (`close_user_connections`): se cortan los sockets de avisos al suspender; `notification/infrastructure/repositories.py` (`_schedule_pushes`): sin push a cuentas no activas.
- `application/application/services.py` (`list_my_applications`): sin turno embebido si el comercio está suspendido, salvo el asignado a la misma persona.
- `application/infrastructure/repositories.py` (`find_applicant_by_name`): sólo cuentas activas.
- Tests: `backend/tests/test_cuentas_suspendidas_segunda_mirada.py`. ADR-0024 con el punto 11 y la actualización.

**Por qué así:** la restauración ya era idempotente, así que se repite en vez de rediseñar la reapertura. Los sockets de chat no se cortan (el chat se bloquea al enviar).

**Queda abierto:** dos cosas esperan una decisión de Julieta y NO se tocaron: (1) un turno ya empezado de una cuenta suspendida no se puede cerrar ni pagar nunca (el comercio suspendido no puede finalizar, el trabajador suspendido no puede marcar la salida); (2) los turnos ocultos de un comercio suspendido pasan a «no cubierto» mientras dura la suspensión.
