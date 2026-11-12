"""El uso del plan cuenta publicaciones que ocurrieron, no intentos.

Antes `publish_shift` sumaba un turno al uso del plan antes de saber si el
turno se podía publicar, y como cada repositorio guarda por su cuenta, la
suma quedaba aunque la publicación fallara: pedir publicar tres veces el
mismo borrador (dos a la vez desde dos pestañas y una después) dejaba
«3 de 5 turnos usados» con un solo turno publicado. Con el tope exigido,
eso le sacaba turnos del plan al comercio sin haber publicado nada.

Ahora el plan se consulta antes de publicar y se cuenta después de que el
turno quedó guardado como publicado."""

import uuid

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.modules.shift.domain.exceptions import ShiftConcurrentModificationError
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from tests.test_subscription import _employer_with_company, _shift_payload

pytestmark = pytest.mark.asyncio


async def _draft(client: AsyncClient, headers: dict) -> str:
    created = await client.post("/api/v1/shifts", headers=headers, json=_shift_payload())
    assert created.status_code == 201
    return created.json()["id"]


async def _publish(client: AsyncClient, headers: dict, shift_id: str):
    return await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)


async def _turnos_usados(client: AsyncClient, headers: dict) -> int:
    subscription = await client.get("/api/v1/subscription", headers=headers)
    assert subscription.status_code == 200
    return subscription.json()["turnos_usados_mes"]


async def test_publicar_bien_suma_un_turno_al_uso_del_plan(client: AsyncClient):
    headers = await _employer_with_company(client, "uso_ok@staffya.com")
    assert await _turnos_usados(client, headers) == 0

    published = await _publish(client, headers, await _draft(client, headers))

    assert published.status_code == 200
    assert published.json()["status"] == "publicado"
    assert await _turnos_usados(client, headers) == 1


async def test_volver_a_publicar_un_turno_ya_publicado_no_suma(client: AsyncClient):
    headers = await _employer_with_company(client, "uso_repetido@staffya.com")
    shift_id = await _draft(client, headers)
    assert (await _publish(client, headers, shift_id)).status_code == 200

    # El mismo pedido otra vez (otra pestaña, un segundo toque): el turno ya
    # no está en borrador, así que no hay nada que publicar.
    for _ in range(2):
        again = await _publish(client, headers, shift_id)
        assert again.status_code == 400

    assert await _turnos_usados(client, headers) == 1


async def test_publicar_un_turno_cancelado_no_suma(client: AsyncClient):
    headers = await _employer_with_company(client, "uso_cancelado@staffya.com")
    shift_id = await _draft(client, headers)
    cancelled = await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=headers)
    assert cancelled.status_code == 200

    response = await _publish(client, headers, shift_id)

    assert response.status_code == 400
    assert await _turnos_usados(client, headers) == 0


async def test_perder_la_carrera_al_publicar_no_suma(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
):
    """Dos pedidos a la vez sobre el mismo borrador: uno publica y el otro
    recibe «El turno cambió mientras tanto» (ADR-0016). El que perdió no
    publicó nada, así que no cuenta."""
    headers = await _employer_with_company(client, "uso_carrera@staffya.com")
    shift_id = await _draft(client, headers)

    async def lose_the_race(self, shift):
        raise ShiftConcurrentModificationError(str(shift.id))

    with monkeypatch.context() as patched:
        patched.setattr(SqlAlchemyShiftRepository, "update", lose_the_race)
        lost = await _publish(client, headers, shift_id)
    assert lost.status_code == 409
    assert await _turnos_usados(client, headers) == 0

    # El turno sigue en borrador y se puede publicar: ahí sí cuenta, una vez.
    assert (await _publish(client, headers, shift_id)).status_code == 200
    assert await _turnos_usados(client, headers) == 1


async def test_repetir_con_la_misma_clave_de_idempotencia_suma_una_sola_vez(
    client: AsyncClient,
):
    employer = await _employer_with_company(client, "uso_idem@staffya.com")
    shift_id = await _draft(client, employer)
    headers = {**employer, "Idempotency-Key": str(uuid.uuid4())}

    first = await _publish(client, headers, shift_id)
    retry = await _publish(client, headers, shift_id)

    assert first.status_code == 200
    assert retry.status_code == 200
    assert retry.json() == first.json()
    assert await _turnos_usados(client, employer) == 1


async def test_los_intentos_fallidos_no_gastan_el_cupo_del_plan(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
):
    """Con el tope exigido (plan inicial: 5 turnos), los intentos repetidos
    sobre un turno ya publicado no le sacan al comercio los turnos que le
    quedan."""
    monkeypatch.setattr(settings, "subscriptions_enforced", True)
    headers = await _employer_with_company(client, "uso_tope@staffya.com")
    first = await _draft(client, headers)
    assert (await _publish(client, headers, first)).status_code == 200
    for _ in range(5):
        assert (await _publish(client, headers, first)).status_code == 400

    # Le quedan cuatro, y los cuatro se publican.
    for _ in range(4):
        response = await _publish(client, headers, await _draft(client, headers))
        assert response.status_code == 200
    assert await _turnos_usados(client, headers) == 5

    # El sexto sí choca con el tope, y ese rechazo tampoco cuenta.
    sixth = await _publish(client, headers, await _draft(client, headers))
    assert sixth.status_code == 402
    assert await _turnos_usados(client, headers) == 5


async def test_un_evento_suma_un_turno_por_cada_puesto_publicado(client: AsyncClient):
    headers = await _employer_with_company(client, "uso_evento@staffya.com")

    event = await client.post(
        "/api/v1/shifts/events",
        headers=headers,
        json={
            "name": "Casamiento",
            "start_at": "2026-06-28T20:00:00",
            "end_at": "2026-06-29T03:00:00",
            "city": "Palermo",
            "roles": [
                {"position": "mozo", "count": 2, "pay_amount": "70000.00"},
                {"position": "bartender", "count": 1, "pay_amount": "80000.00"},
            ],
        },
    )

    assert event.status_code == 201, event.text
    assert len(event.json()["shifts"]) == 3
    assert await _turnos_usados(client, headers) == 3
