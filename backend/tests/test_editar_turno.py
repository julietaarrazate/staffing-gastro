"""Corregir un turno mientras nadie esté asignado (decisión de Julieta,
2026-11-26).

Antes sólo se editaba un borrador o un turno publicado, y la app no tenía
pantalla para hacerlo: un error de tipeo obligaba a cancelar y publicar de
nuevo, perdiendo a los postulantes. Ahora se corrige mientras nadie esté
comprometido; quien se postuló se entera si cambia el horario o baja el pago.
Con alguien asignado o confirmado no se edita."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers
from tests.test_cuentas_suspendidas import _notices

pytestmark = pytest.mark.asyncio

INICIO = datetime(2026, 6, 28, 23, 0, tzinfo=timezone.utc)


def _payload(**cambios) -> dict:
    base = {
        "position": "mozo",
        "quantity": 1,
        "start_at": INICIO.isoformat(),
        "end_at": (INICIO + timedelta(hours=5)).isoformat(),
        "pay_amount": "70000.00",
        "city": "Palermo",
    }
    base.update(cambios)
    return base


async def _comercio(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile", headers=headers, json={"name": "Bar Palermo", "city": "Palermo"}
    )
    return headers


async def _persona(client: AsyncClient, email: str) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email)
    profile = await client.post(
        "/api/v1/workers/me/profile", headers=headers, json={"skills": ["mozo"]}
    )
    return headers, profile.json()["id"]


async def _publicado(client: AsyncClient, comercio: dict) -> str:
    created = await client.post("/api/v1/shifts", headers=comercio, json=_payload())
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=comercio)
    return shift_id


async def test_con_postulantes_se_corrige_el_horario_y_se_les_avisa(client: AsyncClient):
    comercio = await _comercio(client, "edit_emp1@staffya.com")
    persona, _ = await _persona(client, "edit_w1@staffya.com")
    shift_id = await _publicado(client, comercio)
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=persona)

    nuevo_inicio = INICIO + timedelta(hours=1)
    response = await client.put(
        f"/api/v1/shifts/{shift_id}",
        headers=comercio,
        json=_payload(
            start_at=nuevo_inicio.isoformat(),
            end_at=(nuevo_inicio + timedelta(hours=5)).isoformat(),
        ),
    )

    assert response.status_code == 200, response.text
    assert response.json()["is_editable"] is True
    [aviso] = await _notices(client, persona, "applied_shift_changed")
    assert aviso["title"] == "Cambió un turno al que te postulaste"
    assert "de 21:00 a 02:00" in aviso["message"]  # hora argentina
    assert "$70.000" in aviso["message"]
    # La postulación sigue: decide la persona.
    mias = (await client.get("/api/v1/applications/mine", headers=persona)).json()
    assert [a["status"] for a in mias] == ["pendiente"]


async def test_bajar_el_pago_avisa_y_subirlo_o_tocar_la_vestimenta_no(client: AsyncClient):
    comercio = await _comercio(client, "edit_emp2@staffya.com")
    persona, _ = await _persona(client, "edit_w2@staffya.com")
    shift_id = await _publicado(client, comercio)
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=persona)

    subir = await client.put(
        f"/api/v1/shifts/{shift_id}", headers=comercio,
        json=_payload(pay_amount="90000.00", dress_code="Camisa negra"),
    )
    assert subir.status_code == 200, subir.text
    assert await _notices(client, persona, "applied_shift_changed") == []

    bajar = await client.put(
        f"/api/v1/shifts/{shift_id}", headers=comercio, json=_payload(pay_amount="60000.00")
    )
    assert bajar.status_code == 200, bajar.text
    assert len(await _notices(client, persona, "applied_shift_changed")) == 1


async def test_sin_postulantes_no_se_avisa_a_nadie(client: AsyncClient):
    comercio = await _comercio(client, "edit_emp3@staffya.com")
    persona, _ = await _persona(client, "edit_w3@staffya.com")
    shift_id = await _publicado(client, comercio)

    response = await client.put(
        f"/api/v1/shifts/{shift_id}", headers=comercio, json=_payload(pay_amount="50000.00")
    )

    assert response.status_code == 200
    assert await _notices(client, persona, "applied_shift_changed") == []


async def test_con_postulantes_no_se_puede_cambiar_el_puesto(client: AsyncClient):
    comercio = await _comercio(client, "edit_emp4@staffya.com")
    persona, _ = await _persona(client, "edit_w4@staffya.com")
    shift_id = await _publicado(client, comercio)
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=persona)

    response = await client.put(
        f"/api/v1/shifts/{shift_id}", headers=comercio, json=_payload(position="bartender")
    )

    assert response.status_code == 400
    assert "no se puede cambiar el puesto" in response.json()["detail"]
    assert (await client.get(f"/api/v1/shifts/{shift_id}", headers=comercio)).json()["position"] == "mozo"


async def test_con_alguien_asignado_o_confirmado_no_se_edita(client: AsyncClient):
    comercio = await _comercio(client, "edit_emp5@staffya.com")
    persona, perfil_id = await _persona(client, "edit_w5@staffya.com")
    shift_id = await _publicado(client, comercio)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=comercio, json={"worker_profile_id": perfil_id}
    )

    asignado = await client.put(
        f"/api/v1/shifts/{shift_id}", headers=comercio, json=_payload(pay_amount="10000.00")
    )
    assert asignado.status_code == 400
    assert (await client.get(f"/api/v1/shifts/{shift_id}", headers=comercio)).json()["is_editable"] is False

    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=persona)
    confirmado = await client.put(
        f"/api/v1/shifts/{shift_id}", headers=comercio, json=_payload(pay_amount="10000.00")
    )
    assert confirmado.status_code == 400
    assert (await client.get(f"/api/v1/shifts/{shift_id}", headers=persona)).json()["pay_amount"] == "70000.00"


async def test_un_turno_reabierto_sin_nadie_asignado_se_puede_corregir(client: AsyncClient):
    comercio = await _comercio(client, "edit_emp6@staffya.com")
    persona, perfil_id = await _persona(client, "edit_w6@staffya.com")
    # Con fecha futura de verdad: un turno ya pasado no se reabre, queda sin cubrir.
    inicio = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    horario = dict(start_at=inicio.isoformat(), end_at=(inicio + timedelta(hours=5)).isoformat())
    created = await client.post("/api/v1/shifts", headers=comercio, json=_payload(**horario))
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=comercio)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=comercio, json={"worker_profile_id": perfil_id}
    )
    rechazo = await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=persona)
    assert rechazo.status_code == 200, rechazo.text
    assert rechazo.json()["status"] == "buscando_personal"

    response = await client.put(
        f"/api/v1/shifts/{shift_id}", headers=comercio,
        json=_payload(pay_amount="80000.00", **horario),
    )

    assert response.status_code == 200, response.text
    assert response.json()["pay_amount"] == "80000.00"
    assert response.json()["status"] == "buscando_personal"


async def test_editar_un_turno_ajeno_da_404(client: AsyncClient):
    comercio = await _comercio(client, "edit_emp7@staffya.com")
    otro = await _comercio(client, "edit_emp7b@staffya.com")
    shift_id = await _publicado(client, comercio)

    response = await client.put(f"/api/v1/shifts/{shift_id}", headers=otro, json=_payload())

    assert response.status_code == 404
