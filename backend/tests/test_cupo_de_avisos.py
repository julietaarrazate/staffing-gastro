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
    """Con tope 8 hay 2 lugares reservados y 6 por ranking. La nueva que va
    primera entra por ranking; los dos reservados son para otras dos."""
    primera = P("nueva-primera", events_completed=0)
    otras = [P(f"nueva-{i}", events_completed=0, distance_km=i) for i in (3, 4, 5)]
    ranked = [primera] + [P(f"h{i}") for i in range(12)] + otras

    elegidos = repartir_cupo(ranked, 8, {primera.user_id, *(o.user_id for o in otras)})

    assert _nombres(elegidos) == [
        "nueva-primera", "h0", "h1", "h2", "h3", "h4", "nueva-3", "nueva-4",
    ]


def test_con_tope_menor_a_cuatro_no_hay_lugares_reservados():
    nueva = P("nueva", events_completed=0, distance_km=0.1)
    ranked = [P(f"h{i}") for i in range(6)] + [nueva]
    for tope in (1, 2, 3):
        assert _nombres(repartir_cupo(ranked, tope, {nueva.user_id})) == [
            f"h{i}" for i in range(tope)
        ]
    assert repartir_cupo([], 20, set()) == []


def test_sin_distancia_va_ultima_entre_las_nuevas():
    sin_distancia = P("sin-distancia", events_completed=0, distance_km=None)
    con_distancia = P("con-distancia", events_completed=0, distance_km=20)
    ranked = [P(f"h{i}") for i in range(8)] + [sin_distancia, con_distancia]
    elegidos = repartir_cupo(ranked, 4, {sin_distancia.user_id, con_distancia.user_id})
    assert _nombres(elegidos)[-1] == "con-distancia"


def test_pocas_nuevas_verificadas_el_resto_del_cupo_vuelve_al_ranking():
    nueva = P("nueva", events_completed=0)
    ranked = [P(f"h{i}") for i in range(12)] + [nueva]
    # Tope 8: 6 por ranking, 2 reservados, pero hay una sola nueva.
    assert _nombres(repartir_cupo(ranked, 8, {nueva.user_id})) == [
        "h0", "h1", "h2", "h3", "h4", "h5", "h6", "nueva",
    ]


def test_nunca_pasa_del_tope_ni_repite():
    ranked = [P(f"n{i}", events_completed=0, distance_km=i) for i in range(50)]
    elegidos = repartir_cupo(ranked, 20, {p.user_id for p in ranked})
    assert len(elegidos) == 20
    assert len({p.profile_id for p in elegidos}) == 20
    assert repartir_cupo(ranked, 0, set()) == []


async def test_al_publicar_la_nueva_verificada_que_no_entraba_por_ranking_recibe_el_aviso(
    client, session_factory, monkeypatch
):
    """De punta a punta: con el tope en 4 (3 por ranking y 1 reservado), de
    seis personas nuevas a distancia creciente la más lejana no entraría;
    como es la única verificada, se queda con el lugar reservado."""
    from datetime import timedelta
    from uuid import UUID as _UUID

    from app.modules.verification.domain.value_objects import ClaimStatus, ClaimType
    from app.modules.verification.infrastructure.models import IdentityClaimModel
    from app.modules.worker.infrastructure.models import WorkerProfileModel
    from tests.conftest import auth_headers
    from tests.test_favorite import PALERMO, _employer_with_company, _now_naive

    monkeypatch.setattr(ShiftService, "NEARBY_NOTIFICATION_LIMIT", 4)
    employer = await _employer_with_company(client, "cupo_emp@staffya.com")
    personas = []
    for i in range(6):
        headers = await auth_headers(client, "worker", f"cupo_w{i}@staffya.com")
        perfil = await client.post(
            "/api/v1/workers/me/profile",
            headers=headers,
            # Cada una unos 550 m más lejos del local que la anterior.
            json={
                "skills": ["mozo"],
                "latitude": PALERMO["latitude"] + 0.005 * i,
                "longitude": PALERMO["longitude"],
            },
        )
        personas.append((headers, perfil.json()["id"]))
    async with session_factory() as session:
        lejana = await session.get(WorkerProfileModel, _UUID(personas[-1][1]))
        session.add(
            IdentityClaimModel(
                user_id=lejana.user_id,
                claim_type=ClaimType.DOCUMENTO_VERIFICADO.value,
                status=ClaimStatus.VERIFICADA.value,
            )
        )
        await session.commit()

    inicio = _now_naive() + timedelta(days=1)
    creado = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json={
            "position": "mozo",
            "quantity": 1,
            "start_at": inicio.isoformat(),
            "end_at": (inicio + timedelta(hours=6)).isoformat(),
            "pay_amount": "60000.00",
            "city": "Palermo",
            **PALERMO,
        },
    )
    await client.post(f"/api/v1/shifts/{creado.json()['id']}/publish", headers=employer)

    recibieron = []
    for headers, _ in personas:
        avisos = (await client.get("/api/v1/notifications", headers=headers)).json()
        recibieron.append(any(a["type"] == "new_shift_nearby" for a in avisos))

    assert sum(recibieron) == 4
    assert recibieron[-1] is True, "la nueva verificada tiene su lugar reservado"
    assert recibieron[:3] == [True, True, True], "las tres más cercanas entran por ranking"
