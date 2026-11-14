"""«No se presentó» sólo desde 15 minutos después del inicio (hallazgo U079).

Antes se ofrecía y se aplicaba sobre un turno confirmado que empezaba
mañana, y penalizaba al trabajador sin vuelta atrás.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.exceptions import InvalidShiftTransitionError
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.worker.domain.value_objects import WorkerSkill
from tests._turno_empezado import empezar_turno
from tests.test_no_show_and_late_cancellation import _confirmed_shift

# 20:00 hora argentina (UTC-3).
INICIO = datetime(2030, 3, 9, 23, 0, tzinfo=timezone.utc)


def _turno_confirmado() -> Shift:
    return Shift(
        company_id=uuid4(),
        position=WorkerSkill.MOZO,
        quantity=1,
        start_at=INICIO,
        end_at=INICIO + timedelta(hours=6),
        pay_amount=Decimal("70000"),
        status=ShiftStatus.CONFIRMADO,
        worker_profile_id=uuid4(),
    )


@pytest.mark.parametrize(
    "now",
    [
        INICIO - timedelta(days=1),
        INICIO - timedelta(minutes=1),
        INICIO,
        INICIO + timedelta(minutes=14),
    ],
)
def test_dominio_rechaza_la_ausencia_antes_de_los_15_minutos(now):
    turno = _turno_confirmado()
    ausente = turno.worker_profile_id

    with pytest.raises(InvalidShiftTransitionError) as exc:
        turno.no_show(now)

    # Hora de Argentina, formato de persona (no ISO, no UTC).
    assert "desde las 20:15 de " in str(exc.value)
    assert "23:15" not in str(exc.value)
    assert "T" not in str(exc.value).replace("Todavía", "")
    # Sin efectos: sigue confirmado y sin penalidad registrada.
    assert turno.status == ShiftStatus.CONFIRMADO
    assert turno.worker_profile_id == ausente
    assert turno.no_show_at is None


def test_dominio_acepta_la_ausencia_a_los_15_minutos_y_despues():
    for minutos in (15, 16, 120):
        turno = _turno_confirmado()
        ausente = turno.worker_profile_id
        turno.no_show(INICIO + timedelta(minutes=minutos))
        assert turno.status == ShiftStatus.BUSCANDO_PERSONAL
        assert turno.worker_profile_id is None
        assert turno.last_no_show_worker_profile_id == ausente


def test_dominio_acepta_now_sin_zona_como_utc():
    turno = _turno_confirmado()
    turno.no_show((INICIO + timedelta(minutes=15)).replace(tzinfo=None))
    assert turno.status == ShiftStatus.BUSCANDO_PERSONAL


@pytest.mark.asyncio
async def test_api_rechaza_con_la_hora_y_no_penaliza_antes_de_empezar(
    client: AsyncClient, session_factory
):
    shift_id, employer, worker, _ = await _confirmed_shift(
        client, "ns_ini_emp1@staffya.com", "ns_ini_w1@staffya.com"
    )
    # El turno de prueba arranca en 15 minutos: todavía no empezó.
    marked = await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=employer)

    assert marked.status_code == 400
    detalle = marked.json()["detail"]
    assert detalle.startswith("Todavía no podés marcar que no se presentó")
    assert "se habilita desde las " in detalle
    assert detalle.endswith("15 minutos después de que empieza el turno.")
    assert "T" not in detalle.replace("Todavía", "")  # sin fecha ISO

    perfil = await client.get("/api/v1/workers/me/profile", headers=worker)
    assert perfil.json()["no_shows"] == 0
    turno = await client.get(f"/api/v1/shifts/{shift_id}", headers=employer)
    assert turno.json()["status"] == "confirmado"


@pytest.mark.asyncio
async def test_api_despues_de_la_hora_anda_como_siempre(client: AsyncClient, session_factory):
    shift_id, employer, worker, _ = await _confirmed_shift(
        client, "ns_ini_emp2@staffya.com", "ns_ini_w2@staffya.com"
    )
    await empezar_turno(session_factory, shift_id, minutos=20)

    marked = await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=employer)

    assert marked.status_code == 200
    assert marked.json()["status"] == "buscando_personal"
    perfil = await client.get("/api/v1/workers/me/profile", headers=worker)
    assert perfil.json()["no_shows"] == 1
