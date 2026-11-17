"""«Asignados» del trabajador (U066): lo que hay que hacer arriba, lo
terminado abajo, y los recordatorios con link a donde se actúa."""

from uuid import UUID

import pytest
from httpx import AsyncClient

from app.modules.shift.application import scheduler
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from tests.test_attendance import (
    _employer_with_company,
    _shift_payload,
    _worker_with_profile,
)

pytestmark = pytest.mark.asyncio


async def _assign(client: AsyncClient, employer: dict, profile_id: str, day: int) -> str:
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json=_shift_payload(
            start_at=f"2026-07-{day:02d}T20:00:00", end_at=f"2026-07-{day + 1:02d}T03:00:00"
        ),
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    assigned = await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": profile_id},
    )
    assert assigned.status_code == 200
    return shift_id


async def _force_status(session_factory, shift_id: str, status: ShiftStatus) -> None:
    async with session_factory() as session:
        repo = SqlAlchemyShiftRepository(session)
        shift = await repo.get_by_id(UUID(shift_id))
        shift.status = status
        await repo.update(shift)


async def test_asignados_lists_pending_first_by_start_and_finished_last(
    client: AsyncClient, session_factory
):
    employer = await _employer_with_company(client, "orden_emp@staffya.com")
    worker, profile_id = await _worker_with_profile(client, "orden_w@staffya.com")
    # Se crean en un orden que NO coincide con el de inicio.
    late = await _assign(client, employer, profile_id, 20)
    paid_old = await _assign(client, employer, profile_id, 3)
    soon = await _assign(client, employer, profile_id, 10)
    cancelled = await _assign(client, employer, profile_id, 25)
    paid_new = await _assign(client, employer, profile_id, 15)
    await _force_status(session_factory, paid_old, ShiftStatus.PAGADO)
    await _force_status(session_factory, paid_new, ShiftStatus.PAGADO)
    await _force_status(session_factory, cancelled, ShiftStatus.CANCELADO)

    listed = await client.get("/api/v1/shifts/mine", headers=worker)

    assert listed.status_code == 200
    # Activos por inicio ascendente; terminados por inicio descendente.
    assert [s["id"] for s in listed.json()] == [soon, late, cancelled, paid_new, paid_old]


async def test_the_checkin_and_departure_reminders_open_the_specific_shift_in_matches(
    client: AsyncClient, session_factory
):
    employer = await _employer_with_company(client, "recordatorio_emp@staffya.com")
    worker, profile_id = await _worker_with_profile(client, "recordatorio_w@staffya.com")
    shift_id = await _assign(client, employer, profile_id, 10)
    await _force_status(session_factory, shift_id, ShiftStatus.CONFIRMADO)

    async with session_factory() as session:
        service = scheduler._build_service(session)
        await service.send_checkin_reminder(UUID(shift_id))
        await service.send_departure_reminder(UUID(shift_id))

    listed = await client.get("/api/v1/notifications", headers=worker)
    by_type = {n["type"]: n for n in listed.json()}
    assert by_type["checkin_reminder"]["link"] == f"/my-shifts?turno={shift_id}"
    assert by_type["departure_reminder"]["link"] == f"/my-shifts?turno={shift_id}"
