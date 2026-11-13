"""Cálculo puro del score de matching.

Combina distancia, experiencia, reputación, puntualidad e historial de
desempeño, según el spec del motor de matching de Oído. La afinidad con
el local queda fuera hasta que exista historial de asignaciones (Fase 3+).
"""

from collections.abc import Callable

from app.core.geo import haversine_km, is_near
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


DistanceFn = Callable[[CandidateProfile, ShiftRequirement], float | None]


def real_distance_km(
    candidate: CandidateProfile, requirement: ShiftRequirement
) -> float | None:
    """Distancia exacta entre la ubicación del candidato y la del turno."""
    return haversine_km(
        candidate.latitude,
        candidate.longitude,
        requirement.latitude,
        requirement.longitude,
    )


def score_candidate(
    candidate: CandidateProfile,
    requirement: ShiftRequirement,
    weights: MatchWeights = DEFAULT_WEIGHTS,
    max_radius_km: float = DEFAULT_MAX_RADIUS_KM,
    distance_fn: DistanceFn = real_distance_km,
) -> ScoreBreakdown:
    """Calcula el desglose del score de un candidato para un turno.

    `distance_fn` decide QUÉ distancia entra al puntaje. Por defecto la real
    (aviso a trabajadores cercanos: no sale hacia nadie). Lo que el comercio
    ve pasa la distancia pública (pin desplazado, redondeada): si el puntaje
    usara la real, la diferencia de score entre turnos la despejaría igual
    (revisión de seguridad 2026-10-21)."""
    distance_km = distance_fn(candidate, requirement)
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


def is_within_radius(
    candidate: CandidateProfile,
    requirement: ShiftRequirement,
    distance_km: float | None,
    max_radius_km: float,
) -> bool:
    """¿Está el candidato «cerca» del turno? El radio es un límite duro.

    Antes el radio sólo puntuaba (fuera de él la cercanía valía 0), así que
    con pocos candidatos quien estaba a más de 1.000 km recibía «Turno cerca
    tuyo» igual (prueba de punta a punta, 2026-11).

    - Con distancia medible: adentro del radio, borde incluido.
    - Sin distancia (el candidato no tiene ubicación conocida o el turno no
      tiene coordenadas): cuenta sólo si su ciudad es la del turno. Sin
      ciudad en alguna de las dos puntas, no cuenta.

    Es la misma regla que usa el feed del trabajador (`app.core.geo.is_near`).
    `distance_km` es la MISMA distancia con la que se puntúa (`distance_fn`):
    para lo que ve el comercio es la pública, así que el corte tampoco dice
    nada que la distancia mostrada no diga ya.
    """
    return is_near(distance_km, max_radius_km, candidate.city, requirement.city)


def rank_candidates(
    candidates: list[CandidateProfile],
    requirement: ShiftRequirement,
    weights: MatchWeights = DEFAULT_WEIGHTS,
    max_radius_km: float = DEFAULT_MAX_RADIUS_KM,
    distance_fn: DistanceFn = real_distance_km,
) -> list[MatchResult]:
    """Filtra por elegibilidad y por radio, calcula el score y ordena de
    mayor a menor."""
    results = []
    for candidate in candidates:
        if not is_eligible(candidate, requirement):
            continue
        breakdown = score_candidate(
            candidate, requirement, weights, max_radius_km, distance_fn
        )
        if not is_within_radius(
            candidate, requirement, breakdown.distance_km, max_radius_km
        ):
            continue
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
                badges=candidate.badges,
                level=candidate.level,
            )
        )
    return sorted(results, key=lambda r: r.score, reverse=True)
