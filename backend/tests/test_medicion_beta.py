"""Medición de la beta (docs/planning/BETA_TABLERO.md, M1 a M5).

Definiciones (Julieta, 2026-11-17): **cubierto** = la persona confirmó
(`Shift.first_confirmed_at`), no que el comercio eligió; **cumplido** =
cubierto y con check-in; **aviso corto** = el turno empieza dentro de las 24 h
de publicado. Las cuentas de prueba e invitadas no cuentan."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.admin.application.periods import period_bounds
from app.modules.admin.application.services import TEST_ACCOUNTS
from app.modules.identity.application.services import GUEST_ACCOUNTS
from app.modules.identity.domain.value_objects import UserRole
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.worker.domain.value_objects import WorkerSkill
from tests.test_admin_vivo_metricas import (
    _employer,
    _make_admin,
    _published_shift,
    _set,
    _worker,
)

pytestmark = pytest.mark.asyncio

TEST_EMPLOYER_EMAIL = TEST_ACCOUNTS[UserRole.EMPLOYER][0]
GUEST_EMPLOYER_EMAIL = GUEST_ACCOUNTS[UserRole.EMPLOYER][0]


def _shift(**overrides) -> Shift:
    start = datetime.now(UTC) + timedelta(days=1)
    fields = {
        "company_id": uuid4(),
        "position": WorkerSkill.MOZO,
        "quantity": 1,
        "start_at": start,
        "end_at": start + timedelta(hours=6),
        "pay_amount": 70000,
        "city": "Palermo",
        "status": ShiftStatus.PUBLICADO,
    }
    fields.update(overrides)
    return Shift(**fields)


# --- Dominio ----------------------------------------------------------------


async def test_confirm_completa_first_confirmed_at_solo_la_primera_vez():
    shift = _shift(status=ShiftStatus.ASIGNADO, worker_profile_id=uuid4())
    assert shift.first_confirmed_at is None

    shift.confirm()
    primera = shift.first_confirmed_at
    assert primera is not None

    # La persona cancela, el turno se reabre y confirma otra: no se pisa.
    shift.worker_cancel()
    shift.assign(uuid4())
    assert shift.first_confirmed_at == primera
    shift.confirm()
    assert shift.first_confirmed_at == primera


async def test_asignar_no_completa_first_confirmed_at():
    shift = _shift()
    shift.assign(uuid4())
    assert shift.first_assigned_at is not None
    assert shift.first_confirmed_at is None


# --- Helpers ----------------------------------------------------------------


def _inside_current_window() -> datetime:
    bounds = period_bounds(7, datetime.now(UTC))
    return bounds.current_start + timedelta(hours=2)


async def _cubrir(
    session_factory: async_sessionmaker[AsyncSession],
    shift_id: str,
    *,
    published: datetime,
    minutes: float,
    notice_hours: float = 30,
    check_in: bool = False,
) -> None:
    """Deja el turno publicado en `published`, confirmado `minutes` después y
    empezando `notice_hours` después de publicarse."""
    start = published + timedelta(hours=notice_hours)
    fields = {
        "published_at": published,
        "first_confirmed_at": published + timedelta(minutes=minutes),
        "start_at": start,
        "end_at": start + timedelta(hours=6),
    }
    if check_in:
        fields["check_in_at"] = start
    await _set(session_factory, shift_id, **fields)


async def _period(client: AsyncClient, admin: dict, days: int = 7) -> dict:
    resp = await client.get(f"/api/v1/admin/period-metrics?period={days}", headers=admin)
    assert resp.status_code == 200
    return resp.json()


# --- Cubierto = confirmado ---------------------------------------------------


async def test_asignado_sin_confirmar_no_cuenta_como_cubierto(client, session_factory):
    admin = await _make_admin(client, session_factory, "mb_asig_admin@test.com")
    employer = await _employer(client, "mb_asig_emp@test.com", "Bar Asignado")
    cur = _inside_current_window()
    shift_id = await _published_shift(client, employer)
    # El comercio eligió a alguien (first_assigned_at) pero nadie confirmó.
    await _set(
        session_factory,
        shift_id,
        published_at=cur,
        first_assigned_at=cur + timedelta(minutes=3),
    )

    current = (await _period(client, admin))["current"]
    assert current["shifts_published"] == 1
    assert current["shifts_covered"] == 0
    assert current["covered_pct"] == pytest.approx(0.0)
    assert current["avg_minutes_to_cover"] is None
    assert current["median_minutes_to_cover"] is None
    assert current["companies_with_covered"] == 0

    stats = (await client.get("/api/v1/admin/stats", headers=admin)).json()
    assert stats["coverage_sample_size"] == 0
    assert stats["avg_time_to_fill_minutes"] is None
    # La asignación sigue medida aparte, como dato interno del embudo.
    assert stats["shift_assignment_rate_pct"] == pytest.approx(100.0)


async def test_confirmar_por_la_api_cubre_el_turno(client, session_factory):
    admin = await _make_admin(client, session_factory, "mb_api_admin@test.com")
    employer = await _employer(client, "mb_api_emp@test.com", "Bar API")
    worker = await _worker(client, "mb_api_w@test.com")
    profile = (await client.get("/api/v1/workers/me/profile", headers=worker)).json()
    shift_id = await _published_shift(client, employer)

    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": profile["id"]},
    )
    antes = (await _period(client, admin))["current"]
    assert antes["shifts_covered"] == 0

    assert (await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker)).status_code == 200
    despues = (await _period(client, admin))["current"]
    assert despues["shifts_covered"] == 1
    assert despues["covered_under_10_min_pct"] == pytest.approx(100.0)


# --- Mediana, aviso corto, cumplidos, locales --------------------------------


async def test_mediana_aviso_corto_cumplidos_y_locales(client, session_factory):
    admin = await _make_admin(client, session_factory, "mb_met_admin@test.com")
    bar_a = await _employer(client, "mb_met_a@test.com", "Bar A")
    bar_b = await _employer(client, "mb_met_b@test.com", "Bar B")
    bar_c = await _employer(client, "mb_met_c@test.com", "Bar C")
    cur = _inside_current_window()

    # Bar A: 3 cubiertos (2, 4 y 60 min). El de 4 min tiene aviso corto (5 h)
    # y fue cumplido; el de 2 min también es aviso corto (23,5 h) pero no
    # se cumplió; el de 60 min es de aviso largo (3 días) y se cumplió.
    a1 = await _published_shift(client, bar_a)
    await _cubrir(session_factory, a1, published=cur, minutes=4, notice_hours=5, check_in=True)
    a2 = await _published_shift(client, bar_a)
    await _cubrir(session_factory, a2, published=cur, minutes=2, notice_hours=23.5)
    a3 = await _published_shift(client, bar_a)
    await _cubrir(session_factory, a3, published=cur, minutes=60, notice_hours=72, check_in=True)
    # Bar B: uno cubierto con aviso corto pero lento (30 min) y uno abierto.
    b1 = await _published_shift(client, bar_b)
    await _cubrir(session_factory, b1, published=cur, minutes=30, notice_hours=10)
    b2 = await _published_shift(client, bar_b)
    await _set(session_factory, b2, published_at=cur)
    # Bar C: publicó pero no se le cubrió nada.
    c1 = await _published_shift(client, bar_c)
    await _set(session_factory, c1, published_at=cur)

    current = (await _period(client, admin))["current"]
    assert current["shifts_published"] == 6
    assert current["shifts_covered"] == 4
    # Minutos de los cubiertos: 2, 4, 30, 60 -> mediana 17 (el promedio es 24).
    assert current["median_minutes_to_cover"] == pytest.approx(17.0, abs=0.1)
    assert current["avg_minutes_to_cover"] == pytest.approx(24.0, abs=0.1)
    # Aviso corto (<= 24 h): a1, a2 y b1; dos en menos de 10 min.
    assert current["short_notice_covered"] == 3
    assert current["short_notice_under_10_min_pct"] == pytest.approx(66.67, abs=0.1)
    # Cumplidos: a1 y a3, sobre 4 cubiertos.
    assert current["fulfilled"] == 2
    assert current["fulfilled_pct"] == pytest.approx(50.0)
    # Locales: tres publicaron, dos tuvieron un turno cubierto.
    assert current["active_companies"] == 3
    assert current["companies_with_covered"] == 2


async def test_periodo_vacio_no_inventa_porcentajes(client, session_factory):
    admin = await _make_admin(client, session_factory, "mb_vacio_admin@test.com")
    body = await _period(client, admin, 30)
    for summary in (body["current"], body["previous"]):
        assert summary["median_minutes_to_cover"] is None
        assert summary["short_notice_under_10_min_pct"] is None
        assert summary["fulfilled_pct"] is None
        assert summary["active_companies"] == 0
        assert summary["companies_with_covered"] == 0


async def test_period_metrics_mantiene_constante_la_cantidad_de_consultas_con_mediana(
    client, session_factory
):
    from tests.test_shift import _count_queries

    admin = await _make_admin(client, session_factory, "mb_n1_admin@test.com")
    employer = await _employer(client, "mb_n1_emp@test.com", "Bar N1")
    with _count_queries(session_factory) as empty:
        await client.get("/api/v1/admin/period-metrics?period=7", headers=admin)
    cur = _inside_current_window()
    for _ in range(4):
        shift_id = await _published_shift(client, employer)
        await _cubrir(session_factory, shift_id, published=cur, minutes=5)
    with _count_queries(session_factory) as full:
        body = (await client.get("/api/v1/admin/period-metrics?period=7", headers=admin)).json()
    assert body["current"]["shifts_covered"] == 4
    assert full["n"] == empty["n"]


# --- M1: cuentas de prueba e invitadas ---------------------------------------


async def test_cuentas_de_prueba_e_invitadas_no_cuentan(client, session_factory):
    admin = await _make_admin(client, session_factory, "mb_excl_admin@test.com")
    real = await _employer(client, "mb_excl_real@test.com", "Bar Real")
    prueba = await _employer(client, TEST_EMPLOYER_EMAIL, "Prueba · Comercio")
    invitado = await _employer(client, GUEST_EMPLOYER_EMAIL, "Invitado · Comercio")
    cur = _inside_current_window()

    r = await _published_shift(client, real)
    await _cubrir(session_factory, r, published=cur, minutes=5, check_in=True)
    for headers in (prueba, invitado):
        # Cada una publica y cubre un turno, y lo repite a los pocos días.
        for dias in (0, 2):
            sid = await _published_shift(client, headers)
            await _cubrir(
                session_factory,
                sid,
                published=cur + timedelta(days=dias),
                minutes=1,
                check_in=True,
            )

    current = (await _period(client, admin))["current"]
    assert current["shifts_published"] == 1
    assert current["shifts_covered"] == 1
    assert current["fulfilled"] == 1
    assert current["active_companies"] == 1
    assert current["companies_with_covered"] == 1
    assert current["avg_minutes_to_cover"] == pytest.approx(5.0, abs=0.1)

    stats = (await client.get("/api/v1/admin/stats", headers=admin)).json()
    assert stats["coverage_sample_size"] == 1
    assert stats["avg_time_to_fill_minutes"] == pytest.approx(5.0, abs=0.1)
    assert stats["shift_assignment_rate_sample_size"] == 1
    assert stats["shift_completion_rate_sample_size"] == 1
    # Todos se cubrieron hace menos de 30 días: todavía no entran en la
    # muestra de «vuelven a publicar» (la exclusión de ésa se prueba abajo).
    assert stats["employer_return_30d_sample_size"] == 0
    assert stats["employer_return_30d_rate_pct"] is None


# --- M5: comercios que vuelven a publicar (30 días) --------------------------


async def test_comercios_que_vuelven_a_publicar_en_30_dias(client, session_factory):
    admin = await _make_admin(client, session_factory, "mb_vuelve_admin@test.com")
    t0 = datetime.now(UTC) - timedelta(days=60)

    vuelve = await _employer(client, "mb_vuelve_si@test.com", "Bar Vuelve")
    tarde = await _employer(client, "mb_vuelve_tarde@test.com", "Bar Tarde")
    sin_cubrir = await _employer(client, "mb_vuelve_nada@test.com", "Bar Sin Cubrir")
    solo_uno = await _employer(client, "mb_vuelve_uno@test.com", "Bar Solo Uno")

    # Vuelve: cubierto, y publica otro a los 10 días de la primera confirmación.
    s1 = await _published_shift(client, vuelve)
    await _cubrir(session_factory, s1, published=t0, minutes=5)
    s2 = await _published_shift(client, vuelve)
    await _set(session_factory, s2, published_at=t0 + timedelta(days=10))

    # Vuelve tarde: el segundo turno es a los 45 días, fuera de la ventana.
    s3 = await _published_shift(client, tarde)
    await _cubrir(session_factory, s3, published=t0, minutes=5)
    s4 = await _published_shift(client, tarde)
    await _set(session_factory, s4, published_at=t0 + timedelta(days=45))

    # Publicó dos veces pero nunca se le cubrió nada: no entra en la muestra
    # (el viejo «2 o más turnos publicados» sí la contaba).
    for dias in (0, 3):
        s = await _published_shift(client, sin_cubrir)
        await _set(session_factory, s, published_at=t0 + timedelta(days=dias))

    # Cubierto una sola vez, sin otro turno.
    s5 = await _published_shift(client, solo_uno)
    await _cubrir(session_factory, s5, published=t0, minutes=5)

    # La cuenta de prueba vuelve a publicar, pero no entra en la muestra.
    prueba = await _employer(client, TEST_EMPLOYER_EMAIL, "Prueba · Comercio")
    p1 = await _published_shift(client, prueba)
    await _cubrir(session_factory, p1, published=t0, minutes=5)
    p2 = await _published_shift(client, prueba)
    await _set(session_factory, p2, published_at=t0 + timedelta(days=5))

    # Cubierto hace 5 días y sin otro turno: todavía puede volver, no cuenta.
    reciente = await _employer(client, "mb_vuelve_reciente@test.com", "Bar Reciente")
    s6 = await _published_shift(client, reciente)
    await _cubrir(session_factory, s6, published=datetime.now(UTC) - timedelta(days=5), minutes=5)

    stats = (await client.get("/api/v1/admin/stats", headers=admin)).json()
    assert stats["employer_return_30d_sample_size"] == 3  # vuelve, tarde, solo_uno
    assert stats["employer_return_30d_rate_pct"] == pytest.approx(33.33, abs=0.1)
    assert "employer_repeat_sample_size" not in stats


async def test_publicar_antes_de_la_primera_confirmacion_no_cuenta_como_volver(
    client, session_factory
):
    admin = await _make_admin(client, session_factory, "mb_antes_admin@test.com")
    employer = await _employer(client, "mb_antes_emp@test.com", "Bar Antes")
    t0 = datetime.now(UTC) - timedelta(days=40)
    # Dos turnos publicados juntos; el primero se confirma, pero el otro se
    # publicó ANTES de esa confirmación: no es «volver».
    a = await _published_shift(client, employer)
    await _cubrir(session_factory, a, published=t0, minutes=60)
    b = await _published_shift(client, employer)
    await _set(session_factory, b, published_at=t0 + timedelta(minutes=10))

    stats = (await client.get("/api/v1/admin/stats", headers=admin)).json()
    assert stats["employer_return_30d_sample_size"] == 1
    assert stats["employer_return_30d_rate_pct"] == pytest.approx(0.0)
