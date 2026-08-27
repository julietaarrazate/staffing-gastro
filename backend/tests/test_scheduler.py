"""Tests del scheduler del ciclo de vida del turno: recordatorio de
check-in + no-show automático (ADR-0008), y escalada automática de urgencia.

Ambos chequeos usan `AsyncSessionLocal` (no la inyección de FastAPI, corren
fuera del ciclo request/response) — se monkeypatchea al mismo
`session_factory` de la base en memoria del test, mismo patrón que
`test_seed_demo_data.py` con el script de siembra."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.shift.application import scheduler
from app.modules.shift.application.services import (
    CHECKIN_REMINDER_DELAY,
    ESCALATION_DELAY,
    NO_SHOW_GRACE_PERIOD,
)
from app.modules.shift.infrastructure.models import ShiftModel
from tests.conftest import auth_headers
from tests.test_attendance import _shift_payload

pytestmark = pytest.mark.asyncio


async def _confirmed_shift_starting_ago(
    client: AsyncClient, emp_email: str, worker_email: str, *, ago: timedelta
) -> tuple[str, dict, dict]:
    """Arma un turno CONFIRMADO cuyo `start_at` ya pasó hace `ago`."""
    start_at = datetime.now(timezone.utc).replace(tzinfo=None) - ago
    end_at = start_at + timedelta(hours=5)

    employer_headers = await auth_headers(client, "employer", emp_email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=employer_headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    created = await client.post(
        "/api/v1/shifts",
        headers=employer_headers,
        json=_shift_payload(start_at=start_at.isoformat(), end_at=end_at.isoformat()),
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers = await auth_headers(client, "worker", worker_email)
    profile = await client.post(
        "/api/v1/workers/me/profile", headers=worker_headers, json={"skills": ["mozo"]}
    )
    worker_profile_id = profile.json()["id"]
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker_headers)
    return shift_id, employer_headers, worker_headers


async def test_sends_reminder_after_delay_without_checkin(client, session_factory, monkeypatch):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, _employer_headers, worker_headers = await _confirmed_shift_starting_ago(
        client,
        "sched_emp1@staffya.com",
        "sched_w1@staffya.com",
        ago=CHECKIN_REMINDER_DELAY + timedelta(minutes=1),
    )

    await scheduler.run_attendance_check()

    shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=worker_headers)
    assert shift.json()["status"] == "confirmado"

    notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    assert any(n["type"] == "checkin_reminder" for n in notifications.json())


async def test_does_not_resend_reminder_on_second_tick(client, session_factory, monkeypatch):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, _employer_headers, worker_headers = await _confirmed_shift_starting_ago(
        client,
        "sched_emp2@staffya.com",
        "sched_w2@staffya.com",
        ago=CHECKIN_REMINDER_DELAY + timedelta(minutes=1),
    )

    await scheduler.run_attendance_check()
    await scheduler.run_attendance_check()

    notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    reminders = [n for n in notifications.json() if n["type"] == "checkin_reminder"]
    assert len(reminders) == 1


async def test_marks_no_show_after_grace_period(client, session_factory, monkeypatch):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, _employer_headers, worker_headers = await _confirmed_shift_starting_ago(
        client,
        "sched_emp3@staffya.com",
        "sched_w3@staffya.com",
        ago=NO_SHOW_GRACE_PERIOD + timedelta(minutes=1),
    )

    await scheduler.run_attendance_check()

    shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=worker_headers)
    body = shift.json()
    assert body["status"] == "buscando_personal"

    notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    assert any(n["type"] == "shift_no_show" for n in notifications.json())


async def test_does_not_touch_shift_that_already_checked_in(client, session_factory, monkeypatch):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, _employer_headers, worker_headers = await _confirmed_shift_starting_ago(
        client,
        "sched_emp4@staffya.com",
        "sched_w4@staffya.com",
        ago=NO_SHOW_GRACE_PERIOD + timedelta(minutes=1),
    )
    checked_in = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers=worker_headers,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    assert checked_in.status_code == 200

    await scheduler.run_attendance_check()

    shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=worker_headers)
    assert shift.json()["status"] == "check_in"


async def test_does_not_touch_shift_within_reminder_delay(client, session_factory, monkeypatch):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, _employer_headers, worker_headers = await _confirmed_shift_starting_ago(
        client,
        "sched_emp5@staffya.com",
        "sched_w5@staffya.com",
        ago=timedelta(minutes=1),
    )

    await scheduler.run_attendance_check()

    shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=worker_headers)
    assert shift.json()["status"] == "confirmado"

    notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    assert not any(n["type"] == "checkin_reminder" for n in notifications.json())


async def test_scheduler_is_noop_outside_production(monkeypatch):
    """`settings.is_production` gatea el scheduler: nunca corre en
    tests/desarrollo, mismo patrón "flag por ausencia" que Sentry/VAPID."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "environment", "development")
    assert scheduler.start_scheduler() is None


