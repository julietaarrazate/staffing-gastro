"""Qué pasa con los turnos cuando se suspende una cuenta (ADR-0024, G6:
U023, U097, U095).

Un bloque por efecto del ADR:

1. Asignar: no se puede asignar a una cuenta suspendida, y la lista de
   postulantes no la muestra.
2. Ingreso y renovación: 403 con `account_suspended` sólo con la contraseña
   (o la sesión, o Google) correcta; con la contraseña mal, lo de siempre.
3. Comercio suspendido: lo abierto se oculta y no acepta postulaciones; lo
   tomado que no empezó se cancela con aviso y sin penalidad; lo empezado no
   se toca.
4. Trabajador suspendido: lo tomado que no empezó se reabre con aviso al
   comercio y sin sumarle una cancelación; lo empezado no se toca.
5. La admin ve antes cuántos turnos toca, y suspender es una sola operación.
6. Reactivar: lo oculto vuelve a verse; lo cancelado o reabierto, no.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.main import app
from app.modules.company.infrastructure.models import CompanyProfileModel
from app.modules.identity.api.dependencies import get_google_verifier
from app.modules.identity.domain.google_verifier import GoogleIdentity, GoogleTokenVerifier
from app.modules.shift.application.services import ShiftService
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from app.modules.worker.infrastructure.models import WorkerProfileModel
from tests.conftest import (
    auth_headers,
    login,
    make_admin,
    new_client,
    refresh_with_cookie,
    register_user,
)

pytestmark = pytest.mark.asyncio

SUSPENDED = {
    "code": "account_suspended",
    "message": (
        "Tu cuenta está suspendida. Si creés que es un error, escribinos a "
        "hola@oido.com.ar"
    ),
}
_TITLE = "Mozo para el sábado"


# --- Helpers ----------------------------------------------------------------


async def _employer(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email, "Dueña Bar")
    created = await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    assert created.status_code in (200, 201), created.text
    return headers


async def _worker(client: AsyncClient, email: str, full_name: str) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email, full_name)
    profile = await client.post(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={"skills": ["mozo"], "city": "Palermo"},
    )
    assert profile.status_code in (200, 201), profile.text
    return headers, profile.json()["id"]


async def _published(client: AsyncClient, employer: dict, *, minutes: int = 15) -> str:
    """Turno publicado que empieza en `minutes` (a 15: ya se puede marcar la
    llegada, como en `test_cancel_shift_notifications.py`)."""
    start = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    end = start + timedelta(hours=6)
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json={
            "title": _TITLE,
            "position": "mozo",
            "quantity": 1,
            "start_at": start.replace(tzinfo=None).isoformat(),
            "end_at": end.replace(tzinfo=None).isoformat(),
            "pay_amount": "70000.00",
            "city": "Palermo",
        },
    )
    assert created.status_code == 201, created.text
    shift_id = created.json()["id"]
    published = await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    assert published.status_code == 200, published.text
    return shift_id


async def _draft(client: AsyncClient, employer: dict) -> str:
    start = datetime.now(timezone.utc) + timedelta(days=1)
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
    return created.json()["id"]


async def _apply(client: AsyncClient, shift_id: str, worker: dict) -> None:
    applied = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    assert applied.status_code == 201, applied.text


async def _assign(client: AsyncClient, shift_id: str, employer: dict, profile_id: str):
    return await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": profile_id},
    )


async def _assigned(client, employer, worker_profile_id, *, minutes: int = 15) -> str:
    shift_id = await _published(client, employer, minutes=minutes)
    assigned = await _assign(client, shift_id, employer, worker_profile_id)
    assert assigned.status_code == 200, assigned.text
    return shift_id


async def _confirmed(client, employer, worker, worker_profile_id, *, minutes: int = 15) -> str:
    shift_id = await _assigned(client, employer, worker_profile_id, minutes=minutes)
    confirmed = await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker)
    assert confirmed.status_code == 200, confirmed.text
    return shift_id


async def _checked_in(client, employer, worker, worker_profile_id) -> str:
    shift_id = await _confirmed(client, employer, worker, worker_profile_id)
    checked_in = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers=worker,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    assert checked_in.json()["status"] == "check_in", checked_in.text
    return shift_id


async def _user_id(client: AsyncClient, admin: dict, email: str) -> str:
    users = await client.get("/api/v1/admin/users", headers=admin, params={"q": email})
    return next(u["id"] for u in users.json() if u["email"] == email)


async def _suspend(client: AsyncClient, admin: dict, email: str):
    user_id = await _user_id(client, admin, email)
    return await client.post(f"/api/v1/admin/users/{user_id}/suspend", headers=admin)


async def _preview(client: AsyncClient, admin: dict, email: str) -> dict:
    user_id = await _user_id(client, admin, email)
    resp = await client.get(
        f"/api/v1/admin/users/{user_id}/suspension-preview", headers=admin
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _shift(client: AsyncClient, shift_id: str, party: dict) -> dict:
    resp = await client.get(f"/api/v1/shifts/{shift_id}", headers=party)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _feed_ids(client: AsyncClient, worker: dict, **params) -> set[str]:
    resp = await client.get("/api/v1/shifts/feed", headers=worker, params=params)
    assert resp.status_code == 200, resp.text
    return {s["id"] for s in resp.json()}


async def _notices(client: AsyncClient, headers: dict, type_: str) -> list[dict]:
    listed = await client.get("/api/v1/notifications", headers=headers)
    assert listed.status_code == 200
    return [n for n in listed.json() if n["type"] == type_]


async def _worker_cancellations(session_factory, profile_id: str) -> int:
    async with session_factory() as session:
        model = await session.get(WorkerProfileModel, UUID(profile_id))
        return model.cancellations


async def _late_cancellations(client: AsyncClient, employer: dict) -> int:
    profile = await client.get("/api/v1/companies/me/profile", headers=employer)
    return profile.json()["late_cancellations"]


async def _company_late_cancellations_db(session_factory) -> list[int]:
    """Cancelaciones tardías de todos los comercios de la base (el comercio
    suspendido ya no puede leer su perfil por la API)."""
    async with session_factory() as session:
        rows = await session.execute(select(CompanyProfileModel.late_cancellations))
        return [r for (r,) in rows.all()]


# --- 1. Asignar --------------------------------------------------------------


async def test_asignar_a_una_cuenta_suspendida_se_rechaza_sin_tocar_a_los_demas(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin1@staffya.com")
    employer = await _employer(client, "g6_emp1@staffya.com")
    ana, ana_id = await _worker(client, "g6_ana1@staffya.com", "Ana Gomez")
    beto, _ = await _worker(client, "g6_beto1@staffya.com", "Beto Ruiz")
    shift_id = await _published(client, employer)
    await _apply(client, shift_id, ana)
    await _apply(client, shift_id, beto)
    assert (await _suspend(client, admin, "g6_ana1@staffya.com")).status_code == 200

    resp = await _assign(client, shift_id, employer, ana_id)

    assert resp.status_code == 409
    assert resp.json()["detail"] == "Esta persona no puede tomar turnos por ahora. Elegí a otra."
    # No dice el motivo: ni «suspendida» ni nada de la cuenta.
    assert "suspend" not in resp.text.lower()
    # El turno y los demás postulantes quedaron como estaban.
    assert (await _shift(client, shift_id, employer))["status"] == "publicado"
    mine = await client.get("/api/v1/applications/mine", headers=beto)
    assert [a["status"] for a in mine.json() if a["shift_id"] == shift_id] == ["pendiente"]


async def test_la_lista_de_postulantes_no_muestra_cuentas_suspendidas(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin2@staffya.com")
    employer = await _employer(client, "g6_emp2@staffya.com")
    ana, _ = await _worker(client, "g6_ana2@staffya.com", "Ana Gomez")
    beto, _ = await _worker(client, "g6_beto2@staffya.com", "Beto Ruiz")
    shift_id = await _published(client, employer)
    await _apply(client, shift_id, ana)
    await _apply(client, shift_id, beto)
    assert (await _suspend(client, admin, "g6_ana2@staffya.com")).status_code == 200

    applicants = await client.get(f"/api/v1/applications/shifts/{shift_id}", headers=employer)
    assert applicants.status_code == 200
    assert [a["full_name"] for a in applicants.json()] == ["Beto Ruiz"]
    # El contador del panel dice lo mismo que la lista.
    panel = await client.get("/api/v1/shifts/me", headers=employer)
    [row] = [s for s in panel.json() if s["id"] == shift_id]
    assert row["pending_applicants_count"] == 1


# --- 2. Ingreso y renovación -------------------------------------------------


async def test_ingreso_con_la_contrasena_correcta_dice_que_esta_suspendida(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin3@staffya.com")
    await register_user(client, email="g6_target3@staffya.com", role="worker")
    assert (await _suspend(client, admin, "g6_target3@staffya.com")).status_code == 200

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "g6_target3@staffya.com", "password": "supersecreta123"},
    )

    assert resp.status_code == 403
    assert resp.json() == {"detail": SUSPENDED}


async def test_ingreso_con_la_contrasena_incorrecta_no_revela_la_suspension(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin4@staffya.com")
    await register_user(client, email="g6_target4@staffya.com", role="worker")
    assert (await _suspend(client, admin, "g6_target4@staffya.com")).status_code == 200

    wrong = await client.post(
        "/api/v1/auth/login",
        json={"email": "g6_target4@staffya.com", "password": "otra-clave-cualquiera"},
    )
    nobody = await client.post(
        "/api/v1/auth/login",
        json={"email": "g6_nadie4@staffya.com", "password": "otra-clave-cualquiera"},
    )

    # Lo mismo que para un email sin cuenta: ni existe ni está suspendida.
    assert wrong.status_code == nobody.status_code == 401
    assert wrong.json() == nobody.json() == {"detail": "Credenciales inválidas"}


async def test_la_renovacion_de_una_sesion_abierta_dice_que_esta_suspendida(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin5@staffya.com")
    async with new_client() as device:
        await register_user(device, email="g6_target5@staffya.com", role="employer")
        await login(device, "g6_target5@staffya.com")
        refresh_cookie = device.cookies.get("staffya_refresh")
    assert refresh_cookie
    assert (await _suspend(client, admin, "g6_target5@staffya.com")).status_code == 200

    resp = await refresh_with_cookie(refresh_cookie)

    assert resp.status_code == 403
    assert resp.json() == {"detail": SUSPENDED}


async def test_la_renovacion_reactivada_sigue_pidiendo_ingresar(
    client: AsyncClient, session_factory
):
    """Reactivar no revive la sesión de antes (la suspensión la revocó): da
    el 401 de siempre, no el aviso de suspendida."""
    admin = await make_admin(client, session_factory, "g6_admin5b@staffya.com")
    async with new_client() as device:
        await register_user(device, email="g6_target5b@staffya.com", role="worker")
        await login(device, "g6_target5b@staffya.com")
        refresh_cookie = device.cookies.get("staffya_refresh")
    user_id = await _user_id(client, admin, "g6_target5b@staffya.com")
    await client.post(f"/api/v1/admin/users/{user_id}/suspend", headers=admin)
    await client.post(f"/api/v1/admin/users/{user_id}/activate", headers=admin)

    resp = await refresh_with_cookie(refresh_cookie)

    assert resp.status_code == 401


class _GoogleSays(GoogleTokenVerifier):
    def __init__(self, email: str) -> None:
        self._email = email

    async def verify(self, id_token: str) -> GoogleIdentity:
        return GoogleIdentity(email=self._email, email_verified=True, full_name="Ana")


async def test_ingreso_con_google_dice_que_esta_suspendida(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin6@staffya.com")
    await register_user(client, email="g6_target6@staffya.com", role="worker")
    assert (await _suspend(client, admin, "g6_target6@staffya.com")).status_code == 200
    app.dependency_overrides[get_google_verifier] = lambda: _GoogleSays(
        "g6_target6@staffya.com"
    )
    try:
        resp = await client.post(
            "/api/v1/auth/google", json={"id_token": "tok", "accepted_terms": True}
        )
    finally:
        app.dependency_overrides.pop(get_google_verifier, None)

    assert resp.status_code == 403
    assert resp.json() == {"detail": SUSPENDED}


# --- 3. Comercio suspendido --------------------------------------------------


async def test_comercio_suspendido_sus_turnos_abiertos_se_ocultan_y_no_aceptan_postulaciones(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin7@staffya.com")
    employer = await _employer(client, "g6_emp7@staffya.com")
    other_employer = await _employer(client, "g6_emp7b@staffya.com")
    ana, _ = await _worker(client, "g6_ana7@staffya.com", "Ana Gomez")
    hidden_id = await _published(client, employer, minutes=120)
    visible_id = await _published(client, other_employer, minutes=120)
    assert hidden_id in await _feed_ids(client, ana)

    assert (await _suspend(client, admin, "g6_emp7@staffya.com")).status_code == 200

    # Inicio y Mapa (cerca) y Buscar (todo): afuera. El del otro comercio, no.
    for params in ({}, {"scope": "all"}):
        ids = await _feed_ids(client, ana, **params)
        assert hidden_id not in ids
        assert visible_id in ids
    # Página pública: «ya no disponible», sin decir por qué.
    public = await client.get(f"/api/v1/shifts/{hidden_id}/public")
    assert public.status_code == 410
    assert public.json() == {"detail": "Este turno ya no está disponible"}
    # El detalle para quien no es parte: como un turno que no está.
    assert (await client.get(f"/api/v1/shifts/{hidden_id}", headers=ana)).status_code == 404
    # No acepta postulaciones (mismo 404 que un turno que no está abierto).
    applied = await client.post(f"/api/v1/applications/shifts/{hidden_id}", headers=ana)
    assert applied.status_code == 404
    # No se canceló ni se borró: sigue publicado (la admin lo ve).
    detail = await client.get(f"/api/v1/shifts/{hidden_id}", headers=admin)
    assert detail.json()["status"] == "publicado"


async def test_comercio_suspendido_se_cancelan_los_tomados_sin_penalidad_y_con_aviso(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin8@staffya.com")
    employer = await _employer(client, "g6_emp8@staffya.com")
    ana, ana_id = await _worker(client, "g6_ana8@staffya.com", "Ana Gomez")
    beto, beto_id = await _worker(client, "g6_beto8@staffya.com", "Beto Ruiz")
    assigned_id = await _assigned(client, employer, ana_id)
    confirmed_id = await _confirmed(client, employer, beto, beto_id)

    assert (await _suspend(client, admin, "g6_emp8@staffya.com")).status_code == 200

    for shift_id in (assigned_id, confirmed_id):
        detail = await client.get(f"/api/v1/shifts/{shift_id}", headers=admin)
        assert detail.json()["status"] == "cancelado"
    # Un aviso a cada persona, sin decir el motivo ni «suspendida», y nunca
    # el de cancelación tardía.
    for worker in (ana, beto):
        [notice] = await _notices(client, worker, "shift_cancelled")
        assert notice["title"] == "Se canceló un turno tuyo"
        assert notice["message"] == (
            f'"{_TITLE}" se canceló. Ya no tenés que ir ni responder, y no cuenta '
            "en tu reputación. Mirá otros turnos cerca."
        )
        assert "suspend" not in notice["message"].lower()
        assert await _notices(client, worker, "shift_cancelled_late") == []
    # Nadie recibe penalidad: ni cancelación tardía del comercio ni
    # cancelación del trabajador.
    assert await _company_late_cancellations_db(session_factory) == [0]
    assert await _worker_cancellations(session_factory, ana_id) == 0
    assert await _worker_cancellations(session_factory, beto_id) == 0


async def test_comercio_suspendido_no_toca_un_turno_que_ya_empezo(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin9@staffya.com")
    employer = await _employer(client, "g6_emp9@staffya.com")
    ana, ana_id = await _worker(client, "g6_ana9@staffya.com", "Ana Gomez")
    shift_id = await _checked_in(client, employer, ana, ana_id)

    assert (await _suspend(client, admin, "g6_emp9@staffya.com")).status_code == 200

    detail = await _shift(client, shift_id, ana)
    assert detail["status"] == "check_in"
    assert detail["worker_profile_id"] == ana_id
    assert await _notices(client, ana, "shift_cancelled") == []


async def test_comercio_suspendido_no_escala_sus_turnos_ocultos(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin10@staffya.com")
    employer = await _employer(client, "g6_emp10@staffya.com")
    other = await _employer(client, "g6_emp10b@staffya.com")
    hidden_id = await _published(client, employer, minutes=120)
    visible_id = await _published(client, other, minutes=120)
    assert (await _suspend(client, admin, "g6_emp10@staffya.com")).status_code == 200

    async with session_factory() as session:
        pending = await SqlAlchemyShiftRepository(session).list_open_awaiting_escalation()
    ids = {str(s.id) for s in pending}
    assert hidden_id not in ids
    assert visible_id in ids


# --- 4. Trabajador suspendido -------------------------------------------------


async def test_trabajador_suspendido_sus_turnos_se_reabren_sin_cancelacion_y_con_aviso(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin11@staffya.com")
    employer = await _employer(client, "g6_emp11@staffya.com")
    ana, ana_id = await _worker(client, "g6_ana11@staffya.com", "Ana Gomez")
    beto, _ = await _worker(client, "g6_beto11@staffya.com", "Beto Ruiz")
    # Confirmado, con otro postulante que había quedado afuera al asignar.
    confirmed_id = await _published(client, employer)
    await _apply(client, confirmed_id, ana)
    await _apply(client, confirmed_id, beto)
    assert (await _assign(client, confirmed_id, employer, ana_id)).status_code == 200
    assert (
        await client.post(f"/api/v1/shifts/{confirmed_id}/confirm", headers=ana)
    ).status_code == 200
    # Y otro asignado, todavía sin confirmar.
    assigned_id = await _assigned(client, employer, ana_id)

    assert (await _suspend(client, admin, "g6_ana11@staffya.com")).status_code == 200

    for shift_id in (confirmed_id, assigned_id):
        detail = await _shift(client, shift_id, employer)
        assert detail["status"] == "buscando_personal"
        assert detail["worker_profile_id"] is None
    # Los demás postulantes vuelven a estar en carrera.
    mine = await client.get("/api/v1/applications/mine", headers=beto)
    assert [a["status"] for a in mine.json() if a["shift_id"] == confirmed_id] == [
        "pendiente"
    ]
    # Un aviso al comercio por turno, que lleva a elegir a otra persona.
    notices = await _notices(client, employer, "shift_reopened")
    assert len(notices) == 2
    for notice in notices:
        assert notice["title"] == "Tu turno volvió a buscar personal"
        assert notice["message"] == (
            f'La persona asignada a "{_TITLE}" ya no puede tomarlo. El turno volvió '
            "a buscar personal: elegí a otra persona entre los postulantes."
        )
        assert "suspend" not in notice["message"].lower()
    assert {n["link"] for n in notices} == {
        f"/shifts/{confirmed_id}/candidates",
        f"/shifts/{assigned_id}/candidates",
    }
    # Sin penalidad: no se le suma una cancelación.
    assert await _worker_cancellations(session_factory, ana_id) == 0
    assert await _late_cancellations(client, employer) == 0


async def test_trabajador_suspendido_no_toca_un_turno_que_ya_empezo(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin12@staffya.com")
    employer = await _employer(client, "g6_emp12@staffya.com")
    ana, ana_id = await _worker(client, "g6_ana12@staffya.com", "Ana Gomez")
    shift_id = await _checked_in(client, employer, ana, ana_id)

    assert (await _suspend(client, admin, "g6_ana12@staffya.com")).status_code == 200

    detail = await _shift(client, shift_id, employer)
    assert detail["status"] == "check_in"
    assert detail["worker_profile_id"] == ana_id
    assert await _notices(client, employer, "shift_reopened") == []


# --- 5. Vista previa y una sola operación -------------------------------------


async def test_la_vista_previa_del_comercio_cuenta_bien_y_no_cambia_nada(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin13@staffya.com")
    employer = await _employer(client, "g6_emp13@staffya.com")
    ana, ana_id = await _worker(client, "g6_ana13@staffya.com", "Ana Gomez")
    beto, beto_id = await _worker(client, "g6_beto13@staffya.com", "Beto Ruiz")
    caro, caro_id = await _worker(client, "g6_caro13@staffya.com", "Caro Paz")
    open_a = await _published(client, employer, minutes=120)
    open_b = await _published(client, employer, minutes=180)
    await _draft(client, employer)  # un borrador no se ve: no cuenta
    assigned_id = await _assigned(client, employer, ana_id)
    confirmed_id = await _confirmed(client, employer, beto, beto_id)
    await _checked_in(client, employer, caro, caro_id)  # ya empezó: no cuenta

    preview = await _preview(client, admin, "g6_emp13@staffya.com")

    assert preview == {"hidden": 2, "cancelled": 2, "reopened": 0}
    # Mirar no cambia nada.
    assert (await _shift(client, assigned_id, employer))["status"] == "asignado"
    assert (await _shift(client, confirmed_id, employer))["status"] == "confirmado"
    assert {open_a, open_b} <= await _feed_ids(client, ana, scope="all")


async def test_la_vista_previa_del_trabajador_cuenta_bien(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin14@staffya.com")
    employer = await _employer(client, "g6_emp14@staffya.com")
    ana, ana_id = await _worker(client, "g6_ana14@staffya.com", "Ana Gomez")
    await _assigned(client, employer, ana_id)
    # Mañana: no se superpone con el que ya empezó (regla de doble turno).
    await _confirmed(client, employer, ana, ana_id, minutes=24 * 60)
    await _checked_in(client, employer, ana, ana_id)  # ya empezó: no cuenta

    preview = await _preview(client, admin, "g6_ana14@staffya.com")

    assert preview == {"hidden": 0, "cancelled": 0, "reopened": 2}


async def test_la_vista_previa_de_una_cuenta_que_no_existe_es_404(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin15@staffya.com")
    missing = "00000000-0000-0000-0000-000000000000"
    resp = await client.get(
        f"/api/v1/admin/users/{missing}/suspension-preview", headers=admin
    )
    assert resp.status_code == 404


async def test_si_falla_un_efecto_la_cuenta_no_queda_suspendida_y_se_puede_repetir(
    client: AsyncClient, session_factory, monkeypatch
):
    admin = await make_admin(client, session_factory, "g6_admin16@staffya.com")
    employer = await _employer(client, "g6_emp16@staffya.com")
    ana, ana_id = await _worker(client, "g6_ana16@staffya.com", "Ana Gomez")
    beto, beto_id = await _worker(client, "g6_beto16@staffya.com", "Beto Ruiz")
    await _assigned(client, employer, ana_id)
    await _assigned(client, employer, beto_id)

    original = ShiftService._cancel_for_company_suspension
    calls = {"n": 0}

    async def falla_el_segundo(self, shift):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("la base se cayó a mitad de camino")
        return await original(self, shift)

    monkeypatch.setattr(ShiftService, "_cancel_for_company_suspension", falla_el_segundo)
    with pytest.raises(RuntimeError):
        await _suspend(client, admin, "g6_emp16@staffya.com")

    # La cuenta sigue activa: no quedó suspendida con un turno colgado.
    still = await client.post(
        "/api/v1/auth/login",
        json={"email": "g6_emp16@staffya.com", "password": "supersecreta123"},
    )
    assert still.status_code == 200
    assert (await _preview(client, admin, "g6_emp16@staffya.com"))["cancelled"] == 1

    # Al repetir, sigue con lo que faltaba y la cuenta queda suspendida.
    monkeypatch.setattr(ShiftService, "_cancel_for_company_suspension", original)
    assert (await _suspend(client, admin, "g6_emp16@staffya.com")).status_code == 200
    assert (await _preview(client, admin, "g6_emp16@staffya.com"))["cancelled"] == 0
    for worker in (ana, beto):
        assert len(await _notices(client, worker, "shift_cancelled")) == 1


# --- 6. Reactivar --------------------------------------------------------------


async def test_reactivar_muestra_de_nuevo_lo_oculto_y_no_deshace_lo_cancelado(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "g6_admin17@staffya.com")
    employer = await _employer(client, "g6_emp17@staffya.com")
    ana, ana_id = await _worker(client, "g6_ana17@staffya.com", "Ana Gomez")
    beto, _ = await _worker(client, "g6_beto17@staffya.com", "Beto Ruiz")
    open_id = await _published(client, employer, minutes=120)
    assigned_id = await _assigned(client, employer, ana_id)
    user_id = await _user_id(client, admin, "g6_emp17@staffya.com")
    assert (
        await client.post(f"/api/v1/admin/users/{user_id}/suspend", headers=admin)
    ).status_code == 200
    assert open_id not in await _feed_ids(client, beto, scope="all")

    activated = await client.post(f"/api/v1/admin/users/{user_id}/activate", headers=admin)
    assert activated.status_code == 200

    assert open_id in await _feed_ids(client, beto)
    assert open_id in await _feed_ids(client, beto, scope="all")
    assert (await client.get(f"/api/v1/shifts/{open_id}/public")).status_code == 200
    applied = await client.post(f"/api/v1/applications/shifts/{open_id}", headers=beto)
    assert applied.status_code == 201
    # Lo cancelado por la suspensión sigue cancelado.
    detail = await client.get(f"/api/v1/shifts/{assigned_id}", headers=admin)
    assert detail.json()["status"] == "cancelado"
