"""Unit tests puros del motor de scoring de matching.

Sin DB ni cliente HTTP: se instancian directamente los dataclasses del
dominio (`CandidateProfile`, `ShiftRequirement`, `MatchWeights`) y se llama a
las funciones puras de `app.modules.matching.domain.scoring`.

Pesos por defecto (ver `value_objects.py`): distancia 0.30, reputación 0.25,
experiencia 0.15, puntualidad 0.15, desempeño 0.15. Radio máx 25km.
Experiencia tope 10 años.
"""

from uuid import uuid4

import pytest

from app.modules.matching.domain.entities import CandidateProfile, ShiftRequirement
from app.modules.matching.domain.scoring import (
    _distance_score,
    _experience_score,
    _performance_score,
    _punctuality_score,
    _reputation_score,
    rank_candidates,
    score_candidate,
)
from app.modules.matching.domain.value_objects import (
    DEFAULT_MAX_RADIUS_KM,
    DEFAULT_WEIGHTS,
    EXPERIENCE_CAP_YEARS,
    MatchWeights,
)
from app.modules.worker.domain.value_objects import WorkerSkill

PALERMO = (-34.58, -58.43)


def _candidate(**overrides) -> CandidateProfile:
    """Candidato base "neutro": bien calificado, disponible, en Palermo."""
    defaults = dict(
        profile_id=uuid4(),
        user_id=uuid4(),
        full_name="Candidata de prueba",
        photo_url=None,
        skills=(WorkerSkill.MOZO,),
        years_experience=2,
        rating=4.0,
        punctuality_rate=0.9,
        events_completed=10,
        cancellations=0,
        no_shows=0,
        is_available=True,
        latitude=PALERMO[0],
        longitude=PALERMO[1],
    )
    defaults.update(overrides)
    return CandidateProfile(**defaults)


def _requirement(**overrides) -> ShiftRequirement:
    defaults = dict(
        position=WorkerSkill.MOZO,
        latitude=PALERMO[0],
        longitude=PALERMO[1],
    )
    defaults.update(overrides)
    return ShiftRequirement(**defaults)


# --- Pesos ------------------------------------------------------------------


def test_default_weights_sum_to_one():
    total = (
        DEFAULT_WEIGHTS.distance
        + DEFAULT_WEIGHTS.experience
        + DEFAULT_WEIGHTS.reputation
        + DEFAULT_WEIGHTS.punctuality
        + DEFAULT_WEIGHTS.performance
    )
    assert total == pytest.approx(1.0)


def test_default_weights_match_spec_values():
    assert DEFAULT_WEIGHTS.distance == pytest.approx(0.30)
    assert DEFAULT_WEIGHTS.reputation == pytest.approx(0.25)
    assert DEFAULT_WEIGHTS.experience == pytest.approx(0.15)
    assert DEFAULT_WEIGHTS.punctuality == pytest.approx(0.15)
    assert DEFAULT_WEIGHTS.performance == pytest.approx(0.15)


def test_weights_that_do_not_sum_to_one_are_rejected():
    with pytest.raises(ValueError):
        MatchWeights(distance=0.5, experience=0.5, reputation=0.5, punctuality=0.0, performance=0.0)


# --- Distancia ----------------------------------------------------------------


def test_distance_score_without_geolocation_is_neutral():
    """Si al candidato le falta lat/lon, la distancia es None -> factor neutral 0.5."""
    assert _distance_score(None, DEFAULT_MAX_RADIUS_KM) == 0.5


def test_candidate_without_geo_gets_neutral_distance_factor_via_score_candidate():
    candidate = _candidate(latitude=None, longitude=None)
    requirement = _requirement()
    breakdown = score_candidate(candidate, requirement)
    assert breakdown.distance_km is None
    assert breakdown.distance_score == 0.5


