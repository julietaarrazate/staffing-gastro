"""Recordatorio y cierre automático del turno que el comercio no cierra
(ADR-0008, decisión 24).

Un turno con la salida marcada (`check_out`) que el comercio no cierra
quedaba «en marcha» para siempre: la persona no podía calificar ni verlo en
sus ganancias. A las 24 h de la salida se le recuerda al comercio una sola
vez; a las 72 h Oído lo cierra solo, con la puntualidad de la llegada.

Mismo patrón que `test_scheduler.py`: el chequeo usa `AsyncSessionLocal`, que
se apunta a la base en memoria del test."""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from httpx import AsyncClient

from app.core.tz import format_inicio_art, to_art
from app.modules.identity.domain.value_objects import UserStatus
from app.modules.identity.infrastructure.models import UserModel
from app.modules.shift.application import scheduler
from app.modules.shift.application.services import (
    AUTO_FINISH_DELAY,
    FINISH_REMINDER_DELAY,
    PAYMENT_TOLERANCE,
)
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.exceptions import (
    InvalidShiftTransitionError,
    ShiftConcurrentModificationError,
)
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from app.modules.worker.domain.value_objects import WorkerSkill
from app.modules.worker.infrastructure.models import WorkerProfileModel
from tests.test_cuentas_suspendidas import _notices
from tests.test_scheduler import _confirmed_shift_starting_ago

pytestmark = pytest.mark.asyncio

_TITLE = "Mozo para la cena"


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _checked_out_shift(
    client: AsyncClient,
    session_factory,
    prefix: str,
    *,
    out_ago: timedelta,
    late: bool = False,
) -> tuple[str, dict, dict, datetime]:
    """Turno con la salida marcada hace `out_ago`, sin cerrar. Se arma
    confirmado por la API y se lleva a CHECK_OUT en la base (la llegada y la
    salida reales exigen estar en el lugar y a la hora). `late`: la llegada
    fue media hora después del inicio; si no, cinco minutos antes."""
    shift_id, employer, worker = await _confirmed_shift_starting_ago(
        client, f"{prefix}_emp@staffya.com", f"{prefix}_w@staffya.com", ago=-timedelta(days=1)
    )
    checked_out = _now() - out_ago
    start = checked_out - timedelta(hours=5)
    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        model.title = _TITLE
        model.start_at = start
        model.end_at = checked_out
        model.status = ShiftStatus.CHECK_OUT.value
        model.check_in_at = start + (timedelta(minutes=30) if late else -timedelta(minutes=5))
        model.check_out_at = checked_out
        await session.commit()
    return shift_id, employer, worker, checked_out


async def _shift_row(session_factory, shift_id: str) -> ShiftModel:
    async with session_factory() as session:
        return await session.get(ShiftModel, UUID(shift_id))


async def _worker_reputation(session_factory, shift_id: str) -> tuple[int, float]:
    async with session_factory() as session:
        shift = await session.get(ShiftModel, UUID(shift_id))
        worker = await session.get(WorkerProfileModel, shift.worker_profile_id)
        return worker.events_completed, worker.punctuality_rate


async def _suspend_company_owner(session_factory, employer_email: str) -> None:
    from sqlalchemy import update

    async with session_factory() as session:
        await session.execute(
            update(UserModel)
            .where(UserModel.email == employer_email)
            .values(status=UserStatus.SUSPENDED.value)
        )
        await session.commit()


# --- Recordatorio a las 24 h -------------------------------------------------


async def test_no_reminder_before_24_hours(client, session_factory, monkeypatch):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, employer, worker, checked_out = await _checked_out_shift(
        client, session_factory, "fin_antes", out_ago=FINISH_REMINDER_DELAY - timedelta(hours=1)
    )

    next_deadline = await scheduler.run_finish_check()

    assert next_deadline == checked_out + FINISH_REMINDER_DELAY
    assert await _notices(client, employer, "shift_finish_reminder") == []
    row = await _shift_row(session_factory, shift_id)
    assert row.finish_reminder_sent_at is None
    assert row.status == ShiftStatus.CHECK_OUT.value


