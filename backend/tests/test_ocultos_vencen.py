"""Los turnos ocultos de un comercio suspendido vencen igual (decisión 22 de
Julieta, 2026-11-18; ADR-0024 y ADR-0015):

1. Dominio: `Shift.mark_not_covered` guarda si la cuenta estaba suspendida.
2. Caso de uso y scheduler: con el comercio suspendido el turno pasa a «no
   cubierto», queda marcado y no sale ningún aviso (ni en la app, ni push, ni
   mail). Con la cuenta activa, todo como antes.
3. Reactivar no deshace nada: el turno sigue marcado y sin aviso.
4. Métricas de cobertura: los turnos marcados quedan fuera del numerador y
   del denominador; los conteos de actividad no cambian.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient

from app.modules.admin.application.periods import period_bounds
from app.modules.notification.domain.entities import PushSubscription
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.notification.infrastructure.fake_push_sender import FakePushSender
from app.modules.notification.infrastructure.push_tasks import drain_pending_pushes
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
    SqlAlchemyPushSubscriptionRepository,
)
from app.modules.shift.application import scheduler
from app.modules.shift.application.services import NOT_COVERED_GRACE_NORMAL
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.exceptions import InvalidShiftTransitionError
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.worker.domain.value_objects import WorkerSkill
from tests.conftest import make_admin
from tests.test_admin_vivo_metricas import _published_shift, _set
from tests.test_cuentas_suspendidas import (
    _assign,
    _employer,
    _suspend,
    _user_id,
    _worker,
)

pytestmark = pytest.mark.asyncio

VENCIDO = NOT_COVERED_GRACE_NORMAL + timedelta(minutes=1)


# --- 1. Dominio ---------------------------------------------------------------


def _turno(status: ShiftStatus) -> Shift:
    inicio = datetime.now(UTC) - timedelta(hours=3)
    return Shift(
        id=uuid4(),
        company_id=uuid4(),
        position=WorkerSkill.MOZO,
        quantity=1,
        start_at=inicio,
        end_at=inicio + timedelta(hours=5),
        pay_amount=Decimal("1000"),
        status=status,
    )


@pytest.mark.parametrize(
    "status",
    [ShiftStatus.PUBLICADO, ShiftStatus.BUSCANDO_PERSONAL, ShiftStatus.ASIGNADO],
)
async def test_dominio_vencer_con_la_cuenta_suspendida_deja_la_marca(status):
    turno = _turno(status)
    assert turno.not_covered_while_suspended is False

    turno.mark_not_covered(company_suspended=True)

    assert turno.status == ShiftStatus.NO_CUBIERTO
    assert turno.not_covered_while_suspended is True


async def test_dominio_vencer_con_la_cuenta_activa_no_marca():
    turno = _turno(ShiftStatus.PUBLICADO)

    turno.mark_not_covered()

    assert turno.status == ShiftStatus.NO_CUBIERTO
    assert turno.not_covered_while_suspended is False


async def test_dominio_una_transicion_invalida_no_deja_la_marca():
    turno = _turno(ShiftStatus.CONFIRMADO)

    with pytest.raises(InvalidShiftTransitionError):
        turno.mark_not_covered(company_suspended=True)

    assert turno.status == ShiftStatus.CONFIRMADO
    assert turno.not_covered_while_suspended is False


# --- Helpers de los casos con base --------------------------------------------


class _MailEspia:
    """Guarda lo que el scheduler hubiera mandado por mail."""

    enviados: list[tuple[str, str]] = []

    async def send(self, to: str, subject: str, html: str) -> None:
        type(self).enviados.append((to, subject))


def _canales_espiados(monkeypatch, session_factory) -> FakePushSender:
    """El scheduler sobre la base del test, con push y mail a la vista."""
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    _MailEspia.enviados = []
    monkeypatch.setattr(scheduler, "NullEmailSender", _MailEspia)
    push = FakePushSender()
    monkeypatch.setattr(
        "app.modules.notification.infrastructure.repositories._get_push_sender",
        lambda: push,
    )
    return push


async def _con_push(client: AsyncClient, session_factory, headers: dict, nombre: str) -> UUID:
    """Le da a la cuenta un dispositivo con avisos push. Devuelve su id."""
    user_id = UUID((await client.get("/api/v1/auth/me", headers=headers)).json()["id"])
    async with session_factory() as session:
        await SqlAlchemyPushSubscriptionRepository(session).add(
            PushSubscription(
                user_id=user_id,
                endpoint=f"https://fcm.googleapis.com/fcm/send/ocultos-{nombre}",
                p256dh_key="clave-p",
                auth_key="clave-a",
            )
        )
    return user_id


async def _avisos(session_factory, user_id: UUID) -> list[NotificationType]:
    async with session_factory() as session:
        saved = await SqlAlchemyNotificationRepository(session).list_by_user(user_id)
    return [n.type for n in saved]


async def _turno_en_base(session_factory, shift_id: str) -> ShiftModel:
    async with session_factory() as session:
        return await session.get(ShiftModel, UUID(shift_id))


async def _ya_empezo(session_factory, shift_id: str, hace: timedelta = VENCIDO) -> None:
    """Corre el horario del turno para atrás: empezó hace `hace`."""
    inicio = datetime.now(UTC) - hace
    await _set(session_factory, shift_id, start_at=inicio, end_at=inicio + timedelta(hours=6))


# --- 2. Caso de uso y scheduler -----------------------------------------------


async def test_comercio_suspendido_el_turno_oculto_vence_marcado_y_sin_ningun_aviso(
    client, session_factory, monkeypatch
):
    admin = await make_admin(client, session_factory, "ov1_admin@test.com")
    comercio = await _employer(client, "ov1_bar@test.com")
    comercio_id = await _con_push(client, session_factory, comercio, "bar-suspendido")
    ana, ana_perfil = await _worker(client, "ov1_ana@test.com", "Ana Postulante")
    ana_id = await _con_push(client, session_factory, ana, "ana")

    abierto = await _published_shift(client, comercio, title="Abierto y oculto")
    # Asignado sin confirmar cuya hora ya pasó: la suspensión no lo toca
    # (ADR-0024, punto 3), así que también le toca vencer.
    asignado = await _published_shift(client, comercio, title="Asignado sin confirmar")
    assert (await _assign(client, asignado, comercio, ana_perfil)).status_code == 200
    for shift_id in (abierto, asignado):
        await _ya_empezo(session_factory, shift_id)
    assert (await _suspend(client, admin, "ov1_bar@test.com")).status_code == 200
    antes_comercio = await _avisos(session_factory, comercio_id)
    antes_ana = await _avisos(session_factory, ana_id)
    await drain_pending_pushes()

    push = _canales_espiados(monkeypatch, session_factory)
    await scheduler.run_coverage_check()
    await drain_pending_pushes()

    for shift_id in (abierto, asignado):
        turno = await _turno_en_base(session_factory, shift_id)
        assert turno.status == "no_cubierto"
        assert turno.not_covered_while_suspended is True
    # Ni en la app, ni push, ni mail: a la cuenta suspendida y a nadie más.
    assert await _avisos(session_factory, comercio_id) == antes_comercio
    assert NotificationType.SHIFT_NOT_COVERED not in antes_comercio
    assert await _avisos(session_factory, ana_id) == antes_ana
    assert push.sent == []
    assert _MailEspia.enviados == []


async def test_comercio_activo_el_turno_vence_como_siempre_con_su_aviso(
    client, session_factory, monkeypatch
):
    comercio = await _employer(client, "ov2_bar@test.com")
    comercio_id = await _con_push(client, session_factory, comercio, "bar-activo")
    shift_id = await _published_shift(client, comercio, title="Nadie lo tomó")
    await _ya_empezo(session_factory, shift_id)

    push = _canales_espiados(monkeypatch, session_factory)
    await scheduler.run_coverage_check()
    await drain_pending_pushes()

    turno = await _turno_en_base(session_factory, shift_id)
    assert turno.status == "no_cubierto"
    assert turno.not_covered_while_suspended is False
    avisos = await client.get("/api/v1/notifications", headers=comercio)
    no_cubierto = [n for n in avisos.json() if n["type"] == "shift_not_covered"]
    assert [n["title"] for n in no_cubierto] == ["Un turno quedó sin cubrir"]
    assert [s.user_id for s in push.sent] == [comercio_id]


async def test_solo_vence_sin_aviso_el_del_comercio_suspendido(
    client, session_factory, monkeypatch
):
    """Una misma pasada con un comercio suspendido y otro activo."""
    admin = await make_admin(client, session_factory, "ov3_admin@test.com")
    suspendido = await _employer(client, "ov3_susp@test.com")
    suspendido_id = await _con_push(client, session_factory, suspendido, "ov3-susp")
    activo = await _employer(client, "ov3_act@test.com")
    activo_id = await _con_push(client, session_factory, activo, "ov3-act")
    del_suspendido = await _published_shift(client, suspendido)
    del_activo = await _published_shift(client, activo)
    for shift_id in (del_suspendido, del_activo):
        await _ya_empezo(session_factory, shift_id)
    assert (await _suspend(client, admin, "ov3_susp@test.com")).status_code == 200
    await drain_pending_pushes()

    push = _canales_espiados(monkeypatch, session_factory)
    await scheduler.run_coverage_check()
    await drain_pending_pushes()

    assert (await _turno_en_base(session_factory, del_suspendido)).not_covered_while_suspended
    assert not (await _turno_en_base(session_factory, del_activo)).not_covered_while_suspended
    assert NotificationType.SHIFT_NOT_COVERED not in await _avisos(session_factory, suspendido_id)
    assert NotificationType.SHIFT_NOT_COVERED in await _avisos(session_factory, activo_id)
    assert [s.user_id for s in push.sent] == [activo_id]


async def test_comercio_suspendido_el_turno_que_todavia_no_vencio_no_se_toca(
    client, session_factory, monkeypatch
):
    admin = await make_admin(client, session_factory, "ov4_admin@test.com")
    comercio = await _employer(client, "ov4_bar@test.com")
    en_gracia = await _published_shift(client, comercio, title="Todavía en gracia")
    await _ya_empezo(session_factory, en_gracia, hace=timedelta(minutes=10))
    futuro = await _published_shift(client, comercio, title="Empieza mañana")
    assert (await _suspend(client, admin, "ov4_bar@test.com")).status_code == 200

    _canales_espiados(monkeypatch, session_factory)
    await scheduler.run_coverage_check()

    for shift_id in (en_gracia, futuro):
        turno = await _turno_en_base(session_factory, shift_id)
        assert turno.status == "publicado"
        assert turno.not_covered_while_suspended is False


# --- 3. Reactivar no deshace nada ---------------------------------------------


async def test_reactivar_despues_no_devuelve_el_turno_a_las_metricas_ni_avisa(
    client, session_factory, monkeypatch
):
    admin = await make_admin(client, session_factory, "ov5_admin@test.com")
    comercio = await _employer(client, "ov5_bar@test.com")
    comercio_id = await _con_push(client, session_factory, comercio, "bar-reactivado")
    shift_id = await _published_shift(client, comercio, title="Venció oculto")
    await _ya_empezo(session_factory, shift_id)
    assert (await _suspend(client, admin, "ov5_bar@test.com")).status_code == 200
    push = _canales_espiados(monkeypatch, session_factory)
    await scheduler.run_coverage_check()

    user_id = await _user_id(client, admin, "ov5_bar@test.com")
    activated = await client.post(f"/api/v1/admin/users/{user_id}/activate", headers=admin)
    assert activated.status_code == 200
    # Otra pasada con la cuenta ya activa: el turno ya está resuelto.
    await scheduler.run_coverage_check()
    await drain_pending_pushes()

    turno = await _turno_en_base(session_factory, shift_id)
    assert turno.status == "no_cubierto"
    assert turno.not_covered_while_suspended is True
    assert NotificationType.SHIFT_NOT_COVERED not in await _avisos(session_factory, comercio_id)
    assert push.sent == []
    # Sigue fuera de las métricas de cobertura aunque la cuenta esté activa.
    metricas = await client.get("/api/v1/admin/period-metrics?period=7", headers=admin)
    assert metricas.json()["current"]["shifts_published"] == 0
    assert metricas.json()["current"]["covered_pct"] is None
    stats = (await client.get("/api/v1/admin/stats", headers=admin)).json()
    assert stats["shift_assignment_rate_sample_size"] == 0
    assert stats["shift_assignment_rate_pct"] is None


# --- 4. Métricas de cobertura -------------------------------------------------


async def _marcar(session_factory, *shift_ids: str) -> None:
    for shift_id in shift_ids:
        await _set(
            session_factory, shift_id, status="no_cubierto", not_covered_while_suspended=True
        )


async def test_metricas_del_periodo_sin_los_turnos_marcados(client, session_factory):
    admin = await make_admin(client, session_factory, "ov6_admin@test.com")
    bar = await _employer(client, "ov6_bar@test.com")
    cafe = await _employer(client, "ov6_cafe@test.com")
    bounds = period_bounds(7, datetime.now(UTC))
    cur = bounds.current_start + timedelta(hours=2)
    prev = bounds.previous_start + timedelta(hours=2)

    def _cubierto(publicado: datetime, minutos: int) -> dict:
        return {
            "published_at": publicado,
            "first_confirmed_at": publicado + timedelta(minutes=minutos),
            # Aviso corto: empieza a las 3 h de publicado.
            "start_at": publicado + timedelta(hours=3),
            "end_at": publicado + timedelta(hours=9),
        }

    # Del bar, período actual: uno cubierto a los 20 min (con llegada) y uno
    # que nadie tomó.
    lento = await _published_shift(client, bar)
    await _set(session_factory, lento, **_cubierto(cur, 20), check_in_at=cur + timedelta(hours=3))
    abierto = await _published_shift(client, bar)
    await _set(session_factory, abierto, published_at=cur)
    # Del café, período actual: dos que después van a quedar marcados. Uno
    # llegó a tener a alguien confirmado (a los 4 min, con llegada marcada
    # por error de datos: igual no cuenta) y el otro nunca tuvo a nadie.
    cafe_confirmado = await _published_shift(client, cafe)
    await _set(
        session_factory,
        cafe_confirmado,
        **_cubierto(cur, 4),
        check_in_at=cur + timedelta(hours=3),
    )
    cafe_abierto = await _published_shift(client, cafe)
    await _set(session_factory, cafe_abierto, published_at=cur)
    # Del café, período anterior: uno cubierto a los 6 min que también se marca.
    cafe_viejo = await _published_shift(client, cafe)
    await _set(session_factory, cafe_viejo, **_cubierto(prev, 6))

    async def _metricas() -> tuple[dict, dict]:
        resp = await client.get("/api/v1/admin/period-metrics?period=7", headers=admin)
        assert resp.status_code == 200, resp.text
        return resp.json()["current"], resp.json()["previous"]

    # Sin marcas: los cinco cuentan.
    actual, anterior = await _metricas()
    assert actual["shifts_published"] == 4
    assert actual["shifts_covered"] == 2
    assert actual["covered_pct"] == pytest.approx(50.0)
    assert actual["covered_under_10_min_pct"] == pytest.approx(50.0)
    assert actual["avg_minutes_to_cover"] == pytest.approx(12.0, abs=0.1)
    assert actual["median_minutes_to_cover"] == pytest.approx(12.0, abs=0.1)
    assert actual["short_notice_covered"] == 2
    assert actual["short_notice_under_10_min_pct"] == pytest.approx(50.0)
    assert actual["fulfilled"] == 2
    assert actual["fulfilled_pct"] == pytest.approx(100.0)
    assert actual["active_companies"] == 2
    assert actual["companies_with_covered"] == 2
    assert anterior["shifts_published"] == 1
    assert anterior["shifts_covered"] == 1
    assert anterior["covered_under_10_min_pct"] == pytest.approx(100.0)

    await _marcar(session_factory, cafe_confirmado, cafe_abierto, cafe_viejo)

    # Con marcas: sólo quedan los dos del bar, arriba y abajo de cada tasa.
    actual, anterior = await _metricas()
    assert actual["shifts_published"] == 2
    assert actual["shifts_covered"] == 1
    assert actual["covered_pct"] == pytest.approx(50.0)
    assert actual["covered_under_10_min_pct"] == pytest.approx(0.0)
    assert actual["avg_minutes_to_cover"] == pytest.approx(20.0, abs=0.1)
    assert actual["median_minutes_to_cover"] == pytest.approx(20.0, abs=0.1)
    assert actual["short_notice_covered"] == 1
    assert actual["short_notice_under_10_min_pct"] == pytest.approx(0.0)
    assert actual["fulfilled"] == 1
    assert actual["fulfilled_pct"] == pytest.approx(100.0)
    assert actual["companies_with_covered"] == 1
    # «Locales activos» es actividad, no cobertura: el café publicó.
    assert actual["active_companies"] == 2
    # El período anterior quedó sin turnos: sin tasas, nunca un número sobre cero.
    assert anterior["shifts_published"] == 0
    assert anterior["shifts_covered"] == 0
    assert anterior["covered_pct"] is None
    assert anterior["covered_under_10_min_pct"] is None
    assert anterior["avg_minutes_to_cover"] is None
    assert anterior["median_minutes_to_cover"] is None


async def test_metricas_generales_sin_los_turnos_marcados(client, session_factory):
    admin = await make_admin(client, session_factory, "ov7_admin@test.com")
    bar = await _employer(client, "ov7_bar@test.com")
    cafe = await _employer(client, "ov7_cafe@test.com")
    hace_un_rato = datetime.now(UTC) - timedelta(hours=5)

    # Del bar: uno cubierto a los 30 min y terminado, y uno que nadie tomó.
    terminado = await _published_shift(client, bar)
    await _set(
        session_factory,
        terminado,
        published_at=hace_un_rato,
        first_assigned_at=hace_un_rato + timedelta(minutes=25),
        first_confirmed_at=hace_un_rato + timedelta(minutes=30),
        status="finalizado",
    )
    await _published_shift(client, bar)
    # Del café: uno que llegó a estar confirmado (a los 6 min) y otro que sólo
    # llegó a asignarse. Los dos van a quedar marcados.
    cafe_confirmado = await _published_shift(client, cafe)
    await _set(
        session_factory,
        cafe_confirmado,
        published_at=hace_un_rato,
        first_assigned_at=hace_un_rato + timedelta(minutes=3),
        first_confirmed_at=hace_un_rato + timedelta(minutes=6),
    )
    cafe_asignado = await _published_shift(client, cafe)
    await _set(
        session_factory,
        cafe_asignado,
        published_at=hace_un_rato,
        first_assigned_at=hace_un_rato + timedelta(minutes=3),
    )

    async def _stats() -> dict:
        resp = await client.get("/api/v1/admin/stats", headers=admin)
        assert resp.status_code == 200, resp.text
        return resp.json()

    # Sin marcas.
    antes = await _stats()
    assert antes["coverage_sample_size"] == 2
    assert antes["avg_time_to_fill_minutes"] == pytest.approx(18.0, abs=0.1)
    assert antes["pct_filled_under_10_min"] == pytest.approx(50.0)
    assert antes["shift_assignment_rate_sample_size"] == 4
    assert antes["shift_assignment_rate_pct"] == pytest.approx(75.0)
    assert antes["shift_completion_rate_sample_size"] == 4
    assert antes["shift_completion_rate_pct"] == pytest.approx(25.0)

    await _marcar(session_factory, cafe_confirmado, cafe_asignado)

    # Con marcas: quedan los dos del bar.
    despues = await _stats()
    assert despues["coverage_sample_size"] == 1
    assert despues["avg_time_to_fill_minutes"] == pytest.approx(30.0, abs=0.1)
    assert despues["pct_filled_under_10_min"] == pytest.approx(0.0)
    assert despues["shift_assignment_rate_sample_size"] == 2
    assert despues["shift_assignment_rate_pct"] == pytest.approx(50.0)
    assert despues["shift_completion_rate_sample_size"] == 2
    assert despues["shift_completion_rate_pct"] == pytest.approx(50.0)
    # Lo que no mide cobertura no cambia.
    for campo in (
        "total_users",
        "employers",
        "workers",
        "active",
        "suspended",
        "application_acceptance_sample_size",
        "no_show_sample_size",
        "employer_return_30d_sample_size",
    ):
        assert despues[campo] == antes[campo], campo


async def test_las_ausencias_de_hoy_no_son_de_cobertura_y_siguen_contando(
    client, session_factory
):
    """Un turno marcado con una ausencia de hoy: la ausencia pasó de verdad,
    así que «Hoy» y «Turnos en vivo» la siguen contando."""
    admin = await make_admin(client, session_factory, "ov8_admin@test.com")
    bar = await _employer(client, "ov8_bar@test.com")
    shift_id = await _published_shift(client, bar)
    await _set(session_factory, shift_id, no_show_at=datetime.now(UTC))
    await _marcar(session_factory, shift_id)

    hoy = (await client.get("/api/v1/admin/today", headers=admin)).json()
    vivo = (await client.get("/api/v1/admin/live-shifts", headers=admin)).json()

    assert hoy["no_shows_today"] == 1
    assert hoy["urgent_uncovered"] == 0
    assert vivo["no_shows"] == 1
    # Ya venció: no es un turno en vivo.
    assert vivo["total"] == 0


# --- 5. Un turno empezado que se reabre con el comercio suspendido (U080) ------


async def test_un_turno_oculto_que_se_reabre_ya_empezado_no_se_anuncia(
    client: AsyncClient, session_factory
):
    """Decisión 22 con U080: si quien tenía el turno lo deja con el turno ya
    empezado y el comercio está suspendido, el turno queda reofrecido pero
    oculto. No sale el aviso urgente a quienes están cerca (ofrecería algo que
    nadie puede ver ni tomar) ni el aviso al comercio suspendido."""
    from tests.test_turno_reofrecido import (
        _avisos as _avisos_api,
        _trabajador,
        _turno_confirmado_y_empezado,
    )

    admin = await make_admin(client, session_factory, "oculto_reabre_admin@staffya.com")
    b, _b_id = await _trabajador(client, "oculto_reabre_b@staffya.com", "Beto Cerca")
    shift_id, _comercio, a, _a_id = await _turno_confirmado_y_empezado(client, "oculto_reabre")
    antes_b = len(await _avisos_api(client, b, "urgent_shift_nearby"))
    comercio_id = UUID(await _user_id(client, admin, "reof_emp_oculto_reabre@staffya.com"))
    avisos_antes = await _avisos(session_factory, comercio_id)
    assert (await _suspend(client, admin, "reof_emp_oculto_reabre@staffya.com")).status_code == 200

    cancelled = await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=a)

    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["reoffered_at"] is not None
    assert len(await _avisos_api(client, b, "urgent_shift_nearby")) == antes_b
    assert await _avisos(session_factory, comercio_id) == avisos_antes
    # Y sigue oculto: no está en el Inicio de quien está cerca.
    feed = (await client.get("/api/v1/shifts/feed", headers=b)).json()
    assert shift_id not in {s["id"] for s in feed}
