"""U081 (decisión 2, ADR-0007 actualizado el 2026-11-18): un turno con la
salida marcada no se cancela.

Antes el comercio podía cancelar un turno cuyo trabajador ya había terminado
de trabajar: el turno quedaba «cancelado», sin pago, y a la persona le
llegaba «cancelaron tu turno» después de haberlo hecho entero. Ahora, con la
salida marcada, el comercio finaliza y paga; un problema va por soporte.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.exceptions import InvalidShiftTransitionError
from app.modules.shift.domain.value_objects import (
    NOT_CANCELLABLE_STATUSES,
    TERMINAL_STATUSES,
    ShiftStatus,
)
from app.modules.worker.domain.value_objects import WorkerSkill
from tests._turno_empezado import empezar_turno
from tests.test_cancelar_evento import _avisos, _confirmar, _evento, _tardias
from tests.test_cuentas_suspendidas import _checked_in, _employer, _shift, _worker

PALERMO = {"latitude": -34.58, "longitude": -58.43}


def _turno(status: ShiftStatus) -> Shift:
    inicio = datetime(2030, 3, 9, 23, 0, tzinfo=timezone.utc)
    return Shift(
        company_id=uuid4(),
        position=WorkerSkill.MOZO,
        quantity=1,
        start_at=inicio,
        end_at=inicio + timedelta(hours=6),
        pay_amount=Decimal("70000"),
        status=status,
        worker_profile_id=uuid4(),
    )


def test_dominio_no_cancela_un_turno_con_la_salida_marcada():
    turno = _turno(ShiftStatus.CHECK_OUT)
    asignado = turno.worker_profile_id

    with pytest.raises(InvalidShiftTransitionError) as exc:
        turno.cancel()

    assert "ya se trabajó" in str(exc.value)
    assert "Finalizalo y pagalo" in str(exc.value)
    assert "Soporte" in str(exc.value)
    assert turno.status == ShiftStatus.CHECK_OUT
    assert turno.worker_profile_id == asignado
    assert not turno.is_cancellable


@pytest.mark.parametrize(
    "status", [s for s in ShiftStatus if s not in NOT_CANCELLABLE_STATUSES]
)
def test_dominio_sigue_cancelando_desde_los_demas_estados(status):
    turno = _turno(status)
    assert turno.is_cancellable
    turno.cancel()
    assert turno.status == ShiftStatus.CANCELADO


def test_lo_que_no_se_cancela_son_los_terminales_y_la_salida_marcada():
    assert NOT_CANCELLABLE_STATUSES == TERMINAL_STATUSES | {ShiftStatus.CHECK_OUT}


async def _salida_marcada(client, session_factory, employer, worker, worker_id) -> str:
    shift_id = await _checked_in(client, employer, worker, worker_id)
    # La salida no se puede marcar antes del inicio (#552).
    await empezar_turno(session_factory, shift_id)
    out = await client.post(f"/api/v1/shifts/{shift_id}/check-out", headers=worker, json=PALERMO)
    assert out.json()["status"] == "check_out", out.text
    return shift_id


@pytest.mark.asyncio
async def test_cancelar_con_la_salida_marcada_se_rechaza_y_no_toca_nada(
    client: AsyncClient, session_factory
):
    employer = await _employer(client, "u081_emp1@staffya.com")
    worker, worker_id = await _worker(client, "u081_ana1@staffya.com", "Ana Trabajó")
    shift_id = await _salida_marcada(client, session_factory, employer, worker, worker_id)
    tardias = await _tardias(client, employer)

    cancelled = await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=employer)

    assert cancelled.status_code == 400, cancelled.text
    assert cancelled.json()["detail"] == (
        "Este turno ya se trabajó, no se puede cancelar. Finalizalo y pagalo; "
        "si hubo un problema, escribinos desde Soporte."
    )
    turno = await _shift(client, shift_id, employer)
    assert turno["status"] == "check_out"
    assert turno["worker_profile_id"] == worker_id
    # Ni cancelación tardía para el comercio ni aviso de cancelación a quien trabajó.
    assert await _tardias(client, employer) == tardias
    assert await _avisos(client, worker) == []


@pytest.mark.asyncio
async def test_despues_del_rechazo_el_turno_se_finaliza_y_se_paga(
    client: AsyncClient, session_factory
):
    employer = await _employer(client, "u081_emp2@staffya.com")
    worker, worker_id = await _worker(client, "u081_ana2@staffya.com", "Ana Trabajó")
    shift_id = await _salida_marcada(client, session_factory, employer, worker, worker_id)
    assert (
        await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=employer)
    ).status_code == 400

    finished = await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer)
    assert finished.status_code == 200, finished.text
    paid = await client.post(f"/api/v1/shifts/{shift_id}/mark-paid", headers=employer)
    assert paid.status_code == 200, paid.text
    assert paid.json()["status"] == "pagado"


@pytest.mark.asyncio
async def test_con_la_llegada_marcada_todavia_se_puede_cancelar_y_es_tardia(client: AsyncClient):
    """La regla es sólo para la salida: en pleno turno el comercio todavía
    puede cancelar, y le cuenta como cancelación tardía (ADR-0007)."""
    employer = await _employer(client, "u081_emp3@staffya.com")
    worker, worker_id = await _worker(client, "u081_ana3@staffya.com", "Ana Llegó")
    shift_id = await _checked_in(client, employer, worker, worker_id)

    cancelled = await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=employer)

    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelado"
    assert await _tardias(client, employer) == 1


@pytest.mark.asyncio
async def test_cancelar_el_evento_saltea_el_puesto_con_la_salida_marcada(
    client: AsyncClient, session_factory
):
    employer = await _employer(client, "u081_emp4@staffya.com")
    ana, ana_id = await _worker(client, "u081_ana4@staffya.com", "Ana Trabajó")
    evento = await _evento(client, employer, mozos=2)
    trabajado, otro = (s["id"] for s in evento["shifts"])
    await _confirmar(client, employer, trabajado, ana, ana_id)
    await empezar_turno(session_factory, trabajado, minutos=5)
    # El evento es en estas coordenadas (`_evento`): la llegada exige estar cerca.
    aca = {"latitude": -34.5875, "longitude": -58.43}
    checked_in = await client.post(f"/api/v1/shifts/{trabajado}/check-in", headers=ana, json=aca)
    assert checked_in.json().get("status") == "check_in", checked_in.text
    out = await client.post(f"/api/v1/shifts/{trabajado}/check-out", headers=ana, json=aca)
    assert out.json()["status"] == "check_out", out.text

    cancelled = await client.post(
        f"/api/v1/shifts/events/{evento['event_id']}/cancel", headers=employer
    )

    assert cancelled.status_code == 200, cancelled.text
    assert (await _shift(client, otro, employer))["status"] == "cancelado"
    assert (await _shift(client, trabajado, employer))["status"] == "check_out"
    assert await _tardias(client, employer) == 0
    assert await _avisos(client, ana) == []

    # Ya no queda nada para cancelar: el puesto trabajado no cuenta.
    again = await client.post(
        f"/api/v1/shifts/events/{evento['event_id']}/cancel", headers=employer
    )
    assert again.status_code == 400
    assert again.json()["detail"] == "Este evento ya no tiene puestos para cancelar."
