"""Reconfirmación antes del turno (ADR-0031, P3).

A las 24 y a las 3 horas del inicio se le pregunta a quien confirmó si sigue
yendo; a las 2 horas, si no contestó nunca, se le avisa al comercio. «Sí,
voy» queda registrado; «No puedo» es la cancelación de siempre, que no pesa
si se avisa con tiempo. Todo apagado por defecto.

Primero las reglas puras (`shift/domain/reconfirmacion.py`), después el
scheduler y la API, con el mismo patrón que `test_cierre_automatico.py`."""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.modules.shift.application import scheduler
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.reconfirmacion import (
    PasoReconfirmacion,
    cancelacion_sin_peso,
    paso_pendiente,
)
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.worker.domain.value_objects import WorkerSkill
from app.modules.worker.infrastructure.models import WorkerProfileModel
from tests.test_cuentas_suspendidas import _notices
from tests.test_scheduler import _confirmed_shift_starting_ago

INICIO = datetime(2026, 6, 28, 23, 0)  # UTC, sin zona (como lo devuelve SQLite)


def _turno(**cambios) -> Shift:
    """Turno confirmado hace una semana, sin ninguna marca."""
    base = dict(
        company_id=uuid4(),
        position=WorkerSkill.MOZO,
        quantity=1,
        start_at=INICIO,
        end_at=INICIO + timedelta(hours=5),
        pay_amount=70000,
        status=ShiftStatus.CONFIRMADO,
        worker_profile_id=uuid4(),
        confirmed_at=INICIO - timedelta(days=7),
    )
    base.update(cambios)
    return Shift(**base)


def _antes(**delta) -> datetime:
    return INICIO - timedelta(**delta)


# --- Reglas puras -------------------------------------------------------------


def test_antes_de_las_24_horas_no_toca_nada_y_avisa_cuando_mirar():
    assert paso_pendiente(_turno(), _antes(hours=30)) == (None, _antes(hours=24))


def test_a_las_24_horas_sale_el_primer_aviso():
    assert paso_pendiente(_turno(), _antes(hours=24)) == (
        PasoReconfirmacion.PRIMER_AVISO,
        _antes(hours=3),
    )
    # Ya mandado: no se repite.
    mandado = _turno(reconfirm_24h_sent_at=_antes(hours=24))
    assert paso_pendiente(mandado, _antes(hours=20)) == (None, _antes(hours=3))


def test_no_hay_primer_aviso_si_confirmo_con_menos_de_24_horas():
    turno = _turno(confirmed_at=_antes(hours=10))
    assert paso_pendiente(turno, _antes(hours=9)) == (None, _antes(hours=3))


def test_a_las_3_horas_sale_el_segundo_aviso():
    turno = _turno(reconfirm_24h_sent_at=_antes(hours=24))
    assert paso_pendiente(turno, _antes(hours=3)) == (
        PasoReconfirmacion.SEGUNDO_AVISO,
        _antes(hours=2),
    )


@pytest.mark.parametrize("campo", ["confirmed_at", "reconfirmed_at"])
def test_no_hay_segundo_aviso_si_confirmo_o_reconfirmo_en_las_3_horas_anteriores(campo):
    turno = _turno(**{campo: _antes(hours=4)})
    paso, _ = paso_pendiente(turno, _antes(hours=3))
    assert paso is None
    # Tampoco sale un rato después, cuando ya pasaron 3 horas de esa respuesta.
    paso, _ = paso_pendiente(turno, _antes(hours=2, minutes=10))
    assert paso is None


def test_reconfirmar_al_primer_aviso_no_evita_el_segundo():
    turno = _turno(
        reconfirm_24h_sent_at=_antes(hours=24), reconfirmed_at=_antes(hours=23)
    )
    paso, _ = paso_pendiente(turno, _antes(hours=3))
    assert paso is PasoReconfirmacion.SEGUNDO_AVISO


