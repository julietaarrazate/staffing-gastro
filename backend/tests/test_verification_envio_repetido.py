"""Envío de verificación seguro ante repetición.

Si la persona manda el formulario dos veces casi a la vez (dos pestañas, doble
toque con conexión lenta), los dos envíos leen «no hay pedido» y los dos
intentan crearlo: el segundo choca con `uq_identity_claim_user_type`. Debe
terminar bien, con UN solo pedido pendiente que lleva las evidencias del último
envío, y sin dejar archivos sin dueño fuera de la cola de borrado.
"""

from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.verification.application.services import VerificationService
from app.modules.verification.domain.entities import Claim
from app.modules.verification.domain.exceptions import ClaimAlreadyExistsError
from app.modules.verification.domain.value_objects import (
    ClaimStatus,
    ClaimType,
    EvidenceFile,
)
from app.modules.verification.infrastructure.models import (
    EvidenceFileDeletionModel,
    IdentityClaimModel,
    IdentityEvidenceModel,
)
from app.modules.verification.infrastructure.repositories import (
    SqlAlchemyClaimRepository,
)
from tests.conftest import auth_headers
from tests.test_verification import _constancia_payload, _doc_payload


def _file(prefix: str = "oido/identidad") -> EvidenceFile:
    return EvidenceFile(
        public_id=f"{prefix}/{uuid4().hex}",
        resource_type="image",
        format="jpg",
        delivery_type="private",
    )


class _LecturaVieja(SqlAlchemyClaimRepository):
    """Repositorio real cuyas primeras `n` lecturas por usuario devuelven «no
    hay pedido», como las que hicieron dos envíos que se pisaron antes de que
    cualquiera de los dos guardara."""

    def __init__(self, session: AsyncSession, stale_reads: int = 1) -> None:
        super().__init__(session)
        self.stale_reads = stale_reads

    async def get_for_user(self, user_id, claim_type):
        if self.stale_reads > 0:
            self.stale_reads -= 1
            return None
        return await super().get_for_user(user_id, claim_type)


async def _claims_of(factory, user_id: UUID) -> list[IdentityClaimModel]:
    async with factory() as s:
        rows = await s.execute(
            select(IdentityClaimModel).where(IdentityClaimModel.user_id == user_id)
        )
        return list(rows.scalars().all())


async def _evidence_ids(factory, claim_id: UUID) -> set[str]:
    async with factory() as s:
        rows = await s.execute(
            select(IdentityEvidenceModel.file_public_id).where(
                IdentityEvidenceModel.claim_id == claim_id
            )
        )
        return {r[0] for r in rows.all()}


async def _queued(factory) -> set[str]:
    async with factory() as s:
        rows = await s.execute(select(EvidenceFileDeletionModel.public_id))
        return {r[0] for r in rows.all()}


@pytest.mark.asyncio
async def test_el_repositorio_traduce_el_choque_de_unicidad(session_factory):
    user_id = uuid4()
    async with session_factory() as s:
        await SqlAlchemyClaimRepository(s).add(
            Claim(user_id=user_id, claim_type=ClaimType.DOCUMENTO_VERIFICADO)
        )
    async with session_factory() as s:
        repo = SqlAlchemyClaimRepository(s)
        with pytest.raises(ClaimAlreadyExistsError):
            await repo.add(
                Claim(user_id=user_id, claim_type=ClaimType.DOCUMENTO_VERIFICADO)
            )
        # La sesión quedó usable (rollback hecho): puede seguir leyendo.
        assert await repo.get_for_user(user_id, ClaimType.DOCUMENTO_VERIFICADO)
    assert len(await _claims_of(session_factory, user_id)) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("tipo", ["identidad", "comercio"])
