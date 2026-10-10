"""Dos acciones a la vez sobre el mismo turno (ADR-0016, bloqueo optimista).

Antes cada caso de uso leía el turno, lo modificaba y lo reescribía entero:
ganaba el último en escribir. Si el comercio cancelaba mientras el
trabajador confirmaba con una lectura previa, el turno terminaba
CONFIRMADO (un estado terminal reabierto). Las carreras se simulan con dos
sesiones de base, cada una con su lectura, que es exactamente lo que pasa
con dos requests concurrentes."""

from uuid import UUID

import pytest
from httpx import AsyncClient

from app.modules.shift.application import scheduler
from app.modules.shift.domain.exceptions import (
    InvalidShiftTransitionError,
    ShiftConcurrentModificationError,
)
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from tests.test_attendance import (
    _employer_with_company,
    _shift_payload,
    _worker_with_profile,
)

pytestmark = pytest.mark.asyncio


async def _assigned_shift(client: AsyncClient, prefix: str) -> tuple[str, dict, dict, str]:
    employer = await _employer_with_company(client, f"{prefix}_emp@staffya.com")
    created = await client.post("/api/v1/shifts", headers=employer, json=_shift_payload())
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    worker, profile_id = await _worker_with_profile(client, f"{prefix}_w@staffya.com")
    assigned = await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": profile_id},
    )
    assert assigned.status_code == 200
    return shift_id, employer, worker, profile_id


async def test_cancel_and_confirm_at_once_do_not_reopen_a_cancelled_shift(
    client: AsyncClient, session_factory
):
    shift_id, employer, _worker, _ = await _assigned_shift(client, "conc1")

    async with session_factory() as session_a, session_factory() as session_b:
        repo_a = SqlAlchemyShiftRepository(session_a)
        repo_b = SqlAlchemyShiftRepository(session_b)
        by_company = await repo_a.get_by_id(UUID(shift_id))
        by_worker = await repo_b.get_by_id(UUID(shift_id))

        by_company.cancel()
        await repo_a.update(by_company)

        by_worker.confirm([])
        with pytest.raises(ShiftConcurrentModificationError):
            await repo_b.update(by_worker)

    detail = await client.get(f"/api/v1/shifts/{shift_id}", headers=employer)
    assert detail.json()["status"] == ShiftStatus.CANCELADO.value


async def test_two_assignments_at_once_keep_only_the_first(
    client: AsyncClient, session_factory
):
    employer = await _employer_with_company(client, "conc2_emp@staffya.com")
    created = await client.post("/api/v1/shifts", headers=employer, json=_shift_payload())
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    _a, worker_a = await _worker_with_profile(client, "conc2_a@staffya.com")
    _b, worker_b = await _worker_with_profile(client, "conc2_b@staffya.com")

    async with session_factory() as session_a, session_factory() as session_b:
        repo_a = SqlAlchemyShiftRepository(session_a)
        repo_b = SqlAlchemyShiftRepository(session_b)
        first = await repo_a.get_by_id(UUID(shift_id))
        second = await repo_b.get_by_id(UUID(shift_id))

        first.assign(UUID(worker_a))
        await repo_a.update(first)
        second.assign(UUID(worker_b))
        with pytest.raises(ShiftConcurrentModificationError):
            await repo_b.update(second)

    detail = (await client.get(f"/api/v1/shifts/{shift_id}", headers=employer)).json()
    assert detail["worker_profile_id"] == worker_a


async def test_sequential_saves_of_the_same_entity_are_not_a_conflict(session_factory, client):
    """Un caso de uso que guarda dos veces la misma entidad (p. ej. publica y
    después marca la escalada) no debe chocar consigo mismo."""
    shift_id, _employer, _worker, _ = await _assigned_shift(client, "conc3")

    async with session_factory() as session:
        repo = SqlAlchemyShiftRepository(session)
        shift = await repo.get_by_id(UUID(shift_id))
        shift.confirm([])
        await repo.update(shift)
        shift.depart()
        saved = await repo.update(shift)

    assert saved.status == ShiftStatus.EN_CAMINO


async def test_get_by_id_reads_the_database_not_the_session_cache(
    client: AsyncClient, session_factory
):
    """El scheduler usa una sesión por pasada: sin releer, decidía sobre una
    copia vieja de un turno que el usuario ya había cambiado."""
    shift_id, employer, _worker, _ = await _assigned_shift(client, "conc4")

    async with session_factory() as long_lived:
        repo = SqlAlchemyShiftRepository(long_lived)
        before = await repo.get_by_id(UUID(shift_id))
        assert before.status == ShiftStatus.ASIGNADO

        cancelled = await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=employer)
        assert cancelled.status_code == 200

        after = await repo.get_by_id(UUID(shift_id))
        assert after.status == ShiftStatus.CANCELADO


async def test_lost_race_answers_409_with_a_clear_message(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
):
    shift_id, employer, _worker, _ = await _assigned_shift(client, "conc5")

    async def lose_the_race(self, shift):
        raise ShiftConcurrentModificationError(str(shift.id))

    monkeypatch.setattr(SqlAlchemyShiftRepository, "update", lose_the_race)
    response = await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=employer)

    assert response.status_code == 409
    assert "cambió" in response.json()["detail"]


@pytest.mark.parametrize(
    "error", [ShiftConcurrentModificationError("x"), InvalidShiftTransitionError("x")]
)
async def test_scheduler_skips_a_shift_it_lost_and_keeps_going(error):
    calls: list[UUID] = []

    async def action(shift_id: UUID):
        calls.append(shift_id)
        raise error

    some_id = UUID(int=1)
    await scheduler._act(action, some_id)  # no propaga

    assert calls == [some_id]
