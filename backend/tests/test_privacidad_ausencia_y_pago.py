"""Datos de otra persona que viajaban en un turno (pasada de privacidad del
2026-11-19).

- PRI-01: quien toma un turno reofrecido (U080) heredaba quién faltó antes
  (`last_no_show_worker_profile_id`, `no_show_at`) y con ese id llegaba al
  perfil de esa persona. Lo sigue viendo el comercio dueño.
- PRI-05: quien se postuló o guardó un turno que tomó otro veía cuándo el
  comercio le pagó a esa persona (`paid_at`)."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from tests._turno_empezado import correr_reloj_del_turno, empezar_turno
from tests.test_attendance import _employer_with_company, _shift_payload
from tests.test_attendance import _worker_with_profile as _worker_con_perfil
from tests.test_no_show_and_late_cancellation import (
    _confirmed_shift,
    _worker_with_profile,
)

pytestmark = pytest.mark.asyncio


async def test_reemplazo_no_ve_la_ausencia_de_quien_tuvo_el_turno(
    client: AsyncClient, session_factory
):
    shift_id, employer, _ausente, ausente_id = await _confirmed_shift(
        client, "pri01_emp@staffya.com", "pri01_ausente@staffya.com", city="Pri01City"
    )
    await empezar_turno(session_factory, shift_id)
    marked = await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=employer)
    assert marked.status_code == 200
    assert marked.json()["status"] == "buscando_personal"  # reofrecido (U080)

    reemplazo, reemplazo_id = await _worker_with_profile(client, "pri01_reemplazo@staffya.com")
    assigned = await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": reemplazo_id},
    )
    assert assigned.status_code == 200
    confirmado = await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=reemplazo)
    assert confirmado.status_code == 200, confirmado.text

    detalle = (await client.get(f"/api/v1/shifts/{shift_id}", headers=reemplazo)).json()
    mios = (await client.get("/api/v1/shifts/mine", headers=reemplazo)).json()
    [en_mis_turnos] = [s for s in mios if s["id"] == shift_id]
    vistas = {
        "confirm": confirmado.json(),
        "detalle": detalle,
        "mine": en_mis_turnos,
    }
    fugas = {
        f"{donde}.{campo}": vista[campo]
        for donde, vista in vistas.items()
        for campo in ("last_no_show_worker_profile_id", "no_show_at")
        if vista[campo] is not None
    }
    assert fugas == {}, fugas
    # Su propio turno lo sigue viendo entero.
    assert detalle["worker_profile_id"] == reemplazo_id

    # El comercio dueño sigue sabiendo quién faltó (lo usa su panel).
    del_comercio = (await client.get(f"/api/v1/shifts/{shift_id}", headers=employer)).json()
    assert del_comercio["last_no_show_worker_profile_id"] == ausente_id
    assert del_comercio["no_show_at"] is not None


async def test_quien_no_quedo_no_ve_el_pago_del_turno_ajeno(client: AsyncClient):
    employer = await _employer_with_company(client, "pri05_emp@staffya.com")
    start = (datetime.now(timezone.utc) + timedelta(minutes=10)).replace(tzinfo=None)
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json=_shift_payload(
            start_at=start.isoformat(), end_at=(start + timedelta(hours=5)).isoformat()
        ),
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)

    otro, _ = await _worker_con_perfil(client, "pri05_otro@staffya.com")
    assert (await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=otro)).status_code == 201
    assert (await client.put(f"/api/v1/saved-shifts/{shift_id}", headers=otro)).status_code == 200

    elegido, elegido_id = await _worker_con_perfil(client, "pri05_elegido@staffya.com")
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=employer, json={"worker_profile_id": elegido_id}
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=elegido)
    llegada = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in", headers=elegido, json={"latitude": -34.58, "longitude": -58.43}
    )
    assert llegada.status_code == 200, llegada.text
    await correr_reloj_del_turno(shift_id, 60)
    salida = await client.post(
        f"/api/v1/shifts/{shift_id}/check-out", headers=elegido, json={"latitude": -34.58, "longitude": -58.43}
    )
    assert salida.status_code == 200, salida.text
    assert (await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer)).status_code == 200
    assert (await client.post(f"/api/v1/shifts/{shift_id}/mark-paid", headers=employer)).status_code == 200

    # El detalle ya no existe para quien no es parte...
    assert (await client.get(f"/api/v1/shifts/{shift_id}", headers=otro)).status_code == 404
    # ...pero «Mis postulaciones» y «Guardados» le dan el turno con el pago.
    mias = (await client.get("/api/v1/applications/mine", headers=otro)).json()
    [postulacion] = [a for a in mias if a["shift_id"] == shift_id]
    guardados = (await client.get("/api/v1/saved-shifts", headers=otro)).json()
    [guardado] = [s for s in guardados if s["id"] == shift_id]
    vistos = {
        "applications.paid_at": postulacion["shift"]["paid_at"],
        "saved.paid_at": guardado["paid_at"],
    }
    assert vistos["applications.paid_at"] is None and vistos["saved.paid_at"] is None, vistos


_CAMPOS = ("last_no_show_worker_profile_id", "no_show_at")


# Lo sumó la revisión independiente: las respuestas de TODAS las acciones del
# reemplazo (y su repetición por idempotencia), no sólo confirmar y el detalle.
async def test_ninguna_accion_del_reemplazo_trae_la_ausencia_ajena(
    client: AsyncClient, session_factory
):
    shift_id, employer, _ausente, _ = await _confirmed_shift(
        client, "revpri_emp@staffya.com", "revpri_ausente@staffya.com", city="RevPriCity"
    )
    await empezar_turno(session_factory, shift_id)
    marked = await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=employer)
    assert marked.status_code == 200 and marked.json()["status"] == "buscando_personal"

    # Primero alguien que lo rechaza: la respuesta de rechazar tampoco.
    rechaza, rechaza_id = await _worker_with_profile(client, "revpri_rechaza@staffya.com")
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=employer, json={"worker_profile_id": rechaza_id}
    )
    vistas: dict[str, dict] = {}
    rechazo = await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=rechaza)
    assert rechazo.status_code == 200, rechazo.text
    vistas["reject"] = rechazo.json()

    reemplazo, reemplazo_id = await _worker_with_profile(client, "revpri_reemplazo@staffya.com")
    asignado = await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=employer, json={"worker_profile_id": reemplazo_id}
    )
    assert asignado.status_code == 200, asignado.text
    # Asignado y todavía sin confirmar: el detalle ya lo ve como parte.
    vistas["detalle_asignado"] = (
        await client.get(f"/api/v1/shifts/{shift_id}", headers=reemplazo)
    ).json()
    confirm = await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=reemplazo)
    assert confirm.status_code == 200, confirm.text

    depart = await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=reemplazo)
    assert depart.status_code == 200, depart.text
    vistas["depart"] = depart.json()
    en_camino = await client.post(
        f"/api/v1/shifts/{shift_id}/en-route",
        headers=reemplazo,
        json={"latitude": -34.60, "longitude": -58.40},
    )
    assert en_camino.status_code == 200, en_camino.text
    vistas["en_route"] = en_camino.json()
    corta = await client.delete(f"/api/v1/shifts/{shift_id}/en-route", headers=reemplazo)
    assert corta.status_code == 200, corta.text
    vistas["en_route_delete"] = corta.json()

    llave = {"Idempotency-Key": "revpri-llegada-1"}
    llegada = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers={**reemplazo, **llave},
        json={"latitude": -34.58, "longitude": -58.43},
    )
    assert llegada.status_code == 200, llegada.text
    vistas["check_in"] = llegada.json()
    repetida = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers={**reemplazo, **llave},
        json={"latitude": -34.58, "longitude": -58.43},
    )
    assert repetida.status_code == 200, repetida.text
    vistas["check_in_repetido"] = repetida.json()

    trabaja = await client.post(f"/api/v1/shifts/{shift_id}/start-working", headers=reemplazo)
    assert trabaja.status_code == 200, trabaja.text
    vistas["start_working"] = trabaja.json()
    salida = await client.post(
        f"/api/v1/shifts/{shift_id}/check-out",
        headers=reemplazo,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    assert salida.status_code == 200, salida.text
    vistas["check_out"] = salida.json()

    fugas = {
        f"{donde}.{campo}": vista[campo]
        for donde, vista in vistas.items()
        for campo in _CAMPOS
        if vista.get(campo) is not None
    }
    assert fugas == {}, fugas
    # El comercio dueño la sigue viendo.
    del_comercio = (await client.get(f"/api/v1/shifts/{shift_id}", headers=employer)).json()
    assert del_comercio["last_no_show_worker_profile_id"] is not None