async def test_dos_envios_que_se_pisan_dejan_un_solo_pedido(session_factory, tipo):
    user_id = uuid4()
    borrados: list[list[UUID]] = []

    async def enviar(repo_cls_kwargs, archivos):
        async with session_factory() as s:
            service = VerificationService(
                _LecturaVieja(s, **repo_cls_kwargs),
                delete_files_later=borrados.append,
            )
            if tipo == "identidad":
                return await service.submit_identity_document(user_id, *archivos)
            return await service.submit_business_document(user_id, archivos[0])

    ganador = (_file(), _file())
    perdedor = (_file(), _file())
    # El que gana ve «no hay» y crea; el que pierde vio «no hay» también.
    await enviar({"stale_reads": 1}, ganador)
    claim = await enviar({"stale_reads": 1}, perdedor)

    claims = await _claims_of(session_factory, user_id)
    assert len(claims) == 1
    assert claims[0].status == ClaimStatus.PENDIENTE.value
    assert claim.status == ClaimStatus.PENDIENTE
    usados = {a.public_id for a in (perdedor if tipo == "identidad" else perdedor[:1])}
    assert await _evidence_ids(session_factory, claims[0].id) == usados
    # Los archivos del envío que perdió la carrera quedaron en la cola de
    # borrado (ninguno sin dueño), y los vigentes no.
    viejos = {a.public_id for a in (ganador if tipo == "identidad" else ganador[:1])}
    assert await _queued(session_factory) == viejos
    assert len(borrados) == 1 and len(borrados[0]) == len(viejos)


@pytest.mark.asyncio
async def test_si_el_reintento_tambien_falla_el_error_sube(session_factory):
    user_id = uuid4()

    class Siempre(SqlAlchemyClaimRepository):
        async def get_for_user(self, user_id, claim_type):
            return None

    async with session_factory() as s:
        await SqlAlchemyClaimRepository(s).add(
            Claim(user_id=user_id, claim_type=ClaimType.NEGOCIO_VERIFICADO)
        )
    async with session_factory() as s:
        service = VerificationService(Siempre(s))
        with pytest.raises(ClaimAlreadyExistsError):
            await service.submit_business_document(user_id, _file("oido/constancias"))
    assert len(await _claims_of(session_factory, user_id)) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "ruta,payload,rol",
    [
        ("/api/v1/identity/me/document", _doc_payload, "worker"),
        ("/api/v1/identity/me/business", _constancia_payload, "employer"),
    ],
)
async def test_api_el_segundo_envio_que_se_pisa_responde_bien(
    client, session_factory, monkeypatch, ruta, payload, rol
):
    headers = await auth_headers(client, rol, f"{rol}-doble@test.com")
    if rol == "employer":
        await client.post(
            "/api/v1/companies/me/profile",
            headers=headers,
            json={"name": "Bar Doble", "city": "Palermo"},
        )

    # El primer envío gana. El segundo había leído «no hay pedido» antes de
    # que el primero guardara (la base de los tests comparte una sola conexión,
    # así que la superposición se arma a mano en vez de con tareas paralelas).
    a = await client.post(ruta, headers=headers, json=payload())

    original = SqlAlchemyClaimRepository.get_for_user
    pendientes = {"n": 1}

    async def lectura_vieja(self, user_id, claim_type):
        if pendientes["n"] > 0:
            pendientes["n"] -= 1
            return None
        return await original(self, user_id, claim_type)

    monkeypatch.setattr(SqlAlchemyClaimRepository, "get_for_user", lectura_vieja)
    b = await client.post(ruta, headers=headers, json=payload())
    assert a.status_code == 200, a.text
    assert b.status_code == 200, b.text

    me = await client.get("/api/v1/identity/me", headers=headers)
    tipo = "documento_verificado" if rol == "worker" else "negocio_verificado"
    mios = [c for c in me.json()["claims"] if c["claim_type"] == tipo]
    assert len(mios) == 1 and mios[0]["status"] == "pendiente"
    async with session_factory() as s:
        total = await s.scalar(select(func.count()).select_from(IdentityClaimModel))
    assert total == 1
