"""Objetos de valor del motor de matching: pesos y desglose del score."""

from dataclasses import dataclass

# Radio por defecto fuera del cual la distancia deja de aportar puntaje.
DEFAULT_MAX_RADIUS_KM = 25.0

# Años de experiencia que ya representan el máximo puntaje en ese factor.
EXPERIENCE_CAP_YEARS = 10


@dataclass(frozen=True)
class MatchWeights:
    """Pesos de cada factor del score. Deben sumar 1.0."""

    distance: float = 0.30
    experience: float = 0.15
    reputation: float = 0.25
    punctuality: float = 0.15
    performance: float = 0.15

    def __post_init__(self) -> None:
        total = (
            self.distance
            + self.experience
            + self.reputation
            + self.punctuality
            + self.performance
        )
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"Los pesos deben sumar 1.0 (suman {total})")


DEFAULT_WEIGHTS = MatchWeights()


@dataclass(frozen=True)
class ScoreBreakdown:
    """Detalle de cada factor (0..1) que compone el score final."""

    distance_score: float
    experience_score: float
    reputation_score: float
    punctuality_score: float
    performance_score: float
    distance_km: float | None

    def total(self, weights: MatchWeights = DEFAULT_WEIGHTS) -> float:
        return (
            weights.distance * self.distance_score
            + weights.experience * self.experience_score
            + weights.reputation * self.reputation_score
            + weights.punctuality * self.punctuality_score
            + weights.performance * self.performance_score
        )
