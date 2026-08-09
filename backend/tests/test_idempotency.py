"""Tests de idempotencia (product/IDEMPOTENCIA_SPEC.md).

Verifica el contrato del header `Idempotency-Key` sobre mutaciones críticas:
- key repetida devuelve la MISMA respuesta sin re-ejecutar el handler
  (comprobado contando filas creadas, y comprobando que una segunda
  transición de estado que debería fallar por regla de negocio en realidad
  ni se re-ejecuta);
- key repetida con un body distinto → 422;
- sin header, el endpoint sigue funcionando (modo grace, sin romper
  clientes viejos);
- dos requests concurrentes con la misma key no duplican la acción (una
  ejecuta, la otra recibe 409 o la misma respuesta, nunca dos filas).
"""

import asyncio
import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email, "Bar Idempotencia")
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Idempotencia", "city": "Palermo"},
    )
    return headers


async def _worker_with_profile(client: AsyncClient, email: str) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email, "Juana Trabajadora")
    profile = await client.post(
        "/api/v1/workers/me/profile", headers=headers, json={"skills": ["mozo"]}
    )
    return headers, profile.json()["id"]


def _shift_payload(**overrides) -> dict:
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": "2026-06-28T20:00:00",
        "end_at": "2026-06-29T03:00:00",
        "pay_amount": "70000.00",
        "city": "Palermo",
    }
    payload.update(overrides)
    return payload


async def _draft_shift(client: AsyncClient, employer_headers: dict) -> str:
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    return created.json()["id"]


async def _published_shift(client: AsyncClient, employer_headers: dict) -> str:
    shift_id = await _draft_shift(client, employer_headers)
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)
    return shift_id


# --- 1. Key repetida no duplica la fila creada ------------------------------


async def test_apply_twice_same_key_creates_one_application(client: AsyncClient):
    employer = await _employer_with_company(client, "emp_idem_apply@staffya.com")
    shift_id = await _published_shift(client, employer)
    worker, _ = await _worker_with_profile(client, "w_idem_apply@staffya.com")

    key = str(uuid.uuid4())
    headers = {**worker, "Idempotency-Key": key}

    first = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=headers)
    assert first.status_code == 201

    second = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=headers)
    # Misma respuesta guardada, no la 409 "Ya te postulaste" que daría el
    # dominio si de verdad se re-ejecutara la postulación.
    assert second.status_code == 201
    assert second.json() == first.json()

    mine = await client.get("/api/v1/applications/mine", headers=worker)
    assert len(mine.json()) == 1  # UNA sola postulación, no dos


async def test_create_shift_twice_same_key_creates_one_shift(client: AsyncClient):
    """D3 (auditoría de producto/UI 2026-08-09): antes POST /shifts no
    llevaba idempotencia — un reintento tras un timeout que sí había creado
    el turno duplicaba el borrador al reintentar."""
    employer = await _employer_with_company(client, "emp_idem_create_shift@staffya.com")
    key = str(uuid.uuid4())
    headers = {**employer, "Idempotency-Key": key}

    first = await client.post("/api/v1/shifts", headers=headers, json=_shift_payload())
    assert first.status_code == 201

    second = await client.post("/api/v1/shifts", headers=headers, json=_shift_payload())
    assert second.status_code == 201
    assert second.json() == first.json()

    mine = await client.get("/api/v1/shifts/me", headers=employer)
    assert len(mine.json()) == 1  # UN solo turno, no dos


async def test_create_event_twice_same_key_creates_one_set_of_shifts(client: AsyncClient):
    """Un evento crea varios turnos de una sola vez (uno por rol): sin
    idempotencia, un reintento duplica el set entero, no sólo un turno."""
    employer = await _employer_with_company(client, "emp_idem_create_event@staffya.com")
    key = str(uuid.uuid4())
    headers = {**employer, "Idempotency-Key": key}
    payload = {
        "name": "Boda Idempotencia",
        "start_at": "2026-09-10T20:00:00",
        "end_at": "2026-09-11T02:00:00",
        "city": "Palermo",
        "roles": [
            {"position": "mozo", "count": 2, "pay_amount": "50000.00"},
            {"position": "bartender", "count": 1, "pay_amount": "60000.00"},
        ],
    }

    first = await client.post("/api/v1/shifts/events", headers=headers, json=payload)
    assert first.status_code == 201
    assert first.json()["requested"] == 3

    second = await client.post("/api/v1/shifts/events", headers=headers, json=payload)
    assert second.status_code == 201
    assert second.json() == first.json()

    mine = await client.get("/api/v1/shifts/me", headers=employer)
    assert len(mine.json()) == 3  # TRES turnos (uno por rol), no seis


