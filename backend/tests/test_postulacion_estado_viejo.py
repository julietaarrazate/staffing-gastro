"""La postulación se decide sobre un estado que ya cambió (pasada por clase de
error del 2026-11-19): VIE-01 (el comercio con la lista vieja), CON-04
(postularse mientras el comercio asigna o cancela) y CON-11 (confirmar a la vez
dos turnos que se superponen).

Las carreras se arman con un gancho en el hueco entre la lectura y la
escritura, que es donde entra el otro pedido en producción."""

import asyncio
import os
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_session
from app.core.ws_manager import ws_manager
from app.main import app
from app.modules.application.application.services import ApplicationService
from app.modules.notification.infrastructure.repositories import LIVE_REFRESH_FRAME
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from app.modules.worker.infrastructure.repositories import SqlAlchemyWorkerProfileRepository
from tests.test_attendance import _employer_with_company, _shift_payload, _worker_with_profile

pytestmark = pytest.mark.asyncio

_FUTURO = {"start_at": "2030-06-28T20:00:00", "end_at": "2030-06-29T03:00:00"}


async def _published(client: AsyncClient, prefix: str) -> tuple[str, dict]:
    employer = await _employer_with_company(client, f"{prefix}_emp@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer, json=_shift_payload(**_FUTURO)
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    return shift_id, employer


async def _user_id(client: AsyncClient, headers: dict) -> UUID:
    return UUID((await client.get("/api/v1/auth/me", headers=headers)).json()["id"])


@pytest.fixture
def frames(monkeypatch):
    """Todo lo que sale por el socket de avisos: (user_id, payload)."""
    enviados: list[tuple[UUID, dict]] = []

    async def broadcast(user_id, payload):
        enviados.append((user_id, payload))

    monkeypatch.setattr(ws_manager, "broadcast_notification", broadcast)
    return enviados


# --- VIE-01 ---------------------------------------------------------------


async def test_retirar_la_postulacion_le_pide_al_comercio_que_recargue_sin_dejar_aviso(
    client: AsyncClient, frames
):
    shift_id, employer = await _published(client, "vie01")
    worker, _ = await _worker_with_profile(client, "vie01_w@staffya.com")
    applied = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    app_id = applied.json()["id"]
    employer_id = await _user_id(client, employer)
    frames.clear()  # el aviso de postulante nuevo no es lo que se prueba

    withdrawn = await client.post(f"/api/v1/applications/{app_id}/withdraw", headers=worker)
    assert withdrawn.status_code == 200

    # Al comercio le llega el cuadro de refresco, y sólo a él...
    assert frames == [(employer_id, {"type": LIVE_REFRESH_FRAME})]
    # ...que no es un aviso: ni en la campanita ni con push.
    avisos = (await client.get("/api/v1/notifications", headers=employer)).json()
    assert [n["type"] for n in avisos] == ["new_applicant"]


async def test_si_falla_el_refresco_el_retiro_igual_se_hace(
    client: AsyncClient, monkeypatch
):
    shift_id, _ = await _published(client, "vie01b")
    worker, _ = await _worker_with_profile(client, "vie01b_w@staffya.com")
    app_id = (await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)).json()["id"]

    async def roto(user_id, payload):
        raise RuntimeError("socket caído")

    monkeypatch.setattr(ws_manager, "broadcast_notification", roto)
    withdrawn = await client.post(f"/api/v1/applications/{app_id}/withdraw", headers=worker)
    assert withdrawn.status_code == 200
    assert withdrawn.json()["status"] == "retirada"


async def test_asignar_desde_recomendados_a_quien_retiro_sigue_andando(client: AsyncClient):
    """ADR-0026 punto 5: la regla de `/assign` no cambia."""
    shift_id, employer = await _published(client, "vie01c")
    worker, profile_id = await _worker_with_profile(client, "vie01c_w@staffya.com")
    app_id = (await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)).json()["id"]
    await client.post(f"/api/v1/applications/{app_id}/withdraw", headers=worker)
    asignado = await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": profile_id},
    )
    assert asignado.status_code == 200


# --- CON-04 ---------------------------------------------------------------


