"""Puntualidad real (ADR-0008, actualización 2026-11-26; mejora P1).

Puntual es estar a la hora de inicio, con 5 minutos sólo para marcar. Para
que nadie se olvide: tres recordatorios (10 minutos antes, a la hora y 5
después). A la hora de inicio, si la persona no marcó, el comercio se entera
y tiene la última palabra: «Ya llegó» (a horario o tarde) o «No llegó»."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from httpx import AsyncClient

from app.modules.shift.application import scheduler
from app.modules.shift.domain.punctuality import (
    arrived_on_time,
    punctuality_of,
    recordatorio_pendiente,
)
from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.worker.infrastructure.models import WorkerProfileModel
from tests.test_cuentas_suspendidas import _notices
from tests.test_scheduler import _confirmed_shift_starting_ago

INICIO = datetime(2026, 6, 28, 23, 0)


def _a(**delta) -> datetime:
    return INICIO + timedelta(**delta)


# --- Reglas puras -------------------------------------------------------------


def test_puntual_es_marcar_hasta_5_minutos_despues_del_inicio():
    assert arrived_on_time(_a(minutes=-20), INICIO)
    assert arrived_on_time(_a(minutes=5), INICIO)
    assert not arrived_on_time(_a(minutes=6), INICIO)
    assert not arrived_on_time(None, INICIO)


def test_si_la_llegada_la_marco_el_comercio_vale_lo_que_dijo():
    # La marcó 40 minutos después, pero dijo que llegó a horario.
    assert punctuality_of(_a(minutes=40), INICIO, False, arrival_on_time=True) is True
    # La marcó enseguida, pero dijo que llegó tarde.
    assert punctuality_of(_a(minutes=1), INICIO, False, arrival_on_time=False) is False
    # El reemplazo de un turno ya empezado no mueve su puntualidad, diga lo que diga.
    assert punctuality_of(_a(minutes=40), INICIO, True, arrival_on_time=False) is None


def test_los_tres_recordatorios_salen_a_su_hora_y_una_sola_vez():
    assert recordatorio_pendiente(INICIO, 0, _a(minutes=-30)) == (None, _a(minutes=-10))
    assert recordatorio_pendiente(INICIO, 0, _a(minutes=-10)) == (1, INICIO)
    assert recordatorio_pendiente(INICIO, 1, _a(minutes=-5)) == (None, INICIO)
    assert recordatorio_pendiente(INICIO, 1, INICIO) == (2, _a(minutes=5))
    assert recordatorio_pendiente(INICIO, 2, _a(minutes=5)) == (3, None)
    assert recordatorio_pendiente(INICIO, 3, _a(minutes=30)) == (None, None)


def test_si_varios_quedaron_atras_se_manda_solo_el_ultimo():
    # El scheduler estuvo caído: no llegan tres avisos juntos.
    assert recordatorio_pendiente(INICIO, 0, _a(minutes=7)) == (3, None)


def test_al_reemplazo_de_un_turno_empezado_le_toca_uno_solo_a_los_20_minutos():
    confirmo = INICIO
    assert recordatorio_pendiente(confirmo, 0, _a(minutes=1), taken_after_start=True) == (
        None,
        _a(minutes=20),
    )
    assert recordatorio_pendiente(confirmo, 0, _a(minutes=20), taken_after_start=True) == (3, None)


# --- Scheduler y API -----------------------------------------------------------


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _fila(session_factory, shift_id: str) -> ShiftModel:
    async with session_factory() as session:
        return await session.get(ShiftModel, UUID(shift_id))


async def _mover_inicio(session_factory, shift_id: str, hace: timedelta) -> None:
    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        model.start_at = _now() - hace
        model.end_at = model.start_at + timedelta(hours=5)
        await session.commit()


@pytest.mark.asyncio
async def test_diez_minutos_antes_avisa_a_la_persona_y_todavia_no_al_comercio(
    client: AsyncClient, session_factory, monkeypatch
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, employer, worker = await _confirmed_shift_starting_ago(
        client, "punt_emp1@staffya.com", "punt_w1@staffya.com", ago=-timedelta(minutes=8)
    )

    await scheduler.run_attendance_check()
    await scheduler.run_attendance_check()

    [aviso] = await _notices(client, worker, "checkin_reminder")
    assert aviso["title"] == "Tu turno está por empezar"
    assert await _notices(client, employer, "worker_not_checked_in") == []
    assert (await _fila(session_factory, shift_id)).checkin_reminder_step == 1


@pytest.mark.asyncio
async def test_a_la_hora_de_inicio_sin_llegada_se_entera_el_comercio_una_sola_vez(
    client: AsyncClient, session_factory, monkeypatch
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, employer, worker = await _confirmed_shift_starting_ago(
        client, "punt_emp2@staffya.com", "punt_w2@staffya.com", ago=timedelta(minutes=1)
    )

    await scheduler.run_attendance_check()  # paso 2
    await _mover_inicio(session_factory, shift_id, timedelta(minutes=6))
    await scheduler.run_attendance_check()  # paso 3
    await scheduler.run_attendance_check()

    titulos = [a["title"] for a in await _notices(client, worker, "checkin_reminder")]
    assert sorted(titulos) == ["Es la hora de tu turno", "¿Ya llegaste a tu turno?"]
    [alerta] = await _notices(client, employer, "worker_not_checked_in")
    assert "todavía no marcó la llegada" in alerta["title"]
    assert alerta["link"] == f"/shifts?turno={shift_id}"
    # La persona sigue asignada: decide el comercio.
    assert (await _fila(session_factory, shift_id)).status == "confirmado"


@pytest.mark.asyncio
@pytest.mark.parametrize("a_horario", [True, False])
async def test_ya_llego_marca_la_llegada_y_la_puntualidad_es_la_que_dijo_el_comercio(
    client: AsyncClient, session_factory, a_horario: bool
):
    sufijo = "si" if a_horario else "no"
    shift_id, employer, worker = await _confirmed_shift_starting_ago(
        client, f"punt_emp3{sufijo}@staffya.com", f"punt_w3{sufijo}@staffya.com",
        ago=timedelta(minutes=25),
    )

    response = await client.post(
        f"/api/v1/shifts/{shift_id}/company-check-in", headers=employer, json={"on_time": a_horario}
    )

    assert response.status_code == 200, response.text
    cuerpo = response.json()
    assert cuerpo["status"] == "check_in"
    assert cuerpo["arrival_on_time"] is a_horario
    assert cuerpo["arrival_marked_by_company_at"] is not None
    [aviso] = await _notices(client, worker, "arrival_marked_by_company")
    assert ("a horario" if a_horario else "tarde") in aviso["message"]

    # Hasta el final: la puntualidad que se guarda es la que dijo el comercio,
    # no los 25 minutos que tardó en marcarla.
    fila = await _fila(session_factory, shift_id)
    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        model.status = "check_out"
        model.check_out_at = _now()
        await session.commit()
    cerrado = await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer)
    assert cerrado.status_code == 200, cerrado.text
    async with session_factory() as session:
        perfil = await session.get(WorkerProfileModel, fila.worker_profile_id)
    assert perfil.events_completed == 1
    assert perfil.punctuality_rate == (1.0 if a_horario else 0.0)


@pytest.mark.asyncio
async def test_ya_llego_no_se_puede_antes_de_la_hora_ni_sobre_un_turno_ajeno(
    client: AsyncClient,
):
    from tests.conftest import auth_headers

    shift_id, employer, worker = await _confirmed_shift_starting_ago(
        client, "punt_emp4@staffya.com", "punt_w4@staffya.com", ago=-timedelta(hours=1)
    )
    antes = await client.post(
        f"/api/v1/shifts/{shift_id}/company-check-in", headers=employer, json={"on_time": True}
    )
    assert antes.status_code == 400
    assert "Todavía no empezó" in antes.json()["detail"]

    otro = await auth_headers(client, "employer", "punt_emp4b@staffya.com")
    await client.post(
        "/api/v1/companies/me/profile", headers=otro, json={"name": "Otro", "city": "Palermo"}
    )
    ajeno = await client.post(
        f"/api/v1/shifts/{shift_id}/company-check-in", headers=otro, json={"on_time": True}
    )
    assert ajeno.status_code == 404
    # La persona asignada tampoco puede marcarse por esa vía.
    propia = await client.post(
        f"/api/v1/shifts/{shift_id}/company-check-in", headers=worker, json={"on_time": True}
    )
    assert propia.status_code in (403, 404)


@pytest.mark.asyncio
async def test_no_llego_se_puede_marcar_desde_los_10_minutos(client: AsyncClient):
    shift_id, employer, _worker = await _confirmed_shift_starting_ago(
        client, "punt_emp5@staffya.com", "punt_w5@staffya.com", ago=timedelta(minutes=11)
    )
    response = await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=employer)
    assert response.status_code == 200, response.text

    temprano_id, employer2, _w = await _confirmed_shift_starting_ago(
        client, "punt_emp6@staffya.com", "punt_w6@staffya.com", ago=timedelta(minutes=8)
    )
    temprano = await client.post(f"/api/v1/shifts/{temprano_id}/no-show", headers=employer2)
    assert temprano.status_code == 400