# --- 2. Key repetida, sin re-ejecutar: probado con una transición que la ---
# --- segunda vez fallaría por regla de negocio si de verdad se re-ejecutara -


async def test_publish_twice_same_key_replays_response_without_reexecuting(
    client: AsyncClient,
):
    employer = await _employer_with_company(client, "emp_idem_publish@staffya.com")
    shift_id = await _draft_shift(client, employer)

    key = str(uuid.uuid4())
    headers = {**employer, "Idempotency-Key": key}

    first = await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
    assert first.status_code == 200
    assert first.json()["status"] == "publicado"

    # Sin idempotencia, publicar un turno ya PUBLICADO es una transición
    # inválida (400). Si acá devuelve 200 con el mismo body, es la prueba de
    # que NO se re-ejecutó el handler: se devolvió la respuesta guardada.
    second = await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
    assert second.status_code == 200
    assert second.json() == first.json()


# --- 3. Key repetida con body distinto → 422 --------------------------------


async def test_same_key_different_body_returns_422(client: AsyncClient):
    from tests.test_review import _shift_at_status

    shift_id, employer_headers, worker_headers, _ = await _shift_at_status(
        client, "emp_idem_review@staffya.com", "w_idem_review@staffya.com", "pagado"
    )

    key = str(uuid.uuid4())
    headers = {**employer_headers, "Idempotency-Key": key}

    first = await client.post(
        f"/api/v1/reviews/shifts/{shift_id}",
        headers=headers,
        json={"rating": 5, "comment": "Excelente"},
    )
    assert first.status_code == 201

    # Misma key, body distinto (rating y comentario cambiaron): 422, no un
    # 409 "ya calificaste" ni la respuesta original.
    second = await client.post(
        f"/api/v1/reviews/shifts/{shift_id}",
        headers=headers,
        json={"rating": 1, "comment": "En realidad no"},
    )
    assert second.status_code == 422

    # Y la reseña original sigue siendo la única que existe.
    reviews = await client.get(
        f"/api/v1/reviews/shifts/{shift_id}", headers=employer_headers
    )
    assert len(reviews.json()) == 1
    assert reviews.json()[0]["rating"] == 5


# --- 4. Sin header, el endpoint sigue funcionando (modo grace) -------------


async def test_missing_header_still_works(client: AsyncClient):
    employer = await _employer_with_company(client, "emp_idem_grace@staffya.com")
    shift_id = await _draft_shift(client, employer)

    # Sin Idempotency-Key: se comporta exactamente como antes de esta
    # feature (no rompe clientes viejos que no manden el header).
    response = await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    assert response.status_code == 200
    assert response.json()["status"] == "publicado"


# --- 5. Concurrencia: misma key no duplica ---------------------------------


async def test_concurrent_same_key_does_not_duplicate(client: AsyncClient):
    employer = await _employer_with_company(client, "emp_idem_concurrent@staffya.com")
    shift_id = await _published_shift(client, employer)
    worker, _ = await _worker_with_profile(client, "w_idem_concurrent@staffya.com")

    key = str(uuid.uuid4())
    headers = {**worker, "Idempotency-Key": key}

    responses = await asyncio.gather(
        client.post(f"/api/v1/applications/shifts/{shift_id}", headers=headers),
        client.post(f"/api/v1/applications/shifts/{shift_id}", headers=headers),
    )

    statuses = sorted(r.status_code for r in responses)
    # Ambas aceptables (spec): [201, 201] (una reservó y ejecutó, la otra
    # llegó después de que la respuesta ya estaba guardada y la replica) o
    # [201, 409] (la otra llegó mientras la primera todavía estaba en
    # vuelo). Lo que NUNCA puede pasar es una segunda postulación real.
    assert statuses in ([201, 201], [201, 409])

    mine = await client.get("/api/v1/applications/mine", headers=worker)
    assert len(mine.json()) == 1