async def _postularse_mientras(client, monkeypatch, shift_id, tardia, accion_del_comercio):
    """La postulación de `tardia` lee el turno abierto y, antes de escribir,
    el comercio hace `accion_del_comercio`."""
    original = ApplicationService._account_active
    hecho = False

    async def account_active(self, user_id):
        nonlocal hecho
        if not hecho:
            hecho = True
            await accion_del_comercio()
        return await original(self, user_id)

    monkeypatch.setattr(ApplicationService, "_account_active", account_active)
    try:
        return await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=tardia)
    finally:
        monkeypatch.setattr(ApplicationService, "_account_active", original)


async def test_postulacion_que_llega_mientras_asignan_no_queda_pendiente(
    client: AsyncClient, monkeypatch
):
    shift_id, employer = await _published(client, "con04")
    _, elegida_id = await _worker_with_profile(client, "con04_a@staffya.com")
    tardia, _ = await _worker_with_profile(client, "con04_b@staffya.com")

    async def asignar():
        res = await client.post(
            f"/api/v1/shifts/{shift_id}/assign",
            headers=employer,
            json={"worker_profile_id": elegida_id},
        )
        assert res.status_code == 200

    tarde = await _postularse_mientras(client, monkeypatch, shift_id, tardia, asignar)

    # La misma respuesta que postularse a un turno cerrado.
    cerrado_antes = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=tardia)
    assert tarde.status_code == cerrado_antes.status_code == 404
    assert tarde.json() == cerrado_antes.json()
    estados = [a["status"] for a in (await client.get("/api/v1/applications/mine", headers=tardia)).json()]
    assert "pendiente" not in estados
    # Y al comercio no le llegó «postulante nuevo» de un turno ya cubierto.
    avisos = (await client.get("/api/v1/notifications", headers=employer)).json()
    assert [n for n in avisos if n["type"] == "new_applicant"] == []


async def test_si_la_asignan_a_ella_mientras_se_postula_queda_aceptada(
    client: AsyncClient, monkeypatch
):
    """El comercio la asigna desde «Recomendados» justo mientras ella se
    postula: tiene el turno, así que la postulación queda aceptada (no
    retirada) y ella no recibe «turno no disponible» (revisión del
    2026-11-19)."""
    shift_id, employer = await _published(client, "con04c")
    ella, ella_id = await _worker_with_profile(client, "con04c_a@staffya.com")

    async def asignarla():
        res = await client.post(
            f"/api/v1/shifts/{shift_id}/assign",
            headers=employer,
            json={"worker_profile_id": ella_id},
        )
        assert res.status_code == 200

    respuesta = await _postularse_mientras(client, monkeypatch, shift_id, ella, asignarla)
    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json()["status"] == "aceptada"
    mias = (await client.get("/api/v1/applications/mine", headers=ella)).json()
    assert [a["status"] for a in mias if a["shift_id"] == shift_id] == ["aceptada"]
    avisos = (await client.get("/api/v1/notifications", headers=employer)).json()
    assert [n for n in avisos if n["type"] == "new_applicant"] == []


async def test_postulacion_que_llega_mientras_cancelan_no_queda_pendiente(
    client: AsyncClient, monkeypatch
):
    shift_id, employer = await _published(client, "con04c")
    tardia, _ = await _worker_with_profile(client, "con04c_b@staffya.com")

    async def cancelar():
        res = await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=employer)
        assert res.status_code == 200, res.text

    tarde = await _postularse_mientras(client, monkeypatch, shift_id, tardia, cancelar)
    assert tarde.status_code == 404
    estados = [a["status"] for a in (await client.get("/api/v1/applications/mine", headers=tardia)).json()]
    assert "pendiente" not in estados


async def test_volver_a_postularse_mientras_asignan_tampoco_queda_pendiente(
    client: AsyncClient, monkeypatch
):
    """Mismo hueco por el camino de reactivar una postulación retirada."""
    shift_id, employer = await _published(client, "con04r")
    _, elegida_id = await _worker_with_profile(client, "con04r_a@staffya.com")
    tardia, _ = await _worker_with_profile(client, "con04r_b@staffya.com")
    app_id = (await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=tardia)).json()["id"]
    await client.post(f"/api/v1/applications/{app_id}/withdraw", headers=tardia)

    async def asignar():
        await client.post(
            f"/api/v1/shifts/{shift_id}/assign",
            headers=employer,
            json={"worker_profile_id": elegida_id},
        )

    tarde = await _postularse_mientras(client, monkeypatch, shift_id, tardia, asignar)
    assert tarde.status_code == 404
    estados = [a["status"] for a in (await client.get("/api/v1/applications/mine", headers=tardia)).json()]
    assert estados == ["retirada"]


