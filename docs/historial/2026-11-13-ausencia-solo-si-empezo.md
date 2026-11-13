# «No se presentó» sólo si el turno ya empezó (U079)

**Pedido:** clave T3c / hallazgo U079: se podía marcar la ausencia de un turno confirmado que empezaba mañana, y penalizaba al trabajador sin vuelta atrás.

**Qué cambió:** el comercio puede marcar «No se presentó» desde 15 minutos después del inicio (la tolerancia de la puntualidad), no antes. La regla vive en `Shift.no_show()` (`backend/app/modules/shift/domain/entities.py`, `NO_SHOW_EARLIEST_AFTER_START`); la API responde 400 con la hora de Argentina en formato de persona ("Todavía no podés marcar que no se presentó: se habilita el 09/03 a las 20:15 (hora de Argentina), 15 minutos después del inicio."). `frontend/components/ShiftActions.tsx` no ofrece la opción antes de tiempo (se relee la hora cada 30 s). La ausencia automática (2 h) no cambia. Tests: `backend/tests/test_no_show_solo_si_empezo.py`, `ShiftActions.test.tsx`; los tests viejos que marcaban ausencia sobre turnos futuros mueven el turno al pasado con `tests/_turno_empezado.py`.

**Por qué así:** la regla en el dominio, no sólo en la UI, para que ningún camino la saltee. Se reutilizó `InvalidShiftTransitionError` (ya es 400 con su mensaje).

**Queda abierto:** (1) cancelar un turno cuyo trabajador ya terminó de trabajar (decisión de producto). (2) Avisos al reabrirse el turno. (3) Un turno reabierto por ausencia ya empezó, así que no aparece en el feed (`list_open` sólo ofrece turnos por delante, ADR-0015): decidir si hace falta otra vía para re-cubrirlo.