# --- Escalada automática de urgencia ---------------------------------------


async def _open_shift_published_ago(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    emp_email: str,
    *,
    ago: timedelta,
) -> tuple[str, dict]:
    """Publica un turno abierto (sin asignar) cuyo `published_at` ya pasó
    hace `ago` (backdateado directo en la DB: no hay otra forma de
    controlar el tiempo transcurrido para el test)."""
    employer_headers = await auth_headers(client, "employer", emp_email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=employer_headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        assert model is not None
        model.published_at = datetime.now(timezone.utc) - ago
        await session.commit()

    return shift_id, employer_headers


async def test_escalates_urgency_after_delay_without_coverage(
    client, session_factory, monkeypatch
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    worker_headers = await auth_headers(client, "worker", "sched_esc_w1@staffya.com")
    await client.post(
        "/api/v1/workers/me/profile",
        headers=worker_headers,
        json={"city": "Palermo", "skills": ["mozo"], "is_available": True},
    )
    shift_id, employer_headers = await _open_shift_published_ago(
        client, session_factory, "sched_esc_emp1@staffya.com", ago=ESCALATION_DELAY + timedelta(minutes=1)
    )

    await scheduler.run_escalation_check()

    shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=employer_headers)
    assert shift.json()["urgent"] is True

    notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    assert any(n["type"] == "urgent_shift_nearby" for n in notifications.json())


async def test_does_not_escalate_twice(client, session_factory, monkeypatch):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    worker_headers = await auth_headers(client, "worker", "sched_esc_w2@staffya.com")
    await client.post(
        "/api/v1/workers/me/profile",
        headers=worker_headers,
        json={"city": "Palermo", "skills": ["mozo"], "is_available": True},
    )
    await _open_shift_published_ago(
        client, session_factory, "sched_esc_emp2@staffya.com", ago=ESCALATION_DELAY + timedelta(minutes=1)
    )

    await scheduler.run_escalation_check()
    await scheduler.run_escalation_check()

    notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    escalations = [n for n in notifications.json() if n["type"] == "urgent_shift_nearby"]
    assert len(escalations) == 1


async def test_does_not_touch_shift_within_escalation_delay(client, session_factory, monkeypatch):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, employer_headers = await _open_shift_published_ago(
        client, session_factory, "sched_esc_emp3@staffya.com", ago=timedelta(minutes=1)
    )

    await scheduler.run_escalation_check()

    shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=employer_headers)
    assert shift.json()["urgent"] is False


async def test_does_not_escalate_already_assigned_shift(client, session_factory, monkeypatch):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, employer_headers = await _open_shift_published_ago(
        client, session_factory, "sched_esc_emp4@staffya.com", ago=ESCALATION_DELAY + timedelta(minutes=1)
    )
    worker_headers, worker_profile_id = (
        await auth_headers(client, "worker", "sched_esc_w4@staffya.com"),
        None,
    )
    profile = await client.post(
        "/api/v1/workers/me/profile", headers=worker_headers, json={"skills": ["mozo"]}
    )
    worker_profile_id = profile.json()["id"]
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )

    await scheduler.run_escalation_check()

    shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=employer_headers)
    body = shift.json()
    assert body["status"] == "asignado"
    assert body["urgent"] is False


# --- Despertar por deadline en vez de sondear (incidente Neon 2026-08-26) ---
#
# El loop ya no duerme un intervalo fijo: cada chequeo devuelve su próxima
# deadline futura y el loop duerme hasta ahí. Estos tests fijan ese contrato
# nuevo (los de arriba ya cubren que la lógica de ACCIÓN no cambió).


