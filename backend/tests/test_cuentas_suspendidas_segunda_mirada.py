"""Segunda mirada a las cuentas suspendidas (ADR-0024, actualización 2026-11-18).

Un test por hallazgo, más los bordes. Cada uno afirma el comportamiento
correcto: sin el arreglo, falla."""

from uuid import UUID

import pytest
from httpx import AsyncClient

from app.modules.application.infrastructure.repositories import (
    SqlAlchemyShiftApplicationRepository,
)
from app.modules.notification.domain.entities import Notification, PushSubscription
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.notification.infrastructure.fake_push_sender import FakePushSender
from app.modules.notification.infrastructure.push_tasks import drain_pending_pushes
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
    SqlAlchemyPushSubscriptionRepository,
)
from app.modules.shift.application.services import ShiftService
from tests.conftest import make_admin
from tests.test_cuentas_suspendidas import (
    _apply,
    _assign,
    _assigned,
    _employer,
    _notices,
    _published,
    _shift,
    _suspend,
    _worker,
)

pytestmark = pytest.mark.asyncio


# --- 1. Reabrir a medias: los rechazados se restauran al repetir --------------


async def test_si_falla_restaurar_la_suspension_no_corta_y_avisa_al_comercio(
    client: AsyncClient, session_factory, monkeypatch
):
    admin = await make_admin(client, session_factory, "sm1_admin@staffya.com")
    employer = await _employer(client, "sm1_emp@staffya.com")
    ana, ana_id = await _worker(client, "sm1_ana@staffya.com", "Ana Gomez")
    beto, _ = await _worker(client, "sm1_beto@staffya.com", "Beto Ruiz")
    shift_id = await _published(client, employer, minutes=120)
    await _apply(client, shift_id, ana)
    await _apply(client, shift_id, beto)
    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200

    original = ShiftService._restore_rejected_applicants
    calls = {"n": 0}

    async def falla_una_vez(self, sid):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("la base se cortó después de reabrir el turno")
        return await original(self, sid)

    monkeypatch.setattr(ShiftService, "_restore_rejected_applicants", falla_una_vez)
    # Un fallo al restaurar se registra y no impide el resto.
    assert (await _suspend(client, admin, "sm1_ana@staffya.com")).status_code == 200
    assert (await _shift(client, shift_id, employer))["status"] == "buscando_personal"
    assert len(await _notices(client, employer, "shift_reopened")) >= 1
    # La segunda pasada de la misma suspensión ya reintentó: Beto volvió.
    mine = await client.get("/api/v1/applications/mine", headers=beto)
    assert [a["status"] for a in mine.json() if a["shift_id"] == shift_id] == ["pendiente"]


async def test_repetir_la_suspension_termina_lo_que_quedo_a_medias(
    client: AsyncClient, session_factory, monkeypatch
):
    """Falla la restauración en la suspensión entera (primera pasada, su
    reintento interno y segunda pasada): el turno quedó reabierto pero Beto sigue rechazado. La admin repite y la
    cola se completa aunque el turno ya no figure entre los tomados."""
    admin = await make_admin(client, session_factory, "sm1b_admin@staffya.com")
    employer = await _employer(client, "sm1b_emp@staffya.com")
    ana, ana_id = await _worker(client, "sm1b_ana@staffya.com", "Ana Gomez")
    beto, _ = await _worker(client, "sm1b_beto@staffya.com", "Beto Ruiz")
    shift_id = await _published(client, employer, minutes=120)
    await _apply(client, shift_id, ana)
    await _apply(client, shift_id, beto)
    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200

    original = ShiftService._restore_rejected_applicants
    calls = {"n": 0}

    async def falla_hasta_repetir(self, sid):
        calls["n"] += 1
        if calls["n"] <= 3:
            raise RuntimeError("la base sigue caída")
        return await original(self, sid)

    monkeypatch.setattr(ShiftService, "_restore_rejected_applicants", falla_hasta_repetir)
    assert (await _suspend(client, admin, "sm1b_ana@staffya.com")).status_code == 200
    mine = await client.get("/api/v1/applications/mine", headers=beto)
    assert [a["status"] for a in mine.json() if a["shift_id"] == shift_id] == ["rechazada"]

    # La admin repite (la cuenta ya está suspendida: el endpoint es idempotente).
    assert (await _suspend(client, admin, "sm1b_ana@staffya.com")).status_code == 200
    mine = await client.get("/api/v1/applications/mine", headers=beto)
    assert [a["status"] for a in mine.json() if a["shift_id"] == shift_id] == ["pendiente"]
    # Y Beto puede seguir en carrera: el comercio lo ve entre los postulantes.
    listed = await client.get(f"/api/v1/applications/shifts/{shift_id}", headers=employer)
    assert [a["status"] for a in listed.json()] == ["pendiente"]


