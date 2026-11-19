"""G4 (U021, U123): quien tuvo el turno asignado y lo dejó queda escrito.

Antes, cuando la persona asignada rechazaba, cancelaba o faltaba, su
postulación seguía «aceptada» para siempre: en la lista del comercio aparecía
como cualquier postulante, con «Asignar» y sin ninguna marca.

1. Rechazo, cancelación y ausencia dejan la postulación `desasignada` con su
   motivo; si la persona fue asignada sin postularse, la fila se crea.
2. La lista de postulantes: sin las retiradas, y las desasignadas al final.
3. Se le puede volver a asignar; ella no puede postularse otra vez.
4. No vuelve como «Recomendada». La suspensión no deja marca (ADR-0024).
5. U123: un solo aviso cuando la app retira postulaciones del mismo horario.
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.modules.application.domain.entities import ShiftApplication
from app.modules.application.domain.exceptions import InvalidApplicationTransitionError
from app.modules.application.domain.value_objects import (
    ApplicationStatus,
    MotivoDesasignacion,
)
from tests._turno_empezado import empezar_turno
from tests.conftest import make_admin
from tests.test_cuentas_suspendidas import (
    _apply,
    _assign,
    _confirmed,
    _employer,
    _notices,
    _published,
    _suspend,
    _worker,
)

# --- Dominio -----------------------------------------------------------------


def _aceptada() -> ShiftApplication:
    return ShiftApplication(
        shift_id=uuid4(), worker_profile_id=uuid4(), status=ApplicationStatus.ACEPTADA
    )


@pytest.mark.parametrize("motivo", list(MotivoDesasignacion))
def test_desasignar_guarda_el_motivo_y_reasignar_lo_borra(motivo):
    postulacion = _aceptada()

    postulacion.unassign(motivo)
    assert postulacion.status == ApplicationStatus.DESASIGNADA
    assert postulacion.motivo == motivo

    postulacion.accept()
    assert postulacion.status == ApplicationStatus.ACEPTADA
    assert postulacion.motivo is None


@pytest.mark.parametrize(
    "status",
    [ApplicationStatus.PENDIENTE, ApplicationStatus.RECHAZADA, ApplicationStatus.RETIRADA],
)
def test_solo_se_desasigna_a_quien_tenia_el_turno(status):
    postulacion = ShiftApplication(shift_id=uuid4(), worker_profile_id=uuid4(), status=status)
    with pytest.raises(InvalidApplicationTransitionError):
        postulacion.unassign(MotivoDesasignacion.RECHAZO)
    assert postulacion.status == status


def test_una_desasignada_no_se_retira_ni_se_vuelve_a_postular():
    postulacion = _aceptada()
    postulacion.unassign(MotivoDesasignacion.CANCELACION)
    for transicion in (postulacion.withdraw, postulacion.reapply, postulacion.restore):
        with pytest.raises(InvalidApplicationTransitionError):
            transicion()
    assert postulacion.status == ApplicationStatus.DESASIGNADA
    assert postulacion.motivo == MotivoDesasignacion.CANCELACION


def test_una_rechazada_no_se_puede_asignar():
    postulacion = ShiftApplication(
        shift_id=uuid4(), worker_profile_id=uuid4(), status=ApplicationStatus.RECHAZADA
    )
    with pytest.raises(InvalidApplicationTransitionError):
        postulacion.accept()


def test_el_motivo_va_solo_con_la_desasignada():
    with pytest.raises(ValueError):
        ShiftApplication(
            shift_id=uuid4(), worker_profile_id=uuid4(), motivo=MotivoDesasignacion.RECHAZO
        )
    with pytest.raises(ValueError):
        ShiftApplication(
            shift_id=uuid4(), worker_profile_id=uuid4(), status=ApplicationStatus.DESASIGNADA
        )


def test_soltar_por_suspension_la_deja_pendiente_y_sin_marca():
    postulacion = _aceptada()
    postulacion.release()
    assert postulacion.status == ApplicationStatus.PENDIENTE
    assert postulacion.motivo is None


# --- API -----------------------------------------------------------------------


async def _applicants(client: AsyncClient, shift_id: str, employer: dict) -> list[dict]:
    resp = await client.get(f"/api/v1/applications/shifts/{shift_id}", headers=employer)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _mine(client: AsyncClient, worker: dict, shift_id: str) -> dict | None:
    resp = await client.get("/api/v1/applications/mine", headers=worker)
    assert resp.status_code == 200, resp.text
    return next((a for a in resp.json() if a["shift_id"] == shift_id), None)


def _marca(applicants: list[dict], profile_id: str) -> tuple[str, str | None]:
    row = next(a for a in applicants if a["worker_profile_id"] == profile_id)
    return row["status"], row["motivo"]


@pytest.mark.asyncio
async def test_rechazar_la_asignacion_deja_la_postulacion_desasignada(client: AsyncClient):
    employer = await _employer(client, "g4_emp1@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana1@staffya.com", "Ana Rechaza")
    shift_id = await _published(client, employer, minutes=600)
    await _apply(client, shift_id, ana)
    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200

    rejected = await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=ana)
    assert rejected.status_code == 200, rejected.text

    assert _marca(await _applicants(client, shift_id, employer), ana_id) == (
        "desasignada",
        "rechazo",
    )
    mine = await _mine(client, ana, shift_id)
    assert (mine["status"], mine["motivo"]) == ("desasignada", "rechazo")


@pytest.mark.asyncio
async def test_cancelar_despues_de_confirmar_deja_el_motivo_cancelacion(client: AsyncClient):
    employer = await _employer(client, "g4_emp2@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana2@staffya.com", "Ana Cancela")
    shift_id = await _published(client, employer, minutes=600)
    await _apply(client, shift_id, ana)
    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200
    assert (await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=ana)).status_code == 200

    cancelled = await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=ana)
    assert cancelled.status_code == 200, cancelled.text

    assert _marca(await _applicants(client, shift_id, employer), ana_id) == (
        "desasignada",
        "cancelacion",
    )


@pytest.mark.asyncio
async def test_no_presentarse_deja_el_motivo_ausencia(client: AsyncClient, session_factory):
    employer = await _employer(client, "g4_emp3@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana3@staffya.com", "Ana Falta")
    shift_id = await _published(client, employer, minutes=600)
    await _apply(client, shift_id, ana)
    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200
    assert (await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=ana)).status_code == 200
    await empezar_turno(session_factory, shift_id)

    no_show = await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=employer)
    assert no_show.status_code == 200, no_show.text

    assert _marca(await _applicants(client, shift_id, employer), ana_id) == (
        "desasignada",
        "ausencia",
    )


@pytest.mark.asyncio
async def test_asignada_sin_postularse_que_rechaza_queda_en_la_lista_con_su_marca(
    client: AsyncClient,
):
    """Asignación directa (desde «Recomendados»): no había postulación. Al
    rechazar se crea, ya desasignada, para que el hecho quede escrito."""
    employer = await _employer(client, "g4_emp4@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana4@staffya.com", "Ana Directa")
    shift_id = await _published(client, employer, minutes=600)
    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200
    assert await _mine(client, ana, shift_id) is None

    assert (await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=ana)).status_code == 200

    applicants = await _applicants(client, shift_id, employer)
    assert [a["worker_profile_id"] for a in applicants] == [ana_id]
    assert _marca(applicants, ana_id) == ("desasignada", "rechazo")


@pytest.mark.asyncio
async def test_la_lista_no_muestra_retiradas_y_deja_las_desasignadas_al_final(
    client: AsyncClient,
):
    employer = await _employer(client, "g4_emp5@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana5@staffya.com", "Ana Rechaza")
    beto, beto_id = await _worker(client, "g4_beto5@staffya.com", "Beto Sigue")
    caro, caro_id = await _worker(client, "g4_caro5@staffya.com", "Caro Retira")
    shift_id = await _published(client, employer, minutes=600)
    # Ana es la última en postularse: sin la regla iría primera (más reciente).
    await _apply(client, shift_id, beto)
    await _apply(client, shift_id, caro)
    await _apply(client, shift_id, ana)
    caro_application = (await _mine(client, caro, shift_id))["id"]
    withdrawn = await client.post(
        f"/api/v1/applications/{caro_application}/withdraw", headers=caro
    )
    assert withdrawn.status_code == 200, withdrawn.text
    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200
    assert (await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=ana)).status_code == 200

    applicants = await _applicants(client, shift_id, employer)

    assert [(a["worker_profile_id"], a["status"]) for a in applicants] == [
        (beto_id, "pendiente"),
        (ana_id, "desasignada"),
    ]
    assert caro_id not in {a["worker_profile_id"] for a in applicants}
    # El contador del panel sigue contando sólo a quien está en carrera.
    panel = await client.get("/api/v1/shifts/me", headers=employer)
    turno = next(s for s in panel.json() if s["id"] == shift_id)
    assert turno["pending_applicants_count"] == 1


@pytest.mark.asyncio
async def test_se_puede_volver_a_asignar_a_quien_rechazo(client: AsyncClient):
    employer = await _employer(client, "g4_emp6@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana6@staffya.com", "Ana Vuelve")
    shift_id = await _published(client, employer, minutes=600)
    await _apply(client, shift_id, ana)
    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200
    assert (await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=ana)).status_code == 200

    again = await _assign(client, shift_id, employer, ana_id)
    assert again.status_code == 200, again.text
    assert again.json()["worker_profile_id"] == ana_id

    mine = await _mine(client, ana, shift_id)
    assert (mine["status"], mine["motivo"]) == ("aceptada", None)
    # Y si vuelve a dejarlo, vuelve a quedar marcada.
    assert (await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=ana)).status_code == 200
    assert (
        await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=ana)
    ).status_code == 200
    mine = await _mine(client, ana, shift_id)
    assert (mine["status"], mine["motivo"]) == ("desasignada", "cancelacion")


@pytest.mark.asyncio
async def test_quien_dejo_el_turno_no_puede_postularse_otra_vez(client: AsyncClient):
    employer = await _employer(client, "g4_emp7@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana7@staffya.com", "Ana Insiste")
    shift_id = await _published(client, employer, minutes=600)
    await _apply(client, shift_id, ana)
    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200
    assert (await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=ana)).status_code == 200

    again = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=ana)

    assert again.status_code == 409
    assert "Ya tuviste este turno asignado" in again.json()["detail"]
    mine = await _mine(client, ana, shift_id)
    assert (mine["status"], mine["motivo"]) == ("desasignada", "rechazo")


@pytest.mark.asyncio
async def test_asignar_desde_recomendados_a_quien_habia_retirado_su_postulacion(
    client: AsyncClient,
):
    """El comercio puede asignar a alguien que retiró su postulación (sigue
    saliendo en «Recomendados»). Su postulación pasa a aceptada, así que si
    después rechaza queda marcada como cualquiera."""
    employer = await _employer(client, "g4_emp8@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana8@staffya.com", "Ana Retiró")
    shift_id = await _published(client, employer, minutes=600)
    await _apply(client, shift_id, ana)
    application_id = (await _mine(client, ana, shift_id))["id"]
    assert (
        await client.post(f"/api/v1/applications/{application_id}/withdraw", headers=ana)
    ).status_code == 200

    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200
    assert (await _mine(client, ana, shift_id))["status"] == "aceptada"

    assert (await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=ana)).status_code == 200
    mine = await _mine(client, ana, shift_id)
    assert (mine["status"], mine["motivo"]) == ("desasignada", "rechazo")


@pytest.mark.asyncio
async def test_quien_dejo_el_turno_no_vuelve_como_recomendada(client: AsyncClient):
    employer = await _employer(client, "g4_emp9@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana9@staffya.com", "Ana Rechaza")
    beto, beto_id = await _worker(client, "g4_beto9@staffya.com", "Beto Sigue")
    shift_id = await _published(client, employer, minutes=600)

    async def recomendados() -> set[str]:
        resp = await client.get(f"/api/v1/shifts/{shift_id}/candidates", headers=employer)
        assert resp.status_code == 200, resp.text
        return {c["profile_id"] for c in resp.json()}

    assert await recomendados() == {ana_id, beto_id}
    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200
    assert (await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=ana)).status_code == 200

    assert await recomendados() == {beto_id}
    # Sigue en la lista de postulantes, que es desde donde se la reasigna.
    assert _marca(await _applicants(client, shift_id, employer), ana_id) == (
        "desasignada",
        "rechazo",
    )


@pytest.mark.asyncio
async def test_la_suspension_no_deja_marca(client: AsyncClient, session_factory):
    """ADR-0024: a quien se le suspende la cuenta se le suelta el turno, pero
    no fue una decisión suya. Su postulación vuelve a pendiente."""
    employer = await _employer(client, "g4_emp10@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana10@staffya.com", "Ana Suspendida")
    admin = await make_admin(client, session_factory, "g4_admin10@staffya.com")
    shift_id = await _published(client, employer, minutes=600)
    await _apply(client, shift_id, ana)
    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200
    assert (await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=ana)).status_code == 200

    assert (await _suspend(client, admin, "g4_ana10@staffya.com")).status_code == 200

    # Suspendida no aparece en la lista (ADR-0024)...
    assert await _applicants(client, shift_id, employer) == []
    # ...y al reactivarla vuelve como una postulante más, sin marca.
    users = await client.get(
        "/api/v1/admin/users", headers=admin, params={"q": "g4_ana10@staffya.com"}
    )
    user_id = users.json()[0]["id"]
    activated = await client.post(f"/api/v1/admin/users/{user_id}/activate", headers=admin)
    assert activated.status_code == 200, activated.text
    assert _marca(await _applicants(client, shift_id, employer), ana_id) == ("pendiente", None)


# --- U123 ----------------------------------------------------------------------


async def _published_at(client: AsyncClient, employer: dict, start: datetime, title: str) -> str:
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json={
            "title": title,
            "position": "mozo",
            "quantity": 1,
            "start_at": start.replace(tzinfo=None).isoformat(),
            "end_at": (start + timedelta(hours=6)).replace(tzinfo=None).isoformat(),
            "pay_amount": "70000.00",
            "city": "Palermo",
        },
    )
    assert created.status_code == 201, created.text
    shift_id = created.json()["id"]
    assert (
        await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    ).status_code == 200
    return shift_id


@pytest.mark.asyncio
async def test_confirmar_avisa_una_vez_las_postulaciones_que_se_retiraron(client: AsyncClient):
    employer = await _employer(client, "g4_emp11@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana11@staffya.com", "Ana Confirma")
    start = datetime.now(timezone.utc) + timedelta(days=2)
    confirmado = await _published_at(client, employer, start, "Cena del sábado")
    pisado_1 = await _published_at(client, employer, start + timedelta(hours=1), "Barra")
    pisado_2 = await _published_at(client, employer, start + timedelta(hours=2), "Salón")
    libre = await _published_at(client, employer, start + timedelta(days=1), "Domingo")
    for shift_id in (confirmado, pisado_1, pisado_2, libre):
        await _apply(client, shift_id, ana)
    assert (await _assign(client, confirmado, employer, ana_id)).status_code == 200

    assert (await client.post(f"/api/v1/shifts/{confirmado}/confirm", headers=ana)).status_code == 200

    avisos = await _notices(client, ana, "applications_withdrawn")
    assert len(avisos) == 1
    aviso = avisos[0]
    assert aviso["title"] == "Retiramos 2 postulaciones"
    assert '"Cena del sábado"' in aviso["message"]
    assert '"Barra" en Bar Palermo' in aviso["message"]
    assert '"Salón" en Bar Palermo' in aviso["message"]
    assert "Domingo" not in aviso["message"]
    assert "podés volver a postularte" in aviso["message"]
    assert aviso["link"] == "/my-shifts"
    assert (await _mine(client, ana, libre))["status"] == "pendiente"
    assert (await _mine(client, ana, pisado_1))["status"] == "retirada"


@pytest.mark.asyncio
async def test_confirmar_sin_postulaciones_pisadas_no_avisa(client: AsyncClient):
    employer = await _employer(client, "g4_emp12@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana12@staffya.com", "Ana Sola")

    await _confirmed(client, employer, ana, ana_id, minutes=600)

    assert await _notices(client, ana, "applications_withdrawn") == []


@pytest.mark.asyncio
async def test_el_aviso_de_una_sola_postulacion_la_nombra(client: AsyncClient):
    employer = await _employer(client, "g4_emp13@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana13@staffya.com", "Ana Confirma")
    start = datetime.now(timezone.utc) + timedelta(days=2)
    confirmado = await _published_at(client, employer, start, "Cena")
    pisado = await _published_at(client, employer, start + timedelta(hours=1), "Barra")
    for shift_id in (confirmado, pisado):
        await _apply(client, shift_id, ana)
    assert (await _assign(client, confirmado, employer, ana_id)).status_code == 200

    assert (await client.post(f"/api/v1/shifts/{confirmado}/confirm", headers=ana)).status_code == 200

    (aviso,) = await _notices(client, ana, "applications_withdrawn")
    assert aviso["title"] == "Retiramos una postulación"
    assert (
        aviso["message"]
        == 'Confirmaste "Cena", así que retiramos tu postulación a "Barra" en Bar '
        "Palermo, que es en el mismo horario. Si el turno confirmado se cae, podés "
        "volver a postularte."
    )


# --- Revisión independiente: carreras ------------------------------------------


@pytest.mark.asyncio
async def test_si_la_marca_choca_con_otra_escritura_el_pedido_igual_termina_bien(
    client: AsyncClient, session_factory, monkeypatch
):
    """Entre leer y escribir, otro pedido creó la fila (la persona se postuló
    justo): el INSERT choca con la fila única. Antes el error se atrapaba pero
    la sesión quedaba rota y el pedido terminaba en 500, sin contar la
    cancelación ni avisar al comercio. Ahora la sesión se recupera y la
    segunda vuelta encuentra la fila y la marca."""
    from app.modules.application.infrastructure.repositories import (
        SqlAlchemyShiftApplicationRepository as Repo,
    )

    employer = await _employer(client, "g4_emp14@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana14@staffya.com", "Ana Carrera")
    shift_id = await _published(client, employer, minutes=600)
    await _apply(client, shift_id, ana)
    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200
    assert (await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=ana)).status_code == 200

    real = Repo.get_by_shift_and_worker
    calls = {"n": 0}

    async def primero_no_la_ve(self, shift_id_, worker_profile_id_):
        calls["n"] += 1
        if calls["n"] == 1:
            return None
        return await real(self, shift_id_, worker_profile_id_)

    monkeypatch.setattr(Repo, "get_by_shift_and_worker", primero_no_la_ve)

    cancelled = await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=ana)

    assert cancelled.status_code == 200, cancelled.text
    assert calls["n"] == 2
    monkeypatch.setattr(Repo, "get_by_shift_and_worker", real)
    mine = await _mine(client, ana, shift_id)
    assert (mine["status"], mine["motivo"]) == ("desasignada", "cancelacion")
    # Lo que viene después de la marca en el mismo pedido también se hizo.
    profile = await client.get("/api/v1/workers/me/profile", headers=ana)
    assert profile.json()["cancellations"] == 1
    assert len(await _notices(client, employer, "shift_reopened")) == 1


@pytest.mark.asyncio
async def test_no_marca_a_quien_volvio_a_tener_el_turno(client: AsyncClient, session_factory):
    """El turno se guarda reabierto antes de escribir la marca. Si en ese
    hueco el comercio vuelve a asignar a la misma persona, no se la marca:
    quedaría «desasignada» con el turno en la mano."""
    from app.modules.application.domain.value_objects import MotivoDesasignacion as Motivo
    from uuid import UUID

    from fastapi import BackgroundTasks

    from app.modules.shift.api.dependencies import get_shift_service

    employer = await _employer(client, "g4_emp15@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana15@staffya.com", "Ana Reasignada")
    shift_id = await _published(client, employer, minutes=600)
    await _apply(client, shift_id, ana)
    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200

    async with session_factory() as session:
        service = get_shift_service(session, email_sender=None, background_tasks=BackgroundTasks())
        await service._mark_unassigned(UUID(shift_id), UUID(ana_id), Motivo.RECHAZO)

    mine = await _mine(client, ana, shift_id)
    assert (mine["status"], mine["motivo"]) == ("aceptada", None)


# --- La fila que escribe el sistema no es una postulación de la persona ---------


def test_la_fila_sin_postulacion_no_cuenta_como_postulacion_propia():
    fila = ShiftApplication.unassigned(uuid4(), uuid4(), MotivoDesasignacion.RECHAZO)
    assert fila.se_postulo is False
    # El comercio la vuelve a asignar y después se le suelta por suspensión:
    # no se le inventa una postulación pendiente.
    fila.accept()
    fila.release()
    assert fila.status == ApplicationStatus.RETIRADA
    # Si ahora se postula ella, ya es una postulación suya.
    fila.reapply()
    assert (fila.status, fila.se_postulo) == (ApplicationStatus.PENDIENTE, True)


@pytest.mark.asyncio
async def test_rechazar_una_asignacion_directa_no_le_abre_el_cv_al_comercio(client: AsyncClient):
    """Revisión de seguridad 2026-10-21: el comercio no puede fabricarse el
    vínculo asignando directo. La fila `desasignada` que deja el rechazo no es
    una postulación de la persona."""
    employer = await _employer(client, "g4_emp16@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana16@staffya.com", "Ana Privada")
    updated = await client.put(
        "/api/v1/workers/me/profile",
        headers=ana,
        json={"skills": ["mozo"], "city": "Palermo", "cv_url": "https://example.com/cv-g4.pdf"},
    )
    assert updated.status_code == 200, updated.text
    shift_id = await _published(client, employer, minutes=600)
    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200
    assert (await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=ana)).status_code == 200
    assert _marca(await _applicants(client, shift_id, employer), ana_id) == (
        "desasignada",
        "rechazo",
    )

    seen = await client.get(f"/api/v1/workers/{ana_id}", headers=employer)

    assert seen.status_code == 200, seen.text
    assert seen.json()["cv_url"] is None
    assert seen.json()["cv_kind"] is None
    link = await client.get(f"/api/v1/workers/{ana_id}/cv-link", headers=employer)
    assert link.status_code == 404


@pytest.mark.asyncio
async def test_la_fila_sin_postulacion_no_suma_en_las_metricas_de_postulaciones(
    client: AsyncClient, session_factory
):
    from app.modules.application.infrastructure.repositories import (
        SqlAlchemyShiftApplicationRepository as Repo,
    )

    employer = await _employer(client, "g4_emp17@staffya.com")
    ana, ana_id = await _worker(client, "g4_ana17@staffya.com", "Ana Directa")
    beto, _ = await _worker(client, "g4_beto17@staffya.com", "Beto Postulado")
    shift_id = await _published(client, employer, minutes=600)
    await _apply(client, shift_id, beto)
    assert (await _assign(client, shift_id, employer, ana_id)).status_code == 200
    assert (await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=ana)).status_code == 200

    async with session_factory() as session:
        stats = await Repo(session).count_application_stats()

    assert stats.total == 1
