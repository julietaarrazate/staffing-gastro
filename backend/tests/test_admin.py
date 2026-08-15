"""Tests del módulo admin (panel de administración)."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.shift.infrastructure.models import ShiftModel
from tests.conftest import auth_headers, login

pytestmark = pytest.mark.asyncio


async def _make_admin(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    email: str,
) -> dict:
    """Registra un usuario y lo promueve a admin directamente en la DB."""
    await auth_headers(client, "employer", email)
    async with session_factory() as session:
        repo = SqlAlchemyUserRepository(session)
        user = await repo.get_by_email(email)
        user.promote_to_admin()
        await repo.update(user)
    # Re-login para obtener un token con el rol actualizado en los claims.
    tokens = await login(client, email)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    return headers


async def _worker_with_profile(client: AsyncClient, email: str) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email)
    profile = await client.post(
        "/api/v1/workers/me/profile", headers=headers, json={"skills": ["mozo"]}
    )
    return headers, profile.json()["id"]


def _shift_payload(**overrides) -> dict:
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": "2026-06-28T20:00:00",
        "end_at": "2026-06-29T03:00:00",
        "pay_amount": "70000.00",
        "tips": True,
        "city": "Palermo",
    }
    payload.update(overrides)
    return payload


async def _backdate_published_at(
    session_factory: async_sessionmaker[AsyncSession], shift_id: str, minutes_ago: int
) -> None:
    """Corre directo en la DB (no hay endpoint para esto): simula que un
    turno se publicó hace rato, para poder controlar el tiempo transcurrido
    hasta el `assign()` real que se dispara a continuación por API."""
    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        assert model is not None
        model.published_at = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
        await session.commit()


async def test_non_admin_cannot_access(client: AsyncClient):
    headers = await auth_headers(client, "worker", "worker@test.com")
    resp = await client.get("/api/v1/admin/users", headers=headers)
    assert resp.status_code == 403


async def test_admin_lists_users_and_stats(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin@test.com")
    await auth_headers(client, "worker", "w1@test.com")
    await auth_headers(client, "employer", "e1@test.com")

    users = await client.get("/api/v1/admin/users", headers=admin)
    assert users.status_code == 200
    assert len(users.json()) == 3

    stats = await client.get("/api/v1/admin/stats", headers=admin)
    assert stats.status_code == 200
    body = stats.json()
    assert body["total_users"] == 3
    assert body["workers"] == 1
    assert body["employers"] == 1
    assert body["admins"] == 1
    # Sin turnos cubiertos todavía: sin muestra, sin dividir por cero.
    assert body["coverage_sample_size"] == 0
    assert body["avg_time_to_fill_minutes"] is None
    assert body["pct_filled_under_10_min"] is None


async def test_admin_stats_compute_coverage_metric(client, session_factory):
    """Promesa central del negocio (PRODUCT.md, "<10 min"): el panel admin
    calcula el tiempo real de cobertura sobre los turnos que ya se
    cubrieron, ignorando los que todavía están abiertos."""
    admin = await _make_admin(client, session_factory, "admin_cov@test.com")
    employer_headers = await _employer_with_company(client, "emp_cov@test.com")

    # Turno 1: se cubre ~5 min después de publicado (dentro de la promesa).
    created1 = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift1_id = created1.json()["id"]
    await client.post(f"/api/v1/shifts/{shift1_id}/publish", headers=employer_headers)
    await _backdate_published_at(session_factory, shift1_id, 5)
    _, worker1_profile_id = await _worker_with_profile(client, "w_cov1@test.com")
    await client.post(
        f"/api/v1/shifts/{shift1_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker1_profile_id},
    )

    # Turno 2: se cubre ~30 min después (fuera de la promesa).
    created2 = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift2_id = created2.json()["id"]
    await client.post(f"/api/v1/shifts/{shift2_id}/publish", headers=employer_headers)
    await _backdate_published_at(session_factory, shift2_id, 30)
    _, worker2_profile_id = await _worker_with_profile(client, "w_cov2@test.com")
    await client.post(
        f"/api/v1/shifts/{shift2_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker2_profile_id},
    )

    # Turno 3: publicado pero todavía sin cubrir — no debe entrar en la
    # muestra (nada que promediar todavía).
    created3 = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    await client.post(
        f"/api/v1/shifts/{created3.json()['id']}/publish", headers=employer_headers
    )

    stats = await client.get("/api/v1/admin/stats", headers=admin)
    body = stats.json()
    assert body["coverage_sample_size"] == 2
    assert body["avg_time_to_fill_minutes"] == pytest.approx(17.5, abs=1)
    assert body["pct_filled_under_10_min"] == pytest.approx(50.0, abs=1)


PALERMO = {"latitude": -34.58, "longitude": -58.43}


async def test_admin_stats_shift_assignment_rate_and_application_acceptance(
    client, session_factory
):
    """`shift_assignment_rate`/`application_to_acceptance_rate`
    (docs/audits/ETAPA1_QUALITY_REVIEW.md §1.1/§1.2): sobre 2 turnos
    publicados con 2 postulaciones en total, sólo 1 termina asignado/aceptado."""
    admin = await _make_admin(client, session_factory, "admin_fill@test.com")
    employer = await _employer_with_company(client, "emp_fill@test.com")

    # Turno 1: se publica, recibe una postulación y se asigna (pero NO se
    # completa el ciclo — sigue ASIGNADO). Cuenta para assignment, no para
    # completion (ver test de más abajo para el caso que sí completa).
    created1 = await client.post(
        "/api/v1/shifts", headers=employer, json=_shift_payload()
    )
    shift1_id = created1.json()["id"]
    await client.post(f"/api/v1/shifts/{shift1_id}/publish", headers=employer)
    worker1, worker1_profile_id = await _worker_with_profile(client, "w_fill1@test.com")
    await client.post(f"/api/v1/applications/shifts/{shift1_id}", headers=worker1)
    await client.post(
        f"/api/v1/shifts/{shift1_id}/assign",
        headers=employer,
        json={"worker_profile_id": worker1_profile_id},
    )

    # Turno 2: se publica y recibe una postulación, pero NUNCA se asigna
    # (queda abierto) — no cuenta como asignado ni como aceptado.
    created2 = await client.post(
        "/api/v1/shifts", headers=employer, json=_shift_payload()
    )
    shift2_id = created2.json()["id"]
    await client.post(f"/api/v1/shifts/{shift2_id}/publish", headers=employer)
    worker2, _ = await _worker_with_profile(client, "w_fill2@test.com")
    await client.post(f"/api/v1/applications/shifts/{shift2_id}", headers=worker2)

    stats = await client.get("/api/v1/admin/stats", headers=admin)
    body = stats.json()
    assert body["shift_assignment_rate_sample_size"] == 2
    assert body["shift_assignment_rate_pct"] == pytest.approx(50.0, abs=1)
    assert body["application_acceptance_sample_size"] == 2
    assert body["application_to_acceptance_rate_pct"] == pytest.approx(50.0, abs=1)


async def test_admin_stats_shift_completion_rate_differs_from_assignment_rate(
    client, session_factory
):
    """`shift_completion_rate` != `shift_assignment_rate`: un turno puede
    asignarse y nunca completarse (no-show, se cancela) — sólo el que
    termina FINALIZADO/PAGADO cuenta como "completion" (docs/audits/
    ETAPA1_QUALITY_REVIEW.md §1.1 — el hallazgo que motivó separar las 2
    métricas)."""
    admin = await _make_admin(client, session_factory, "admin_completion@test.com")
    employer = await _employer_with_company(client, "emp_completion@test.com")

    # Turno A: se asigna, el trabajador nunca se presenta -> no-show ->
    # el comercio termina cancelándolo. Cuenta para "assigned", NUNCA para
    # "completed".
    created_a = await client.post(
        "/api/v1/shifts", headers=employer, json=_shift_payload()
    )
    shift_a_id = created_a.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_a_id}/publish", headers=employer)
    worker_a = await auth_headers(client, "worker", "w_completion_a@test.com")
    profile_a = await client.post(
        "/api/v1/workers/me/profile",
        headers=worker_a,
        json={"skills": ["mozo"], "is_available": True, **PALERMO},
    )
    await client.post(
        f"/api/v1/shifts/{shift_a_id}/assign",
        headers=employer,
        json={"worker_profile_id": profile_a.json()["id"]},
    )
    await client.post(f"/api/v1/shifts/{shift_a_id}/confirm", headers=worker_a)
    await client.post(f"/api/v1/shifts/{shift_a_id}/no-show", headers=employer)
    await client.post(f"/api/v1/shifts/{shift_a_id}/cancel", headers=employer)

    # Turno B: ciclo completo hasta FINALIZADO -> cuenta para "assigned" Y
    # para "completed".
    worker_b, worker_b_id = await _worker_with_profile_palermo(
        client, "w_completion_b@test.com"
    )
    await _run_shift_to_finish(client, employer, worker_b, worker_b_id)

    stats = await client.get("/api/v1/admin/stats", headers=admin)
    body = stats.json()
    # published = 2 (A, B). assigned = 2 (A se asignó una vez aunque luego
    # se canceló; B se asignó y completó). completed = 1 (sólo B).
    assert body["shift_assignment_rate_sample_size"] == 2
    assert body["shift_assignment_rate_pct"] == pytest.approx(100.0, abs=1)
    assert body["shift_completion_rate_sample_size"] == 2
    assert body["shift_completion_rate_pct"] == pytest.approx(50.0, abs=1)


async def test_admin_stats_employer_repeat_rate(client, session_factory):
    """`employer_repeat_rate`: un comercio que publica 2+ turnos cuenta como
    "recurrente"; uno que publica sólo 1, no."""
    admin = await _make_admin(client, session_factory, "admin_repeat_emp@test.com")
    repeat_employer = await _employer_with_company(client, "emp_repeat@test.com")
    once_employer = await _employer_with_company(client, "emp_once@test.com")

    for _ in range(2):
        created = await client.post(
            "/api/v1/shifts", headers=repeat_employer, json=_shift_payload()
        )
        await client.post(
            f"/api/v1/shifts/{created.json()['id']}/publish", headers=repeat_employer
        )
    created_once = await client.post(
        "/api/v1/shifts", headers=once_employer, json=_shift_payload()
    )
    await client.post(
        f"/api/v1/shifts/{created_once.json()['id']}/publish", headers=once_employer
    )

    stats = await client.get("/api/v1/admin/stats", headers=admin)
    body = stats.json()
    assert body["employer_repeat_sample_size"] == 2  # 2 comercios con >=1 turno
    assert body["employer_repeat_rate_pct"] == pytest.approx(50.0, abs=1)  # 1 de 2 repite


async def _worker_with_profile_palermo(
    client: AsyncClient, email: str
) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email)
    profile = await client.post(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={"skills": ["mozo"], "is_available": True, **PALERMO},
    )
    return headers, profile.json()["id"]


async def _run_shift_to_finish(
    client: AsyncClient, employer: dict, worker_headers: dict, worker_profile_id: str
) -> None:
    """Ciclo completo turno->finalizado (mismo patrón que
    `test_full_shift_lifecycle.py`), para poblar `events_completed`.

    Recibe un trabajador ya registrado (no lo crea) para poder llamarse
    varias veces con el MISMO trabajador (turnos repetidos) sin pisar su
    perfil, que sólo se puede crear una vez por usuario."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    payload = _shift_payload(
        start_at=now.isoformat(),
        end_at=(now + timedelta(hours=5)).isoformat(),
        **PALERMO,
    )
    created = await client.post("/api/v1/shifts", headers=employer, json=payload)
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker_headers)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": worker_profile_id},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker_headers)
    await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=worker_headers)
    await client.post(
        f"/api/v1/shifts/{shift_id}/check-in", headers=worker_headers, json=PALERMO
    )
    await client.post(f"/api/v1/shifts/{shift_id}/start-working", headers=worker_headers)
    await client.post(
        f"/api/v1/shifts/{shift_id}/check-out", headers=worker_headers, json=PALERMO
    )
    await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer)