def test_shift_without_geo_also_gets_neutral_distance_factor():
    """La neutralidad aplica también si es el turno el que no tiene coordenadas."""
    candidate = _candidate()
    requirement = _requirement(latitude=None, longitude=None)
    breakdown = score_candidate(candidate, requirement)
    assert breakdown.distance_km is None
    assert breakdown.distance_score == 0.5


def test_distance_score_at_zero_distance_is_maximum():
    assert _distance_score(0.0, DEFAULT_MAX_RADIUS_KM) == 1.0


def test_candidate_at_same_coordinates_gets_max_distance_factor():
    candidate = _candidate(latitude=PALERMO[0], longitude=PALERMO[1])
    requirement = _requirement(latitude=PALERMO[0], longitude=PALERMO[1])
    breakdown = score_candidate(candidate, requirement)
    assert breakdown.distance_km == pytest.approx(0.0, abs=1e-9)
    assert breakdown.distance_score == pytest.approx(1.0)


def test_distance_score_beyond_max_radius_is_zero():
    assert _distance_score(30.0, DEFAULT_MAX_RADIUS_KM) == 0.0


def test_candidate_far_away_gets_zero_distance_factor():
    # Córdoba capital, a ~650km de Palermo (CABA): muy por fuera del radio de 25km.
    candidate = _candidate(latitude=-31.4, longitude=-64.2)
    requirement = _requirement()
    breakdown = score_candidate(candidate, requirement)
    assert breakdown.distance_km > DEFAULT_MAX_RADIUS_KM
    assert breakdown.distance_score == 0.0


def test_distance_score_decays_linearly_within_radius():
    half_radius = DEFAULT_MAX_RADIUS_KM / 2
    assert _distance_score(half_radius, DEFAULT_MAX_RADIUS_KM) == pytest.approx(0.5)


def test_distance_score_exactly_at_radius_boundary_is_zero():
    """Comportamiento real (>=): a exactamente el radio máximo, el factor ya es 0,
    no queda un último punto con puntaje > 0. Documentamos el comportamiento actual."""
    assert _distance_score(DEFAULT_MAX_RADIUS_KM, DEFAULT_MAX_RADIUS_KM) == 0.0


# --- Experiencia ----------------------------------------------------------------


def test_experience_score_capped_at_ten_years():
    assert _experience_score(EXPERIENCE_CAP_YEARS) == 1.0
    assert _experience_score(EXPERIENCE_CAP_YEARS + 15) == 1.0


def test_experience_score_scales_linearly_below_cap():
    assert _experience_score(5) == pytest.approx(0.5)
    assert _experience_score(0) == 0.0


def test_candidate_with_more_than_ten_years_is_capped_via_score_candidate():
    capped = _candidate(years_experience=25)
    junior = _candidate(years_experience=EXPERIENCE_CAP_YEARS)
    requirement = _requirement()
    assert score_candidate(capped, requirement).experience_score == score_candidate(
        junior, requirement
    ).experience_score == 1.0


# --- Reputación (rating 0..5) ------------------------------------------------


def test_reputation_score_normalizes_rating_from_0_to_5():
    assert _reputation_score(0.0) == 0.0
    assert _reputation_score(2.5) == pytest.approx(0.5)
    assert _reputation_score(5.0) == 1.0


def test_reputation_score_clamps_out_of_range_values():
    assert _reputation_score(-1.0) == 0.0
    assert _reputation_score(7.0) == 1.0


def test_new_worker_with_no_reviews_gets_worst_reputation_score_not_neutral():
    # BUG?: a diferencia del factor distancia (neutral 0.5 sin geo) y del factor
    # desempeño (neutral 0.5 sin historial, por el suavizado +1), un trabajador
    # recién registrado tiene `rating=0.0` por default (ver
    # worker/infrastructure/models.py) y por lo tanto `reputation_score == 0.0`,
    # el peor puntaje posible en ese factor (peso 0.25) en vez de un valor
    # neutral. Esto penaliza a los trabajadores nuevos sin reseñas todavía,
    # aunque no hayan hecho nada mal. Se documenta el comportamiento actual;
    # no se corrige acá porque no fue pedido y podría ser intencional
    # (favorecer trabajadores con historial comprobado).
    brand_new_worker = _candidate(rating=0.0, events_completed=0, cancellations=0)
    requirement = _requirement()
    breakdown = score_candidate(brand_new_worker, requirement)
    assert breakdown.reputation_score == 0.0


