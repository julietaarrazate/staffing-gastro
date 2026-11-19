"""Serie semanal M7 (docs/planning/BETA_TABLERO.md, «Antes de abrir: medir
la beta»): `GET /admin/weekly-metrics`.

Semanas de lunes a domingo en hora argentina, la de hoy incluida y marcada
«en curso», de la más vieja a la más nueva. Mismas definiciones que
`period-metrics` (cubierto = la persona confirmó; cumplido = cubierto y con
llegada), con cada turno en la semana en que se publicó, y las altas de cada
semana por origen y por rol.
"""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from app.core.tz import ARG_TZ
from app.modules.admin.application.periods import MAX_WEEKS, week_bounds
from tests.conftest import auth_headers, register_user
from tests.test_admin_vivo_metricas import (
    _employer,
    _make_admin,
    _published_shift,
    _set,
)
from tests.test_origen_alta import _set_created_at
from tests.test_shift import _count_queries

pytestmark = pytest.mark.asyncio


# --- Cortes de semana -----------------------------------------------------------


async def test_las_semanas_van_de_lunes_a_lunes_en_hora_argentina():
    # Jueves 19/11/2026, 15:00 en Argentina: la semana empieza el lunes 16.
    jueves = datetime(2026, 11, 19, 15, 0, tzinfo=ARG_TZ)
    [(inicio, fin)] = week_bounds(1, jueves)
    assert inicio == datetime(2026, 11, 16, 3, 0, tzinfo=UTC)  # lunes 00:00 ART
    assert fin == datetime(2026, 11, 23, 3, 0, tzinfo=UTC)

    tres = week_bounds(3, jueves)
    assert [i for i, _ in tres] == [
        datetime(2026, 11, 2, 3, 0, tzinfo=UTC),
        datetime(2026, 11, 9, 3, 0, tzinfo=UTC),
        datetime(2026, 11, 16, 3, 0, tzinfo=UTC),
    ]
    # Contiguas: cada una termina donde empieza la siguiente.
    assert all(fin == sig for (_, fin), (sig, _) in zip(tres, tres[1:], strict=False))


async def test_el_domingo_a_la_noche_sigue_siendo_la_misma_semana():
    # Domingo 22/11 a las 23:30 en Argentina ya es lunes en UTC: la semana
    # sigue siendo la del lunes 16 (el corte es la medianoche argentina).
    domingo = datetime(2026, 11, 23, 2, 30, tzinfo=UTC)
    [(inicio, _)] = week_bounds(1, domingo)
    assert inicio == datetime(2026, 11, 16, 3, 0, tzinfo=UTC)
    # Lunes 23/11 a las 00:10 en Argentina: semana nueva.
    lunes = datetime(2026, 11, 23, 3, 10, tzinfo=UTC)
    [(inicio, _)] = week_bounds(1, lunes)
    assert inicio == datetime(2026, 11, 23, 3, 0, tzinfo=UTC)


@pytest.mark.parametrize("semanas", [0, MAX_WEEKS + 1])
async def test_semanas_fuera_de_rango(semanas):
    with pytest.raises(ValueError):
        week_bounds(semanas, datetime(2026, 11, 19, 15, 0, tzinfo=ARG_TZ))


# --- API ------------------------------------------------------------------------


async def test_solo_admin(client: AsyncClient):
    comercio = await auth_headers(client, "employer", "sem_noadmin@test.com")
    resp = await client.get("/api/v1/admin/weekly-metrics", headers=comercio)
    assert resp.status_code == 403


@pytest.mark.parametrize("semanas", ["0", str(MAX_WEEKS + 1), "abc"])
async def test_rechaza_semanas_fuera_de_rango(client: AsyncClient, session_factory, semanas):
    admin = await _make_admin(client, session_factory, f"sem_422_{semanas}@test.com")
    resp = await client.get(f"/api/v1/admin/weekly-metrics?weeks={semanas}", headers=admin)
    assert resp.status_code == 422


async def test_por_defecto_doce_semanas_y_la_ultima_en_curso(client: AsyncClient, session_factory):
    admin = await _make_admin(client, session_factory, "sem_def_admin@test.com")
    body = (await client.get("/api/v1/admin/weekly-metrics", headers=admin)).json()
    semanas = body["weeks"]
    assert len(semanas) == 12
    assert [s["in_progress"] for s in semanas] == [False] * 11 + [True]
    vacia = semanas[0]
    assert vacia["shifts_published"] == 0
    assert vacia["covered_pct"] is None and vacia["median_minutes_to_cover"] is None
    assert vacia["signups_by_origin"] == []