async def test_admin_stats_no_show_rate_and_worker_completion_repeat_rate(
    client, session_factory
):
    """`no_show_rate`/`worker_completion_repeat_rate`: un trabajador completa
    2 turnos (repite COMPLETACIÓN, sin no-shows) y otro tiene un no-show en
    su único turno (nunca completa nada -> no entra en la muestra de repeat,
    ver docs/audits/ETAPA1_QUALITY_REVIEW.md §1.4)."""
    admin = await _make_admin(client, session_factory, "admin_repeat_w@test.com")
    employer = await _employer_with_company(client, "emp_repeat_w@test.com")

    repeat_worker, repeat_worker_id = await _worker_with_profile_palermo(
        client, "w_repeat1@test.com"
    )
    await _run_shift_to_finish(client, employer, repeat_worker, repeat_worker_id)
    await _run_shift_to_finish(client, employer, repeat_worker, repeat_worker_id)

    # Trabajador con un no-show: asignado y confirmado, pero nunca hace check-in.
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    ns_payload = _shift_payload(
        start_at=now.isoformat(), end_at=(now + timedelta(hours=5)).isoformat(), **PALERMO
    )
    created = await client.post("/api/v1/shifts", headers=employer, json=ns_payload)
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    ns_worker = await auth_headers(client, "worker", "w_noshow@test.com")
    ns_profile = await client.post(
        "/api/v1/workers/me/profile",
        headers=ns_worker,
        json={"skills": ["mozo"], "is_available": True, **PALERMO},
    )
    ns_profile_id = ns_profile.json()["id"]
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=ns_worker)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": ns_profile_id},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=ns_worker)
    await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=employer)

    stats = await client.get("/api/v1/admin/stats", headers=admin)
    body = stats.json()
    # denominador = events_completed(2) + cancellations(0) + no_shows(1) = 3
    assert body["no_show_sample_size"] == 3
    assert body["no_show_rate_pct"] == pytest.approx(33.33, abs=1)
    # 2 trabajadores con >=1 evento (el recurrente + el no-show cuenta sólo
    # si tiene >=1 *completado*, no aplica acá) -> sólo el recurrente cuenta
    # para el numerador (events_completed=2 >= 2).
    assert body["worker_completion_repeat_sample_size"] == 1
    assert body["worker_completion_repeat_rate_pct"] == pytest.approx(100.0, abs=1)