# --- Puntualidad --------------------------------------------------------------


def test_punctuality_score_passes_through_rate_in_range():
    assert _punctuality_score(0.0) == 0.0
    assert _punctuality_score(0.75) == 0.75
    assert _punctuality_score(1.0) == 1.0


def test_punctuality_score_clamps_out_of_range_values():
    assert _punctuality_score(-0.2) == 0.0
    assert _punctuality_score(1.5) == 1.0


# --- Desempeño (completados vs. cancelaciones) --------------------------------


def test_performance_score_neutral_without_history():
    assert _performance_score(events_completed=0, cancellations=0) == 0.5


def test_performance_score_is_completion_ratio():
    assert _performance_score(events_completed=8, cancellations=2) == pytest.approx(0.8)
    assert _performance_score(events_completed=0, cancellations=5) == 0.0
    assert _performance_score(events_completed=5, cancellations=0) == 1.0


def test_performance_score_weighs_no_show_double_a_cancellation():
    """ADR-0007: un no-show pesa el doble que una cancelación avisada en el
    denominador del desempeño (valor semilla ajustable, ver REPUTATION.md)."""
    # 1 no-show ~ 2 cancelaciones en el denominador.
    with_no_show = _performance_score(events_completed=8, cancellations=0, no_shows=1)
    with_two_cancellations = _performance_score(
        events_completed=8, cancellations=2, no_shows=0
    )
    assert with_no_show == pytest.approx(with_two_cancellations)
    assert with_no_show < _performance_score(events_completed=8, cancellations=1, no_shows=0)


# --- Orden del ranking con trade-offs --------------------------------------


def test_ranking_orders_candidates_with_different_tradeoffs():
    """Tres candidatos con trade-offs distintos: el orden final debe reflejar
    el score ponderado total, no un único factor.

    - `cerca_pero_nueva`: a 0km, sin reseñas (rating 0), sin experiencia.
    - `lejos_pero_excelente`: casi en el borde del radio (a ~24 km, factor
      distancia ≈ 0), pero máxima reputación, puntualidad, desempeño y
      experiencia. No más lejos que eso: fuera del radio ya no entra al
      ranking (ver "El radio es un límite duro", abajo).
    - `equilibrada`: valores intermedios en todos los factores.

    Con los pesos por defecto (distancia 0.30 / reputación 0.25 /
    experiencia 0.15 / puntualidad 0.15 / desempeño 0.15), `equilibrada`
    (≈0.73) supera a `lejos_pero_excelente` (≈0.71): perder casi todo el 30%
    de distancia pesa más que ganar el resto de los factores al máximo. Es
    el comportamiento esperado del diseño (la cercanía es el factor de mayor
    peso, ver docs/reference/MATCHING.md), no un bug.
    """
    cerca_pero_nueva = _candidate(
        full_name="cerca_pero_nueva",
        latitude=PALERMO[0],
        longitude=PALERMO[1],
        years_experience=0,
        rating=0.0,
        punctuality_rate=0.0,
        events_completed=0,
        cancellations=0,
    )
    lejos_pero_excelente = _candidate(
        full_name="lejos_pero_excelente",
        latitude=PALERMO[0] + 24 / 111.19,  # ~24 km al norte
        longitude=PALERMO[1],
        years_experience=15,
        rating=5.0,
        punctuality_rate=1.0,
        events_completed=50,
        cancellations=0,
    )
    equilibrada = _candidate(
        full_name="equilibrada",
        latitude=-34.60,
        longitude=-58.45,
        years_experience=5,
        rating=3.5,
        punctuality_rate=0.7,
        events_completed=7,
        cancellations=3,
    )
    requirement = _requirement()

    ranked = rank_candidates(
        [cerca_pero_nueva, lejos_pero_excelente, equilibrada], requirement
    )

    assert [r.full_name for r in ranked] == [
        "equilibrada",
        "lejos_pero_excelente",
        "cerca_pero_nueva",
    ]
    # El score decrece estrictamente en el orden devuelto.
    scores = [r.score for r in ranked]
    assert scores == sorted(scores, reverse=True)
    assert scores[0] > scores[1] > scores[2]


