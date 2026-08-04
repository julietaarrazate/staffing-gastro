"""Test de integración de PRIMER_TURNO_REAL_SPEC — Parte A.

Recorre el ciclo COMPLETO de un turno entre dos cuentas reales (comercio +
trabajador) tal como lo pide el spec: publicar → postular → asignar →
check-in → check-out → finalizar → AMBOS se califican → la reputación del
trabajador y del comercio se actualiza → el trabajador mejor calificado sube
en el ranking de matching de un turno nuevo.

Nada de esto se había recorrido de punta a punta en un solo test antes de
este batch: cada eslabón tenía cobertura unitaria/parcial en otros archivos
(`test_shift.py`, `test_attendance.py`, `test_review.py`, `test_matching.py`)
pero ninguno verificaba que la reputación *calculada por una reseña real*
efectivamente entra al *ranking real* de un turno nuevo — que es exactamente
el hallazgo que este batch existe para confirmar o refutar (ver
`docs/adr/ADR-0007-no-show-y-cancelacion-tardia.md` y el reporte del batch).
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio

PALERMO = {"latitude": -34.58, "longitude": -58.43}


def _now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email, "Bar Palermo")
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo", **PALERMO},
    )
    return headers


async def _worker_with_profile(client: AsyncClient, email: str, name: str) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email, name)
    profile = await client.post(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={
            "skills": ["mozo"],
            "years_experience": 3,
            "is_available": True,
            **PALERMO,
        },
    )
    return headers, profile.json()["id"]


def _shift_payload(**overrides) -> dict:
    # Horario dinámico (ahora): la puntualidad se mide contra `start_at` con
    # una tolerancia de ±15 min (R2.4, docs/reference/REPUTATION.md), así que un
    # `start_at` fijo en el pasado haría que el check-in "ahora" mismo del
    # test nunca sea puntual. Mismo criterio que
    # `test_attendance.py::test_finish_with_punctual_checkin_updates_worker_metrics`.
    now = _now_naive()
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": now.isoformat(),
        "end_at": (now + timedelta(hours=5)).isoformat(),
        "pay_amount": "70000.00",
        "city": "Palermo",
        **PALERMO,
    }
    payload.update(overrides)
    return payload


async def test_full_review_cycle_closes_and_reputation_enters_matching_ranking(
    client: AsyncClient,
):
    """Ciclo completo, punta a punta, entre dos cuentas reales.

    Se corren DOS trabajadores con el mismo perfil "de base" (misma
    experiencia, misma ubicación, mismo skill) y el mismo historial de turno
    (1 turno finalizado, check-in puntual, 0 cancelaciones/no-shows) — la
    ÚNICA diferencia entre ambos al final es la reseña que recibieron
    (5 estrellas vs. 1 estrella). Así, si el ranking de un turno nuevo
    efectivamente lee `rating` real, el mejor calificado tiene que quedar
    primero — y si no lo lee (el hallazgo que el spec pide confirmar/refutar
    fuerte), este test lo va a mostrar con un assert que compara scores.
    """
    employer_headers = await _employer_with_company(client, "e2e_emp@staffya.com")

    async def _run_shift_to_review(worker_email: str, worker_name: str) -> tuple[dict, str]:
        # 1) publicar
        created = await client.post(
            "/api/v1/shifts",
            headers=employer_headers,
            json=_shift_payload(city=f"Palermo-{worker_email}"),
        )
        assert created.status_code == 201
        shift_id = created.json()["id"]
        published = await client.post(
            f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers
        )
        assert published.status_code == 200
        assert published.json()["status"] == "publicado"

        worker_headers, worker_profile_id = await _worker_with_profile(
            client, worker_email, worker_name
        )

        # 2) postular (lado trabajador del match — no asignación directa)
        applied = await client.post(
            f"/api/v1/applications/shifts/{shift_id}", headers=worker_headers
        )
        assert applied.status_code == 201
        assert applied.json()["status"] == "pendiente"

        # El comercio ve al postulante en su lista (enriquecido).
        applicants = await client.get(
            f"/api/v1/applications/shifts/{shift_id}", headers=employer_headers
        )
        assert applicants.status_code == 200
        assert any(
            a["worker_profile_id"] == worker_profile_id for a in applicants.json()
        )

        # 3) asignar (el comercio elige a este postulante)
        assigned = await client.post(
            f"/api/v1/shifts/{shift_id}/assign",
            headers=employer_headers,
            json={"worker_profile_id": worker_profile_id},
        )
        assert assigned.status_code == 200
        assert assigned.json()["status"] == "asignado"

        confirmed = await client.post(
            f"/api/v1/shifts/{shift_id}/confirm", headers=worker_headers
        )
        assert confirmed.status_code == 200
        assert confirmed.json()["status"] == "confirmado"

        # 4) check-in / check-out (asistencia geolocalizada)
        await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=worker_headers)
        checked_in = await client.post(
            f"/api/v1/shifts/{shift_id}/check-in", headers=worker_headers, json=PALERMO
        )
        assert checked_in.status_code == 200
        await client.post(
            f"/api/v1/shifts/{shift_id}/start-working", headers=worker_headers
        )
        checked_out = await client.post(
            f"/api/v1/shifts/{shift_id}/check-out", headers=worker_headers, json=PALERMO
        )
        assert checked_out.status_code == 200

        # 5) finalizar
        finished = await client.post(
            f"/api/v1/shifts/{shift_id}/finish", headers=employer_headers
        )
        assert finished.status_code == 200
        assert finished.json()["status"] == "finalizado"

        # Reputación derivada del ciclo real (R2.4), igual para ambos
        # trabajadores en este punto: 1 evento completado, puntual, 0
        # cancelaciones/no-shows.
        profile = await client.get("/api/v1/workers/me/profile", headers=worker_headers)
        assert profile.json()["events_completed"] == 1
        assert profile.json()["punctuality_rate"] == pytest.approx(1.0)
        assert profile.json()["cancellations"] == 0
        assert profile.json()["no_shows"] == 0

        return worker_headers, shift_id

    star_headers, star_shift_id = await _run_shift_to_review(
        "e2e_star_worker@staffya.com", "Estrella Puntual"
    )
    flop_headers, flop_shift_id = await _run_shift_to_review(
        "e2e_flop_worker@staffya.com", "Flop Puntual"
    )

    # 6) AMBOS se califican — comercio → trabajador y trabajador → comercio,
    # en los dos turnos (recorremos el lazo completo, no sólo una punta).
    for shift_id, worker_headers, worker_rating in (
        (star_shift_id, star_headers, 5),
        (flop_shift_id, flop_headers, 1),
    ):
        from_employer = await client.post(
            f"/api/v1/reviews/shifts/{shift_id}",
            headers=employer_headers,
            json={"rating": worker_rating, "comment": "Turno cerrado"},
        )
        assert from_employer.status_code == 201

        from_worker = await client.post(
            f"/api/v1/reviews/shifts/{shift_id}",
            headers=worker_headers,
            json={"rating": 5, "comment": "Buena experiencia"},
        )
        assert from_worker.status_code == 201

    # 7) la reputación del trabajador (y del comercio) se actualizó.
    star_profile = await client.get("/api/v1/workers/me/profile", headers=star_headers)
    assert star_profile.json()["rating"] == pytest.approx(5.0)

    flop_profile = await client.get("/api/v1/workers/me/profile", headers=flop_headers)
    assert flop_profile.json()["rating"] == pytest.approx(1.0)

    company_profile = await client.get(
        "/api/v1/companies/me/profile", headers=employer_headers
    )
    # El comercio recibió 2 reseñas de 5 (una por cada trabajador).
    assert company_profile.json()["rating"] == pytest.approx(5.0)

    # 8) el trabajador mejor calificado sube en el ranking de un turno NUEVO.
    new_shift = await client.post(
        "/api/v1/shifts",
        headers=employer_headers,
        json=_shift_payload(city="Palermo-ranking-nuevo"),
    )
    new_shift_id = new_shift.json()["id"]
    await client.post(f"/api/v1/shifts/{new_shift_id}/publish", headers=employer_headers)

    candidates = await client.get(
        f"/api/v1/shifts/{new_shift_id}/candidates", headers=employer_headers
    )
    assert candidates.status_code == 200
    ranked = candidates.json()
    assert len(ranked) == 2

    by_rating = {c["rating"]: c for c in ranked}
    # La API de matching efectivamente devuelve el rating REAL post-reseña
    # (no un valor stale de creación del perfil).
    assert 5.0 in by_rating
    assert 1.0 in by_rating

    # HALLAZGO CRÍTICO A VERIFICAR: si el ranking de matching lee la
    # reputación real, el candidato de 5 estrellas tiene que tener mayor
    # score que el de 1 estrella (con experiencia/ubicación/desempeño
    # idénticos, la única variable que cambia es el rating). Si esto
    # fallara, sería la evidencia de que el score no lee la reputación real
    # — el hallazgo más importante que este batch existe para encontrar.
    assert by_rating[5.0]["score"] > by_rating[1.0]["score"]
    # Y en consecuencia, el mejor calificado aparece primero en el ranking.
    assert ranked[0]["rating"] == 5.0