async def test_admin_suspends_and_activates_user(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin@test.com")
    await auth_headers(client, "worker", "target@test.com")

    users = await client.get("/api/v1/admin/users", headers=admin)
    target_id = next(u["id"] for u in users.json() if u["email"] == "target@test.com")

    suspended = await client.post(f"/api/v1/admin/users/{target_id}/suspend", headers=admin)
    assert suspended.status_code == 200
    assert suspended.json()["status"] == "suspended"

    # El usuario suspendido no puede iniciar sesión.
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "target@test.com", "password": "supersecreta123"},
    )
    assert login.status_code == 403

    activated = await client.post(f"/api/v1/admin/users/{target_id}/activate", headers=admin)
    assert activated.status_code == 200
    assert activated.json()["status"] == "active"


async def test_admin_cannot_suspend_self(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin@test.com")
    me = await client.get("/api/v1/auth/me", headers=admin)
    my_id = me.json()["id"]

    resp = await client.post(f"/api/v1/admin/users/{my_id}/suspend", headers=admin)
    assert resp.status_code == 400


async def test_admin_promotes_and_verifies_user(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin@test.com")
    await auth_headers(client, "worker", "target@test.com")

    users = await client.get("/api/v1/admin/users", headers=admin)
    target_id = next(u["id"] for u in users.json() if u["email"] == "target@test.com")

    promoted = await client.post(f"/api/v1/admin/users/{target_id}/promote", headers=admin)
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "admin"

    verified = await client.post(f"/api/v1/admin/users/{target_id}/verify", headers=admin)
    assert verified.status_code == 200
    assert verified.json()["is_verified"] is True


async def test_action_on_missing_user_returns_404(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin@test.com")
    missing = "00000000-0000-0000-0000-000000000000"
    resp = await client.post(f"/api/v1/admin/users/{missing}/activate", headers=admin)
    assert resp.status_code == 404


# --- "Ver como" (impersonación) ---------------------------------------------


async def test_admin_can_impersonate_worker(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin@test.com")
    await auth_headers(client, "worker", "worker@test.com")
    users = await client.get("/api/v1/admin/users", headers=admin)
    target_id = next(u["id"] for u in users.json() if u["email"] == "worker@test.com")

    resp = await client.post(f"/api/v1/admin/users/{target_id}/impersonate", headers=admin)
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == "worker@test.com"
    assert body["user"]["role"] == "worker"
    # Sin refresh: sesión de impersonación de vida corta, no queda sesión
    # persistente a nombre del usuario impersonado.
    assert "refresh_token" not in body

    # El token entrega efectivamente la identidad del trabajador.
    as_worker = {"Authorization": f"Bearer {body['access_token']}"}
    me = await client.get("/api/v1/auth/me", headers=as_worker)
    assert me.status_code == 200
    assert me.json()["email"] == "worker@test.com"


async def test_admin_can_impersonate_employer(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin@test.com")
    await auth_headers(client, "employer", "comercio@test.com")
    users = await client.get("/api/v1/admin/users", headers=admin)
    target_id = next(u["id"] for u in users.json() if u["email"] == "comercio@test.com")

    resp = await client.post(f"/api/v1/admin/users/{target_id}/impersonate", headers=admin)
    assert resp.status_code == 200
    assert resp.json()["user"]["role"] == "employer"


async def test_cannot_impersonate_another_admin(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin@test.com")
    other_admin = await _make_admin(client, session_factory, "otro-admin@test.com")
    users = await client.get("/api/v1/admin/users", headers=admin)
    target_id = next(u["id"] for u in users.json() if u["email"] == "otro-admin@test.com")

    resp = await client.post(f"/api/v1/admin/users/{target_id}/impersonate", headers=admin)
    assert resp.status_code == 400


async def test_impersonate_missing_user_returns_404(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin@test.com")
    missing = "00000000-0000-0000-0000-000000000000"
    resp = await client.post(f"/api/v1/admin/users/{missing}/impersonate", headers=admin)
    assert resp.status_code == 404


# --- Métricas de suscripción/MRR ----------------------------------------


async def _publish_n_shifts(client: AsyncClient, employer_headers: dict, n: int) -> None:
    for i in range(n):
        created = await client.post(
            "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
        )
        await client.post(
            f"/api/v1/shifts/{created.json()['id']}/publish", headers=employer_headers
        )


async def test_subscription_stats_folds_company_without_row_into_gratis(
    client, session_factory
):
    """Un comercio que nunca publicó ni llamó a `/subscription` no tiene fila
    en `subscriptions` todavía — igual cuenta como `gratis` (arranca ahí por
    default, ADR-0005), usando el total real de comercios como denominador."""
    admin = await _make_admin(client, session_factory, "admin_sub1@test.com")
    await _employer_with_company(client, "emp_sub_norow@test.com")

    stats = await client.get("/api/v1/admin/subscription-stats", headers=admin)
    assert stats.status_code == 200
    body = stats.json()
    assert body["total_companies"] == 1
    assert body["companies_by_plan"] == {"gratis": 1}
    assert Decimal(str(body["mrr_ars"])) == Decimal("0")
    assert body["companies_at_plan_limit"] == 0


async def test_subscription_stats_computes_mrr_and_plan_distribution(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin_sub2@test.com")
    gratis_employer = await _employer_with_company(client, "emp_sub_gratis@test.com")
    basico_employer = await _employer_with_company(client, "emp_sub_basico@test.com")
    pro_employer = await _employer_with_company(client, "emp_sub_pro@test.com")

    # El de gratis publica (crea su fila `subscriptions`, sigue en gratis).
    await _publish_n_shifts(client, gratis_employer, 1)
    await client.post(
        "/api/v1/subscription/subscribe", headers=basico_employer, json={"plan_code": "basico"}
    )
    await client.post(
        "/api/v1/subscription/subscribe", headers=pro_employer, json={"plan_code": "pro"}
    )

    stats = await client.get("/api/v1/admin/subscription-stats", headers=admin)
    body = stats.json()
    assert body["total_companies"] == 3
    assert body["companies_by_plan"] == {"gratis": 1, "basico": 1, "pro": 1}
    # MRR = básico ($20.000) + pro ($45.000); gratis no aporta.
    assert Decimal(str(body["mrr_ars"])) == Decimal("65000")


async def test_subscription_stats_detects_companies_at_plan_limit(client, session_factory):
    """Plan gratis: tope 3 turnos/mes (`plans.py`). Publicar 3 alcanza el
    tope aunque `subscriptions_enforced` esté OFF (el uso se registra
    igual, ver `ShiftService._consume_publication_slot`)."""
    admin = await _make_admin(client, session_factory, "admin_sub3@test.com")
    at_limit_employer = await _employer_with_company(client, "emp_sub_limit@test.com")
    under_limit_employer = await _employer_with_company(client, "emp_sub_under@test.com")

    await _publish_n_shifts(client, at_limit_employer, 3)
    await _publish_n_shifts(client, under_limit_employer, 1)

    stats = await client.get("/api/v1/admin/subscription-stats", headers=admin)
    body = stats.json()
    assert body["companies_at_plan_limit"] == 1


async def test_non_admin_cannot_get_subscription_stats(client: AsyncClient):
    worker = await auth_headers(client, "worker", "worker_no_admin_sub@test.com")
    resp = await client.get("/api/v1/admin/subscription-stats", headers=worker)
    assert resp.status_code == 403


# --- Cuentas de prueba -------------------------------------------------


async def test_admin_gets_test_accounts_worker_and_employer(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin_test_acc@test.com")

    resp = await client.get("/api/v1/admin/test-accounts", headers=admin)
    assert resp.status_code == 200
    body = resp.json()
    roles = {row["role"] for row in body}
    assert roles == {"worker", "employer"}


async def test_test_accounts_are_idempotent_across_calls(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin_test_acc2@test.com")

    first = await client.get("/api/v1/admin/test-accounts", headers=admin)
    second = await client.get("/api/v1/admin/test-accounts", headers=admin)
    first_ids = sorted(row["id"] for row in first.json())
    second_ids = sorted(row["id"] for row in second.json())
    assert first_ids == second_ids

    # No aparecen como usuarios nuevos en cada llamado (no se duplican filas).
    users = await client.get("/api/v1/admin/users", headers=admin)
    test_emails = [u["email"] for u in users.json() if u["email"].endswith("@oido.beta")]
    assert len(test_emails) == len(set(test_emails)) == 2


async def test_admin_can_impersonate_test_account(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin_test_acc3@test.com")

    accounts = await client.get("/api/v1/admin/test-accounts", headers=admin)
    worker_account = next(row for row in accounts.json() if row["role"] == "worker")

    resp = await client.post(
        f"/api/v1/admin/users/{worker_account['id']}/impersonate", headers=admin
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["email"] == worker_account["email"]

    # La cuenta de prueba no tiene contraseña conocida: no se puede loguear
    # directamente con email+contraseña, sólo vía "Ver como".
    login_attempt = await client.post(
        "/api/v1/auth/login",
        json={"email": worker_account["email"], "password": "supersecreta123"},
    )
    assert login_attempt.status_code in (400, 401)


async def test_non_admin_cannot_get_test_accounts(client: AsyncClient):
    worker = await auth_headers(client, "worker", "worker_no_admin@test.com")
    resp = await client.get("/api/v1/admin/test-accounts", headers=worker)
    assert resp.status_code == 403


async def test_non_admin_cannot_impersonate(client: AsyncClient):
    worker = await auth_headers(client, "worker", "worker2@test.com")

    # Ni siquiera puede llamar directamente al endpoint sabiendo un id ajeno.
    resp = await client.post(
        "/api/v1/admin/users/00000000-0000-0000-0000-000000000000/impersonate",
        headers=worker,
    )
    assert resp.status_code == 403
