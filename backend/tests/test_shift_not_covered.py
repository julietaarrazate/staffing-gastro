"""Tests de "no cubierto" (ADR-0015): qué pasa cuando el tiempo se agota
sin que el turno haya llegado a CONFIRMADO.

Julieta, probando la app real (2026-09-16): "veo que quedan puestos abiertos
cuando ya pasó la fecha, debería pasar algo con eso". El hallazgo real fue más
preciso que el síntoma: un turno ASIGNADO cuyo trabajador nunca confirma ni
rechaza queda invisible para los DOS chequeos que ya existían (asistencia sólo
mira CONFIRMADO/EN_CAMINO; escalada sólo mira PUBLICADO/BUSCANDO_PERSONAL).

Tres decisiones de Julieta, tomadas antes de escribir una línea de código:
1. Sin impacto de reputación — nunca confirmó, no es lo mismo que faltar a
   algo que sí aceptó.
2. Estado nuevo "no_cubierto" (su propia sugerencia, mejor que "vencido": se
   conecta con la misión del producto — "cubrir una posición eventual").
3. La ventana de gracia depende de si el turno era urgente — la señal que el
   sistema ya tiene para decir "esto es inmediato" vs. "tiene margen".

Mismo patrón que test_scheduler.py: usa `AsyncSessionLocal` directo
(monkeypatcheado a la sesión en memoria del test), no la inyección de FastAPI.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from app.modules.shift.application import scheduler
from app.modules.shift.application.services import (
    NOT_COVERED_GRACE_NORMAL,
    NOT_COVERED_GRACE_URGENT,
)
from tests.conftest import auth_headers
from tests.test_attendance import _shift_payload

pytestmark = pytest.mark.asyncio


async def _published_shift_starting_ago(
    client: AsyncClient,
    emp_email: str,
    *,
    ago: timedelta,
    urgent: bool = False,
) -> tuple[str, dict]:
    """Turno PUBLICADO (nunca asignado) cuyo `start_at` ya pasó hace `ago`."""
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
        json=_shift_payload(
            start_at=start_at.isoformat(), end_at=end_at.isoformat(), urgent=urgent
        ),
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)
    return shift_id, employer_headers


async def _asignado_shift_starting_ago(
    client: AsyncClient,
    emp_email: str,
    worker_email: str,
    *,
    ago: timedelta,
    urgent: bool = False,
) -> tuple[str, dict, dict, str]:
    """Turno ASIGNADO cuyo trabajador nunca confirma ni rechaza, con
    `start_at` ya pasado hace `ago` — el caso exacto de la captura de
    Julieta."""
    shift_id, employer_headers = await _published_shift_starting_ago(
        client, emp_email, ago=ago, urgent=urgent
    )
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
    # A propósito: NUNCA se llama a /confirm ni a /reject. Es el punto ciego.
    return shift_id, employer_headers, worker_headers, worker_profile_id


async def _confirmed_shift_starting_ago(
    client: AsyncClient, emp_email: str, worker_email: str, *, ago: timedelta
) -> tuple[str, dict, dict]:
    shift_id, employer_headers, worker_headers, _ = await _asignado_shift_starting_ago(
        client, emp_email, worker_email, ago=ago
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker_headers)
    return shift_id, employer_headers, worker_headers


# --- El caso de la captura: ASIGNADO sin confirmar -------------------------


async def test_unconfirmed_assignment_expires_without_penalty(client, session_factory, monkeypatch):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, employer_headers, worker_headers, worker_profile_id = (
        await _asignado_shift_starting_ago(
            client,
            "nc_emp1@staffya.com",
            "nc_w1@staffya.com",
            ago=NOT_COVERED_GRACE_NORMAL + timedelta(minutes=1),
        )
    )

    await scheduler.run_coverage_check()

    shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=employer_headers)
    body = shift.json()
    assert body["status"] == "no_cubierto"
    assert body["worker_profile_id"] is None
    # Conserva quién estaba asignado, mismo campo que usa no_show() — pero
    # SIN que cuente en contra de nadie (ver abajo).
    assert body["last_no_show_worker_profile_id"] == worker_profile_id

    # (1) Julieta: sin impacto de reputación.
    profile = await client.get("/api/v1/workers/me/profile", headers=worker_headers)
    assert profile.json()["no_shows"] == 0
    assert profile.json()["cancellations"] == 0

    # Sólo el comercio se entera — el trabajador no tiene nada que hacer con
    # esa noticia, el momento ya pasó.
    worker_notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    assert not any(n["type"] == "shift_not_covered" for n in worker_notifications.json())
    company_notifications = await client.get("/api/v1/notifications", headers=employer_headers)
    assert any(n["type"] == "shift_not_covered" for n in company_notifications.json())


async def test_urgent_unconfirmed_assignment_expires_faster(client, session_factory, monkeypatch):
    """(3) Julieta: un turno urgente no debe seguir "activo" tanto tiempo
    después de su hora como uno con más margen. Se prueba pasando MÁS que la
    ventana urgente pero MENOS que la normal — sólo se resuelve si el sistema
    realmente usó la ventana corta."""
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    assert NOT_COVERED_GRACE_URGENT < NOT_COVERED_GRACE_NORMAL  # la premisa del test
    shift_id, employer_headers, _worker_headers, _wpid = await _asignado_shift_starting_ago(
        client,
        "nc_emp2@staffya.com",
        "nc_w2@staffya.com",
        ago=NOT_COVERED_GRACE_URGENT + timedelta(minutes=1),
        urgent=True,
    )

    await scheduler.run_coverage_check()

    shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=employer_headers)
    assert shift.json()["status"] == "no_cubierto"


async def test_urgent_shift_not_touched_before_its_grace_period(client, session_factory, monkeypatch):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, employer_headers, _worker_headers, _wpid = await _asignado_shift_starting_ago(
        client,
        "nc_emp3@staffya.com",
        "nc_w3@staffya.com",
        ago=timedelta(minutes=5),
        urgent=True,
    )

    next_deadline = await scheduler.run_coverage_check()

    shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=employer_headers)
    assert shift.json()["status"] == "asignado"
    assert next_deadline is not None


# --- Turno nunca asignado (el otro hueco que reportó Julieta) --------------


async def test_published_never_assigned_expires_to_not_covered(client, session_factory, monkeypatch):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, employer_headers = await _published_shift_starting_ago(
        client, "nc_emp4@staffya.com", ago=NOT_COVERED_GRACE_NORMAL + timedelta(minutes=1)
    )

    await scheduler.run_coverage_check()

    shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=employer_headers)
    assert shift.json()["status"] == "no_cubierto"

    notifications = await client.get("/api/v1/notifications", headers=employer_headers)
    assert any(n["type"] == "shift_not_covered" for n in notifications.json())


# --- El scheduler nunca toca lo que ya está comprometido -------------------


async def test_confirmed_shift_is_never_touched_by_coverage_check(client, session_factory, monkeypatch):
    """Una vez CONFIRMADO, lo que puede fallar es un no-show
    (`Shift.no_show()`, chequeo de asistencia) — no una falta de cobertura.
    El chequeo de cobertura ni siquiera debe considerarlo."""
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    shift_id, employer_headers, _worker_headers = await _confirmed_shift_starting_ago(
        client,
        "nc_emp5@staffya.com",
        "nc_w5@staffya.com",
        # Mucho más que cualquiera de las dos ventanas de gracia: si el
        # chequeo de cobertura lo tocara por error, esto lo va a exponer.
        ago=NOT_COVERED_GRACE_NORMAL * 10,
    )

    await scheduler.run_coverage_check()

    shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=employer_headers)
    assert shift.json()["status"] == "confirmado"


# --- El feed no ofrece algo cuyo horario ya pasó ----------------------------


async def test_feed_excludes_shift_within_grace_period_whose_start_at_passed(
    client, session_factory, monkeypatch
):
    """Independiente de que el scheduler ya haya corrido o no: un turno cuyo
    `start_at` pasó no tiene sentido ofrecerlo para postularse, ni siquiera
    mientras está todavía en su período de gracia."""
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    await _published_shift_starting_ago(
        client, "nc_emp6@staffya.com", ago=timedelta(minutes=5), urgent=False
    )
    worker_headers = await auth_headers(client, "worker", "nc_w6@staffya.com")

    feed = await client.get(
        "/api/v1/shifts/feed", headers=worker_headers, params={"city": "Palermo"}
    )
    assert feed.json() == []


async def test_feed_still_shows_a_shift_whose_time_has_not_come_yet(client):
    """Control: el filtro nuevo no esconde turnos futuros normales — sólo
    los que ya pasaron.

    Fecha explícita, relativa a "ahora": el default de `_shift_payload`
    (`tests/test_attendance.py`) todavía tiene la fecha fija que documenta
    `docs/TECH_DEBT.md` (T-DATE) — quedaría en el pasado y este control
    fallaría por el motivo equivocado."""
    start_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30)
    end_at = start_at + timedelta(hours=5)
    employer_headers = await auth_headers(client, "employer", "nc_emp7@staffya.com")
    await client.post(
        "/api/v1/companies/me/profile",
        headers=employer_headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    created = await client.post(
        "/api/v1/shifts",
        headers=employer_headers,
        json=_shift_payload(
            city="Palermo", start_at=start_at.isoformat(), end_at=end_at.isoformat()
        ),
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers = await auth_headers(client, "worker", "nc_w7@staffya.com")
    feed = await client.get(
        "/api/v1/shifts/feed", headers=worker_headers, params={"city": "Palermo"}
    )
    assert any(s["id"] == shift_id for s in feed.json())
