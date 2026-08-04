"""Cálculo puro del score de matching.

Combina distancia, experiencia, reputación, puntualidad e historial de
desempeño, según el spec del motor de matching de Oído. La afinidad con
el local queda fuera hasta que exista historial de asignaciones (Fase 3+).
"""

from app.core.geo import haversine_km
from app.modules.matching.domain.entities import (
    CandidateProfile,
    MatchResult,
    ShiftRequirement,
)
from app.modules.matching.domain.value_objects import (
    DEFAULT_MAX_RADIUS_KM,
    DEFAULT_WEIGHTS,
    EXPERIENCE_CAP_YEARS,
    MatchWeights,
    ScoreBreakdown,
)


def _distance_score(distance_km: float | None, max_radius_km: float) -> float:
    if distance_km is None:
        return 0.5  # Sin geolocalización en alguna de las dos puntas: neutral.
    if distance_km >= max_radius_km:
        return 0.0
    return 1.0 - (distance_km / max_radius_km)


def _experience_score(years_experience: int) -> float:
    return min(years_experience / EXPERIENCE_CAP_YEARS, 1.0)


def _reputation_score(rating: float) -> float:
    return min(max(rating / 5.0, 0.0), 1.0)


def _punctuality_score(punctuality_rate: float) -> float:
    return min(max(punctuality_rate, 0.0), 1.0)


# Un no-show (el comercio lo marcó como no presentado, ADR-0007) es una señal
# peor que una cancelación avisada con anticipación: no hay aviso, el
# comercio se entera recién en el turno. Pesa el doble en el denominador del
# desempeño. Valor semilla conservador, ajustable (mismo criterio que las
# suscripciones Fase 1, ver docs/reference/REPUTATION.md).
NO_SHOW_PERFORMANCE_WEIGHT = 2


def _performance_score(events_completed: int, cancellations: int, no_shows: int = 0) -> float:
    """Ratio de eventos completados sobre el total de compromisos asumidos.

    Sin historial (total == 0) devuelve neutral (0.5), para no penalizar ni
    premiar a quien recién empieza.
    """
    negative = cancellations + NO_SHOW_PERFORMANCE_WEIGHT * no_shows
    total = events_completed + negative
    if total == 0:
        return 0.5
    return events_completed / total


def score_candidate(
    candidate: CandidateProfile,
    requirement: ShiftRequirement,
    weights: MatchWeights = DEFAULT_WEIGHTS,
    max_radius_km: float = DEFAULT_MAX_RADIUS_KM,
) -> ScoreBreakdown:
    """Calcula el desglose del score de un candidato para un turno."""
    distance_km = haversine_km(
        candidate.latitude,
        candidate.longitude,
        requirement.latitude,
        requirement.longitude,
    )
    return ScoreBreakdown(
        distance_score=_distance_score(distance_km, max_radius_km),
        experience_score=_experience_score(candidate.years_experience),
        reputation_score=_reputation_score(candidate.rating),
        punctuality_score=_punctuality_score(candidate.punctuality_rate),
        performance_score=_performance_score(
            candidate.events_completed, candidate.cancellations, candidate.no_shows
        ),
        distance_km=distance_km,
    )


def is_eligible(candidate: CandidateProfile, requirement: ShiftRequirement) -> bool:
    """Un candidato es elegible si está disponible y tiene la habilidad pedida."""
    return candidate.is_available and requirement.position in candidate.skills


def rank_candidates(
    candidates: list[CandidateProfile],
    requirement: ShiftRequirement,
    weights: MatchWeights = DEFAULT_WEIGHTS,
    max_radius_km: float = DEFAULT_MAX_RADIUS_KM,
) -> list[MatchResult]:
    """Filtra por elegibilidad, calcula el score y ordena de mayor a menor."""
    results = []
    for candidate in candidates:
        if not is_eligible(candidate, requirement):
            continue
        breakdown = score_candidate(candidate, requirement, weights, max_radius_km)
        results.append(
            MatchResult(
                profile_id=candidate.profile_id,
                user_id=candidate.user_id,
                full_name=candidate.full_name,
                photo_url=candidate.photo_url,
                rating=candidate.rating,
                score=breakdown.total(weights),
                distance_km=breakdown.distance_km,
                events_completed=candidate.events_completed,
                punctuality_rate=candidate.punctuality_rate,
                years_experience=candidate.years_experience,
            )
        )
    return sorted(results, key=lambda r: r.score, reverse=True)
