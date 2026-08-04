"""Caso de uso del motor de matching: top de candidatos para un turno."""

from uuid import UUID

from app.core.geo import haversine_km
from app.modules.matching.domain.entities import (
    MatchResult,
    ShiftRequirement,
    WorkerMapResult,
)
from app.modules.matching.domain.repositories import CandidateRepository
from app.modules.matching.domain.scoring import rank_candidates
from app.modules.matching.domain.value_objects import (
    DEFAULT_MAX_RADIUS_KM,
    DEFAULT_WEIGHTS,
    MatchWeights,
)
from app.modules.shift.domain.exceptions import ShiftNotFoundError
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.worker.domain.value_objects import WorkerSkill


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
        candidates = await self._candidates.list_available(shift.position)
        ranked = rank_candidates(candidates, requirement, weights, max_radius_km)
        return ranked[:limit]

    async def search_workers(
        self,
        *,
        skill: WorkerSkill | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        radius_km: float | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[WorkerMapResult]:
        """Busca trabajadores disponibles para mostrar en el mapa, por rol y distancia."""
        # `list_available` ya filtra is_available+skill en SQL (P3/P4 de
        # PERFORMANCE_REPORT.md); el orden final por distancia es Haversine en
        # Python (no hay PostGIS todavía), así que el límite/offset (R2.1) se
        # aplica DESPUÉS de ordenar, no como LIMIT/OFFSET de SQL: paginar antes
        # de ordenar por distancia devolvería una página con los trabajadores
        # equivocados. Ver decisión documentada en docs/reference/API.md#paginación.
        candidates = await self._candidates.list_available(skill)
        results = []
        for candidate in candidates:
            distance_km = haversine_km(
                candidate.latitude, candidate.longitude, latitude, longitude
            )
            if radius_km is not None and (distance_km is None or distance_km > radius_km):
                continue
            results.append(
                WorkerMapResult(
                    profile_id=candidate.profile_id,
                    user_id=candidate.user_id,
                    full_name=candidate.full_name,
                    photo_url=candidate.photo_url,
                    rating=candidate.rating,
                    skills=candidate.skills,
                    latitude=candidate.latitude,
                    longitude=candidate.longitude,
                    distance_km=distance_km,
                )
            )
        ordered = sorted(
            results, key=lambda r: (r.distance_km is None, r.distance_km or 0.0)
        )
        return ordered[offset : offset + limit]
