"""Caso de uso del motor de matching: top de candidatos para un turno."""

from uuid import UUID

from app.modules.matching.domain.entities import MatchResult, ShiftRequirement
from app.modules.matching.domain.repositories import CandidateRepository
from app.modules.matching.domain.scoring import rank_candidates
from app.modules.matching.domain.value_objects import (
    DEFAULT_MAX_RADIUS_KM,
    DEFAULT_WEIGHTS,
    MatchWeights,
)
from app.modules.shift.domain.exceptions import ShiftNotFoundError
from app.modules.shift.domain.repositories import ShiftRepository


class MatchingService:
    """Servicio de aplicación para calcular el top de candidatos de un turno."""

    def __init__(
        self, shifts: ShiftRepository, candidates: CandidateRepository
    ) -> None:
        self._shifts = shifts
        self._candidates = candidates

    async def get_top_candidates(
        self,
        shift_id: UUID,
        company_id: UUID,
        *,
        limit: int = 10,
        weights: MatchWeights = DEFAULT_WEIGHTS,
        max_radius_km: float = DEFAULT_MAX_RADIUS_KM,
    ) -> list[MatchResult]:
        """Calcula el top de candidatos recomendados para un turno propio."""
        shift = await self._shifts.get_by_id(shift_id)
        # No revelamos turnos de otros comercios: se tratan como inexistentes.
        if shift is None or shift.company_id != company_id:
            raise ShiftNotFoundError(str(shift_id))

        requirement = ShiftRequirement(
            position=shift.position,
            latitude=shift.latitude,
            longitude=shift.longitude,
        )
        candidates = await self._candidates.list_available_by_skill(shift.position)
        ranked = rank_candidates(candidates, requirement, weights, max_radius_km)
        return ranked[:limit]
