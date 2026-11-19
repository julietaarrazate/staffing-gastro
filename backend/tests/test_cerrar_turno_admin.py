"""«Cerrar turno» de la admin (decisión 21, ADR-0024 actualizado el 2026-11-18).

Un turno ya empezado de una cuenta suspendida no se toca al suspender, pero
esa parte ya no puede entrar a la app: si es el trabajador, nadie marca la
salida; si es el comercio, nadie cierra el turno. La admin lo hace en su
nombre, con registro en el turno y aviso sólo a la parte activa.

1. Dominio: la tabla de casos de `Shift.admin_close_plan` y sus 409.
2. Servicio y API: cada caso (trabajador, comercio, los dos), avisos (a quién
   y cuántos), reputación igual que `finish`, registro.
3. API: sólo admin, 404, 409 con el motivo.
4. Concurrencia: el trabajador marca la salida justo antes.
5. Ficha: `admin_close` en los turnos donde aplica, sólo de una cuenta
   suspendida.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.tz import to_art
from app.modules.application.infrastructure.repositories import (
    SqlAlchemyShiftApplicationRepository,
)
from app.modules.company.infrastructure.repositories import SqlAlchemyCompanyProfileRepository
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.notification.infrastructure.fake_email_sender import FakeEmailSender
from app.modules.notification.infrastructure.models import NotificationModel
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from app.modules.shift.application.services import ShiftService
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.exceptions import (
    AdminCloseNotAllowedError,
    InvalidShiftTransitionError,
    ShiftConcurrentModificationError,
)
from app.modules.shift.domain.mensajes import (
    CIERRE_ADMIN_CAMBIO,
    CIERRE_ADMIN_CIERRE_DEL_COMERCIO,
    CIERRE_ADMIN_NINGUNA_SUSPENDIDA,
    CIERRE_ADMIN_SALIDA_DEL_TRABAJADOR,
)
from app.modules.shift.domain.value_objects import AdminClosePlan, ShiftStatus
from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from app.modules.subscription.infrastructure.repositories import (
    SqlAlchemySubscriptionRepository,
)
from app.modules.worker.domain.value_objects import WorkerSkill
from app.modules.worker.infrastructure.models import WorkerProfileModel
from app.modules.worker.infrastructure.repositories import SqlAlchemyWorkerProfileRepository
from tests._turno_empezado import (
    correr_reloj_del_turno,
    empezar_turno,
    empezar_turno_de_la_app,
)
from tests.conftest import make_admin
from tests.test_cuentas_suspendidas import (
    _checked_in,
    _confirmed,
    _employer,
    _shift,
    _suspend,
    _user_id,
    _worker,
)

PALERMO = {"latitude": -34.58, "longitude": -58.43}


# --- 1. Dominio ---------------------------------------------------------------


def _turno(status: ShiftStatus, *, empezo_hace: timedelta = timedelta(hours=1)) -> Shift:
    inicio = datetime.now(timezone.utc) - empezo_hace
    return Shift(
        company_id=uuid4(),
        position=WorkerSkill.MOZO,
        quantity=1,
        start_at=inicio,
        end_at=inicio + timedelta(hours=6),
        pay_amount=Decimal("70000"),
        status=status,
        worker_profile_id=uuid4(),
        check_in_at=inicio,
    )


_AHORA = datetime.now(timezone.utc)
_EMPEZADO = (ShiftStatus.CHECK_IN, ShiftStatus.TRABAJANDO)


@pytest.mark.parametrize("status", _EMPEZADO)
def test_trabajador_suspendido_con_la_llegada_marcada_marca_la_salida(status):
    plan = _turno(status).admin_close_plan(
        worker_active=False, company_active=True, now=_AHORA
    )
    assert plan == AdminClosePlan(
        check_out=True, finish=False, worker_active=False, company_active=True
    )
    assert plan.notifies == "company"


def test_comercio_suspendido_con_la_salida_marcada_cierra():
    plan = _turno(ShiftStatus.CHECK_OUT).admin_close_plan(
        worker_active=True, company_active=False, now=_AHORA
    )
    assert (plan.check_out, plan.finish, plan.notifies) == (False, True, "worker")


@pytest.mark.parametrize("status", _EMPEZADO)
def test_las_dos_suspendidas_con_la_llegada_marcada_marca_la_salida_y_cierra(status):
    plan = _turno(status).admin_close_plan(
        worker_active=False, company_active=False, now=_AHORA
    )
    assert (plan.check_out, plan.finish, plan.notifies) == (True, True, None)


def test_las_dos_suspendidas_con_la_salida_marcada_cierra_sin_avisar():
    plan = _turno(ShiftStatus.CHECK_OUT).admin_close_plan(
        worker_active=False, company_active=False, now=_AHORA
    )
    assert (plan.check_out, plan.finish, plan.notifies) == (False, True, None)


@pytest.mark.parametrize(
    ("status", "worker_active", "company_active", "texto"),
    [
        (ShiftStatus.CHECK_IN, True, True, CIERRE_ADMIN_NINGUNA_SUSPENDIDA),
        (ShiftStatus.CHECK_OUT, True, True, CIERRE_ADMIN_NINGUNA_SUSPENDIDA),
        # Lo que falta le toca a la parte activa.
        (ShiftStatus.CHECK_IN, True, False, CIERRE_ADMIN_SALIDA_DEL_TRABAJADOR),
        (ShiftStatus.TRABAJANDO, True, False, CIERRE_ADMIN_SALIDA_DEL_TRABAJADOR),
        (ShiftStatus.CHECK_OUT, False, True, CIERRE_ADMIN_CIERRE_DEL_COMERCIO),
    ],
)
def test_no_aplica_si_nadie_esta_suspendido_o_le_toca_a_la_parte_activa(
    status, worker_active, company_active, texto
):
    turno = _turno(status)
    with pytest.raises(AdminCloseNotAllowedError) as exc:
        turno.admin_close_plan(
            worker_active=worker_active, company_active=company_active, now=_AHORA
        )
    assert str(exc.value) == texto
    assert turno.status == status


@pytest.mark.parametrize(
    ("status", "texto"),
    [
        (ShiftStatus.BORRADOR, "Este turno todavía no empezó"),
        (ShiftStatus.PUBLICADO, "Este turno todavía no empezó"),
        (ShiftStatus.BUSCANDO_PERSONAL, "Este turno todavía no empezó"),
        (ShiftStatus.ASIGNADO, "Este turno todavía no empezó"),
        (ShiftStatus.CONFIRMADO, "Este turno todavía no empezó"),
        (ShiftStatus.EN_CAMINO, "Este turno todavía no empezó"),
        (ShiftStatus.FINALIZADO, "Este turno ya está cerrado."),
        (ShiftStatus.PAGADO, "Este turno ya está cerrado y pagado."),
        (ShiftStatus.CANCELADO, "Este turno está cancelado."),
        (ShiftStatus.NO_CUBIERTO, "Este turno venció sin cubrirse."),
    ],
)
@pytest.mark.parametrize(
    ("worker_active", "company_active"), [(False, True), (True, False), (False, False)]
)
def test_no_aplica_a_un_turno_no_empezado_ni_terminado(
    status, texto, worker_active, company_active
):
    with pytest.raises(AdminCloseNotAllowedError) as exc:
        _turno(status).admin_close_plan(
            worker_active=worker_active, company_active=company_active, now=_AHORA
        )
    assert str(exc.value).startswith(texto)


def test_la_salida_no_se_marca_antes_del_inicio():
    """La llegada se puede marcar hasta 30 min antes; la salida, sólo desde
    el inicio (la misma regla que `check_out`)."""
    turno = _turno(ShiftStatus.CHECK_IN, empezo_hace=-timedelta(minutes=20))
    with pytest.raises(AdminCloseNotAllowedError) as exc:
        turno.admin_close_plan(worker_active=False, company_active=True, now=_AHORA)
    assert str(exc.value).startswith("Todavía no se puede marcar la salida: el turno empieza hoy")
    with pytest.raises(InvalidShiftTransitionError):
        turno.admin_check_out(_AHORA)
    assert turno.status == ShiftStatus.CHECK_IN


def test_la_salida_de_la_admin_no_lleva_ubicacion_ni_controla_distancia():
    turno = _turno(ShiftStatus.CHECK_IN)
    turno.latitude, turno.longitude = PALERMO["latitude"], PALERMO["longitude"]
    turno.admin_check_out(_AHORA)
    assert turno.status == ShiftStatus.CHECK_OUT
    assert turno.check_out_at == _AHORA
    assert turno.check_out_latitude is None and turno.check_out_longitude is None


@pytest.mark.parametrize("status", [s for s in ShiftStatus if s not in _EMPEZADO])
def test_la_salida_de_la_admin_sale_solo_de_un_turno_con_la_llegada_marcada(status):
    with pytest.raises(InvalidShiftTransitionError):
        _turno(status).admin_check_out(_AHORA)


def test_cerrar_deja_el_registro_y_hace_los_dos_pasos():
    turno = _turno(ShiftStatus.CHECK_IN)
    admin_id = uuid4()
    plan = turno.close_for_suspended_account(
        admin_id, worker_active=False, company_active=False, now=_AHORA
    )
    assert plan.check_out and plan.finish
    assert turno.status == ShiftStatus.FINALIZADO
    assert turno.check_out_at == _AHORA
    assert turno.closed_by_admin_at == _AHORA
    assert turno.closed_by_admin_user_id == admin_id
    assert turno.paid_at is None


def test_si_no_aplica_no_cambia_nada_ni_deja_registro():
    turno = _turno(ShiftStatus.CHECK_OUT)
    with pytest.raises(AdminCloseNotAllowedError):
        turno.close_for_suspended_account(
            uuid4(), worker_active=False, company_active=True, now=_AHORA
        )
    assert turno.status == ShiftStatus.CHECK_OUT
    assert turno.closed_by_admin_at is None and turno.closed_by_admin_user_id is None


# --- Helpers de la API --------------------------------------------------------


async def _close(
    client: AsyncClient,
    admin: dict,
    shift_id: str,
    *,
    check_out: bool = True,
    finish: bool = False,
):
    """`check_out`/`finish`: lo que la admin vio y confirmó en el diálogo."""
    return await client.post(
        f"/api/v1/admin/shifts/{shift_id}/close",
        headers=admin,
        json={"check_out": check_out, "finish": finish},
    )


async def _notice_ids(session_factory, user_id: str) -> set[UUID]:
    return {n.id for n in await _notices_of(session_factory, user_id)}


async def _notices_of(session_factory, user_id: str) -> list[NotificationModel]:
    async with session_factory() as session:
        result = await session.execute(
            select(NotificationModel).where(NotificationModel.user_id == UUID(user_id))
        )
        return list(result.scalars().all())


async def _shift_model(session_factory, shift_id: str) -> ShiftModel:
    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        assert model is not None
        return model


async def _reputation(session_factory, profile_id: str) -> tuple[int, float]:
    async with session_factory() as session:
        model = await session.get(WorkerProfileModel, UUID(profile_id))
        return model.events_completed, model.punctuality_rate


async def _started(client, employer, worker, worker_id, *, punctual: bool = True) -> str:
    """Turno con la llegada marcada y ya empezado. `punctual`: la llegada
    queda 15 min antes del inicio (a tiempo) o 20 min después (tarde)."""
    shift_id = await _checked_in(client, employer, worker, worker_id)
    if punctual:
        await correr_reloj_del_turno(shift_id, 20)
    else:
        await empezar_turno_de_la_app(shift_id, minutos=20)
    return shift_id


async def _setup(client, session_factory, prefix: str):
    admin = await make_admin(client, session_factory, f"{prefix}_admin@staffya.com")
    employer = await _employer(client, f"{prefix}_emp@staffya.com")
    worker, worker_id = await _worker(client, f"{prefix}_w@staffya.com", "Ana Pérez")
    employer_uid = await _user_id(client, admin, f"{prefix}_emp@staffya.com")
    worker_uid = await _user_id(client, admin, f"{prefix}_w@staffya.com")
    return admin, employer, worker, worker_id, employer_uid, worker_uid


# --- 2. Servicio y API: cada caso ----------------------------------------------


@pytest.mark.asyncio
async def test_trabajador_suspendido_la_admin_marca_la_salida_y_avisa_al_comercio(
    client: AsyncClient, session_factory
):
    admin, employer, worker, worker_id, employer_uid, worker_uid = await _setup(
        client, session_factory, "d21a"
    )
    shift_id = await _started(client, employer, worker, worker_id)
    assert (await _suspend(client, admin, "d21a_w@staffya.com")).status_code == 200
    company_before = await _notice_ids(session_factory, employer_uid)
    worker_before = await _notice_ids(session_factory, worker_uid)

    resp = await _close(client, admin, shift_id)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "check_out"
    assert (body["check_out"], body["finish"], body["notifies"]) == (True, False, "company")
    model = await _shift_model(session_factory, shift_id)
    assert model.status == "check_out"
    assert model.check_out_at is not None
    assert model.check_out_latitude is None and model.check_out_longitude is None
    assert model.closed_by_admin_at is not None
    admin_uid = await _user_id(client, admin, "d21a_admin@staffya.com")
    assert str(model.closed_by_admin_user_id) == admin_uid
    # Un aviso al comercio; a la cuenta suspendida, nada.
    company_notices = await _notices_of(session_factory, employer_uid)
    [aviso] = [n for n in company_notices if n.id not in company_before]
    hora = f"{to_art(model.check_out_at):%H:%M}"
    # Con el día si no es hoy (`format_inicio_art`); recién marcada, es hoy.
    assert aviso.type == "shift_checked_out"
    assert aviso.title == "Marcamos la salida de un turno"
    assert aviso.message == (
        f"Oído marcó la salida de Ana Pérez en \"Mozo para el sábado\" a las {hora}, "
        "porque no pudo marcarla. Ya podés cerrar el turno."
    )
    assert aviso.link == "/shifts"
    assert await _notice_ids(session_factory, worker_uid) == worker_before
    # Todavía no cuenta en la reputación: falta que el comercio cierre.
    assert (await _reputation(session_factory, worker_id))[0] == 0

    # El comercio, activo, cierra como siempre.
    finished = await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer)
    assert finished.status_code == 200, finished.text
    assert await _reputation(session_factory, worker_id) == (1, 1.0)


@pytest.mark.asyncio
@pytest.mark.parametrize(("punctual", "rate"), [(True, 1.0), (False, 0.0)])
async def test_comercio_suspendido_la_admin_cierra_con_los_efectos_de_finish(
    client: AsyncClient, session_factory, punctual, rate
):
    prefix = f"d21b{int(punctual)}"
    admin, employer, worker, worker_id, employer_uid, worker_uid = await _setup(
        client, session_factory, prefix
    )
    shift_id = await _started(client, employer, worker, worker_id, punctual=punctual)
    out = await client.post(f"/api/v1/shifts/{shift_id}/check-out", headers=worker, json=PALERMO)
    assert out.json()["status"] == "check_out", out.text
    assert (await _suspend(client, admin, f"{prefix}_emp@staffya.com")).status_code == 200
    company_before = await _notice_ids(session_factory, employer_uid)
    worker_before = await _notice_ids(session_factory, worker_uid)

    resp = await _close(client, admin, shift_id, check_out=False, finish=True)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "finalizado"
    assert (body["check_out"], body["finish"], body["notifies"]) == (False, True, "worker")
    # Reputación con la puntualidad registrada, igual que `finish`.
    assert await _reputation(session_factory, worker_id) == (1, rate)
    model = await _shift_model(session_factory, shift_id)
    assert model.paid_at is None
    assert model.closed_by_admin_at is not None
    # El aviso de cierre de siempre al trabajador; al comercio suspendido, nada.
    worker_notices = await _notices_of(session_factory, worker_uid)
    [aviso] = [n for n in worker_notices if n.id not in worker_before]
    assert aviso.type == "shift_finished"
    assert aviso.title == "Cerró tu turno"
    assert aviso.message == "Calificá a Bar Palermo por el turno \"Mozo para el sábado\"."
    assert aviso.link == f"/my-shifts?turno={shift_id}"
    assert await _notice_ids(session_factory, employer_uid) == company_before
    # El trabajador ve el turno cerrado y puede calificar.
    assert (await _shift(client, shift_id, worker))["status"] == "finalizado"


@pytest.mark.asyncio
async def test_las_dos_suspendidas_marca_la_salida_y_cierra_sin_avisos(
    client: AsyncClient, session_factory
):
    admin, employer, worker, worker_id, employer_uid, worker_uid = await _setup(
        client, session_factory, "d21c"
    )
    shift_id = await _started(client, employer, worker, worker_id)
    assert (await _suspend(client, admin, "d21c_w@staffya.com")).status_code == 200
    assert (await _suspend(client, admin, "d21c_emp@staffya.com")).status_code == 200
    company_before = await _notice_ids(session_factory, employer_uid)
    worker_before = await _notice_ids(session_factory, worker_uid)

    resp = await _close(client, admin, shift_id, check_out=True, finish=True)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "finalizado"
    assert (body["check_out"], body["finish"], body["notifies"]) == (True, True, None)
    assert body["checked_out_at"] is not None
    model = await _shift_model(session_factory, shift_id)
    assert model.status == "finalizado"
    assert model.check_out_at is not None and model.closed_by_admin_at is not None
    assert await _reputation(session_factory, worker_id) == (1, 1.0)
    assert await _notice_ids(session_factory, employer_uid) == company_before
    # Al trabajador suspendido le queda guardado el «Cerró tu turno», como
    # todo aviso a una cuenta suspendida (ADR-0024, punto 4 de la
    # actualización del 2026-11-18): no le llega al celular.
    nuevos = [
        n for n in await _notices_of(session_factory, worker_uid) if n.id not in worker_before
    ]
    assert [n.type for n in nuevos] == ["shift_finished"]


# --- 3. API: permisos, 404, 409 -----------------------------------------------


@pytest.mark.asyncio
async def test_solo_la_admin_puede_cerrar(client: AsyncClient, session_factory):
    admin, employer, worker, worker_id, *_ = await _setup(client, session_factory, "d21d")
    shift_id = await _started(client, employer, worker, worker_id)
    # El trabajador, con la cuenta activa todavía (suspendido ya no entra).
    assert (await _close(client, worker, shift_id)).status_code == 403
    assert (await _suspend(client, admin, "d21d_w@staffya.com")).status_code == 200

    assert (await _close(client, employer, shift_id)).status_code == 403
    assert (
        await client.post(
            f"/api/v1/admin/shifts/{shift_id}/close", json={"check_out": True, "finish": False}
        )
    ).status_code == 401
    model = await _shift_model(session_factory, shift_id)
    assert model.status == "check_in" and model.closed_by_admin_at is None


@pytest.mark.asyncio
async def test_turno_inexistente_es_404(client: AsyncClient, session_factory):
    admin = await make_admin(client, session_factory, "d21e_admin@staffya.com")
    resp = await _close(client, admin, str(uuid4()))
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Turno no encontrado"


@pytest.mark.asyncio
async def test_sin_nadie_suspendido_es_409_y_no_toca_nada(client: AsyncClient, session_factory):
    admin, employer, worker, worker_id, *_ = await _setup(client, session_factory, "d21f")
    shift_id = await _started(client, employer, worker, worker_id)

    resp = await _close(client, admin, shift_id)

    assert resp.status_code == 409
    assert resp.json()["detail"] == CIERRE_ADMIN_NINGUNA_SUSPENDIDA
    model = await _shift_model(session_factory, shift_id)
    assert model.status == "check_in" and model.closed_by_admin_at is None


@pytest.mark.asyncio
async def test_la_salida_marcada_con_el_comercio_activo_la_cierra_el_comercio(
    client: AsyncClient, session_factory
):
    admin, employer, worker, worker_id, *_ = await _setup(client, session_factory, "d21g")
    shift_id = await _started(client, employer, worker, worker_id)
    out = await client.post(f"/api/v1/shifts/{shift_id}/check-out", headers=worker, json=PALERMO)
    assert out.status_code == 200
    assert (await _suspend(client, admin, "d21g_w@staffya.com")).status_code == 200

    resp = await _close(client, admin, shift_id)

    assert resp.status_code == 409
    assert resp.json()["detail"] == CIERRE_ADMIN_CIERRE_DEL_COMERCIO
    assert (await _shift_model(session_factory, shift_id)).status == "check_out"


@pytest.mark.asyncio
async def test_comercio_suspendido_sin_la_salida_la_marca_el_trabajador(
    client: AsyncClient, session_factory
):
    admin, employer, worker, worker_id, *_ = await _setup(client, session_factory, "d21h")
    shift_id = await _started(client, employer, worker, worker_id)
    assert (await _suspend(client, admin, "d21h_emp@staffya.com")).status_code == 200

    resp = await _close(client, admin, shift_id)

    assert resp.status_code == 409
    assert resp.json()["detail"] == CIERRE_ADMIN_SALIDA_DEL_TRABAJADOR
    # Después de que el trabajador marca la salida, la admin sí cierra.
    out = await client.post(f"/api/v1/shifts/{shift_id}/check-out", headers=worker, json=PALERMO)
    assert out.status_code == 200, out.text
    assert (await _close(client, admin, shift_id, check_out=False, finish=True)).status_code == 200
    assert (await _shift_model(session_factory, shift_id)).status == "finalizado"


@pytest.mark.asyncio
async def test_un_turno_que_no_empezo_es_409(client: AsyncClient, session_factory):
    """Confirmado y con la hora ya pasada, sin llegada: la suspensión no lo
    toca (ADR-0024, punto 3) y «Cerrar turno» tampoco (sigue con la ausencia
    automática)."""
    admin, employer, worker, worker_id, *_ = await _setup(client, session_factory, "d21i")
    shift_id = await _confirmed(client, employer, worker, worker_id)
    await empezar_turno(session_factory, shift_id)
    assert (await _suspend(client, admin, "d21i_w@staffya.com")).status_code == 200

    resp = await _close(client, admin, shift_id)

    assert resp.status_code == 409
    assert resp.json()["detail"].startswith("Este turno todavía no empezó")
    assert (await _shift_model(session_factory, shift_id)).status == "confirmado"


@pytest.mark.asyncio
async def test_llegada_antes_de_hora_la_salida_espera_al_inicio(
    client: AsyncClient, session_factory
):
    admin, employer, worker, worker_id, *_ = await _setup(client, session_factory, "d21j")
    shift_id = await _checked_in(client, employer, worker, worker_id)  # empieza en 15 min
    assert (await _suspend(client, admin, "d21j_w@staffya.com")).status_code == 200

    resp = await _close(client, admin, shift_id)

    assert resp.status_code == 409
    assert resp.json()["detail"].startswith(
        "Todavía no se puede marcar la salida: el turno empieza"
    )


@pytest.mark.asyncio
async def test_cerrar_dos_veces_la_segunda_es_409(client: AsyncClient, session_factory):
    admin, employer, worker, worker_id, employer_uid, _ = await _setup(
        client, session_factory, "d21k"
    )
    shift_id = await _started(client, employer, worker, worker_id)
    assert (await _suspend(client, admin, "d21k_w@staffya.com")).status_code == 200
    assert (await _close(client, admin, shift_id)).status_code == 200
    before = await _notice_ids(session_factory, employer_uid)

    again = await _close(client, admin, shift_id)

    assert again.status_code == 409
    assert again.json()["detail"] == CIERRE_ADMIN_CIERRE_DEL_COMERCIO
    assert await _notice_ids(session_factory, employer_uid) == before


# --- 4. Concurrencia ----------------------------------------------------------


class _RepoConCarrera(SqlAlchemyShiftRepository):
    """Después de que el caso de uso lee el turno, «el trabajador» marca la
    salida en otra sesión: lo que pasa con dos pedidos a la vez."""

    def __init__(self, session, carrera) -> None:
        super().__init__(session)
        self._carrera = carrera

    async def get_by_id(self, shift_id):
        shift = await super().get_by_id(shift_id)
        if self._carrera is not None:
            carrera, self._carrera = self._carrera, None
            await carrera(shift_id)
        return shift


def _service(session, carrera=None) -> ShiftService:
    return ShiftService(
        shifts=_RepoConCarrera(session, carrera),
        workers=SqlAlchemyWorkerProfileRepository(session),
        companies=SqlAlchemyCompanyProfileRepository(session),
        notifications=SqlAlchemyNotificationRepository(session),
        applications=SqlAlchemyShiftApplicationRepository(session),
        subscriptions=SqlAlchemySubscriptionRepository(session),
        users=SqlAlchemyUserRepository(session),
        email_sender=FakeEmailSender(),
    )


@pytest.mark.asyncio
async def test_si_el_trabajador_marca_la_salida_justo_antes_no_se_guarda_nada(
    client: AsyncClient, session_factory
):
    """La cuenta se suspendió con el turno empezado; entre la lectura de la
    admin y su guardado, el turno cambió (la salida de un pedido que ya
    estaba en vuelo). Gana el primero: 409, sin registro ni avisos."""
    admin, employer, worker, worker_id, employer_uid, _ = await _setup(
        client, session_factory, "d21l"
    )
    shift_id = await _started(client, employer, worker, worker_id)
    assert (await _suspend(client, admin, "d21l_w@staffya.com")).status_code == 200
    before = await _notice_ids(session_factory, employer_uid)

    async def el_trabajador_marca_la_salida(sid):
        async with session_factory() as other:
            repo = SqlAlchemyShiftRepository(other)
            shift = await repo.get_by_id(sid)
            shift.check_out(PALERMO["latitude"], PALERMO["longitude"])
            await repo.update(shift)

    async with session_factory() as session:
        service = _service(session, el_trabajador_marca_la_salida)
        with pytest.raises(ShiftConcurrentModificationError):
            await service.close_for_suspended_account(uuid4(), UUID(shift_id))

    model = await _shift_model(session_factory, shift_id)
    assert model.status == "check_out"
    assert model.check_out_latitude == PALERMO["latitude"]
    assert model.closed_by_admin_at is None and model.closed_by_admin_user_id is None
    assert await _notice_ids(session_factory, employer_uid) == before


@pytest.mark.asyncio
async def test_el_conflicto_llega_a_la_admin_como_409(client: AsyncClient, session_factory):
    from app.main import app
    from app.modules.shift.api.dependencies import get_shift_service

    admin, employer, worker, worker_id, *_ = await _setup(client, session_factory, "d21m")
    shift_id = await _started(client, employer, worker, worker_id)
    assert (await _suspend(client, admin, "d21m_w@staffya.com")).status_code == 200

    async def el_comercio_toca_el_turno(sid):
        async with session_factory() as other:
            repo = SqlAlchemyShiftRepository(other)
            shift = await repo.get_by_id(sid)
            shift.check_out(PALERMO["latitude"], PALERMO["longitude"])
            await repo.update(shift)

    sessions = []

    async def override():
        session = session_factory()
        sessions.append(session)
        return _service(session, el_comercio_toca_el_turno)

    app.dependency_overrides[get_shift_service] = override
    try:
        resp = await _close(client, admin, shift_id)
    finally:
        app.dependency_overrides.pop(get_shift_service, None)
        for session in sessions:
            await session.close()

    assert resp.status_code == 409
    assert resp.json()["detail"] == "El turno cambió mientras tanto. Actualizá y volvé a intentar."


# --- 5. Ficha de la admin -----------------------------------------------------


async def _detail_rows(client, admin, user_id) -> dict[str, dict]:
    resp = await client.get(f"/api/v1/admin/users/{user_id}", headers=admin)
    assert resp.status_code == 200, resp.text
    return {row["id"]: row for row in resp.json()["recent_shifts"]}


@pytest.mark.asyncio
async def test_la_ficha_dice_donde_aplica_y_que_haria(client: AsyncClient, session_factory):
    admin, employer, worker, worker_id, employer_uid, worker_uid = await _setup(
        client, session_factory, "d21n"
    )
    shift_id = await _started(client, employer, worker, worker_id)

    # Con las dos cuentas activas, ninguna fila lo ofrece.
    assert (await _detail_rows(client, admin, worker_uid))[shift_id]["admin_close"] is None
    assert (await _detail_rows(client, admin, employer_uid))[shift_id]["admin_close"] is None

    assert (await _suspend(client, admin, "d21n_w@staffya.com")).status_code == 200
    assert (await _detail_rows(client, admin, worker_uid))[shift_id]["admin_close"] == {
        "check_out": True,
        "finish": False,
        "notifies": "company",
    }
    # La ficha de la parte activa no lo ofrece.
    assert (await _detail_rows(client, admin, employer_uid))[shift_id]["admin_close"] is None

    # Ya con la salida marcada, el cierre le toca al comercio activo.
    assert (await _close(client, admin, shift_id)).status_code == 200
    assert (await _detail_rows(client, admin, worker_uid))[shift_id]["admin_close"] is None


@pytest.mark.asyncio
async def test_la_ficha_del_comercio_suspendido_ofrece_cerrar(
    client: AsyncClient, session_factory
):
    admin, employer, worker, worker_id, employer_uid, _ = await _setup(
        client, session_factory, "d21o"
    )
    shift_id = await _started(client, employer, worker, worker_id)
    out = await client.post(f"/api/v1/shifts/{shift_id}/check-out", headers=worker, json=PALERMO)
    assert out.status_code == 200
    assert (await _suspend(client, admin, "d21o_emp@staffya.com")).status_code == 200

    row = (await _detail_rows(client, admin, employer_uid))[shift_id]

    assert row["admin_close"] == {"check_out": False, "finish": True, "notifies": "worker"}


# --- 6. Revisión: lo confirmado, avisos a suspendidos, ficha completa ---------


def test_si_el_plan_no_es_el_confirmado_no_hace_nada():
    turno = _turno(ShiftStatus.CHECK_IN)
    with pytest.raises(AdminCloseNotAllowedError) as exc:
        turno.close_for_suspended_account(
            uuid4(),
            worker_active=False,
            company_active=False,
            expected=(True, False),
            now=_AHORA,
        )
    assert str(exc.value) == CIERRE_ADMIN_CAMBIO
    assert turno.status == ShiftStatus.CHECK_IN
    assert turno.check_out_at is None and turno.closed_by_admin_at is None


@pytest.mark.asyncio
async def test_api_si_cambio_lo_que_se_haria_es_409_sin_tocar_nada(
    client: AsyncClient, session_factory
):
    """La admin abrió la ficha con sólo el trabajador suspendido («marca la
    salida»); antes de confirmar se suspendió también el comercio, y ahora
    también se cerraría. Se ejecuta sólo lo confirmado: nada."""
    admin, employer, worker, worker_id, employer_uid, _ = await _setup(
        client, session_factory, "d21p"
    )
    shift_id = await _started(client, employer, worker, worker_id)
    assert (await _suspend(client, admin, "d21p_w@staffya.com")).status_code == 200
    assert (await _suspend(client, admin, "d21p_emp@staffya.com")).status_code == 200

    resp = await _close(client, admin, shift_id, check_out=True, finish=False)

    assert resp.status_code == 409
    assert resp.json()["detail"] == "El turno cambió: volvé a abrir la ficha."
    model = await _shift_model(session_factory, shift_id)
    assert model.status == "check_in" and model.closed_by_admin_at is None
    assert (await _reputation(session_factory, worker_id))[0] == 0


@pytest.mark.asyncio
async def test_el_comercio_cierra_y_al_trabajador_suspendido_le_queda_guardado_el_aviso(
    client: AsyncClient, session_factory
):
    admin, employer, worker, worker_id, _, worker_uid = await _setup(
        client, session_factory, "d21q"
    )
    shift_id = await _started(client, employer, worker, worker_id)
    out = await client.post(f"/api/v1/shifts/{shift_id}/check-out", headers=worker, json=PALERMO)
    assert out.status_code == 200
    assert (await _suspend(client, admin, "d21q_w@staffya.com")).status_code == 200
    before = await _notice_ids(session_factory, worker_uid)

    finished = await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer)

    assert finished.status_code == 200, finished.text
    nuevos = [n for n in await _notices_of(session_factory, worker_uid) if n.id not in before]
    assert [n.type for n in nuevos] == ["shift_finished"]
    # La reputación se registra igual.
    assert await _reputation(session_factory, worker_id) == (1, 1.0)


async def _draft_for(client: AsyncClient, employer: dict) -> None:
    start = datetime.now(timezone.utc) + timedelta(days=2)
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json={
            "position": "mozo",
            "quantity": 1,
            "start_at": start.replace(tzinfo=None).isoformat(),
            "end_at": (start + timedelta(hours=6)).replace(tzinfo=None).isoformat(),
            "pay_amount": "70000.00",
            "city": "Palermo",
        },
    )
    assert created.status_code == 201, created.text


@pytest.mark.asyncio
async def test_la_ficha_muestra_el_turno_empezado_aunque_no_este_entre_los_recientes(
    client: AsyncClient, session_factory
):
    admin, employer, worker, worker_id, employer_uid, _ = await _setup(
        client, session_factory, "d21r"
    )
    shift_id = await _started(client, employer, worker, worker_id)
    out = await client.post(f"/api/v1/shifts/{shift_id}/check-out", headers=worker, json=PALERMO)
    assert out.status_code == 200
    # Seis turnos más nuevos: el empezado queda fuera de los 5 recientes
    # (se lo corre al pasado: la base guarda `created_at` al segundo).
    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        model.created_at = datetime.now(timezone.utc) - timedelta(days=3)
        await session.commit()
    for _ in range(6):
        await _draft_for(client, employer)
    assert (await _suspend(client, admin, "d21r_emp@staffya.com")).status_code == 200

    rows = await _detail_rows(client, admin, employer_uid)

    assert shift_id in rows
    assert rows[shift_id]["admin_close"] == {
        "check_out": False,
        "finish": True,
        "notifies": "worker",
    }
    assert len(rows) == 6


@pytest.mark.asyncio
async def test_la_ficha_no_ofrece_cerrar_un_turno_que_ya_tiene_otra_persona(
    client: AsyncClient, session_factory
):
    """En el historial del trabajador figura el turno donde faltó, aunque
    ahora lo tenga otra persona: ahí no se actúa en su nombre."""
    admin, employer, worker, worker_id, _, worker_uid = await _setup(
        client, session_factory, "d21s"
    )
    otro, otro_id = await _worker(client, "d21s_otro@staffya.com", "Otra Persona")
    otro_uid = await _user_id(client, admin, "d21s_otro@staffya.com")
    shift_id = await _started(client, employer, otro, otro_id)
    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        model.last_no_show_worker_profile_id = UUID(worker_id)
        await session.commit()
    assert (await _suspend(client, admin, "d21s_w@staffya.com")).status_code == 200
    assert (await _suspend(client, admin, "d21s_otro@staffya.com")).status_code == 200

    row = (await _detail_rows(client, admin, worker_uid))[shift_id]
    assert row["absent"] is True
    assert row["admin_close"] is None
    # En la ficha de quien lo tiene, sí.
    assert (await _detail_rows(client, admin, otro_uid))[shift_id]["admin_close"] == {
        "check_out": True,
        "finish": False,
        "notifies": "company",
    }
