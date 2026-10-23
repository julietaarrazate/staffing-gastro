"""Tests de "Turnos en vivo", los contadores nuevos de "Hoy" y "Métricas"
con período (pasos 3 y 4 del panel de admin ordenado)."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.tz import ARG_TZ
from app.modules.admin.application.periods import day_bounds, period_bounds
from app.modules.application.infrastructure.models import ShiftApplicationModel
from app.modules.shift.infrastructure.models import ShiftModel
from tests.conftest import auth_headers, make_admin
from tests.test_shift import _count_queries

pytestmark = pytest.mark.asyncio


async def _make_admin(client: AsyncClient, session_factory, email: str) -> dict:
    return await make_admin(client, session_factory, email)


async def _employer(client: AsyncClient, email: str, name: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": name, "city": "Palermo"},
    )
    return headers


async def _worker(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "worker", email)
    await client.post("/api/v1/workers/me/profile", headers=headers, json={"skills": ["mozo"]})
    return headers


def _payload(**overrides) -> dict:
    start = datetime.now(UTC) + timedelta(days=1)
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": start.isoformat(),
        "end_at": (start + timedelta(hours=6)).isoformat(),
        "pay_amount": "70000.00",
        "city": "Palermo",
        "title": "Mozo para la cena",
    }
    payload.update(overrides)
    return payload


async def _published_shift(client: AsyncClient, employer: dict, **overrides) -> str:
    created = await client.post("/api/v1/shifts", headers=employer, json=_payload(**overrides))
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    return shift_id


async def _set(
    session_factory: async_sessionmaker[AsyncSession], shift_id: str, **fields
) -> None:
    """Escribe columnas directo en la base: no hay endpoint para retroceder
    el reloj (publicado hace 40 min, escalado, ausente hoy)."""
    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        for key, value in fields.items():
            setattr(model, key, value)
        await session.commit()


def _ago(minutes: float) -> datetime:
    return datetime.now(UTC) - timedelta(minutes=minutes)


# --- Permisos ---------------------------------------------------------------


@pytest.mark.parametrize(
    "path", ["/admin/live-shifts", "/admin/today", "/admin/period-metrics?period=7"]
)
async def test_only_admins(client: AsyncClient, path: str):
    assert (await client.get(f"/api/v1{path}")).status_code == 401
    worker = await auth_headers(client, "worker", "no_admin_w@test.com")
    employer = await auth_headers(client, "employer", "no_admin_e@test.com")
    assert (await client.get(f"/api/v1{path}", headers=worker)).status_code == 403
    assert (await client.get(f"/api/v1{path}", headers=employer)).status_code == 403


# --- Turnos en vivo ---------------------------------------------------------


async def test_live_shifts_lists_uncovered_most_urgent_first(client, session_factory):
    admin = await _make_admin(client, session_factory, "vivo_admin@test.com")
    bodegon = await _employer(client, "bodegon_vivo@test.com", "Bodegón Don Pepe")
    cafe = await _employer(client, "cafe_vivo@test.com", "Café Martínez")

    viejo = await _published_shift(client, bodegon, title="Viejo sin cubrir")
    nuevo = await _published_shift(client, cafe, title="Nuevo sin cubrir")
    urgente = await _published_shift(client, cafe, title="Urgente del comercio", urgent=True)
    escalado = await _published_shift(client, bodegon, title="Escalado")
    await _set(session_factory, viejo, published_at=_ago(40))
    await _set(session_factory, nuevo, published_at=_ago(3))
    await _set(session_factory, urgente, published_at=_ago(5))
    await _set(session_factory, escalado, published_at=_ago(15), urgent=True, escalated_at=_ago(5))

    # No entran: un borrador, uno cancelado y uno con alguien ya confirmado.
    await client.post("/api/v1/shifts", headers=bodegon, json=_payload(title="Borrador"))
    cancelado = await _published_shift(client, bodegon, title="Cancelado")
    await _set(session_factory, cancelado, status="cancelado")
    confirmado = await _published_shift(client, bodegon, title="Confirmado")
    await _set(session_factory, confirmado, status="confirmado")

    # Postulaciones al viejo: tres, y una retirada que no cuenta.
    for i in range(3):
        worker = await _worker(client, f"vivo_w{i}@test.com")
        await client.post(f"/api/v1/applications/shifts/{viejo}", headers=worker)
    async with session_factory() as session:
        first = (
            await session.execute(
                select(ShiftApplicationModel.id)
                .where(ShiftApplicationModel.shift_id == UUID(viejo))
                .limit(1)
            )
        ).scalar_one()
        await session.execute(
            update(ShiftApplicationModel)
            .where(ShiftApplicationModel.id == first)
            .values(status="retirada")
        )
        await session.commit()

    resp = await client.get("/api/v1/admin/live-shifts", headers=admin)
    assert resp.status_code == 200
    body = resp.json()
    titles = [s["title"] for s in body["shifts"]]
    assert titles == ["Escalado", "Urgente del comercio", "Viejo sin cubrir", "Nuevo sin cubrir"]
    assert (body["total"], body["urgent"], body["escalated"]) == (4, 2, 1)

    by_title = {s["title"]: s for s in body["shifts"]}
    assert by_title["Viejo sin cubrir"]["company_name"] == "Bodegón Don Pepe"
    assert by_title["Viejo sin cubrir"]["applications"] == 2
    assert by_title["Nuevo sin cubrir"]["applications"] == 0
    assert 39 <= by_title["Viejo sin cubrir"]["minutes_open"] <= 41
    assert by_title["Escalado"]["escalated"] is True
    assert by_title["Urgente del comercio"]["escalated"] is False


async def test_live_shifts_includes_assigned_not_confirmed(client, session_factory):
    admin = await _make_admin(client, session_factory, "vivo_asig_admin@test.com")
    employer = await _employer(client, "vivo_asig@test.com", "Bar Asignado")
    shift_id = await _published_shift(client, employer, title="Falta que confirme")
    await _set(session_factory, shift_id, status="asignado", first_assigned_at=_ago(1))

    body = (await client.get("/api/v1/admin/live-shifts", headers=admin)).json()
    assert [(s["title"], s["status"]) for s in body["shifts"]] == [
        ("Falta que confirme", "asignado")
    ]


async def test_live_shifts_filters_keep_full_counts(client, session_factory):
    admin = await _make_admin(client, session_factory, "vivo_filtro_admin@test.com")
    employer = await _employer(client, "vivo_filtro@test.com", "Parrilla")
    await _published_shift(client, employer, title="Normal")
    await _published_shift(client, employer, title="Urgente", urgent=True)
    escalado = await _published_shift(client, employer, title="Escalado")
    await _set(session_factory, escalado, urgent=True, escalated_at=_ago(1))

    urgent = (await client.get("/api/v1/admin/live-shifts?urgent=true", headers=admin)).json()
    assert {s["title"] for s in urgent["shifts"]} == {"Urgente", "Escalado"}
    assert (urgent["total"], urgent["urgent"], urgent["escalated"]) == (3, 2, 1)

    escalated = (
        await client.get("/api/v1/admin/live-shifts?escalated=true", headers=admin)
    ).json()
    assert [s["title"] for s in escalated["shifts"]] == ["Escalado"]


async def test_live_shifts_query_count_is_constant(client, session_factory):
    """Comercio y postulaciones salen en consultas batch: con 1 turno o con
    6 de comercios distintos, el endpoint hace las mismas consultas."""
    admin = await _make_admin(client, session_factory, "vivo_n1_admin@test.com")
    first = await _employer(client, "vivo_n1_0@test.com", "Comercio 0")
    await _published_shift(client, first)

    with _count_queries(session_factory) as one:
        assert (await client.get("/api/v1/admin/live-shifts", headers=admin)).status_code == 200

    for i in range(1, 6):
        employer = await _employer(client, f"vivo_n1_{i}@test.com", f"Comercio {i}")
        shift_id = await _published_shift(client, employer)
        worker = await _worker(client, f"vivo_n1_w{i}@test.com")
        await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)

    with _count_queries(session_factory) as many:
        body = (await client.get("/api/v1/admin/live-shifts", headers=admin)).json()
    assert body["total"] == 6
    assert many["n"] == one["n"]


# --- Hoy --------------------------------------------------------------------


async def test_today_counts_urgent_uncovered_and_no_shows(client, session_factory):
    admin = await _make_admin(client, session_factory, "hoy_admin@test.com")
    employer = await _employer(client, "hoy_emp@test.com", "Bar Hoy")

    await _published_shift(client, employer, urgent=True)
    escalado = await _published_shift(client, employer)
    await _set(session_factory, escalado, urgent=True, escalated_at=_ago(2))
    await _published_shift(client, employer)  # no urgente: no cuenta
    asignado = await _published_shift(client, employer, urgent=True)
    await _set(session_factory, asignado, status="asignado")  # ya tiene a alguien

    day_start, _ = day_bounds(datetime.now(UTC))
    hoy = await _published_shift(client, employer)
    await _set(session_factory, hoy, no_show_at=day_start + timedelta(minutes=1))
    ayer = await _published_shift(client, employer)
    await _set(session_factory, ayer, no_show_at=day_start - timedelta(minutes=1))

    resp = await client.get("/api/v1/admin/today", headers=admin)
    assert resp.status_code == 200
    assert resp.json() == {"urgent_uncovered": 2, "no_shows_today": 1}


async def test_day_bounds_cut_at_argentina_midnight():
    # 23:30 del 22/10 en Argentina = 02:30 del 23/10 en UTC: sigue siendo
    # el 22 para el negocio.
    start, end = day_bounds(datetime(2026, 10, 23, 2, 30, tzinfo=UTC))
    assert start == datetime(2026, 10, 22, 3, 0, tzinfo=UTC)
    assert end == datetime(2026, 10, 23, 3, 0, tzinfo=UTC)
    # 00:10 del 23/10 en Argentina: ya es el 23.
    start, _ = day_bounds(datetime(2026, 10, 23, 0, 10, tzinfo=ARG_TZ))
    assert start == datetime(2026, 10, 23, 3, 0, tzinfo=UTC)


# --- Métricas con período ---------------------------------------------------


async def test_period_bounds_math():
    now = datetime(2026, 10, 23, 15, 0, tzinfo=ARG_TZ)
    seven = period_bounds(7, now)
    assert seven.end == datetime(2026, 10, 24, 3, 0, tzinfo=UTC)
    assert seven.current_start == datetime(2026, 10, 17, 3, 0, tzinfo=UTC)
    assert seven.previous_start == datetime(2026, 10, 10, 3, 0, tzinfo=UTC)
    thirty = period_bounds(30, now)
    assert thirty.end - thirty.current_start == timedelta(days=30)
    assert thirty.current_start - thirty.previous_start == timedelta(days=30)
    # Medianoche UTC (21:00 en Argentina): el período sigue terminando al
    # final del día argentino, no del UTC.
    late = period_bounds(7, datetime(2026, 10, 24, 1, 0, tzinfo=UTC))
    assert late.end == datetime(2026, 10, 24, 3, 0, tzinfo=UTC)
    with pytest.raises(ValueError):
        period_bounds(0, now)


async def test_period_metrics_compare_current_and_previous(client, session_factory):
    admin = await _make_admin(client, session_factory, "met_admin@test.com")
    employer = await _employer(client, "met_emp@test.com", "Bar Métricas")
    bounds = period_bounds(7, datetime.now(UTC))
    cur = bounds.current_start + timedelta(hours=2)
    prev = bounds.previous_start + timedelta(hours=2)

    # Período actual: 3 publicados, 2 cubiertos (a los 5 y a los 25 min).
    rapido = await _published_shift(client, employer)
    await _set(
        session_factory, rapido, published_at=cur, first_assigned_at=cur + timedelta(minutes=5)
    )
    lento = await _published_shift(client, employer)
    await _set(
        session_factory, lento, published_at=cur, first_assigned_at=cur + timedelta(minutes=25)
    )
    abierto = await _published_shift(client, employer)
    await _set(session_factory, abierto, published_at=cur)
    # Período anterior: 1 publicado, cubierto a los 8 min.
    viejo = await _published_shift(client, employer)
    await _set(
        session_factory, viejo, published_at=prev, first_assigned_at=prev + timedelta(minutes=8)
    )
    # Fuera de los dos períodos: no cuenta.
    fuera = await _published_shift(client, employer)
    await _set(session_factory, fuera, published_at=bounds.previous_start - timedelta(hours=1))

    # Postulaciones: 2 en el actual, 1 en el anterior.
    for i, shift_id in enumerate([rapido, lento, viejo]):
        worker = await _worker(client, f"met_w{i}@test.com")
        await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    async with session_factory() as session:
        await session.execute(
            update(ShiftApplicationModel)
            .where(ShiftApplicationModel.shift_id == UUID(viejo))
            .values(created_at=prev)
        )
        await session.commit()

    resp = await client.get("/api/v1/admin/period-metrics?period=7", headers=admin)
    assert resp.status_code == 200
    body = resp.json()
    assert body["days"] == 7
    current, previous = body["current"], body["previous"]
    assert current["shifts_published"] == 3
    assert current["shifts_covered"] == 2
    assert current["covered_pct"] == pytest.approx(66.67, abs=0.1)
    assert current["covered_under_10_min_pct"] == pytest.approx(50.0)
    assert current["avg_minutes_to_cover"] == pytest.approx(15.0, abs=0.1)
    assert current["applications"] == 2
    assert previous["shifts_published"] == 1
    assert previous["shifts_covered"] == 1
    assert previous["avg_minutes_to_cover"] == pytest.approx(8.0, abs=0.1)
    assert previous["covered_under_10_min_pct"] == pytest.approx(100.0)
    assert previous["applications"] == 1
    assert datetime.fromisoformat(previous["end"]) == datetime.fromisoformat(current["start"])


async def test_period_metrics_empty_period_has_no_rates(client, session_factory):
    admin = await _make_admin(client, session_factory, "met_vacio_admin@test.com")
    body = (await client.get("/api/v1/admin/period-metrics?period=30", headers=admin)).json()
    assert body["days"] == 30
    for summary in (body["current"], body["previous"]):
        assert summary["shifts_published"] == 0
        assert summary["covered_pct"] is None
        assert summary["avg_minutes_to_cover"] is None


async def test_period_metrics_rejects_other_periods(client, session_factory):
    admin = await _make_admin(client, session_factory, "met_422_admin@test.com")
    for bad in ("1", "14", "abc"):
        resp = await client.get(f"/api/v1/admin/period-metrics?period={bad}", headers=admin)
        assert resp.status_code == 422


async def test_period_metrics_query_count_is_constant(client, session_factory):
    admin = await _make_admin(client, session_factory, "met_n1_admin@test.com")
    employer = await _employer(client, "met_n1@test.com", "Bar N1")

    with _count_queries(session_factory) as empty:
        await client.get("/api/v1/admin/period-metrics?period=7", headers=admin)
    for i in range(4):
        shift_id = await _published_shift(client, employer)
        worker = await _worker(client, f"met_n1_w{i}@test.com")
        await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    with _count_queries(session_factory) as full:
        body = (await client.get("/api/v1/admin/period-metrics?period=7", headers=admin)).json()
    assert body["current"]["shifts_published"] == 4
    assert full["n"] == empty["n"]