def test_a_las_2_horas_se_avisa_al_comercio_si_nunca_contesto():
    turno = _turno(
        reconfirm_24h_sent_at=_antes(hours=24), reconfirm_3h_sent_at=_antes(hours=3)
    )
    assert paso_pendiente(turno, _antes(hours=2)) == (
        PasoReconfirmacion.ALERTA_AL_COMERCIO,
        None,
    )
    # Una sola vez.
    avisado = _turno(
        reconfirm_3h_sent_at=_antes(hours=3), no_reconfirm_alert_sent_at=_antes(hours=2)
    )
    assert paso_pendiente(avisado, _antes(hours=1)) == (None, None)


def test_no_se_avisa_al_comercio_si_contesto_alguna_vez_o_si_no_se_le_pregunto():
    contesto = _turno(
        reconfirm_24h_sent_at=_antes(hours=24),
        reconfirmed_at=_antes(hours=23),
        reconfirm_3h_sent_at=_antes(hours=3),
    )
    assert paso_pendiente(contesto, _antes(hours=2)) == (None, None)
    # Confirmó hace una hora: no hubo ninguna pregunta que contestar.
    recien = _turno(confirmed_at=_antes(hours=2, minutes=30))
    assert paso_pendiente(recien, _antes(hours=2)) == (None, None)


def test_un_turno_que_no_esta_confirmado_o_ya_empezo_no_lleva_nada():
    assert paso_pendiente(_turno(status=ShiftStatus.EN_CAMINO), _antes(hours=3)) == (None, None)
    assert paso_pendiente(_turno(), INICIO) == (None, None)


def test_pregunta_pendiente_hasta_que_contesta_y_de_nuevo_con_el_segundo_aviso():
    assert not _turno().reconfirmation_pending
    preguntado = _turno(reconfirm_24h_sent_at=_antes(hours=24))
    assert preguntado.reconfirmation_pending
    contesto = _turno(reconfirm_24h_sent_at=_antes(hours=24), reconfirmed_at=_antes(hours=23))
    assert not contesto.reconfirmation_pending
    otra_vez = _turno(
        reconfirm_24h_sent_at=_antes(hours=24),
        reconfirmed_at=_antes(hours=23),
        reconfirm_3h_sent_at=_antes(hours=3),
    )
    assert otra_vez.reconfirmation_pending
    en_camino = _turno(status=ShiftStatus.EN_CAMINO, reconfirm_3h_sent_at=_antes(hours=3))
    assert not en_camino.reconfirmation_pending


def test_cancelar_con_24_horas_o_mas_no_pesa():
    assert cancelacion_sin_peso(_turno(), _antes(hours=30))
    assert cancelacion_sin_peso(_turno(), _antes(hours=24))
    assert not cancelacion_sin_peso(_turno(), _antes(hours=23))


def test_contestar_no_puedo_al_primer_aviso_tampoco_pesa_dentro_del_margen():
    turno = _turno(reconfirm_24h_sent_at=_antes(hours=24))
    assert cancelacion_sin_peso(turno, _antes(hours=22))
    assert cancelacion_sin_peso(turno, _antes(hours=21))
    assert not cancelacion_sin_peso(turno, _antes(hours=20, minutes=59))


def test_un_primer_aviso_que_salio_tarde_no_regala_la_cancelacion():
    # El scheduler estuvo caído: el aviso salió a 4 horas del inicio.
    turno = _turno(reconfirm_24h_sent_at=_antes(hours=4))
    assert not cancelacion_sin_peso(turno, _antes(hours=3, minutes=30))


def test_despues_del_segundo_aviso_cancelar_pesa_como_siempre():
    turno = _turno(
        reconfirm_24h_sent_at=_antes(hours=4), reconfirm_3h_sent_at=_antes(hours=3)
    )
    assert not cancelacion_sin_peso(turno, _antes(hours=2, minutes=50))


# --- Scheduler y API -----------------------------------------------------------


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@pytest.fixture
def prendida(monkeypatch, session_factory):
    monkeypatch.setattr(settings, "reconfirmacion_enabled", True)
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)


