"""Tests unitarios (sin DB) de las reglas de otorgamiento de insignias y
niveles — ADR-0004. `compute_badges`/`compute_level` son funciones puras de
dominio sobre `WorkerProfile`; se testean con casos límite (justo en el
umbral / justo debajo) sin pasar por HTTP ni SQLAlchemy."""

from uuid import uuid4

import pytest

from app.modules.worker.domain.entities import WorkerProfile
from app.modules.worker.domain.rules import compute_badges, compute_level
from app.modules.worker.domain.value_objects import (
    GamificationLevel,
    WorkerBadge,
    WorkerSkill,
)


def _profile(**overrides) -> WorkerProfile:
    defaults = dict(user_id=uuid4())
    defaults.update(overrides)
    return WorkerProfile(**defaults)


# --- nunca_falto: 0 cancelaciones y >= 3 eventos completados ---


def test_nunca_falto_otorgada_en_el_umbral():
    profile = _profile(cancellations=0, events_completed=3)
    assert WorkerBadge.NUNCA_FALTO in compute_badges(profile)


def test_nunca_falto_no_otorgada_justo_debajo_del_umbral():
    profile = _profile(cancellations=0, events_completed=2)
    assert WorkerBadge.NUNCA_FALTO not in compute_badges(profile)


def test_nunca_falto_no_otorgada_si_hay_alguna_cancelacion():
    profile = _profile(cancellations=1, events_completed=10)
    assert WorkerBadge.NUNCA_FALTO not in compute_badges(profile)


# --- top_mozo / top_bartender: skill + rating >= 4.5 + events >= 10 ---


def test_top_mozo_otorgada_en_el_umbral():
    profile = _profile(
        skills=[WorkerSkill.MOZO], rating=4.5, events_completed=10
    )
    assert WorkerBadge.TOP_MOZO in compute_badges(profile)


def test_top_mozo_no_otorgada_con_rating_justo_debajo():
    profile = _profile(
        skills=[WorkerSkill.MOZO], rating=4.49, events_completed=10
    )
    assert WorkerBadge.TOP_MOZO not in compute_badges(profile)


def test_top_mozo_no_otorgada_con_eventos_justo_debajo():
    profile = _profile(
        skills=[WorkerSkill.MOZO], rating=5.0, events_completed=9
    )
    assert WorkerBadge.TOP_MOZO not in compute_badges(profile)


def test_top_mozo_no_otorgada_sin_el_skill():
    profile = _profile(
        skills=[WorkerSkill.BARTENDER], rating=5.0, events_completed=20
    )
    assert WorkerBadge.TOP_MOZO not in compute_badges(profile)


def test_top_bartender_otorgada_en_el_umbral():
    profile = _profile(
        skills=[WorkerSkill.BARTENDER], rating=4.5, events_completed=10
    )
    assert WorkerBadge.TOP_BARTENDER in compute_badges(profile)


def test_top_mozo_y_top_bartender_ambas_con_ambos_skills():
    profile = _profile(
        skills=[WorkerSkill.MOZO, WorkerSkill.BARTENDER],
        rating=4.8,
        events_completed=15,
    )
    badges = compute_badges(profile)
    assert WorkerBadge.TOP_MOZO in badges
    assert WorkerBadge.TOP_BARTENDER in badges


# --- eventos_premium: events_completed >= 20 (proxy por volumen) ---


def test_eventos_premium_otorgada_en_el_umbral():
    profile = _profile(events_completed=20)
    assert WorkerBadge.EVENTOS_PREMIUM in compute_badges(profile)


def test_eventos_premium_no_otorgada_justo_debajo():
    profile = _profile(events_completed=19)
    assert WorkerBadge.EVENTOS_PREMIUM not in compute_badges(profile)


# --- perfil_verificado: fuera de la lógica automática (ADR-0004) ---


def test_perfil_verificado_nunca_se_otorga_automaticamente():
    """`is_verified` vive en `User` (identity), no en `WorkerProfile`; el
    cálculo puro de dominio no cruza módulos, así que esta insignia queda
    fuera de `compute_badges` (ver ADR-0004)."""
    profile = _profile(
        skills=[WorkerSkill.MOZO],
        rating=5.0,
        events_completed=100,
        cancellations=0,
    )
    assert WorkerBadge.PERFIL_VERIFICADO not in compute_badges(profile)


# --- niveles: events_completed con piso de rating, sin histéresis ---


@pytest.mark.parametrize(
    ("events_completed", "rating", "expected"),
    [
        (0, 0.0, GamificationLevel.BRONCE),
        (4, 5.0, GamificationLevel.BRONCE),  # eventos insuficientes para plata
        (5, 3.4, GamificationLevel.BRONCE),  # rating justo debajo del piso de plata
        (5, 3.5, GamificationLevel.PLATA),  # umbral exacto de plata
        (19, 4.0, GamificationLevel.PLATA),  # eventos insuficientes para oro
        (20, 3.9, GamificationLevel.PLATA),  # rating justo debajo del piso de oro
        (20, 4.0, GamificationLevel.ORO),  # umbral exacto de oro
        (49, 4.5, GamificationLevel.ORO),  # eventos insuficientes para platino
        (50, 4.4, GamificationLevel.ORO),  # rating justo debajo del piso de platino
        (50, 4.5, GamificationLevel.PLATINO),  # umbral exacto de platino
        (200, 5.0, GamificationLevel.PLATINO),
    ],
)
def test_compute_level_umbrales(events_completed, rating, expected):
    profile = _profile(events_completed=events_completed, rating=rating)
    assert compute_level(profile) == expected


def test_compute_level_sin_histeresis_baja_si_ya_no_alcanza_el_piso():
    """Sin memoria: un perfil que hoy no llega al piso de rating de un
    nivel no lo conserva aunque antes lo hubiera alcanzado (se recalcula
    desde cero en cada evento, ADR-0004)."""
    profile = _profile(events_completed=60, rating=3.0)
    assert compute_level(profile) == GamificationLevel.BRONCE