# --- 2. /assign no revela si alguien está suspendido ---------------------------


async def test_assign_en_turno_cancelado_responde_igual_para_suspendida_y_activa(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "sm2_admin@staffya.com")
    employer = await _employer(client, "sm2_emp@staffya.com")
    _, ana_id = await _worker(client, "sm2_ana@staffya.com", "Ana Gomez")
    _, beto_id = await _worker(client, "sm2_beto@staffya.com", "Beto Ruiz")
    assert (await _suspend(client, admin, "sm2_ana@staffya.com")).status_code == 200
    shift_id = await _published(client, employer, minutes=120)
    cancelled = await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=employer)
    assert cancelled.status_code == 200

    activa = await _assign(client, shift_id, employer, beto_id)
    suspendida = await _assign(client, shift_id, employer, ana_id)
    assert activa.status_code == suspendida.status_code == 400
    assert activa.json() == suspendida.json()


async def test_assign_perfil_inexistente_sigue_dando_su_error_y_suspendida_en_turno_abierto_409(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "sm2b_admin@staffya.com")
    employer = await _employer(client, "sm2b_emp@staffya.com")
    _, ana_id = await _worker(client, "sm2b_ana@staffya.com", "Ana Gomez")
    assert (await _suspend(client, admin, "sm2b_ana@staffya.com")).status_code == 200
    shift_id = await _published(client, employer, minutes=120)

    # En un turno que sí admite asignar, la suspendida se rechaza como antes.
    resp = await _assign(client, shift_id, employer, ana_id)
    assert resp.status_code == 409, resp.text
    assert (await _shift(client, shift_id, employer))["status"] == "publicado"
    # Un perfil inexistente: su propio error, no el del turno.
    missing = await _assign(
        client, shift_id, employer, "00000000-0000-4000-8000-0000000000aa"
    )
    assert missing.status_code in (404, 400, 422), missing.text
    assert missing.status_code != 409


# --- 4. Sockets y push -----------------------------------------------------------


class _FakeSocket:
    def __init__(self) -> None:
        self.sent: list[dict] = []
        self.closed = False

    async def send_json(self, payload: dict) -> None:
        self.sent.append(payload)

    async def close(self, code: int = 1000) -> None:
        self.closed = True


async def test_suspender_corta_el_socket_de_avisos_abierto(
    client: AsyncClient, session_factory
):
    from app.core.ws_manager import ws_manager

    admin = await make_admin(client, session_factory, "sm4_admin@staffya.com")
    employer = await _employer(client, "sm4_emp@staffya.com")
    other = await _employer(client, "sm4_otro@staffya.com")
    me = await client.get("/api/v1/auth/me", headers=employer)
    owner_id = UUID(me.json()["id"])
    other_id = UUID((await client.get("/api/v1/auth/me", headers=other)).json()["id"])
    socket, other_socket = _FakeSocket(), _FakeSocket()
    assert ws_manager.connect_notification(owner_id, socket)
    assert ws_manager.connect_notification(other_id, other_socket)
    try:
        assert (await _suspend(client, admin, "sm4_emp@staffya.com")).status_code == 200
        assert socket.closed is True
        # Sólo el de la cuenta suspendida.
        assert other_socket.closed is False
        await ws_manager.broadcast_notification(owner_id, {"type": "x"})
        assert socket.sent == []
    finally:
        ws_manager.disconnect_notification(owner_id, socket)
        ws_manager.disconnect_notification(other_id, other_socket)


