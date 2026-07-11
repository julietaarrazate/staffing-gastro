"""Adaptador de `NearbyCandidatesPort` para el ping de turnos urgentes.

Reutiliza el `CandidateRepository` del módulo `matching` por **composición**
(no herencia ni acoplamiento de dominios): este archivo es el único lugar de
`shift` que conoce `matching`, y sólo importa su **puerto** (`domain/`), nunca
sus adaptadores concretos — la instancia concreta (SQLAlchemy) se arma en la
capa `api/` (composición de dependencias), igual que hace
`matching/api/dependencies.py` con el `ShiftRepository` de este módulo.

Ver ADR-0005 (fan-out sincrónico sin broker) y CLAUDE.md ("cruces entre
módulos: por puerto/repositorio inyectado, nunca acoplando dominios").
"""

from app.core.geo import haversine_km
from app.modules.matching.domain.repositories import CandidateRepository
from app.modules.shift.domain.repositories import NearbyCandidate, NearbyCandidatesPort
from app.modules.worker.domain.value_objects import WorkerSkill


class MatchingNearbyCandidatesAdapter(NearbyCandidatesPort):
    """Calcula cercanía sobre los candidatos disponibles que ya filtra matching."""

    def __init__(self, candidates: CandidateRepository) -> None:
        self._candidates = candidates

    async def list_nearby(
        self,
        skill: WorkerSkill,
        latitude: float,
        longitude: float,
        limit: int = 10,
    ) -> list[NearbyCandidate]:
        # `list_available` ya filtra is_available + skill en SQL (mismo
        # camino que usa el ranking de matching, ver
        # `matching/infrastructure/repositories.py`).
        candidates = await self._candidates.list_available(skill)
        nearby: list[NearbyCandidate] = []
        for candidate in candidates:
            distance_km = haversine_km(
                candidate.latitude, candidate.longitude, latitude, longitude
            )
            if distance_km is None:
                # Sin coordenadas propias: no se puede calcular "cerca tuyo",
                # se excluye en vez de asumir una distancia neutral (a
                # diferencia del scoring ponderado de matching, acá la
                # cercanía es el criterio entero, no un factor entre varios).
                continue
            nearby.append(NearbyCandidate(user_id=candidate.user_id, distance_km=distance_km))
        nearby.sort(key=lambda c: c.distance_km)
        return nearby[:limit]