async def _confirmado(
    client: AsyncClient,
    session_factory,
    prefix: str,
    *,
    falta: timedelta,
    confirmo_hace: timedelta = timedelta(days=3),
) -> tuple[str, dict, dict]:
    """Turno confirmado hace `confirmo_hace` al que le falta `falta` para empezar."""
    shift_id, employer, worker = await _confirmed_shift_starting_ago(
        client, f"{prefix}_emp@staffya.com", f"{prefix}_w@staffya.com", ago=-falta
    )
    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        model.confirmed_at = _now() - confirmo_hace
        await session.commit()
    return shift_id, employer, worker


async def _fila(session_factory, shift_id: str) -> ShiftModel:
    async with session_factory() as session:
        return await session.get(ShiftModel, UUID(shift_id))


async def _mover_inicio(session_factory, shift_id: str, falta: timedelta) -> None:
    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        model.start_at = _now() + falta
        model.end_at = model.start_at + timedelta(hours=5)
        await session.commit()


async def _cancelaciones(session_factory, shift_row: ShiftModel, worker_id: UUID) -> int:
    async with session_factory() as session:
        return (await session.get(WorkerProfileModel, worker_id)).cancellations


@pytest.mark.asyncio
async def test_apagada_no_pregunta_nada(client, session_factory, monkeypatch):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, _employer, worker = await _confirmado(
        client, session_factory, "rec_off", falta=timedelta(hours=23)
    )

    assert await scheduler.run_reconfirmation_check() is None

    assert await _notices(client, worker, "reconfirm_request") == []
    assert (await _fila(session_factory, shift_id)).reconfirm_24h_sent_at is None
    # «Sí, voy» tampoco existe.
    response = await client.post(f"/api/v1/shifts/{shift_id}/reconfirm", headers=worker)
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_a_las_24_horas_pregunta_una_sola_vez_y_solo_a_la_persona(
    client, session_factory, prendida
):
    shift_id, employer, worker = await _confirmado(
        client, session_factory, "rec_24", falta=timedelta(hours=23, minutes=30)
    )
    version = (await _fila(session_factory, shift_id)).version

    await scheduler.run_reconfirmation_check()
    await scheduler.run_reconfirmation_check()

    [aviso] = await _notices(client, worker, "reconfirm_request")
    assert aviso["title"].startswith("¿Seguís yendo ")
    assert " a las " in aviso["title"]
    assert aviso["link"] == f"/my-shifts?turno={shift_id}"
    assert await _notices(client, employer, "reconfirm_request") == []
    fila = await _fila(session_factory, shift_id)
    assert fila.reconfirm_24h_sent_at is not None
    # Marca de sistema: no sube la versión del turno.
    assert fila.version == version

    mio = (await client.get(f"/api/v1/shifts/{shift_id}", headers=worker)).json()
    assert mio["reconfirmation_pending"] is True
    # Contestando ahora «No puedo» no le cuenta, y la respuesta lo dice.
    assert mio["cancel_with_notice"] is True
    # Las marcas internas no salen.
    assert "reconfirm_24h_sent_at" not in mio and "reconfirm_3h_sent_at" not in mio


@pytest.mark.asyncio
async def test_si_voy_queda_registrado_y_el_comercio_lo_ve(
    client, session_factory, prendida
):
    shift_id, employer, worker = await _confirmado(
        client, session_factory, "rec_si", falta=timedelta(hours=23)
    )
    await scheduler.run_reconfirmation_check()

    response = await client.post(f"/api/v1/shifts/{shift_id}/reconfirm", headers=worker)

    assert response.status_code == 200, response.text
    assert response.json()["reconfirmation_pending"] is False
    assert response.json()["reconfirmed_at"] is not None
    del_comercio = (await client.get(f"/api/v1/shifts/{shift_id}", headers=employer)).json()
    assert del_comercio["reconfirmed_at"] is not None
    assert del_comercio["status"] == "confirmado"