async def test_cada_turno_cuenta_en_la_semana_en_que_se_publico(
    client: AsyncClient, session_factory
):
    admin = await _make_admin(client, session_factory, "sem_admin@test.com")
    bar = await _employer(client, "sem_bar@test.com", "Bar Semanas")
    resto = await _employer(client, "sem_resto@test.com", "Resto Semanas")
    semanas = week_bounds(3, datetime.now(UTC))
    hace_dos = semanas[0][0] + timedelta(hours=2)
    pasada = semanas[1][0] + timedelta(hours=2)

    # Hace dos semanas: el bar publica dos; uno se cubre a los 6 min, con llegada.
    cumplido = await _published_shift(client, bar)
    await _set(
        session_factory,
        cumplido,
        published_at=hace_dos,
        first_confirmed_at=hace_dos + timedelta(minutes=6),
        check_in_at=hace_dos + timedelta(hours=3),
    )
    sin_cubrir = await _published_shift(client, bar)
    await _set(session_factory, sin_cubrir, published_at=hace_dos)
    # La semana pasada: el resto publica uno, cubierto a los 20 min, sin llegada.
    cubierto = await _published_shift(client, resto)
    await _set(
        session_factory,
        cubierto,
        published_at=pasada,
        first_confirmed_at=pasada + timedelta(minutes=20),
    )
    # Antes de la serie: no cuenta.
    viejo = await _published_shift(client, bar)
    await _set(session_factory, viejo, published_at=semanas[0][0] - timedelta(hours=1))

    resp = await client.get("/api/v1/admin/weekly-metrics?weeks=3", headers=admin)

    assert resp.status_code == 200, resp.text
    s0, s1, s2 = resp.json()["weeks"]
    assert [datetime.fromisoformat(s["start"]) for s in (s0, s1, s2)] == [i for i, _ in semanas]
    assert (s0["in_progress"], s1["in_progress"], s2["in_progress"]) == (False, False, True)

    assert (s0["shifts_published"], s0["shifts_covered"], s0["fulfilled"]) == (2, 1, 1)
    assert s0["covered_pct"] == pytest.approx(50.0)
    assert s0["fulfilled_pct"] == pytest.approx(100.0)
    assert s0["median_minutes_to_cover"] == pytest.approx(6.0, abs=0.1)
    assert (s0["active_companies"], s0["companies_with_covered"]) == (1, 1)
    # Publicado con 24 h de aviso (`_payload` empieza mañana): no es aviso corto.
    assert s0["short_notice_covered"] == 0
    assert s0["short_notice_under_10_min_pct"] is None

    assert (s1["shifts_published"], s1["shifts_covered"], s1["fulfilled"]) == (1, 1, 0)
    assert s1["fulfilled_pct"] == pytest.approx(0.0)
    assert s1["median_minutes_to_cover"] == pytest.approx(20.0, abs=0.1)
    assert (s1["active_companies"], s1["companies_with_covered"]) == (1, 1)

    # Los turnos que se crearon recién (sin mover) quedan en la semana en curso
    # sólo si se publicaron en ella: acá los cuatro se movieron.
    assert s2["shifts_published"] == 0


async def test_la_semana_coincide_con_metricas_del_periodo(client: AsyncClient, session_factory):
    """Las dos pantallas cuentan igual: una semana entera dentro de «Últimos
    30 días» suma lo mismo que la serie para esa semana."""
    admin = await _make_admin(client, session_factory, "sem_igual_admin@test.com")
    bar = await _employer(client, "sem_igual@test.com", "Bar Igual")
    [(inicio, fin), _] = week_bounds(2, datetime.now(UTC))
    for minutos in (3, 12, 40):
        shift_id = await _published_shift(client, bar)
        cuando = inicio + timedelta(days=1)
        await _set(
            session_factory,
            shift_id,
            published_at=cuando,
            first_confirmed_at=cuando + timedelta(minutes=minutos),
        )

    semana = (
        await client.get("/api/v1/admin/weekly-metrics?weeks=2", headers=admin)
    ).json()["weeks"][0]
    periodo = (
        await client.get("/api/v1/admin/period-metrics?period=30", headers=admin)
    ).json()["current"]

    for campo in ("shifts_published", "shifts_covered", "covered_pct", "median_minutes_to_cover"):
        assert semana[campo] == periodo[campo], campo
    assert datetime.fromisoformat(semana["end"]) == fin


async def test_altas_de_cada_semana_por_origen_y_rol(client: AsyncClient, session_factory):
    admin = await _make_admin(client, session_factory, "sem_altas_admin@test.com")
    semanas = week_bounds(2, datetime.now(UTC))
    pasada = semanas[0][0] + timedelta(days=2)
    esta = semanas[1][0] + timedelta(minutes=30)

    altas = [
        ("sem_a1@test.com", "worker", {"ref": "ig"}, pasada),
        ("sem_a2@test.com", "worker", {"ref": "ig"}, pasada),
        ("sem_a3@test.com", "employer", {"ref": "ig"}, pasada),
        ("sem_a4@test.com", "employer", None, pasada),
        ("sem_a5@test.com", "worker", {"utm_source": "volante"}, esta),
    ]
    for email, rol, origen, creada in altas:
        resp = await register_user(client, email=email, role=rol, origen=origen)
        assert resp.status_code == 201, resp.text
        await _set_created_at(session_factory, email, creada)

    s0, s1 = (
        await client.get("/api/v1/admin/weekly-metrics?weeks=2", headers=admin)
    ).json()["weeks"]

    assert (s0["signups_workers"], s0["signups_companies"]) == (2, 2)
    assert s0["signups_by_origin"] == [
        {"origin": "ig", "workers": 2, "companies": 1, "total": 3},
        {"origin": "directo", "workers": 0, "companies": 1, "total": 1},
    ]
    assert (s1["signups_workers"], s1["signups_companies"]) == (1, 0)
    assert s1["signups_by_origin"] == [
        {"origin": "volante", "workers": 1, "companies": 0, "total": 1},
    ]


async def test_cantidad_de_consultas_no_crece_con_los_turnos(
    client: AsyncClient, session_factory
):
    admin = await _make_admin(client, session_factory, "sem_n1_admin@test.com")
    bar = await _employer(client, "sem_n1@test.com", "Bar N1 Semanas")

    with _count_queries(session_factory) as vacio:
        await client.get("/api/v1/admin/weekly-metrics?weeks=4", headers=admin)
    for _ in range(5):
        await _published_shift(client, bar)
    with _count_queries(session_factory) as lleno:
        body = (await client.get("/api/v1/admin/weekly-metrics?weeks=4", headers=admin)).json()
    assert body["weeks"][-1]["shifts_published"] == 5
    assert lleno["n"] == vacio["n"]
