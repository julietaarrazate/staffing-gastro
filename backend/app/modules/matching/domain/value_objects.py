"""Objetos de valor del motor de matching: pesos y desglose del score."""

from dataclasses import dataclass

# Radio del primer aviso «Turno cerca tuyo» y de los recomendados que ve el
# comercio. Es un LÍMITE DURO: fuera de él no se avisa ni se sugiere a nadie,
# por bien que puntúe en lo demás (ver `scoring.is_within_radius`). Adentro,
# es la escala del puntaje de cercanía: 1 en el lugar, 0 en el borde.
DEFAULT_MAX_RADIUS_KM = 25.0

# Radio de la escalada a urgente (ADR-0009): el círculo más amplio al que
# llega un turno que tarda en cubrirse, también como límite duro. Es además
# el alcance máximo de «cerca» en las listas del trabajador: el feed del
# Inicio y del Mapa no muestra nada más lejos que esto.
ESCALATION_RADIUS_KM = 40.0

# Años de experiencia que ya representan el máximo puntaje en ese factor.
EXPERIENCE_CAP_YEARS = 10

# Turnos terminados en Oído en el puesto pedido que ya dan el máximo en
# «experiencia comprobada» (ADR-0031). Valor semilla, ajustable.
PROVEN_EXPERIENCE_CAP_SHIFTS = 10


@dataclass(frozen=True)
class MatchWeights:
    """Pesos de cada factor del score. Deben sumar 1.0."""

    distance: float = 0.30
    experience: float = 0.15
    reputation: float = 0.25
    punctuality: float = 0.15
    performance: float = 0.15
    # Experiencia comprobada: turnos terminados en Oído en ese puesto. Sólo
    # pesa en el carril programado (`PROGRAMADO_WEIGHTS`).
    proven_experience: float = 0.0

    def __post_init__(self) -> None:
        total = (
            self.distance
            + self.proven_experience
            + self.experience
            + self.reputation
            + self.punctuality
            + self.performance
        )
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"Los pesos deben sumar 1.0 (suman {total})")


DEFAULT_WEIGHTS = MatchWeights()

# Carril programado (ADR-0031): la distancia sólo filtra (dentro del radio) y
# su 30 % se reparte entre experiencia comprobada (+15) y cumplimiento (+15).
PROGRAMADO_WEIGHTS = MatchWeights(
    distance=0.0,
    experience=0.15,
    reputation=0.25,
    punctuality=0.15,
    performance=0.30,
    proven_experience=0.15,
)


@dataclass(frozen=True)
class ScoreBreakdown:
    """Detalle de cada factor (0..1) que compone el score final."""

    distance_score: float
    experience_score: float
    reputation_score: float
    punctuality_score: float
    performance_score: float
    distance_km: float | None
    proven_experience_score: float = 0.0

    def total(self, weights: MatchWeights = DEFAULT_WEIGHTS) -> float:
        return (
            weights.distance * self.distance_score
            + weights.experience * self.experience_score
            + weights.reputation * self.reputation_score
            + weights.punctuality * self.punctuality_score
            + weights.performance * self.performance_score
            + weights.proven_experience * self.proven_experience_score
        )
