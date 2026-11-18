"""U072 (decisión 3, ADR-0014 actualizado el 2026-11-18): «va en camino» se
apaga al instante también para el comercio.

Antes «Dejar de compartir» sólo dejaba de mandar posiciones nuevas: la última
seguía guardada y el comercio la seguía viendo hasta que la persona marcaba
la llegada.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from tests.test_attendance import _confirmed_shift, _employer_with_company
from tests.test_cuentas_suspendidas import _notices

pytestmark = pytest.mark.asyncio

AQUI = {"latitude": -34.60, "longitude": -58.40}


async def _en_viaje(client: AsyncClient, tag: str, *, minutes: int = 40):
    start = (datetime.now(timezone.utc) + timedelta(minutes=minutes)).replace(tzinfo=None)
    return await _confirmed_shift(
        client,
        f"u072_emp_{tag}@staffya.com",
        f"u072_w_{tag}@staffya.com",
        start_at=start.isoformat(),
        end_at=(start + timedelta(hours=6)).isoformat(),
    )


async def _compartir(client: AsyncClient, shift_id: str, worker: dict):
    resp = await client.post(f"/api/v1/shifts/{shift_id}/en-route", headers=worker, json=AQUI)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def test_dejar_de_compartir_borra_la_posicion_tambien_para_el_comercio(client: AsyncClient):
    shift_id, employer, worker = await _en_viaje(client, "1")
    await _compartir(client, shift_id, worker)
    visto = (await client.get(f"/api/v1/shifts/{shift_id}", headers=employer)).json()
    assert visto["en_route_latitude"] == AQUI["latitude"]

    stopped = await client.delete(f"/api/v1/shifts/{shift_id}/en-route", headers=worker)

    assert stopped.status_code == 200, stopped.text
    for body in (
        stopped.json(),
        (await client.get(f"/api/v1/shifts/{shift_id}", headers=employer)).json(),
    ):
        assert body["en_route_latitude"] is None
        assert body["en_route_longitude"] is None
        assert body["en_route_at"] is None
        assert body["status"] == "confirmado"
    # En el panel del comercio (la lista) tampoco queda.
    panel = (await client.get("/api/v1/shifts/me", headers=employer)).json()
    turno = next(s for s in panel if s["id"] == shift_id)
    assert turno["en_route_at"] is None and turno["en_route_latitude"] is None


async def test_apagar_dos_veces_o_sin_haber_compartido_no_es_un_error(client: AsyncClient):
    shift_id, _employer, worker = await _en_viaje(client, "2")

    primera = await client.delete(f"/api/v1/shifts/{shift_id}/en-route", headers=worker)
    assert primera.status_code == 200
    await _compartir(client, shift_id, worker)
    assert (await client.delete(f"/api/v1/shifts/{shift_id}/en-route", headers=worker)).status_code == 200
    otra = await client.delete(f"/api/v1/shifts/{shift_id}/en-route", headers=worker)

    assert otra.status_code == 200
    assert otra.json()["en_route_at"] is None


async def test_apagar_y_volver_a_prender_no_le_manda_otro_aviso_al_comercio(client: AsyncClient):
    shift_id, employer, worker = await _en_viaje(client, "3")
    await _compartir(client, shift_id, worker)
    assert len(await _notices(client, employer, "worker_en_route")) == 1

    assert (await client.delete(f"/api/v1/shifts/{shift_id}/en-route", headers=worker)).status_code == 200
    again = await _compartir(client, shift_id, worker)

    # Vuelve a verse en el mapa del comercio...
    assert again["en_route_latitude"] == AQUI["latitude"]
    # ...pero «salió para tu local» ya se había avisado en este viaje.
    assert len(await _notices(client, employer, "worker_en_route")) == 1


async def test_solo_quien_tiene_el_turno_puede_apagarlo(client: AsyncClient):
    shift_id, employer, worker = await _en_viaje(client, "4")
    await _compartir(client, shift_id, worker)
    otro_comercio = await _employer_with_company(client, "u072_otro_4@staffya.com")

    assert (await client.delete(f"/api/v1/shifts/{shift_id}/en-route", headers=employer)).status_code in (403, 404)
    assert (await client.delete(f"/api/v1/shifts/{shift_id}/en-route", headers=otro_comercio)).status_code in (403, 404)
    assert (await client.delete(f"/api/v1/shifts/{shift_id}/en-route")).status_code == 401

    visto = (await client.get(f"/api/v1/shifts/{shift_id}", headers=employer)).json()
    assert visto["en_route_latitude"] == AQUI["latitude"]


async def test_un_turno_en_camino_del_paso_viejo_vuelve_a_confirmado(client: AsyncClient):
    """ADR-0008: `depart` ya no se ofrece, pero un turno puede estar en
    `en_camino`. Al apagar, el comercio vuelve a ver «Confirmado»."""
    shift_id, employer, worker = await _en_viaje(client, "5", minutes=10)
    assert (await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=worker)).status_code == 200
    await _compartir(client, shift_id, worker)

    stopped = await client.delete(f"/api/v1/shifts/{shift_id}/en-route", headers=worker)

    assert stopped.json()["status"] == "confirmado"
    assert (await client.get(f"/api/v1/shifts/{shift_id}", headers=employer)).json()["status"] == "confirmado"
    # Y sigue pudiendo marcar la llegada como siempre.
    llegada = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers=worker,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    assert llegada.status_code == 200, llegada.text


async def test_despues_de_la_llegada_no_hay_nada_que_apagar(client: AsyncClient):
    shift_id, _employer, worker = await _en_viaje(client, "6", minutes=10)
    await _compartir(client, shift_id, worker)
    llegada = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers=worker,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    assert llegada.status_code == 200, llegada.text

    stopped = await client.delete(f"/api/v1/shifts/{shift_id}/en-route", headers=worker)

    assert stopped.status_code == 200
    assert stopped.json()["status"] == "check_in"


# --- Revisión independiente -------------------------------------------------------


async def test_quien_salio_y_apago_no_recibe_el_recordatorio_de_salida(
    client: AsyncClient, session_factory, monkeypatch
):
    """El recordatorio «avisá cuando salgas» miraba si había una posición
    guardada. Apagar la borra, pero la persona ya salió (y ya se le avisó al
    comercio): recordárselo sería ruido."""
    from app.modules.shift.application import scheduler

    shift_id, _employer, worker = await _en_viaje(client, "7", minutes=50)
    await _compartir(client, shift_id, worker)
    assert (await client.delete(f"/api/v1/shifts/{shift_id}/en-route", headers=worker)).status_code == 200

    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    await scheduler.run_attendance_check()

    assert await _notices(client, worker, "departure_reminder") == []


async def test_quien_nunca_aviso_que_salio_si_lo_recibe(
    client: AsyncClient, session_factory, monkeypatch
):
    from app.modules.shift.application import scheduler

    shift_id, _employer, worker = await _en_viaje(client, "8", minutes=50)

    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    await scheduler.run_attendance_check()

    assert len(await _notices(client, worker, "departure_reminder")) == 1


async def test_apagar_gana_si_choca_con_un_reporte_que_llega_a_la_vez(
    client: AsyncClient, monkeypatch
):
    """El reporte periódico y el apagado escriben el mismo turno. Si chocan
    (control de versión, 409), apagar se repite: no puede quedar la posición
    guardada con la persona creyendo que la borró."""
    from app.modules.shift.domain.exceptions import ShiftConcurrentModificationError
    from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository as Repo

    shift_id, employer, worker = await _en_viaje(client, "9")
    await _compartir(client, shift_id, worker)
    real = Repo.update
    calls = {"n": 0}

    async def choca_una_vez(self, shift):
        calls["n"] += 1
        if calls["n"] == 1:
            raise ShiftConcurrentModificationError(str(shift.id))
        return await real(self, shift)

    monkeypatch.setattr(Repo, "update", choca_una_vez)

    stopped = await client.delete(f"/api/v1/shifts/{shift_id}/en-route", headers=worker)

    assert stopped.status_code == 200, stopped.text
    assert calls["n"] == 2
    monkeypatch.setattr(Repo, "update", real)
    visto = (await client.get(f"/api/v1/shifts/{shift_id}", headers=employer)).json()
    assert visto["en_route_latitude"] is None and visto["en_route_at"] is None
