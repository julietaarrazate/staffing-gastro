"""Casos de uso del módulo saved_shift (el trabajador guarda turnos abiertos
para evaluarlos después, sin postularse todavía — pedido de Julieta: "así
comienza algo más de evaluar opciones que convengan")."""

from uuid import UUID

from app.modules.saved_shift.domain.entities import SavedShift
from app.modules.saved_shift.domain.exceptions import ShiftNotSavableError
from app.modules.saved_shift.domain.repositories import SavedShiftRepository
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.repositories import ShiftRepository

# Tope de guardados considerados al listar — un trabajador de la beta no se
# acerca a este volumen; de sobrarse, es mejor señal de que hace falta
# paginación real que fallar en silencio (mismo criterio que
# `AssistantService._LOOKUP_LIMIT`).
_LIST_LIMIT = 200


class SavedShiftService:
    """Guardar/sacar turnos y listar los propios, ordenados por cuándo son
    (no por cuándo se guardaron) — el trabajador los usa para planificar,
    así que lo más útil es ver primero el que vence antes."""

    def __init__(self, saved_shifts: SavedShiftRepository, shifts: ShiftRepository) -> None:
        self._saved_shifts = saved_shifts
        self._shifts = shifts

    async def save(self, worker_profile_id: UUID, shift_id: UUID) -> SavedShift:
        """Guarda un turno. Idempotente: si ya estaba guardado, devuelve el
        registro existente en vez de duplicar."""
        shift = await self._shifts.get_by_id(shift_id)
        if shift is None:
            raise ShiftNotSavableError(str(shift_id))

        existing = await self._saved_shifts.get_by_worker_and_shift(
            worker_profile_id, shift_id
        )
        if existing is not None:
            return existing
        return await self._saved_shifts.add(
            SavedShift(worker_profile_id=worker_profile_id, shift_id=shift_id)
        )

    async def unsave(self, worker_profile_id: UUID, shift_id: UUID) -> None:
        """Saca un turno guardado. Idempotente: no falla si no estaba guardado."""
        await self._saved_shifts.remove(worker_profile_id, shift_id)

    async def is_saved(self, worker_profile_id: UUID, shift_id: UUID) -> bool:
        existing = await self._saved_shifts.get_by_worker_and_shift(
            worker_profile_id, shift_id
        )
        return existing is not None

    async def list_my_saved_shifts(self, worker_profile_id: UUID) -> list[Shift]:
        shift_ids = await self._saved_shifts.list_shift_ids_by_worker(
            worker_profile_id, limit=_LIST_LIMIT
        )
        if not shift_ids:
            return []
        shifts = await self._shifts.list_by_ids(shift_ids)
        # Por fecha del turno (el más próximo primero), no por cuándo se
        # guardó — es lo que sirve para planificar. Los turnos sin horario
        # cargado (no debería pasar en la práctica) quedan al final.
        return sorted(shifts, key=lambda s: s.start_at)