@pytest.mark.asyncio
async def test_reconfirmar_un_turno_ajeno_da_404_y_quien_no_es_parte_no_ve_nada(
    client, session_factory, prendida
):
    from tests.conftest import auth_headers

    shift_id, _employer, worker = await _confirmado(
        client, session_factory, "rec_ajeno", falta=timedelta(hours=23)
    )
    await scheduler.run_reconfirmation_check()
    await client.post(f"/api/v1/shifts/{shift_id}/reconfirm", headers=worker)
    otra = await auth_headers(client, "worker", "rec_ajeno_otra@staffya.com")
    await client.post("/api/v1/workers/me/profile", headers=otra, json={"skills": ["mozo"]})

    response = await client.post(f"/api/v1/shifts/{shift_id}/reconfirm", headers=otra)

    assert response.status_code == 404
    # Quien no es parte recibe el turno sin nada de la reconfirmación (o no lo
    # recibe: un turno ya tomado puede no mostrarse a terceros).
    ajeno = await client.get(f"/api/v1/shifts/{shift_id}", headers=otra)
    if ajeno.status_code == 200:
        for campo in ("reconfirmed_at", "reconfirmation_pending", "no_reconfirm_alert_sent_at"):
            assert ajeno.json()[campo] is None
    else:
        assert ajeno.status_code == 404
    publico = await client.get(f"/api/v1/shifts/{shift_id}/public")
    if publico.status_code == 200:
        assert not publico.json().get("reconfirmed_at")
        assert not publico.json().get("reconfirmation_pending")


@pytest.mark.asyncio
async def test_si_voy_sin_pregunta_pendiente_no_registra_nada(
    client, session_factory, prendida
):
    """Un «Sí, voy» anticipado (por API, la pantalla no lo ofrece) no cuenta:
    si después no contesta las preguntas, el comercio tiene que enterarse."""
    shift_id, _employer, worker = await _confirmado(
        client, session_factory, "rec_antes", falta=timedelta(days=3)
    )

    response = await client.post(f"/api/v1/shifts/{shift_id}/reconfirm", headers=worker)

    assert response.status_code == 200
    assert response.json()["reconfirmed_at"] is None
    assert (await _fila(session_factory, shift_id)).reconfirmed_at is None


@pytest.mark.asyncio
async def test_quien_no_es_parte_no_recibe_si_cancelar_cuenta(
    client, session_factory, prendida
):
    """`cancel_with_notice` es de las partes. FastAPI valida de nuevo la
    respuesta y el validador lo recalculaba para un postulante que quedó
    afuera (revisión independiente de P3)."""
    from tests.conftest import auth_headers

    otra = await auth_headers(client, "worker", "rec_fuera_otra@staffya.com")
    await client.post("/api/v1/workers/me/profile", headers=otra, json={"skills": ["mozo"]})
    employer = await auth_headers(client, "employer", "rec_fuera_emp@staffya.com")
    await client.post(
        "/api/v1/companies/me/profile", headers=employer, json={"name": "Bar", "city": "Palermo"}
    )
    elegida = await auth_headers(client, "worker", "rec_fuera_w@staffya.com")
    perfil = await client.post(
        "/api/v1/workers/me/profile", headers=elegida, json={"skills": ["mozo"]}
    )
    inicio = datetime.now(timezone.utc) + timedelta(days=3)
    creado = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json={
            "position": "mozo", "quantity": 1, "pay_amount": "70000.00", "city": "Palermo",
            "start_at": inicio.isoformat(), "end_at": (inicio + timedelta(hours=5)).isoformat(),
        },
    )
    shift_id = creado.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=otra)
    await client.post(f"/api/v1/saved-shifts/{shift_id}", headers=otra)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": perfil.json()["id"]},
    )
    confirmado = await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=elegida)
    assert confirmado.status_code == 200, confirmado.text
    # La parte sí lo recibe.
    assert confirmado.json()["cancel_with_notice"] is True

    vistos = 0
    for ruta in ("/api/v1/applications/mine", "/api/v1/saved-shifts", f"/api/v1/shifts/{shift_id}"):
        respuesta = await client.get(ruta, headers=otra)
        if respuesta.status_code != 200:
            continue
        cuerpo = respuesta.json()
        turnos = cuerpo if isinstance(cuerpo, list) else [cuerpo]
        for item in turnos:
            turno = item.get("shift") or item
            if turno.get("id") == shift_id:
                vistos += 1
                assert turno["cancel_with_notice"] is None, ruta
                assert turno["reconfirmation_pending"] is None, ruta
    assert vistos >= 1  # al menos por «Mis postulaciones»