async def test_reminder_at_24_hours_goes_once_and_only_to_the_company(
    client, session_factory, monkeypatch
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, employer, worker, checked_out = await _checked_out_shift(
        client, session_factory, "fin_rec", out_ago=FINISH_REMINDER_DELAY + timedelta(minutes=5)
    )
    version_before = (await _shift_row(session_factory, shift_id)).version

    first = await scheduler.run_finish_check()
    second = await scheduler.run_finish_check()

    # Ya recordado: la próxima (y última) deadline es el cierre.
    assert first == checked_out + AUTO_FINISH_DELAY
    assert second == checked_out + AUTO_FINISH_DELAY
    avisos = await _notices(client, employer, "shift_finish_reminder")
    assert len(avisos) == 1
    assert avisos[0]["title"] == "Te falta cerrar un turno"
    salida = format_inicio_art(checked_out)
    cierre = format_inicio_art(checked_out + AUTO_FINISH_DELAY)
    assert avisos[0]["message"].startswith(
        f'La persona marcó la salida de "{_TITLE}" {salida}. Cerralo para poder '
        "calificarla y registrar el pago. "
    )
    assert avisos[0]["message"].endswith(f"Si no lo cerrás, se cierra solo {cierre}.")
    # El turno de prueba termina cuando marca la salida: a las 25 h todavía
    # le quedan 23 para registrar el pago a tiempo.
    pago_hasta = format_inicio_art(checked_out + PAYMENT_TOLERANCE)
    assert (
        f"Para que cuente como pago a tiempo, registralo hasta {pago_hasta}."
        in avisos[0]["message"]
    )
    assert avisos[0]["link"] == "/shifts"
    # Al trabajador no le llega nada.
    worker_notifs = (await client.get("/api/v1/notifications", headers=worker)).json()
    assert not any(n["type"] in ("shift_finish_reminder", "shift_finished") for n in worker_notifs)
    # Ni otro «Terminó un turno» al comercio: el recordatorio tiene tipo propio.
    assert await _notices(client, employer, "shift_checked_out") == []

    row = await _shift_row(session_factory, shift_id)
    assert row.finish_reminder_sent_at is not None
    assert row.status == ShiftStatus.CHECK_OUT.value
    # Marca de sistema: no sube la versión (ADR-0016).
    assert row.version == version_before


async def test_late_reminder_says_the_real_checkout_date_in_argentine_time(
    client, session_factory, monkeypatch
):
    """La pasada puede llegar tarde (primer despliegue, Render dormido): el
    aviso dice cuándo marcó la salida de verdad, en hora argentina, y no
    «hace un día»."""
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    _id, employer, _worker, checked_out = await _checked_out_shift(
        client, session_factory, "fin_hora", out_ago=timedelta(hours=60)
    )

    await scheduler.run_finish_check()

    avisos = await _notices(client, employer, "shift_finish_reminder")
    assert len(avisos) == 1
    salida_art = to_art(checked_out)
    assert "hace un día" not in avisos[0]["message"]
    # A las 60 h ya pasaron las 48 del plazo de pago: lo dice.
    assert "Si registrás el pago ahora, ya cuenta como pago tardío." in avisos[0]["message"]
    # Hace 60 h no es «hoy» ni «mañana»: va con día de la semana y fecha.
    assert f"{salida_art:%d/%m} a las {salida_art:%H:%M}. Cerralo" in avisos[0]["message"]
    assert avisos[0]["message"].endswith(
        f"se cierra solo {format_inicio_art(checked_out + AUTO_FINISH_DELAY)}."
    )


async def test_two_passes_at_once_send_a_single_reminder(client, session_factory):
    """Dos pasadas a la vez (cada una con su sesión, y las dos con el turno
    leído antes de que la otra lo marque): un solo aviso. Lo corta el UPDATE
    condicional (`finish_reminder_sent_at IS NULL`), y el servicio sólo avisa
    si reclamó la marca."""
    shift_id, employer, _worker, _ = await _checked_out_shift(
        client, session_factory, "fin_doble", out_ago=FINISH_REMINDER_DELAY + timedelta(minutes=5)
    )

    async with session_factory() as session_a, session_factory() as session_b:
        service_a = scheduler._build_service(session_a)
        service_b = scheduler._build_service(session_b)
        # Las dos pasadas listaron el turno sin marca.
        listed_a = await service_a.list_shifts_awaiting_finish()
        listed_b = await service_b.list_shifts_awaiting_finish()
        assert all(s.finish_reminder_sent_at is None for s in listed_a + listed_b)

        await asyncio.gather(
            service_a.send_finish_reminder(UUID(shift_id)),
            service_b.send_finish_reminder(UUID(shift_id)),
        )
        # Y una tercera, secuencial, tampoco.
        await service_b.send_finish_reminder(UUID(shift_id))

    assert len(await _notices(client, employer, "shift_finish_reminder")) == 1


async def test_reminder_to_suspended_company_is_marked_but_not_sent(
    client, session_factory, monkeypatch
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, employer, _worker, _ = await _checked_out_shift(
        client, session_factory, "fin_susp", out_ago=FINISH_REMINDER_DELAY + timedelta(minutes=5)
    )
    await _suspend_company_owner(session_factory, "fin_susp_emp@staffya.com")

    await scheduler.run_finish_check()

    row = await _shift_row(session_factory, shift_id)
    assert row.finish_reminder_sent_at is not None
    async with session_factory() as session:
        from sqlalchemy import select

        from app.modules.notification.infrastructure.models import NotificationModel

        owner = (
            await session.execute(
                select(UserModel).where(UserModel.email == "fin_susp_emp@staffya.com")
            )
        ).scalar_one()
        notifs = (
            await session.execute(
                select(NotificationModel).where(NotificationModel.user_id == owner.id)
            )
        ).scalars().all()
    assert not any(n.type == "shift_finish_reminder" for n in notifs)


async def test_reminder_is_not_claimed_on_a_closed_shift(client, session_factory):
    """El UPDATE condicional sólo marca turnos que siguen en CHECK_OUT: si el
    comercio cerró entre la lista y el recordatorio, no hay aviso."""
    shift_id, employer, _worker, _ = await _checked_out_shift(
        client, session_factory, "fin_cerrado", out_ago=FINISH_REMINDER_DELAY + timedelta(minutes=5)
    )
    closed = await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer)
    assert closed.status_code == 200, closed.text

    async with session_factory() as session:
        repo = SqlAlchemyShiftRepository(session)
        assert await repo.mark_finish_reminder_sent(UUID(shift_id), datetime.now(timezone.utc)) is False


async def test_company_finish_after_reminder_keeps_the_mark(client, session_factory, monkeypatch):
    """La marca la escribe el sistema sin versión: un guardado del comercio
    con una entidad leída antes no la borra."""
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, employer, _worker, _ = await _checked_out_shift(
        client, session_factory, "fin_marca", out_ago=FINISH_REMINDER_DELAY + timedelta(minutes=5)
    )
    async with session_factory() as session:
        repo = SqlAlchemyShiftRepository(session)
        read_before: Shift = await repo.get_by_id(UUID(shift_id))
        await scheduler.run_finish_check()
        read_before.finish()
        saved = await repo.update(read_before)

    assert saved.finish_reminder_sent_at is not None
    assert saved.auto_finished_at is None


# --- Cierre automático a las 72 h --------------------------------------------


async def test_auto_finish_at_72_hours_with_punctual_arrival(
    client, session_factory, monkeypatch
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, employer, worker, _ = await _checked_out_shift(
        client, session_factory, "fin_auto", out_ago=AUTO_FINISH_DELAY + timedelta(minutes=5)
    )

    next_deadline = await scheduler.run_finish_check()

    assert next_deadline is None
    row = await _shift_row(session_factory, shift_id)
    assert row.status == ShiftStatus.FINALIZADO.value
    assert row.auto_finished_at is not None
    assert await _worker_reputation(session_factory, shift_id) == (1, 1.0)

    worker_avisos = await _notices(client, worker, "shift_finished")
    assert len(worker_avisos) == 1
    assert worker_avisos[0]["title"] == "Se cerró tu turno"
    assert worker_avisos[0]["message"] == (
        f'"{_TITLE}" se cerró solo porque pasaron 72 horas desde tu salida. '
        "Ya podés calificar a Bar Palermo."
    )
    assert worker_avisos[0]["link"] == f"/my-shifts?turno={shift_id}"

    company_avisos = await _notices(client, employer, "shift_auto_finished")
    assert len(company_avisos) == 1
    assert company_avisos[0]["title"] == "Oído cerró un turno"
    assert company_avisos[0]["message"] == (
        f'Cerramos automáticamente "{_TITLE}": pasaron 72 horas desde que la persona '
        "marcó la salida. Te queda marcarlo como pagado: como pasaron más de 48 "
        "horas desde el fin del turno, cuenta como pago tardío."
    )
    assert company_avisos[0]["link"] == "/shifts"
    # Nada más: ni recordatorio tardío ni aviso de cierre del comercio.
    assert await _notices(client, employer, "shift_finish_reminder") == []

    # Una segunda pasada no lo vuelve a tocar.
    assert await scheduler.run_finish_check() is None
    assert len(await _notices(client, worker, "shift_finished")) == 1
    assert await _worker_reputation(session_factory, shift_id) == (1, 1.0)


async def test_auto_finish_uses_the_late_arrival_already_recorded(
    client, session_factory, monkeypatch
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, _employer, _worker, _ = await _checked_out_shift(
        client,
        session_factory,
        "fin_tarde",
        out_ago=AUTO_FINISH_DELAY + timedelta(minutes=5),
        late=True,
    )

    await scheduler.run_finish_check()

    assert (await _shift_row(session_factory, shift_id)).status == ShiftStatus.FINALIZADO.value
    assert await _worker_reputation(session_factory, shift_id) == (1, 0.0)


async def test_auto_finish_of_suspended_company_tells_only_the_worker(
    client, session_factory, monkeypatch
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, _employer, worker, _ = await _checked_out_shift(
        client, session_factory, "fin_auto_susp", out_ago=AUTO_FINISH_DELAY + timedelta(minutes=5)
    )
    await _suspend_company_owner(session_factory, "fin_auto_susp_emp@staffya.com")

    await scheduler.run_finish_check()

    assert (await _shift_row(session_factory, shift_id)).status == ShiftStatus.FINALIZADO.value
    assert len(await _notices(client, worker, "shift_finished")) == 1
    async with session_factory() as session:
        from sqlalchemy import select

        from app.modules.notification.infrastructure.models import NotificationModel

        owner = (
            await session.execute(
                select(UserModel).where(UserModel.email == "fin_auto_susp_emp@staffya.com")
            )
        ).scalar_one()
        notifs = (
            await session.execute(
                select(NotificationModel).where(NotificationModel.user_id == owner.id)
            )
        ).scalars().all()
    assert not any(n.type == "shift_auto_finished" for n in notifs)


async def test_company_and_scheduler_closing_at_once_count_the_shift_once(
    client, session_factory, monkeypatch
):
    """El comercio cierra mientras el scheduler tiene una lectura previa: el
    guardado con versión hace que el scheduler pierda antes de cualquier
    efecto. Un solo turno completado, un solo aviso al trabajador."""
    shift_id, employer, worker, _ = await _checked_out_shift(
        client, session_factory, "fin_carrera", out_ago=AUTO_FINISH_DELAY + timedelta(minutes=5)
    )

    async with session_factory() as session:
        service = scheduler._build_service(session)
        stale = await service.get_shift(UUID(shift_id))

        closed = await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer)
        assert closed.status_code == 200, closed.text

        monkeypatch.setattr(service, "get_shift", AsyncMock(return_value=stale))
        with pytest.raises(ShiftConcurrentModificationError):
            await service.auto_finish(UUID(shift_id))

    row = await _shift_row(session_factory, shift_id)
    assert row.status == ShiftStatus.FINALIZADO.value
    assert row.auto_finished_at is None
    assert await _worker_reputation(session_factory, shift_id) == (1, 1.0)
    avisos = await _notices(client, worker, "shift_finished")
    assert [a["title"] for a in avisos] == ["Cerró tu turno"]
    assert await _notices(client, employer, "shift_auto_finished") == []


async def test_company_cannot_finish_after_auto_finish(client, session_factory, monkeypatch):
    """Al revés: si ganó el scheduler, el «Cerrar turno» del comercio choca
    con el estado y no suma otro turno completado."""
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, employer, _worker, _ = await _checked_out_shift(
        client, session_factory, "fin_despues", out_ago=AUTO_FINISH_DELAY + timedelta(minutes=5)
    )
    await scheduler.run_finish_check()

    late_close = await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer)

    assert late_close.status_code in (400, 409, 422)
    assert await _worker_reputation(session_factory, shift_id) == (1, 1.0)


async def test_scheduler_skips_a_shift_it_lost(client, session_factory, monkeypatch):
    """`_act` saltea el turno que perdió la carrera sin cortar la pasada."""
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    await _checked_out_shift(
        client, session_factory, "fin_salteo", out_ago=AUTO_FINISH_DELAY + timedelta(minutes=5)
    )

    async def lose(self, shift_id):
        raise InvalidShiftTransitionError("ya cerrado")

    from app.modules.shift.application.services import ShiftService

    monkeypatch.setattr(ShiftService, "auto_finish", lose)
    assert await scheduler.run_finish_check() is None


async def test_domain_auto_finish_only_from_check_out():
    start = datetime.now(timezone.utc) - timedelta(days=4)
    shift = Shift(
        company_id=UUID(int=1),
        position=WorkerSkill.MOZO,
        quantity=1,
        start_at=start,
        end_at=start + timedelta(hours=5),
        pay_amount=1,
        status=ShiftStatus.CHECK_IN,
    )
    with pytest.raises(InvalidShiftTransitionError):
        shift.auto_finish()
    assert shift.auto_finished_at is None

    shift.status = ShiftStatus.CHECK_OUT
    shift.auto_finish()
    assert shift.status == ShiftStatus.FINALIZADO
    assert shift.auto_finished_at is not None


async def test_the_loop_runs_the_finish_check(monkeypatch):
    """`scheduler_loop` corre el chequeo de cierre y duerme hasta su deadline:
    si se saca la llamada del loop, esto falla."""
    from app.core.dt import naive

    async def nada(*_args, **_kwargs):
        return None

    for name in (
        "run_attendance_check",
        "run_escalation_check",
        "run_coverage_check",
        "run_available_now_cleanup",
        "run_subscription_expiry_check",
        "run_retention_cleanup",
    ):
        monkeypatch.setattr(scheduler, name, nada)

    calls: list[str] = []
    in_twenty_minutes = naive(datetime.now(timezone.utc)) + timedelta(minutes=20)

    async def finish_check() -> datetime:
        calls.append("finish")
        return in_twenty_minutes

    monkeypatch.setattr(scheduler, "run_finish_check", finish_check)

    class Corte(Exception):
        pass

    sleeps: list[float] = []

    async def wait(seconds: float) -> None:
        sleeps.append(seconds)
        raise Corte

    monkeypatch.setattr(scheduler, "wait_for_wakeup", wait)

    with pytest.raises(Corte):
        await scheduler.scheduler_loop()

    assert calls == ["finish"]
    assert 19 * 60 < sleeps[0] <= 20 * 60
