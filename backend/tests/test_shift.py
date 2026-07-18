"""Tests de integración del módulo shift (publicación y ciclo de vida del turno)."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.main import app
from app.modules.notification.api.dependencies import get_email_sender
from app.modules.notification.infrastructure.fake_email_sender import FakeEmailSender
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


@pytest.fixture
def fake_email_sender():
    """Reemplaza el EmailSender real por un doble que captura los envíos
    (mismo patrón que `FakeBillingGateway` en tests/test_subscription.py)."""
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_email_sender, None)


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    """Empleador con perfil de comercio listo para publicar turnos."""
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    return headers


def _shift_payload(**overrides) -> dict:
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": "2026-06-28T20:00:00",
        "end_at": "2026-06-29T03:00:00",
        "pay_amount": "70000.00",
        "tips": True,
        "dress_code": "Camisa negra",
        "urgent": True,
        "city": "Palermo",
    }
    payload.update(overrides)
    return payload


async def test_employer_creates_shift_as_draft(client: AsyncClient):
    headers = await _employer_with_company(client, "emp1@staffya.com")
    response = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    assert response.status_code == 201
    body = response.json()
    assert body["position"] == "mozo"
    assert body["quantity"] == 1
    assert float(body["pay_amount"]) == 70000.0
    assert body["status"] == "borrador"
    assert body["urgent"] is True


async def test_employer_without_company_cannot_publish(client: AsyncClient):
    headers = await auth_headers(client, "employer", "emp_nc@staffya.com")
    response = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    assert response.status_code == 400


async def test_worker_cannot_create_shift(client: AsyncClient):
    headers = await auth_headers(client, "worker", "mozo_s@staffya.com")
    response = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    assert response.status_code == 403


async def test_quantity_greater_than_one_rejected(client: AsyncClient):
    """R1.4: un turno = una persona hasta implementar multi-asignación."""
    headers = await _employer_with_company(client, "emp_qty@staffya.com")
    response = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload(quantity=2)
    )
    assert response.status_code == 422


async def test_invalid_schedule_rejected(client: AsyncClient):
    headers = await _employer_with_company(client, "emp2@staffya.com")
    response = await client.post(
        "/api/v1/shifts",
        headers=headers,
        json=_shift_payload(
            start_at="2026-06-28T20:00:00", end_at="2026-06-28T19:00:00"
        ),
    )
    assert response.status_code == 400


async def test_publish_flow_and_feed(client: AsyncClient):
    headers = await _employer_with_company(client, "emp3@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]

    # En borrador todavía no aparece en el feed.
    feed_before = await client.get("/api/v1/shifts/feed", headers=headers)
    assert all(s["id"] != shift_id for s in feed_before.json())

    published = await client.post(
        f"/api/v1/shifts/{shift_id}/publish", headers=headers
    )
    assert published.status_code == 200
    assert published.json()["status"] == "publicado"

    # Ahora sí aparece en el feed.
    feed_after = await client.get("/api/v1/shifts/feed", headers=headers)
    assert any(s["id"] == shift_id for s in feed_after.json())


async def test_cannot_publish_twice(client: AsyncClient):
    headers = await _employer_with_company(client, "emp4@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
    second = await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
    assert second.status_code == 400


async def test_cancel_shift(client: AsyncClient):
    headers = await _employer_with_company(client, "emp5@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    cancelled = await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=headers)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelado"


async def test_cannot_edit_after_cancel(client: AsyncClient):
    headers = await _employer_with_company(client, "emp6@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=headers)
    update = await client.put(
        f"/api/v1/shifts/{shift_id}",
        headers=headers,
        json=_shift_payload(dress_code="Traje formal"),
    )
    assert update.status_code == 400


async def test_other_company_cannot_see_or_touch_shift(client: AsyncClient):
    headers_a = await _employer_with_company(client, "empA@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=headers_a, json=_shift_payload()
    )
    shift_id = created.json()["id"]

    headers_b = await _employer_with_company(client, "empB@staffya.com")
    # No aparece en "mis turnos" del otro comercio.
    mine_b = await client.get("/api/v1/shifts/me", headers=headers_b)
    assert all(s["id"] != shift_id for s in mine_b.json())
    # Y no puede cancelarlo.
    cancel_b = await client.post(
        f"/api/v1/shifts/{shift_id}/cancel", headers=headers_b
    )
    assert cancel_b.status_code == 404


async def test_feed_filters_by_position(client: AsyncClient):
    headers = await _employer_with_company(client, "emp7@staffya.com")
    for position in ("mozo", "bartender"):
        created = await client.post(
            "/api/v1/shifts", headers=headers, json=_shift_payload(position=position)
        )
        await client.post(
            f"/api/v1/shifts/{created.json()['id']}/publish", headers=headers
        )

    feed = await client.get(
        "/api/v1/shifts/feed", headers=headers, params={"position": "bartender"}
    )
    assert feed.status_code == 200
    positions = {s["position"] for s in feed.json()}
    assert positions == {"bartender"}


async def _worker_with_profile(client: AsyncClient, email: str) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email)
    profile = await client.post(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={"skills": ["mozo"]},
    )
    return headers, profile.json()["id"]


async def test_assign_confirm_flow(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp8@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "w_assign@staffya.com"
    )
    assigned = await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )
    assert assigned.status_code == 200
    assert assigned.json()["status"] == "asignado"
    assert assigned.json()["worker_profile_id"] == worker_profile_id

    confirmed = await client.post(
        f"/api/v1/shifts/{shift_id}/confirm", headers=worker_headers
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmado"


async def test_reject_assignment_reopens_search(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp9@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "w_reject@staffya.com"
    )
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )

    rejected = await client.post(
        f"/api/v1/shifts/{shift_id}/reject", headers=worker_headers
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "buscando_personal"
    assert rejected.json()["worker_profile_id"] is None


async def test_worker_cancel_confirmed_shift_reopens_search(client: AsyncClient):
    """ADR-0004: el trabajador puede cancelar su asignación sólo desde
    CONFIRMADO; el turno vuelve a buscar personal, pierde el trabajador
    asignado, reaparece en el feed, incrementa `cancellations` del
    trabajador y notifica al comercio."""
    employer_headers = await _employer_with_company(client, "emp_wcancel@staffya.com")
    created = await client.post(
        "/api/v1/shifts",
        headers=employer_headers,
        json=_shift_payload(city="WorkerCancelCity"),
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "w_cancel@staffya.com"
    )
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker_headers)

    cancelled = await client.post(
        f"/api/v1/shifts/{shift_id}/worker-cancel", headers=worker_headers
    )
    assert cancelled.status_code == 200
    body = cancelled.json()
    assert body["status"] == "buscando_personal"
    assert body["worker_profile_id"] is None

    # Vuelve a aparecer en el feed.
    feed = await client.get(
        "/api/v1/shifts/feed",
        headers=employer_headers,
        params={"city": "WorkerCancelCity"},
    )
    assert any(s["id"] == shift_id for s in feed.json())

    # Se registra la cancelación en el perfil del trabajador.
    profile = await client.get("/api/v1/workers/me/profile", headers=worker_headers)
    assert profile.json()["cancellations"] == 1

    # El comercio recibe una notificación de que el turno se reabrió.
    notifications = await client.get("/api/v1/notifications", headers=employer_headers)
    assert any(n["type"] == "shift_reopened" for n in notifications.json())


async def test_worker_cannot_cancel_before_confirming(client: AsyncClient):
    """Sólo desde CONFIRMADO: en ASIGNADO todavía no puede "cancelar" (eso
    es `reject`)."""
    employer_headers = await _employer_with_company(client, "emp_wcancel2@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "w_cancel2@staffya.com"
    )
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )

    response = await client.post(
        f"/api/v1/shifts/{shift_id}/worker-cancel", headers=worker_headers
    )
    assert response.status_code == 400


async def test_other_worker_cannot_cancel_someone_elses_confirmed_shift(
    client: AsyncClient,
):
    employer_headers = await _employer_with_company(client, "emp_wcancel3@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "w_cancel3@staffya.com"
    )
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker_headers)

    other_headers, _ = await _worker_with_profile(client, "w_cancel_other@staffya.com")
    response = await client.post(
        f"/api/v1/shifts/{shift_id}/worker-cancel", headers=other_headers
    )
    assert response.status_code == 404


async def test_worker_sees_assigned_shifts_in_mine(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp11@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "w_mine@staffya.com"
    )

    mine_before = await client.get("/api/v1/shifts/mine", headers=worker_headers)
    assert mine_before.json() == []

    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )

    mine_after = await client.get("/api/v1/shifts/mine", headers=worker_headers)
    assert any(s["id"] == shift_id for s in mine_after.json())


async def test_other_worker_cannot_confirm_someone_elses_assignment(
    client: AsyncClient,
):
    employer_headers = await _employer_with_company(client, "emp10@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    _assigned_headers, worker_profile_id = await _worker_with_profile(
        client, "w_owner@staffya.com"
    )
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )

    other_headers, _ = await _worker_with_profile(client, "w_other@staffya.com")
    response = await client.post(
        f"/api/v1/shifts/{shift_id}/confirm", headers=other_headers
    )
    assert response.status_code == 404


async def _assigned_shift(
    client: AsyncClient, employer_headers: dict, worker_profile_id: str, **overrides
) -> str:
    """Crea, publica y asigna un turno al trabajador dado; devuelve su id."""
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload(**overrides)
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )
    return shift_id


async def test_confirm_refused_when_overlaps_with_confirmed_shift(client: AsyncClient):
    """Regla de doble turno: no se puede confirmar un turno que se superpone
    en horario con otro turno propio ya CONFIRMADO."""
    employer_headers = await _employer_with_company(client, "emp_overlap1@staffya.com")
    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "w_overlap1@staffya.com"
    )

    shift_a = await _assigned_shift(
        client,
        employer_headers,
        worker_profile_id,
        start_at="2026-07-01T20:00:00",
        end_at="2026-07-02T02:00:00",
    )
    shift_b = await _assigned_shift(
        client,
        employer_headers,
        worker_profile_id,
        start_at="2026-07-01T22:00:00",  # se solapa con shift_a
        end_at="2026-07-02T04:00:00",
    )

    confirmed_a = await client.post(
        f"/api/v1/shifts/{shift_a}/confirm", headers=worker_headers
    )
    assert confirmed_a.status_code == 200
    assert confirmed_a.json()["status"] == "confirmado"

    refused = await client.post(
        f"/api/v1/shifts/{shift_b}/confirm", headers=worker_headers
    )
    assert refused.status_code == 400
    assert "superpone" in refused.json()["detail"]

    # shift_b sigue asignado (no confirmado): la refusión no lo tocó.
    still_assigned = await client.get(f"/api/v1/shifts/{shift_b}", headers=employer_headers)
    assert still_assigned.json()["status"] == "asignado"


async def test_confirm_succeeds_and_withdraws_overlapping_pending_applications(
    client: AsyncClient,
):
    """Al confirmar sin conflicto, las postulaciones PENDIENTE propias que se
    solapan en horario se retiran solas (RETIRADA); las que no se solapan
    quedan intactas (PENDIENTE)."""
    employer_headers = await _employer_with_company(client, "emp_overlap2@staffya.com")
    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "w_overlap2@staffya.com"
    )

    shift_a = await _assigned_shift(
        client,
        employer_headers,
        worker_profile_id,
        start_at="2026-07-01T20:00:00",
        end_at="2026-07-02T02:00:00",
        city="OverlapA",
    )

    # Turno C: se solapa con A, sólo postulación (PENDIENTE, sin asignar).
    created_c = await client.post(
        "/api/v1/shifts",
        headers=employer_headers,
        json=_shift_payload(
            start_at="2026-07-01T23:00:00",
            end_at="2026-07-02T03:00:00",
            city="OverlapC",
        ),
    )
    shift_c = created_c.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_c}/publish", headers=employer_headers)
    applied_c = await client.post(
        f"/api/v1/applications/shifts/{shift_c}", headers=worker_headers
    )
    application_c_id = applied_c.json()["id"]

    # Turno D: no se solapa con A, sólo postulación (PENDIENTE).
    created_d = await client.post(
        "/api/v1/shifts",
        headers=employer_headers,
        json=_shift_payload(
            start_at="2026-07-03T10:00:00",
            end_at="2026-07-03T14:00:00",
            city="OverlapD",
        ),
    )
    shift_d = created_d.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_d}/publish", headers=employer_headers)
    applied_d = await client.post(
        f"/api/v1/applications/shifts/{shift_d}", headers=worker_headers
    )
    application_d_id = applied_d.json()["id"]

    confirmed_a = await client.post(
        f"/api/v1/shifts/{shift_a}/confirm", headers=worker_headers
    )
    assert confirmed_a.status_code == 200

    mine = await client.get("/api/v1/applications/mine", headers=worker_headers)
    by_id = {a["id"]: a["status"] for a in mine.json()}
    assert by_id[application_c_id] == "retirada"
    assert by_id[application_d_id] == "pendiente"


async def test_confirm_two_non_overlapping_shifts_both_succeed(client: AsyncClient):
    """Dos turnos propios sin solapamiento de horario: ambos se pueden
    confirmar sin problema (no es "un solo turno confirmado a la vez", es
    "sin superposición de horario")."""
    employer_headers = await _employer_with_company(client, "emp_overlap3@staffya.com")
    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "w_overlap3@staffya.com"
    )

    shift_e = await _assigned_shift(
        client,
        employer_headers,
        worker_profile_id,
        start_at="2026-07-05T10:00:00",
        end_at="2026-07-05T14:00:00",
    )
    shift_f = await _assigned_shift(
        client,
        employer_headers,
        worker_profile_id,
        start_at="2026-07-05T16:00:00",
        end_at="2026-07-05T20:00:00",
    )

    confirmed_e = await client.post(
        f"/api/v1/shifts/{shift_e}/confirm", headers=worker_headers
    )
    assert confirmed_e.status_code == 200
    assert confirmed_e.json()["status"] == "confirmado"

    confirmed_f = await client.post(
        f"/api/v1/shifts/{shift_f}/confirm", headers=worker_headers
    )
    assert confirmed_f.status_code == 200
    assert confirmed_f.json()["status"] == "confirmado"


async def test_feed_pagination(client: AsyncClient):
    """R2.1: `/shifts/feed` pagina con `limit`/`offset` sin cambiar el shape
    de la respuesta (sigue siendo una lista simple)."""
    headers = await _employer_with_company(client, "emp_pag@staffya.com")
    # 5 turnos > el tope del plan gratis (3/mes, ADR-0005 Fase 1): se
    # sube a `pro` (ilimitado) para no acoplar este test de paginación al
    # gating de capacidad, que se cubre en tests/test_subscription.py.
    await client.post(
        "/api/v1/subscription/subscribe", headers=headers, json={"plan_code": "pro"}
    )
    created_ids = []
    for i in range(5):
        created = await client.post(
            "/api/v1/shifts",
            headers=headers,
            json=_shift_payload(city=f"PagCity{i}"),
        )
        shift_id = created.json()["id"]
        await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
        created_ids.append(shift_id)

    def _ours(payload: list[dict]) -> list[str]:
        return [s["id"] for s in payload if s["id"] in created_ids]

    first_page = await client.get(
        "/api/v1/shifts/feed", headers=headers, params={"limit": 2, "offset": 0}
    )
    assert first_page.status_code == 200
    first_ids = _ours(first_page.json())
    assert len(first_ids) == 2

    second_page = await client.get(
        "/api/v1/shifts/feed", headers=headers, params={"limit": 3, "offset": 2}
    )
    assert second_page.status_code == 200
    second_ids = _ours(second_page.json())

    # Sin solapamiento entre páginas y unión = todo lo creado (paginación
    # real en SQL, no slicing en memoria de una lista ya completa).
    assert set(first_ids).isdisjoint(second_ids)
    assert set(first_ids) | set(second_ids) == set(created_ids)

    # `limit` fuera de rango (tope 100) es rechazado por la ruta.
    invalid = await client.get(
        "/api/v1/shifts/feed", headers=headers, params={"limit": 101}
    )
    assert invalid.status_code == 422


# --- Vista pública del turno (sin autenticación, para compartir) ----------


async def test_public_shift_published_returns_only_safe_fields(client: AsyncClient):
    headers = await _employer_with_company(client, "emp_pub1@staffya.com")
    created = await client.post(
        "/api/v1/shifts",
        headers=headers,
        json=_shift_payload(
            city="Palermo",
            address="Av. Secreta 1234",
            dress_code="Camisa negra",
            description="Instrucciones internas para el candidato",
        ),
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)

    # Sin ningún header de auth: la vista pública no requiere sesión.
    response = await client.get(f"/api/v1/shifts/{shift_id}/public")
    assert response.status_code == 200
    body = response.json()

    # Campos seguros presentes.
    assert body["id"] == shift_id
    assert body["position"] == "mozo"
    assert body["city"] == "Palermo"
    assert float(body["pay_amount"]) == 70000.0
    assert body["currency"] == "ARS"
    assert body["company_name"] == "Bar Palermo"
    assert "start_at" in body
    assert "end_at" in body

    # Campos sensibles/internos explícitamente ausentes.
    sensitive_fields = {
        "company_id",
        "worker_profile_id",
        "address",
        "latitude",
        "longitude",
        "dress_code",
        "description",
        "title",
        "quantity",
        "tips",
        "urgent",
        "check_in_latitude",
        "check_in_longitude",
        "check_in_at",
        "check_out_latitude",
        "check_out_longitude",
        "check_out_at",
        "paid_at",
        "status",
        "company_logo_url",
        "created_at",
    }
    assert sensitive_fields.isdisjoint(body.keys())


async def test_public_shift_in_draft_returns_404(client: AsyncClient):
    headers = await _employer_with_company(client, "emp_pub2@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]

    response = await client.get(f"/api/v1/shifts/{shift_id}/public")
    assert response.status_code == 404


async def test_public_shift_cancelled_returns_404(client: AsyncClient):
    headers = await _employer_with_company(client, "emp_pub3@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
    await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=headers)

    response = await client.get(f"/api/v1/shifts/{shift_id}/public")
    assert response.status_code == 404


async def test_public_shift_nonexistent_id_returns_404(client: AsyncClient):
    response = await client.get(f"/api/v1/shifts/{uuid4()}/public")
    assert response.status_code == 404


async def test_assign_worker_sends_acceptance_email(
    client: AsyncClient, fake_email_sender: FakeEmailSender
):
    """Al aceptar (asignar) un trabajador, se le manda un email best-effort
    avisándole (además de la notificación in-app existente)."""
    employer_headers = await _employer_with_company(client, "emp_email@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    _worker_headers, worker_profile_id = await _worker_with_profile(
        client, "w_email@staffya.com"
    )
    assigned = await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )
    assert assigned.status_code == 200

    assert len(fake_email_sender.sent) == 1
    sent = fake_email_sender.sent[0]
    assert sent.to == "w_email@staffya.com"
    assert "aceptaron" in sent.subject.lower()
    assert "Bar Palermo" in sent.html


async def test_assign_worker_does_not_fail_if_email_sender_explodes(
    client: AsyncClient, fake_email_sender: FakeEmailSender
):
    """Best-effort real: si el proveedor de email explota, la asignación del
    turno igual se confirma (nunca debe romper el flujo de negocio)."""
    fake_email_sender.raise_on_send = True

    employer_headers = await _employer_with_company(client, "emp_explode@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    _worker_headers, worker_profile_id = await _worker_with_profile(
        client, "w_explode@staffya.com"
    )
    assigned = await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )
    assert assigned.status_code == 200
    assert assigned.json()["status"] == "asignado"