async def test_attendance_check_returns_next_deadline_for_future_shift(
    client, session_factory, monkeypatch
):
    """Un turno confirmado cuyo `start_at` es futuro (ej. mañana) NO dispara
    ninguna acción, pero SÍ aporta su deadline (start + recordatorio) para que
    el loop sepa hasta cuándo dormir en vez de sondear cada 5 minutos."""
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    # `ago` negativo = start_at en el futuro.
    shift_id, _emp, worker_headers = await _confirmed_shift_starting_ago(
        client,
        "sched_fut_emp@staffya.com",
        "sched_fut_w@staffya.com",
        ago=-timedelta(days=1),
    )

    next_deadline = await scheduler.run_attendance_check()

    # No hizo nada (sigue confirmado, sin recordatorio).
    shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=worker_headers)
    assert shift.json()["status"] == "confirmado"
    notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    assert not any(n["type"] == "checkin_reminder" for n in notifications.json())

    # Pero devolvió una deadline futura (~mañana + 20 min), no None.
    assert next_deadline is not None
    assert next_deadline > datetime.now(timezone.utc).replace(tzinfo=None)


async def test_attendance_check_returns_none_when_nothing_pending(
    client, session_factory, monkeypatch
):
    """Sin turnos que vigilar, el chequeo devuelve None → el loop duerme hasta
    MAX_SLEEP (latido de seguridad), sin sondear la base."""
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    assert await scheduler.run_attendance_check() is None


async def test_attendance_check_returns_no_show_deadline_after_reminder_sent(
    client, session_factory, monkeypatch
):
    """Un turno ya recordado pero antes del período de gracia devuelve como
    próxima deadline su no-show (start + gracia), no el recordatorio ya
    enviado."""
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, _emp, worker_headers = await _confirmed_shift_starting_ago(
        client,
        "sched_rem_emp@staffya.com",
        "sched_rem_w@staffya.com",
        ago=CHECKIN_REMINDER_DELAY + timedelta(minutes=1),
    )

    # Primera pasada: manda el recordatorio y devuelve la deadline del no-show.
    next_deadline = await scheduler.run_attendance_check()

    notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    assert any(n["type"] == "checkin_reminder" for n in notifications.json())
    assert next_deadline is not None


async def test_escalation_check_returns_deadline_for_recent_publish(
    client, session_factory, monkeypatch
):
    """Un turno abierto publicado hace poco (antes del umbral de escalada) no
    se escala pero devuelve su deadline de escalada (publish + delay)."""
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, employer_headers = await _open_shift_published_ago(
        client, session_factory, "sched_esc_emp5@staffya.com", ago=timedelta(minutes=1)
    )

    next_deadline = await scheduler.run_escalation_check()

    shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=employer_headers)
    assert shift.json()["urgent"] is False
    assert next_deadline is not None


async def test_seconds_until_clamps_between_min_and_max():
    """La aritmética del sueño: acota al piso y al techo, y respeta ERROR_RETRY."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Sin deadline → duerme MAX_SLEEP.
    assert scheduler._seconds_until(None, had_error=False) == pytest.approx(
        scheduler.MAX_SLEEP.total_seconds()
    )
    # Deadline lejana → se recorta al techo.
    far = now + timedelta(days=30)
    assert scheduler._seconds_until(far, had_error=False) == pytest.approx(
        scheduler.MAX_SLEEP.total_seconds(), abs=2
    )
    # Deadline ya pasada → se sube al piso, nunca negativo.
    assert scheduler._seconds_until(
        now - timedelta(hours=1), had_error=False
    ) == pytest.approx(scheduler.MIN_SLEEP.total_seconds())
    # Con error → nunca más que ERROR_RETRY aunque no haya deadline.
    assert scheduler._seconds_until(None, had_error=True) == pytest.approx(
        scheduler.ERROR_RETRY.total_seconds()
    )


async def test_notify_scheduler_wakes_a_sleeping_loop():
    """`notify_scheduler()` interrumpe un `wait_for_wakeup` largo antes de que
    se cumpla su timeout — es lo que hace que un turno recién publicado escale
    a tiempo aunque el loop estuviera durmiendo horas."""
    import asyncio

    from app.modules.shift.application import scheduler_signal

    # Estado limpio: otros tests publican/confirman turnos, que ahora setean la
    # señal — sin esto, el sleeper podría volver por una señal vieja y el test
    # pasaría sin probar nada.
    scheduler_signal._wakeup.clear()

    async def sleeper():
        # Pediría dormir 1 hora; la señal debe cortarlo casi al instante.
        await scheduler_signal.wait_for_wakeup(3600)

    task = asyncio.create_task(sleeper())
    await asyncio.sleep(0.05)  # dejar que entre al wait
    scheduler_signal.notify_scheduler()
    # Si la señal funciona, el task termina ya; si no, este wait_for expira.
    await asyncio.wait_for(task, timeout=2.0)
    assert task.done()
