"""Tests de integración del módulo matching (top de candidatos)."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.geo import haversine_km
from tests.conftest import TEST_GUEST_PIN, auth_headers, make_admin

pytestmark = pytest.mark.asyncio


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo", "latitude": -34.58, "longitude": -58.43},
    )
    return headers


async def _worker_profile(
    client: AsyncClient, email: str, **overrides
) -> dict:
    headers = await auth_headers(client, "worker", email)
    payload = {
        "skills": ["mozo"],
        "years_experience": 2,
        "is_available": True,
        "latitude": -34.58,
        "longitude": -58.43,
    }
    payload.update(overrides)
    await client.post("/api/v1/workers/me/profile", headers=headers, json=payload)
    return headers


async def _publish_shift(client: AsyncClient, headers: dict, **overrides) -> str:
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": "2026-06-28T20:00:00",
        "end_at": "2026-06-29T03:00:00",
        "pay_amount": "70000.00",
        "latitude": -34.58,
        "longitude": -58.43,
    }
    payload.update(overrides)
    created = await client.post("/api/v1/shifts", headers=headers, json=payload)
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
    return shift_id


async def test_only_eligible_candidates_appear(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp1@staffya.com")
    shift_id = await _publish_shift(client, employer_headers)

    eligible_headers = await _worker_profile(client, "w1@staffya.com")
    await _worker_profile(client, "w2@staffya.com", skills=["bartender"])
    await _worker_profile(client, "w3@staffya.com", is_available=False)

    response = await client.get(
        f"/api/v1/shifts/{shift_id}/candidates", headers=employer_headers
    )
    assert response.status_code == 200
    candidates = response.json()
    assert len(candidates) == 1

    me = await client.get("/api/v1/workers/me/profile", headers=eligible_headers)
    assert candidates[0]["profile_id"] == me.json()["id"]


async def test_ranking_orders_by_score_desc(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp2@staffya.com")
    shift_id = await _publish_shift(client, employer_headers)

    await _worker_profile(client, "near@staffya.com", years_experience=10)
    await _worker_profile(
        client, "far@staffya.com", years_experience=0, latitude=-31.4, longitude=-64.2
    )

    response = await client.get(
        f"/api/v1/shifts/{shift_id}/candidates", headers=employer_headers
    )
    assert response.status_code == 200
    candidates = response.json()
    assert len(candidates) == 2
    assert candidates[0]["score"] > candidates[1]["score"]
    assert candidates[0]["distance_km"] < candidates[1]["distance_km"]


async def test_candidates_expose_badges_and_level(client: AsyncClient):
    """F1 (auditoría de producto 2026-08-10): `badges`/`level` (ADR-0004) ya
    se calculan, pero no llegaban a la lista de recomendados del comercio.
    Un perfil recién creado no tiene insignias todavía (nivel BRONCE)."""
    employer_headers = await _employer_with_company(client, "emp_badges@staffya.com")
    shift_id = await _publish_shift(client, employer_headers)
    await _worker_profile(client, "w_badges@staffya.com")

    response = await client.get(
        f"/api/v1/shifts/{shift_id}/candidates", headers=employer_headers
    )
    assert response.status_code == 200
    candidate = response.json()[0]
    assert candidate["badges"] == []
    assert candidate["level"] == "bronce"


async def test_other_company_cannot_see_candidates(client: AsyncClient):
    headers_a = await _employer_with_company(client, "empA@staffya.com")
    shift_id = await _publish_shift(client, headers_a)
    await _worker_profile(client, "w4@staffya.com")

    headers_b = await _employer_with_company(client, "empB@staffya.com")
    response = await client.get(
        f"/api/v1/shifts/{shift_id}/candidates", headers=headers_b
    )
    assert response.status_code == 404


async def test_worker_cannot_request_candidates(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp3@staffya.com")
    shift_id = await _publish_shift(client, employer_headers)

    worker_headers = await auth_headers(client, "worker", "w5@staffya.com")
    response = await client.get(
        f"/api/v1/shifts/{shift_id}/candidates", headers=worker_headers
    )
    assert response.status_code == 403


async def test_search_workers_filters_by_skill_and_radius(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp4@staffya.com")
    await _worker_profile(client, "near_mozo@staffya.com", skills=["mozo"])
    await _worker_profile(
        client,
        "far_mozo@staffya.com",
        skills=["mozo"],
        latitude=-31.4,
        longitude=-64.2,
    )
    await _worker_profile(client, "near_bartender@staffya.com", skills=["bartender"])

    response = await client.get(
        "/api/v1/matching/search",
        headers=employer_headers,
        params={
            "skill": "mozo",
            "latitude": -34.58,
            "longitude": -58.43,
            "radius_km": 25,
        },
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["distance_km"] < 1


async def test_search_workers_without_filters_returns_all_available(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp5@staffya.com")
    await _worker_profile(client, "any1@staffya.com", skills=["mozo"])
    await _worker_profile(client, "any2@staffya.com", skills=["bartender"])

    response = await client.get("/api/v1/matching/search", headers=employer_headers)
    assert response.status_code == 200
    assert len(response.json()) == 2


async def test_search_map_never_returns_the_workers_exact_coordinates(
    client: AsyncClient,
):
    """TECH_DEBT.md S4 / ADR-0014 §3: el mapa del comercio no puede dibujar un
    pin sobre el domicilio real de nadie que no le haya dado ningún turno."""
    employer_headers = await _employer_with_company(client, "emp_fuzz@staffya.com")
    await _worker_profile(
        client, "w_fuzz@staffya.com", skills=["mozo"], latitude=-34.58, longitude=-58.43
    )

    response = await client.get(
        "/api/v1/matching/search",
        headers=employer_headers,
        params={"latitude": -34.6, "longitude": -58.45},
    )
    assert response.status_code == 200
    worker = response.json()[0]
    assert (worker["latitude"], worker["longitude"]) != (-34.58, -58.43)
    # La distancia se mide desde el pin desplazado, no desde el domicilio:
    # con la real, tres búsquedas desde puntos distintos triangulaban la casa
    # (revisión de seguridad 2026-10-20).
    from_pin = haversine_km(worker["latitude"], worker["longitude"], -34.6, -58.45)
    real = haversine_km(-34.58, -58.43, -34.6, -58.45)
    assert worker["distance_km"] == round(from_pin, 1)
    assert worker["distance_km"] != round(real, 3)


async def test_worker_cannot_search_map(client: AsyncClient):
    worker_headers = await auth_headers(client, "worker", "w6@staffya.com")
    response = await client.get("/api/v1/matching/search", headers=worker_headers)
    assert response.status_code == 403


async def test_admin_can_search_map_read_only(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    """El admin explora el mapa de trabajadores en modo sólo-lectura, sin
    tener que impersonar a nadie puntual (pedido real de Julieta, "Ver como"
    de PR #165 no alcanzaba para esto)."""
    await _worker_profile(client, "any3@staffya.com", skills=["mozo"])

    admin_headers = await make_admin(client, session_factory, "admin_search@staffya.com")

    response = await client.get("/api/v1/matching/search", headers=admin_headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


async def test_guest_worker_excluded_from_search_results(client: AsyncClient):
    """La cuenta invitado compartida ("Explorar sin cuenta") es un sandbox de
    demo, no un trabajador real: no debe aparecer en los resultados que ve un
    comercio/admin real buscando a quién contratar (pedido de Julieta, salía
    mezclada con trabajadores reales en QA)."""
    guest_login = await client.post(
        "/api/v1/auth/guest", json={"pin": TEST_GUEST_PIN, "role": "worker"}
    )
    assert guest_login.status_code == 200
    guest_headers = {
        "Authorization": f"Bearer {guest_login.json()['access_token']}"
    }
    await client.post(
        "/api/v1/workers/me/profile",
        headers=guest_headers,
        json={
            "skills": ["mozo"],
            "years_experience": 2,
            "is_available": True,
            "latitude": -34.58,
            "longitude": -58.43,
        },
    )
    await _worker_profile(client, "real_worker@staffya.com", skills=["mozo"])

    employer_headers = await _employer_with_company(client, "emp6@staffya.com")
    response = await client.get("/api/v1/matching/search", headers=employer_headers)
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["full_name"] != "Invitado · Trabajador"


async def test_top_candidates_score_does_not_leak_the_real_distance():
    """Revisión de seguridad 2026-10-21: el `score` del top de candidatos se
    calculaba con la distancia REAL aunque `distance_km` ya saliera del pin
    desplazado. Con tres turnos de lat/lng elegidas, Δdist = Δscore·25/0,30
    despejaba la distancia real y triangulaba el domicilio. Dos turnos a la
    misma distancia pública pero a distinta distancia real tienen que dar el
    MISMO score."""
    from types import SimpleNamespace
    from uuid import UUID, uuid4

    from app.core.geo import fuzz_point
    from app.modules.matching.application.services import MatchingService
    from app.modules.matching.domain.entities import CandidateProfile
    from app.modules.worker.domain.value_objects import WorkerSkill

    home = (-34.58, -58.43)
    candidate = CandidateProfile(
        profile_id=UUID("11111111-2222-3333-4444-555555555555"),
        user_id=uuid4(),
        full_name="Candidata",
        photo_url=None,
        skills=(WorkerSkill.MOZO,),
        years_experience=2,
        rating=4.0,
        punctuality_rate=0.9,
        events_completed=10,
        cancellations=0,
        no_shows=0,
        is_available=True,
        latitude=home[0],
        longitude=home[1],
    )
    pin = fuzz_point(*home, str(candidate.profile_id))
    # Dos turnos sobre la recta pin→domicilio, a ~2,03 km del pin: uno del
    # lado del domicilio (real ≈ 2,03 − r) y otro del lado opuesto
    # (real ≈ 2,03 + r), con r = desplazamiento del pin (≥ 0,15 km).
    r = haversine_km(*pin, *home)
    k = 2.03 / r
    d_lat, d_lng = home[0] - pin[0], home[1] - pin[1]
    near = (pin[0] + d_lat * k, pin[1] + d_lng * k)
    far = (pin[0] - d_lat * k, pin[1] - d_lng * k)

    company_id = uuid4()
    shifts = {
        "near": SimpleNamespace(
            company_id=company_id, position=WorkerSkill.MOZO, latitude=near[0], longitude=near[1]
        ),
        "far": SimpleNamespace(
            company_id=company_id, position=WorkerSkill.MOZO, latitude=far[0], longitude=far[1]
        ),
    }

    class _Shifts:
        async def get_by_id(self, shift_id):
            return shifts[shift_id]

    class _Candidates:
        async def list_available(self, position):
            return [candidate]

    service = MatchingService(_Shifts(), _Candidates())
    [a] = await service.get_top_candidates("near", company_id)
    [b] = await service.get_top_candidates("far", company_id)

    real_a = haversine_km(*home, *near)
    real_b = haversine_km(*home, *far)
    assert abs(real_a - real_b) > 0.25  # de verdad están a distinta distancia
    assert a.distance_km == b.distance_km == 2.0  # misma banda pública
    assert a.score == b.score  # el score no despeja la distancia real


async def _notifications_of(session_factory, email: str) -> list[str]:
    """Tipos de los avisos guardados para esa cuenta (directo de la base:
    un admin necesita la verificación en dos pasos para pedirlos por API)."""
    from sqlalchemy import select

    from app.modules.identity.infrastructure.models import UserModel
    from app.modules.notification.infrastructure.models import NotificationModel

    async with session_factory() as session:
        result = await session.execute(
            select(NotificationModel.type)
            .join(UserModel, UserModel.id == NotificationModel.user_id)
            .where(UserModel.email == email)
        )
        return list(result.scalars().all())


async def test_admin_with_worker_profile_is_not_a_candidate_nor_notified(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    """Pedido de Julieta (2026-10-30): su cuenta es admin pero tiene un
    `worker_profile` viejo de pruebas, y le llegaban todos los avisos de
    "turno cerca tuyo" (86 sin leer). Un admin no es candidato: ni aviso, ni
    lista de candidatos del comercio, ni mapa de búsqueda."""
    from tests.conftest import promote_to_admin

    await _worker_profile(client, "admin_con_perfil@staffya.com")
    await promote_to_admin(session_factory, "admin_con_perfil@staffya.com")
    worker_headers = await _worker_profile(client, "real_cerca@staffya.com")

    employer_headers = await _employer_with_company(client, "emp_admin_perfil@staffya.com")
    shift_id = await _publish_shift(client, employer_headers)

    assert await _notifications_of(session_factory, "admin_con_perfil@staffya.com") == []
    assert await _notifications_of(session_factory, "real_cerca@staffya.com") == [
        "new_shift_nearby"
    ]

    me = await client.get("/api/v1/workers/me/profile", headers=worker_headers)
    candidates = await client.get(
        f"/api/v1/shifts/{shift_id}/candidates", headers=employer_headers
    )
    assert candidates.status_code == 200
    assert [c["profile_id"] for c in candidates.json()] == [me.json()["id"]]

    search = await client.get("/api/v1/matching/search", headers=employer_headers)
    assert search.status_code == 200
    assert [w["profile_id"] for w in search.json()] == [me.json()["id"]]


async def test_suspended_worker_is_not_a_candidate_nor_notified(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    """Un suspendido no puede entrar (`User.is_active`): avisarle un turno o
    recomendárselo al comercio no sirve de nada."""
    from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository

    await _worker_profile(client, "suspendido@staffya.com")
    async with session_factory() as session:
        repo = SqlAlchemyUserRepository(session)
        user = await repo.get_by_email("suspendido@staffya.com")
        user.suspend()
        await repo.update(user)

    employer_headers = await _employer_with_company(client, "emp_suspendido@staffya.com")
    shift_id = await _publish_shift(client, employer_headers)

    assert await _notifications_of(session_factory, "suspendido@staffya.com") == []
    candidates = await client.get(
        f"/api/v1/shifts/{shift_id}/candidates", headers=employer_headers
    )
    assert candidates.status_code == 200
    assert candidates.json() == []