async def test_postularse_a_un_turno_abierto_sigue_andando(client: AsyncClient):
    shift_id, _ = await _published(client, "con04ok")
    worker, _ = await _worker_with_profile(client, "con04ok_w@staffya.com")
    res = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    assert res.status_code == 201
    assert res.json()["status"] == "pendiente"


# --- CON-11 ---------------------------------------------------------------


async def _asignado(client: AsyncClient, emp_email: str, profile_id: str) -> str:
    employer = await _employer_with_company(client, emp_email)
    created = await client.post(
        "/api/v1/shifts", headers=employer, json=_shift_payload(**_FUTURO)
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    res = await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": profile_id},
    )
    assert res.status_code == 200
    return shift_id


async def test_confirmar_toma_la_agenda_de_la_persona_antes_de_leer_sus_turnos(
    client: AsyncClient, monkeypatch
):
    """En SQLite el bloqueo no hace nada, así que acá se prueba el orden: el
    bloqueo de la agenda tiene que estar tomado ANTES de leer los comprometidos
    (la carrera real, contra Postgres, está en el test de abajo)."""
    worker, profile_id = await _worker_with_profile(client, "con11o_w@staffya.com")
    turno = await _asignado(client, "con11o_a@staffya.com", profile_id)
    orden: list[str] = []
    lock = SqlAlchemyWorkerProfileRepository.lock_agenda
    lista = SqlAlchemyShiftRepository.list_by_worker_and_statuses

    async def espiar_lock(self, pid):
        orden.append(f"lock:{pid}")
        return await lock(self, pid)

    async def espiar_lista(self, pid, statuses):
        orden.append("lista")
        return await lista(self, pid, statuses)

    monkeypatch.setattr(SqlAlchemyWorkerProfileRepository, "lock_agenda", espiar_lock)
    monkeypatch.setattr(SqlAlchemyShiftRepository, "list_by_worker_and_statuses", espiar_lista)
    res = await client.post(f"/api/v1/shifts/{turno}/confirm", headers=worker)
    assert res.status_code == 200
    assert orden == [f"lock:{profile_id}", "lista"]


POSTGRES_URL = os.environ.get("TEST_POSTGRES_URL")


@pytest.mark.skipif(
    not POSTGRES_URL,
    reason="la carrera sólo existe en Postgres: TEST_POSTGRES_URL="
    "postgresql+asyncpg://… apuntando a una base vacía y descartable",
)
async def test_dos_confirmaciones_a_la_vez_de_turnos_superpuestos_comprometen_uno_solo(
    monkeypatch,
):
    """CON-11 con Postgres de verdad: dos pedidos en paralelo, cada uno con su
    sesión, se sacan ventaja leyendo antes de que el otro escriba (la lectura
    se demora a propósito). Sin el bloqueo de la agenda, los dos pasaban."""
    engine = create_async_engine(POSTGRES_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async def session_dep():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = session_dep
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            worker, profile_id = await _worker_with_profile(c, "con11pg_w@staffya.com")
            turno_a = await _asignado(c, "con11pg_a@staffya.com", profile_id)
            turno_b = await _asignado(c, "con11pg_b@staffya.com", profile_id)

            lista = SqlAlchemyShiftRepository.list_by_worker_and_statuses

            async def lista_lenta(self, pid, statuses):
                leidos = await lista(self, pid, statuses)
                await asyncio.sleep(0.5)  # el otro pedido llega en este hueco
                return leidos

            monkeypatch.setattr(
                SqlAlchemyShiftRepository, "list_by_worker_and_statuses", lista_lenta
            )
            res = await asyncio.gather(
                c.post(f"/api/v1/shifts/{turno_a}/confirm", headers=worker),
                c.post(f"/api/v1/shifts/{turno_b}/confirm", headers=worker),
            )
            monkeypatch.setattr(SqlAlchemyShiftRepository, "list_by_worker_and_statuses", lista)

            assert sorted(r.status_code for r in res) == [200, 400], [r.text for r in res]
            estados = [
                (await c.get(f"/api/v1/shifts/{s}", headers=worker)).json()["status"]
                for s in (turno_a, turno_b)
            ]
            assert sorted(estados) == ["asignado", "confirmado"], estados
    finally:
        app.dependency_overrides.clear()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()
