"""Reparto del cupo de avisos de «turno cerca» (`shift/domain/cupo_de_avisos.py`)."""

from dataclasses import dataclass
from uuid import UUID, uuid4

from app.modules.shift.application.services import ShiftService
from app.modules.shift.domain.cupo_de_avisos import repartir_cupo


@dataclass
class P:
    nombre: str
    events_completed: int = 5
    distance_km: float | None = 1.0
    profile_id: UUID = None  # type: ignore[assignment]
    user_id: UUID = None  # type: ignore[assignment]

    def __post_init__(self):
        self.profile_id = uuid4()
        self.user_id = uuid4()


def _nombres(ps):
    return [p.nombre for p in ps]


def test_los_topes_vigentes():
    assert ShiftService.NEARBY_NOTIFICATION_LIMIT == 20
    assert ShiftService.ESCALATION_NOTIFICATION_LIMIT == 40


def test_si_entran_todos_no_se_toca_nada():
    gente = [P("a"), P("b", events_completed=0)]
    assert repartir_cupo(gente, 20, set()) == gente


def test_una_cuarta_parte_del_cupo_es_para_nuevos_verificados_los_mas_cercanos():
    con_historial = [P(f"h{i}") for i in range(8)]
    lejos = P("nueva-lejos", events_completed=0, distance_km=9)
    cerca = P("nueva-cerca", events_completed=0, distance_km=2)
    sin_verificar = P("nueva-sin-verificar", events_completed=0, distance_km=0.5)
    ranked = con_historial + [lejos, sin_verificar, cerca]

    elegidos = repartir_cupo(ranked, 4, {lejos.user_id, cerca.user_id})

    # 3 por ranking y 1 lugar (4 // 4) para la nueva verificada más cercana.
    assert _nombres(elegidos) == ["h0", "h1", "h2", "nueva-cerca"]


def test_sin_gente_nueva_el_cupo_vuelve_al_ranking():
    ranked = [P(f"h{i}") for i in range(10)]
    assert _nombres(repartir_cupo(ranked, 4, set())) == ["h0", "h1", "h2", "h3"]


def test_una_nueva_que_ya_entraba_por_ranking_no_gasta_lugar_reservado():
    primera = P("nueva-primera", events_completed=0)
    otra = P("nueva-otra", events_completed=0, distance_km=3)
    ranked = [primera] + [P(f"h{i}") for i in range(8)] + [otra]

    elegidos = repartir_cupo(ranked, 4, {primera.user_id, otra.user_id})

    assert _nombres(elegidos) == ["nueva-primera", "h0", "h1", "nueva-otra"]


def test_nunca_pasa_del_tope_ni_repite():
    ranked = [P(f"n{i}", events_completed=0, distance_km=i) for i in range(50)]
    elegidos = repartir_cupo(ranked, 20, {p.user_id for p in ranked})
    assert len(elegidos) == 20
    assert len({p.profile_id for p in elegidos}) == 20
    assert repartir_cupo(ranked, 0, set()) == []