@pytest.mark.asyncio
async def test_sin_respuesta_a_las_2_horas_se_avisa_al_comercio_y_la_persona_sigue_asignada(
    client, session_factory, prendida
):
    shift_id, employer, worker = await _confirmado(
        client, session_factory, "rec_alerta", falta=timedelta(hours=2, minutes=50)
    )
    await scheduler.run_reconfirmation_check()  # segundo aviso
    assert len(await _notices(client, worker, "reconfirm_request")) == 1

    await _mover_inicio(session_factory, shift_id, timedelta(hours=1, minutes=50))
    await scheduler.run_reconfirmation_check()
    await scheduler.run_reconfirmation_check()

    [aviso] = await _notices(client, employer, "worker_not_reconfirmed")
    assert "no reconfirmó el turno de" in aviso["title"]
    assert aviso["link"] == f"/shifts?turno={shift_id}"
    fila = await _fila(session_factory, shift_id)
    assert fila.status == ShiftStatus.CONFIRMADO.value
    assert fila.worker_profile_id is not None
    # No contestar no penaliza.
    assert await _cancelaciones(session_factory, fila, fila.worker_profile_id) == 0


@pytest.mark.asyncio
async def test_no_puedo_al_primer_aviso_reabre_el_turno_y_no_suma_cancelacion(
    client, session_factory, prendida
):
    shift_id, employer, worker = await _confirmado(
        client, session_factory, "rec_no", falta=timedelta(hours=23, minutes=30)
    )
    await scheduler.run_reconfirmation_check()
    worker_id = (await _fila(session_factory, shift_id)).worker_profile_id

    response = await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=worker)

    assert response.status_code == 200, response.text
    fila = await _fila(session_factory, shift_id)
    assert fila.status == ShiftStatus.BUSCANDO_PERSONAL.value
    assert await _cancelaciones(session_factory, fila, worker_id) == 0
    # Las marcas eran de quien se fue: al reemplazo se le pregunta de nuevo.
    assert fila.reconfirm_24h_sent_at is None
    # El comercio se entera, como en toda cancelación.
    assert len(await _notices(client, employer, "shift_reopened")) == 1


@pytest.mark.asyncio
async def test_no_puedo_despues_del_segundo_aviso_suma_cancelacion(
    client, session_factory, prendida
):
    shift_id, _employer, worker = await _confirmado(
        client, session_factory, "rec_tarde", falta=timedelta(hours=2, minutes=50)
    )
    await scheduler.run_reconfirmation_check()
    worker_id = (await _fila(session_factory, shift_id)).worker_profile_id

    mio = (await client.get(f"/api/v1/shifts/{shift_id}", headers=worker)).json()
    assert mio["cancel_with_notice"] is False
    await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=worker)

    fila = await _fila(session_factory, shift_id)
    assert await _cancelaciones(session_factory, fila, worker_id) == 1


@pytest.mark.asyncio
async def test_apagada_cancelar_con_dias_de_anticipacion_pesa_como_siempre(
    client, session_factory, monkeypatch
):
    shift_id, _employer, worker = await _confirmado(
        client, session_factory, "rec_off_cancel", falta=timedelta(days=3)
    )
    worker_id = (await _fila(session_factory, shift_id)).worker_profile_id
    # Apagada, la respuesta no promete nada.
    mio = (await client.get(f"/api/v1/shifts/{shift_id}", headers=worker)).json()
    assert mio["cancel_with_notice"] is None

    await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=worker)

    fila = await _fila(session_factory, shift_id)
    assert await _cancelaciones(session_factory, fila, worker_id) == 1
