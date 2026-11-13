"""T2a (U004/U005): la salida no se puede marcar antes de que empiece el turno."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.core.tz import format_inicio_art
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.exceptions import InvalidShiftTransitionError
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.worker.domain.value_objects import WorkerSkill
from tests.test_attendance import _confirmed_shift

pytestmark = pytest.mark.asyncio

AQUI = {"latitude": -34.58, "longitude": -58.43}


def _turno_con_llegada(start_at: datetime) -> Shift:
    return Shift(
        id=uuid4(),
        company_id=uuid4(),
        position=WorkerSkill.MOZO,
        quantity=1,
        start_at=start_at,
        end_at=start_at + timedelta(hours=5),
        pay_amount=Decimal("1000"),
        status=ShiftStatus.CHECK_IN,
        worker_profile_id=uuid4(),
    )


def test_dominio_rechaza_salida_antes_del_inicio_y_dice_la_hora():
    inicio = datetime.now(timezone.utc) + timedelta(minutes=20)
    turno = _turno_con_llegada(inicio)
    with pytest.raises(InvalidShiftTransitionError) as exc:
        turno.check_out(-34.58, -58.43)
    assert "Todavía no podés marcar la salida" in str(exc.value)
    assert format_inicio_art(inicio) in str(exc.value)
    assert "T" not in format_inicio_art(inicio)  # hora de persona, no ISO
    assert turno.status == ShiftStatus.CHECK_IN


def test_dominio_acepta_salida_con_el_turno_empezado():
    turno = _turno_con_llegada(datetime.now(timezone.utc) - timedelta(minutes=5))
    turno.check_out(-34.58, -58.43)
    assert turno.status == ShiftStatus.CHECK_OUT


def test_formato_de_inicio_en_hora_argentina():
    ahora = datetime(2026, 11, 13, 12, 0, tzinfo=timezone.utc)  # 09:00 ART
    assert format_inicio_art(datetime(2026, 11, 13, 23, 0, tzinfo=timezone.utc), ahora) == (
        "hoy a las 20:00"
    )
    assert format_inicio_art(datetime(2026, 11, 14, 23, 0, tzinfo=timezone.utc), ahora) == (
        "el sábado 14/11 a las 20:00"
    )


async def test_api_salida_antes_del_inicio_rechazada_y_despues_anda(client: AsyncClient):
    inicio = (datetime.now(timezone.utc) + timedelta(minutes=20)).replace(tzinfo=None)
    shift_id, _emp, worker = await _confirmed_shift(
        client,
        "co_antes_emp@staffya.com",
        "co_antes_w@staffya.com",
        start_at=inicio.isoformat(),
        end_at=(inicio + timedelta(hours=5)).isoformat(),
    )
    llegada = await client.post(f"/api/v1/shifts/{shift_id}/check-in", headers=worker, json=AQUI)
    assert llegada.status_code == 200
    salida = await client.post(f"/api/v1/shifts/{shift_id}/check-out", headers=worker, json=AQUI)
    assert salida.status_code in (400, 409, 422)
    assert "el turno empieza hoy a las" in salida.text or "el turno empieza el" in salida.text
    # Sigue con la llegada marcada.
    mios = await client.get("/api/v1/shifts/mine", headers=worker)
    assert [s["status"] for s in mios.json() if s["id"] == shift_id] == ["check_in"]


async def test_api_salida_con_el_turno_empezado_anda_como_siempre(client: AsyncClient):
    inicio = (datetime.now(timezone.utc) - timedelta(hours=1)).replace(tzinfo=None)
    shift_id, _emp, worker = await _confirmed_shift(
        client,
        "co_desp_emp@staffya.com",
        "co_desp_w@staffya.com",
        start_at=inicio.isoformat(),
        end_at=(inicio + timedelta(hours=6)).isoformat(),
    )
    await client.post(f"/api/v1/shifts/{shift_id}/check-in", headers=worker, json=AQUI)
    salida = await client.post(f"/api/v1/shifts/{shift_id}/check-out", headers=worker, json=AQUI)
    assert salida.status_code == 200
    assert salida.json()["status"] == "check_out"