def test_ranking_excludes_ineligible_candidates():
    eligible = _candidate(full_name="elegible", is_available=True)
    wrong_skill = _candidate(
        full_name="skill_incorrecto", skills=(WorkerSkill.BARTENDER,)
    )
    unavailable = _candidate(full_name="no_disponible", is_available=False)
    requirement = _requirement(position=WorkerSkill.MOZO)

    ranked = rank_candidates([eligible, wrong_skill, unavailable], requirement)

    assert [r.full_name for r in ranked] == ["elegible"]


def test_ranking_uses_custom_weights_and_radius():
    """Con peso 100% en distancia, el orden depende únicamente de la cercanía."""
    only_distance_weights = MatchWeights(
        distance=1.0, experience=0.0, reputation=0.0, punctuality=0.0, performance=0.0
    )
    near = _candidate(full_name="cerca", latitude=PALERMO[0], longitude=PALERMO[1], rating=0.0)
    far_but_better_rated = _candidate(
        full_name="lejos_mejor_calificada",
        latitude=-34.70,
        longitude=-58.50,
        rating=5.0,
    )
    requirement = _requirement()

    ranked = rank_candidates(
        [far_but_better_rated, near], requirement, weights=only_distance_weights
    )

    assert [r.full_name for r in ranked] == ["cerca", "lejos_mejor_calificada"]


# --- El radio es un límite duro ---------------------------------------------
#
# Prueba de punta a punta (2026-11): el radio sólo puntuaba, así que con pocos
# candidatos una trabajadora de Tucumán recibía «Turno cerca tuyo» de un bar
# de Bahía Blanca, a más de 1.300 km. Fuera del radio no se avisa ni se
# sugiere, por bien que puntúe el resto.

BAHIA_BLANCA = (-38.7183, -62.2663)
TUCUMAN = (-26.8083, -65.2176)


def _fixed_distance(km: float | None):
    """`distance_fn` que devuelve siempre `km`, para probar el borde exacto."""
    return lambda _candidate, _requirement: km


def test_radios_del_aviso_y_de_la_escalada():
    """25 km en el primer aviso y 40 km en la escalada (ADR-0009)."""
    from app.modules.matching.domain.value_objects import ESCALATION_RADIUS_KM

    assert DEFAULT_MAX_RADIUS_KM == 25.0
    assert ESCALATION_RADIUS_KM == 40.0


def test_ranking_excludes_candidates_outside_the_radius():
    requirement = _requirement(latitude=BAHIA_BLANCA[0], longitude=BAHIA_BLANCA[1])
    cerca = _candidate(full_name="cerca", latitude=-38.70, longitude=-62.27)
    lejos_pero_excelente = _candidate(
        full_name="lejos_pero_excelente",
        latitude=TUCUMAN[0],
        longitude=TUCUMAN[1],
        years_experience=15,
        rating=5.0,
        punctuality_rate=1.0,
        events_completed=50,
    )

    ranked = rank_candidates([lejos_pero_excelente, cerca], requirement)

    assert [r.full_name for r in ranked] == ["cerca"]


