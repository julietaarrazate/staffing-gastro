"""Carril urgente (decisión de Julieta, 2026-11-27; `settings.urgente_directo`).

En un turno que empieza en menos de 6 horas, postularse es «Puedo ir ya»: si
el comercio acepta a esa persona, el turno queda confirmado sin que ella
tenga que confirmar otra vez. Siguen aceptando las dos partes.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.modules.shift.domain.urgente import postularse_compromete
from tests.conftest import auth_headers
from tests.test_scheduler import _shift_payload


@pytest.fixture
def directo(monkeypatch):
    monkeypatch.setattr(settings, "urgente_directo", True)


def _en(horas: float) -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=horas)


async def _turno(client: AsyncClient, employer: dict, empieza_en: float, dura: float = 4) -> str:
    inicio = _en(empieza_en)
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json=_shift_payload(
            start_at=inicio.isoformat(), end_at=(inicio + timedelta(hours=dura)).isoformat()
        ),
    )
    assert created.status_code == 201, created.text
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    return shift_id


async def _comercio(client: AsyncClient, prefix: str) -> dict:
    employer = await auth_headers(client, "employer", f"{prefix}_emp@staffya.com")
    await client.post(
        "/api/v1/companies/me/profile", headers=employer, json={"name": "Bar", "city": "Palermo"}
    )
    return employer


async def _persona(client: AsyncClient, mail: str) -> tuple[dict, str]:
    worker = await auth_headers(client, "worker", mail)
    profile = await client.post(
        "/api/v1/workers/me/profile", headers=worker, json={"skills": ["mozo"]}
    )
    return worker, profile.json()["id"]


async def _aceptar(client: AsyncClient, shift_id: str, employer: dict, profile_id: str):
    return await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": profile_id},
    )


def test_la_ventana_es_de_seis_horas():
    inicio = datetime(2026, 12, 12, 20, 0)
    assert postularse_compromete(inicio, datetime(2026, 12, 12, 14, 0)) is True
    assert postularse_compromete(inicio, datetime(2026, 12, 12, 13, 59)) is False
    assert postularse_compromete(inicio, datetime(2026, 12, 12, 19, 30, tzinfo=timezone.utc)) is True


async def test_quien_se_ofrecio_para_ya_queda_confirmado_al_ser_aceptado(client, directo):
    employer = await _comercio(client, "ud_ya")
    shift_id = await _turno(client, employer, empieza_en=3)
    worker, profile_id = await _persona(client, "ud_ya_w@staffya.com")

    # La pantalla lo sabe antes de que la persona toque.
    visto = await client.get(f"/api/v1/shifts/{shift_id}", headers=worker)
    assert visto.json()["apply_commits"] is True

    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    respuesta = await _aceptar(client, shift_id, employer, profile_id)

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["status"] == "confirmado"
    assert respuesta.json()["worker_profile_id"] == profile_id
    # Ya no hay nada que confirmar.
    otra_vez = await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker)
    assert otra_vez.status_code in (400, 409)
    avisos = (await client.get("/api/v1/notifications", headers=worker)).json()
    assert any("Te aceptaron" in a["title"] for a in avisos)


async def test_un_turno_con_tiempo_sigue_pidiendo_la_confirmacion(client, directo):
    employer = await _comercio(client, "ud_prog")
    shift_id = await _turno(client, employer, empieza_en=48)
    worker, profile_id = await _persona(client, "ud_prog_w@staffya.com")

    visto = await client.get(f"/api/v1/shifts/{shift_id}", headers=worker)
    assert visto.json()["apply_commits"] is False

    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    respuesta = await _aceptar(client, shift_id, employer, profile_id)
    assert respuesta.json()["status"] == "asignado"
    confirmar = await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker)
    assert confirmar.json()["status"] == "confirmado"


async def test_a_quien_no_se_postulo_se_le_pide_confirmar_aunque_sea_urgente(client, directo):
    """Elegida desde «Recomendados»: no dijo «Puedo ir ya»."""
    employer = await _comercio(client, "ud_rec")
    shift_id = await _turno(client, employer, empieza_en=3)
    _, profile_id = await _persona(client, "ud_rec_w@staffya.com")

    respuesta = await _aceptar(client, shift_id, employer, profile_id)
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["status"] == "asignado"


async def test_con_la_regla_apagada_todo_sigue_como_antes(client):
    employer = await _comercio(client, "ud_off")
    shift_id = await _turno(client, employer, empieza_en=3)
    worker, profile_id = await _persona(client, "ud_off_w@staffya.com")

    visto = await client.get(f"/api/v1/shifts/{shift_id}", headers=worker)
    assert visto.json()["apply_commits"] is False
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    respuesta = await _aceptar(client, shift_id, employer, profile_id)
    assert respuesta.json()["status"] == "asignado"


async def test_si_ya_tomo_otro_turno_en_ese_horario_no_se_la_puede_aceptar(client, directo):
    """Se ofreció a dos urgentes que se pisan; el primero que la acepta se la
    queda y el segundo recibe un mensaje claro, con su turno intacto."""
    uno = await _comercio(client, "ud_dos_a")
    otro = await _comercio(client, "ud_dos_b")
    turno_uno = await _turno(client, uno, empieza_en=3)
    turno_otro = await _turno(client, otro, empieza_en=4)
    worker, profile_id = await _persona(client, "ud_dos_w@staffya.com")
    await client.post(f"/api/v1/applications/shifts/{turno_uno}", headers=worker)
    await client.post(f"/api/v1/applications/shifts/{turno_otro}", headers=worker)

    primero = await _aceptar(client, turno_uno, uno, profile_id)
    assert primero.json()["status"] == "confirmado"

    segundo = await _aceptar(client, turno_otro, otro, profile_id)
    # Su postulación al otro turno se retiró sola al quedar confirmada, así
    # que el segundo comercio la asigna como a cualquier recomendada (queda
    # «asignado», y al confirmar choca con la regla de doble turno), o recibe
    # el 409 del carril urgente. En ningún caso queda confirmada dos veces.
    if segundo.status_code == 200:
        assert segundo.json()["status"] == "asignado"
        confirmar = await client.post(f"/api/v1/shifts/{turno_otro}/confirm", headers=worker)
        assert confirmar.status_code in (400, 409)
    else:
        assert segundo.status_code == 409
        assert "otro turno" in segundo.json()["detail"]
