"""Verificación de identidad obligatoria para que te asignen un turno
(decisión de Julieta, 2026-11-26; `settings.verificacion_obligatoria`).

Registrarse, mirar y postularse sigue libre. Lo que no se puede sin la
identidad verificada es quedar asignado: es lo que le asegura al comercio que
la persona es quien dice ser.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.modules.verification.domain.value_objects import ClaimStatus, ClaimType
from app.modules.verification.infrastructure.models import IdentityClaimModel
from app.modules.worker.infrastructure.models import WorkerProfileModel
from tests.conftest import auth_headers
from tests.test_scheduler import _shift_payload


@pytest.fixture
def obligatoria(monkeypatch):
    monkeypatch.setattr(settings, "verificacion_obligatoria", True)


async def _turno_y_persona(client: AsyncClient, prefix: str) -> tuple[str, dict, dict, str]:
    start_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)
    employer = await auth_headers(client, "employer", f"{prefix}_emp@staffya.com")
    await client.post(
        "/api/v1/companies/me/profile", headers=employer, json={"name": "Bar", "city": "Palermo"}
    )
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json=_shift_payload(
            start_at=start_at.isoformat(), end_at=(start_at + timedelta(hours=5)).isoformat()
        ),
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    worker = await auth_headers(client, "worker", f"{prefix}_w@staffya.com")
    profile = await client.post(
        "/api/v1/workers/me/profile", headers=worker, json={"skills": ["mozo"]}
    )
    return shift_id, employer, worker, profile.json()["id"]


async def _verificar(session_factory, worker_profile_id: str) -> None:
    async with session_factory() as session:
        perfil = await session.get(WorkerProfileModel, UUID(worker_profile_id))
        session.add(
            IdentityClaimModel(
                user_id=perfil.user_id,
                claim_type=ClaimType.DOCUMENTO_VERIFICADO.value,
                status=ClaimStatus.VERIFICADA.value,
            )
        )
        await session.commit()


async def _asignar(client, shift_id, employer, worker_profile_id):
    return await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": worker_profile_id},
    )


@pytest.mark.asyncio
async def test_sin_verificar_se_puede_postular_pero_no_quedar_asignado(
    client, session_factory, obligatoria
):
    shift_id, employer, worker, perfil = await _turno_y_persona(client, "vo_sin")

    # Postularse sigue libre.
    postulacion = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    assert postulacion.status_code in (200, 201), postulacion.text

    respuesta = await _asignar(client, shift_id, employer, perfil)

    assert respuesta.status_code == 409
    assert "no verificó su identidad" in respuesta.json()["detail"]
    # El turno sigue abierto y la postulación, pendiente.
    turno = (await client.get(f"/api/v1/shifts/{shift_id}", headers=employer)).json()
    assert turno["worker_profile_id"] is None
    [postulante] = (
        await client.get(f"/api/v1/applications/shifts/{shift_id}", headers=employer)
    ).json()
    assert postulante["status"] == "pendiente"
    assert postulante["identidad_verificada"] is False


@pytest.mark.asyncio
async def test_con_la_identidad_verificada_se_asigna(client, session_factory, obligatoria):
    shift_id, employer, _worker, perfil = await _turno_y_persona(client, "vo_ok")
    await _verificar(session_factory, perfil)

    respuesta = await _asignar(client, shift_id, employer, perfil)

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["worker_profile_id"] == perfil


@pytest.mark.asyncio
async def test_con_la_regla_apagada_todo_sigue_como_antes(client, session_factory):
    shift_id, employer, worker, perfil = await _turno_y_persona(client, "vo_off")

    respuesta = await _asignar(client, shift_id, employer, perfil)

    assert respuesta.status_code == 200, respuesta.text
    mio = (await client.get("/api/v1/workers/me/profile", headers=worker)).json()
    assert mio["verificacion_requerida"] is False


@pytest.mark.asyncio
async def test_el_perfil_propio_dice_si_hace_falta_verificarse(
    client, session_factory, obligatoria
):
    _shift, _employer, worker, perfil = await _turno_y_persona(client, "vo_perfil")

    mio = (await client.get("/api/v1/workers/me/profile", headers=worker)).json()
    assert mio["verificacion_requerida"] is True
    assert mio["identidad_verificada"] is False

    await _verificar(session_factory, perfil)
    mio = (await client.get("/api/v1/workers/me/profile", headers=worker)).json()
    assert mio["identidad_verificada"] is True