def test_ranking_radius_boundary_is_inclusive():
    """A exactamente el radio todavía es «cerca»; un paso más allá, no."""
    requirement = _requirement()
    candidate = _candidate()

    en_el_borde = rank_candidates(
        [candidate], requirement, distance_fn=_fixed_distance(DEFAULT_MAX_RADIUS_KM)
    )
    pasado = rank_candidates(
        [candidate], requirement, distance_fn=_fixed_distance(DEFAULT_MAX_RADIUS_KM + 0.1)
    )

    assert len(en_el_borde) == 1
    assert pasado == []


def test_escalation_radius_reaches_further_but_is_also_a_hard_limit():
    """A 30 km no entra al primer aviso y sí a la escalada; a 45 km, a ninguno."""
    from app.modules.matching.domain.value_objects import ESCALATION_RADIUS_KM

    requirement = _requirement()
    candidate = _candidate()

    assert rank_candidates([candidate], requirement, distance_fn=_fixed_distance(30.0)) == []
    assert (
        len(
            rank_candidates(
                [candidate],
                requirement,
                max_radius_km=ESCALATION_RADIUS_KM,
                distance_fn=_fixed_distance(30.0),
            )
        )
        == 1
    )
    assert (
        rank_candidates(
            [candidate],
            requirement,
            max_radius_km=ESCALATION_RADIUS_KM,
            distance_fn=_fixed_distance(45.0),
        )
        == []
    )


def test_candidate_without_location_counts_only_if_city_matches():
    """Sin ubicación conocida no se puede medir: cuenta sólo si su ciudad es
    la del turno (sin mayúsculas ni tildes)."""
    requirement = _requirement(
        latitude=BAHIA_BLANCA[0], longitude=BAHIA_BLANCA[1], city="Bahía Blanca"
    )
    misma_ciudad = _candidate(
        full_name="misma_ciudad", latitude=None, longitude=None, city="bahia blanca"
    )
    otra_ciudad = _candidate(
        full_name="otra_ciudad", latitude=None, longitude=None, city="San Miguel de Tucumán"
    )
    sin_ciudad = _candidate(full_name="sin_ciudad", latitude=None, longitude=None, city=None)

    ranked = rank_candidates([otra_ciudad, sin_ciudad, misma_ciudad], requirement)

    assert [r.full_name for r in ranked] == ["misma_ciudad"]
    # Sigue sin distancia: el factor de cercanía queda neutral, como antes.
    assert ranked[0].distance_km is None


def test_shift_without_coordinates_compares_city_for_everyone():
    """Turno sin coordenadas: se compara por ciudad para todos, también para
    quien sí tiene ubicación (no hay contra qué medirla)."""
    requirement = _requirement(latitude=None, longitude=None, city="Bahía Blanca")
    de_la_ciudad = _candidate(
        full_name="de_la_ciudad",
        latitude=BAHIA_BLANCA[0],
        longitude=BAHIA_BLANCA[1],
        city="Bahía Blanca",
    )
    de_otra = _candidate(
        full_name="de_otra", latitude=TUCUMAN[0], longitude=TUCUMAN[1], city="Tucumán"
    )

    ranked = rank_candidates([de_otra, de_la_ciudad], requirement)

    assert [r.full_name for r in ranked] == ["de_la_ciudad"]


def test_with_a_known_distance_the_city_is_not_used():
    """Con distancia medible manda la distancia: una ciudad mal escrita no
    deja afuera a quien está a dos cuadras, ni mete a quien está lejos."""
    requirement = _requirement(city="Palermo")
    a_dos_cuadras = _candidate(full_name="a_dos_cuadras", city="Otra ciudad")
    lejos_misma_ciudad = _candidate(
        full_name="lejos_misma_ciudad", latitude=TUCUMAN[0], longitude=TUCUMAN[1], city="Palermo"
    )

    ranked = rank_candidates([lejos_misma_ciudad, a_dos_cuadras], requirement)

    assert [r.full_name for r in ranked] == ["a_dos_cuadras"]