async def test_no_sale_push_a_una_cuenta_suspendida_pero_el_aviso_se_guarda(
    client: AsyncClient, session_factory, monkeypatch
):
    admin = await make_admin(client, session_factory, "sm4b_admin@staffya.com")
    suspended = await _employer(client, "sm4b_susp@staffya.com")
    active = await _employer(client, "sm4b_act@staffya.com")
    susp_id = UUID((await client.get("/api/v1/auth/me", headers=suspended)).json()["id"])
    act_id = UUID((await client.get("/api/v1/auth/me", headers=active)).json()["id"])
    async with session_factory() as session:
        subs = SqlAlchemyPushSubscriptionRepository(session)
        for uid, name in ((susp_id, "susp"), (act_id, "act")):
            await subs.add(
                PushSubscription(
                    user_id=uid,
                    endpoint=f"https://fcm.googleapis.com/fcm/send/sm4b-{name}",
                    p256dh_key="clave-p",
                    auth_key="clave-a",
                )
            )
    assert (await _suspend(client, admin, "sm4b_susp@staffya.com")).status_code == 200

    fake = FakePushSender()
    monkeypatch.setattr(
        "app.modules.notification.infrastructure.repositories._get_push_sender",
        lambda: fake,
    )
    async with session_factory() as session:
        repo = SqlAlchemyNotificationRepository(session)
        for uid in (susp_id, act_id):
            await repo.add(
                Notification(
                    user_id=uid,
                    type=NotificationType.NEW_APPLICANT,
                    title="Aviso de prueba",
                    message="Mensaje de prueba.",
                )
            )
    assert await drain_pending_pushes() == 0
    assert [s.user_id for s in fake.sent] == [act_id]
    # El aviso dentro de la app sí quedó guardado para la cuenta suspendida.
    async with session_factory() as session:
        saved = await SqlAlchemyNotificationRepository(session).list_by_user(susp_id)
    assert [n.title for n in saved] == ["Aviso de prueba"]


# --- 5. «Mis postulaciones» sin el turno oculto --------------------------------


async def test_mis_postulaciones_no_trae_el_turno_de_un_comercio_suspendido(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "sm5_admin@staffya.com")
    employer = await _employer(client, "sm5_emp@staffya.com")
    other = await _employer(client, "sm5_otro@staffya.com")
    ana, _ = await _worker(client, "sm5_ana@staffya.com", "Ana Gomez")
    hidden_id = await _published(client, employer, minutes=120)
    visible_id = await _published(client, other, minutes=120)
    await _apply(client, hidden_id, ana)
    await _apply(client, visible_id, ana)
    assert (await _suspend(client, admin, "sm5_emp@staffya.com")).status_code == 200

    mine = await client.get("/api/v1/applications/mine", headers=ana)
    assert mine.status_code == 200
    by_shift = {a["shift_id"]: a for a in mine.json()}
    assert by_shift[hidden_id]["shift"] is None
    # El estado de la postulación no se toca.
    assert by_shift[hidden_id]["status"] == "pendiente"
    assert by_shift[visible_id]["shift"]["id"] == visible_id


async def test_mis_postulaciones_conserva_el_turno_asignado_a_uno_mismo(
    client: AsyncClient, session_factory
):
    """Un turno ya empezado de un comercio suspendido sigue su curso: quien
    lo está trabajando lo sigue viendo."""
    from tests.test_cuentas_suspendidas import _checked_in

    admin = await make_admin(client, session_factory, "sm5b_admin@staffya.com")
    employer = await _employer(client, "sm5b_emp@staffya.com")
    ana, ana_id = await _worker(client, "sm5b_ana@staffya.com", "Ana Gomez")
    shift_id = await _checked_in(client, employer, ana, ana_id)
    assert (await _suspend(client, admin, "sm5b_emp@staffya.com")).status_code == 200
    mine = await client.get("/api/v1/applications/mine", headers=ana)
    rows = [a for a in mine.json() if a["shift_id"] == shift_id]
    # Sin postulación previa (asignada directo) puede no haber fila; si la hay,
    # trae el turno.
    assert all(a["shift"] is not None for a in rows)


# --- 6. El asistente no encuentra a un postulante suspendido -------------------


async def test_el_asistente_no_encuentra_a_un_postulante_suspendido(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "sm6_admin@staffya.com")
    employer = await _employer(client, "sm6_emp@staffya.com")
    ana, _ = await _worker(client, "sm6_ana@staffya.com", "Ana Gomez")
    shift_id = await _published(client, employer, minutes=120)
    await _apply(client, shift_id, ana)
    shift = await _shift(client, shift_id, employer)
    company_id = UUID(shift["company_id"])

    async with session_factory() as session:
        before = await SqlAlchemyShiftApplicationRepository(session).find_applicant_by_name(
            company_id, "Ana"
        )
    assert before is not None and before.full_name == "Ana Gomez"

    assert (await _suspend(client, admin, "sm6_ana@staffya.com")).status_code == 200
    async with session_factory() as session:
        after = await SqlAlchemyShiftApplicationRepository(session).find_applicant_by_name(
            company_id, "Ana"
        )
    assert after is None
