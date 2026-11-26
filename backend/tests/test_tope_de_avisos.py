"""Tope a las cancelaciones con aviso que no pesan (2026-11-26).

Avisar con 24 horas o más no suma una cancelación, pero sólo dos veces por
período de 30 días: desde la tercera cuenta como cualquier otra. Sin tope,
alguien podía confirmar y soltar turnos todo el tiempo sin costo.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import update

from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.worker.domain.avisos import (
    AVISOS_SIN_PESO_POR_PERIODO,
    PERIODO_DE_AVISOS,
    queda_aviso_sin_peso,
    usar_aviso,
)
from app.modules.worker.infrastructure.models import WorkerProfileModel
from tests.test_reconfirmacion import _cancelaciones, _confirmado, _fila

AHORA = datetime(2026, 11, 26, 15, 0, tzinfo=timezone.utc)


def test_los_dos_primeros_avisos_del_periodo_no_pesan_y_el_tercero_si():
    sin_peso, desde, usados = usar_aviso(None, 0, AHORA)
    assert (sin_peso, desde, usados) == (True, AHORA, 1)

    sin_peso, desde, usados = usar_aviso(desde, usados, AHORA + timedelta(days=3))
    assert (sin_peso, desde, usados) == (True, AHORA, 2)
    assert usados == AVISOS_SIN_PESO_POR_PERIODO

    # El tercero dentro del período pesa, y no gasta nada.
    assert usar_aviso(desde, usados, AHORA + timedelta(days=10)) == (False, AHORA, 2)
    assert not queda_aviso_sin_peso(desde, usados, AHORA + timedelta(days=29))


def test_pasados_los_30_dias_el_periodo_se_renueva_solo():
    despues = AHORA + PERIODO_DE_AVISOS
    assert queda_aviso_sin_peso(AHORA, 2, despues)
    assert usar_aviso(AHORA, 2, despues) == (True, despues, 1)


def test_una_fecha_sin_zona_se_lee_como_el_mismo_instante():
    # SQLite devuelve las fechas sin zona.
    assert not queda_aviso_sin_peso(AHORA.replace(tzinfo=None), 2, AHORA + timedelta(days=1))


async def _gastar(session_factory, worker_id, *, usados: int, hace: timedelta) -> None:
    async with session_factory() as session:
        await session.execute(
            update(WorkerProfileModel)
            .where(WorkerProfileModel.id == worker_id)
            .values(
                notice_cancellations_used=usados,
                notice_window_started_at=datetime.now(timezone.utc) - hace,
            )
        )
        await session.commit()


async def _perfil(session_factory, worker_id) -> WorkerProfileModel:
    async with session_factory() as session:
        return await session.get(WorkerProfileModel, worker_id)


@pytest.mark.asyncio
async def test_avisar_con_tiempo_gasta_un_aviso_del_periodo(client, session_factory):
    shift_id, _employer, worker = await _confirmado(
        client, session_factory, "tope_uno", falta=timedelta(days=3)
    )
    worker_id = (await _fila(session_factory, shift_id)).worker_profile_id

    await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=worker)

    perfil = await _perfil(session_factory, worker_id)
    assert perfil.notice_cancellations_used == 1
    assert perfil.notice_window_started_at is not None
    assert perfil.cancellations == 0


@pytest.mark.asyncio
async def test_el_tercer_aviso_del_periodo_suma_y_la_app_lo_avisa_antes(client, session_factory):
    shift_id, _employer, worker = await _confirmado(
        client, session_factory, "tope_tres", falta=timedelta(days=3)
    )
    worker_id = (await _fila(session_factory, shift_id)).worker_profile_id
    await _gastar(session_factory, worker_id, usados=2, hace=timedelta(days=5))

    # Antes de cancelar, la app ya sabe que esta vez suma: en el detalle y en
    # «Mis turnos», que es de donde lee el cartel.
    detalle = (await client.get(f"/api/v1/shifts/{shift_id}", headers=worker)).json()
    assert detalle["cancel_with_notice"] is False
    [mio] = (await client.get("/api/v1/shifts/mine", headers=worker)).json()
    assert mio["cancel_with_notice"] is False

    response = await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=worker)

    assert response.status_code == 200, response.text
    fila = await _fila(session_factory, shift_id)
    assert fila.status == ShiftStatus.BUSCANDO_PERSONAL.value
    assert await _cancelaciones(session_factory, fila, worker_id) == 1
    # No gasta un aviso que no tenía.
    assert (await _perfil(session_factory, worker_id)).notice_cancellations_used == 2


@pytest.mark.asyncio
async def test_con_el_periodo_vencido_vuelve_a_no_pesar(client, session_factory):
    shift_id, _employer, worker = await _confirmado(
        client, session_factory, "tope_vencido", falta=timedelta(days=3)
    )
    worker_id = (await _fila(session_factory, shift_id)).worker_profile_id
    await _gastar(session_factory, worker_id, usados=2, hace=timedelta(days=31))

    detalle = (await client.get(f"/api/v1/shifts/{shift_id}", headers=worker)).json()
    assert detalle["cancel_with_notice"] is True
    await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=worker)

    fila = await _fila(session_factory, shift_id)
    assert await _cancelaciones(session_factory, fila, worker_id) == 0
    assert (await _perfil(session_factory, worker_id)).notice_cancellations_used == 1


@pytest.mark.asyncio
async def test_cancelar_sobre_la_hora_no_gasta_avisos(client, session_factory):
    shift_id, _employer, worker = await _confirmado(
        client, session_factory, "tope_tarde", falta=timedelta(hours=5)
    )
    worker_id = (await _fila(session_factory, shift_id)).worker_profile_id

    await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=worker)

    perfil = await _perfil(session_factory, worker_id)
    assert perfil.cancellations == 1
    assert perfil.notice_cancellations_used == 0
