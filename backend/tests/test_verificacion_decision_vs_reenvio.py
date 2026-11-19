"""La decisión del admin contra un reenvío de la persona (ESC-01, 2026-11-19).

Antes `SqlAlchemyClaimRepository.update` reescribía el pedido entero (estado
y evidencias) desde la entidad leída al principio. Si la persona reenviaba
entre la lectura del admin y su guardado, el admin aprobaba sobre la
evidencia vieja: la persona quedaba verificada con documentos que nadie
miró, y sus archivos nuevos quedaban en el storage sin dueño ni cola de
borrado (ADR-0021). Además la decisión no llevaba qué envío había revisado
el admin: si la persona reenviaba mientras el admin miraba, se decidía
sobre algo que no vio.

Ahora el guardado es condicional (estado y `submitted_at` como se leyeron) y
la decisión lleva el `submitted_at` que el admin tenía en pantalla. Las
carreras se simulan con dos sesiones de base, cada una con su lectura.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.modules.verification.application.services import VerificationService
from app.modules.verification.domain.entities import Claim, Evidence
from app.modules.verification.domain.exceptions import (
    ClaimAlreadyVerifiedError,
    ClaimChangedError,
    ClaimNotPendingError,
)
from app.modules.verification.domain.value_objects import (
    ClaimStatus,
    ClaimType,
    EvidenceFile,
    EvidenceType,
    VerificationMethod,
)
from app.modules.verification.infrastructure.models import (
    EvidenceFileDeletionModel,
    IdentityClaimModel,
    IdentityEvidenceModel,
)
from app.modules.verification.infrastructure.repositories import SqlAlchemyClaimRepository
from tests.conftest import auth_headers, make_admin
from tests.test_verification import _constancia_payload, _doc_payload

pytestmark = pytest.mark.asyncio

RESUBMITTED = "La persona volvió a mandar los documentos. Revisalos de nuevo."


def _file() -> EvidenceFile:
    return EvidenceFile(
        public_id=f"oido/constancias/{uuid4().hex}",
        resource_type="image",
        format="pdf",
        delivery_type="private",
    )


async def _pending_constancia(session_factory, archivo: EvidenceFile) -> tuple[UUID, UUID]:
    user_id = uuid4()
    async with session_factory() as s:
        claim = await VerificationService(
            SqlAlchemyClaimRepository(s)
        ).submit_business_document(user_id, archivo)
    return user_id, claim.id


async def _estado(session_factory) -> tuple[str, set[str], set[str]]:
    async with session_factory() as s:
        estado = (await s.execute(select(IdentityClaimModel.status))).scalar_one()
        vigentes = {
            r[0] for r in (await s.execute(select(IdentityEvidenceModel.file_public_id))).all()
        }
        cola = {
            r[0] for r in (await s.execute(select(EvidenceFileDeletionModel.public_id))).all()
        }
    return estado, vigentes, cola


# --- Repositorio: el guardado es condicional ----------------------------------


@pytest.mark.parametrize("decision", ["aprobar", "rechazar"])
async def test_decidir_con_una_lectura_vieja_no_pisa_el_reenvio(session_factory, decision):
    vieja, nueva = _file(), _file()
    user_id, claim_id = await _pending_constancia(session_factory, vieja)

    async with session_factory() as admin, session_factory() as comercio:
        # El admin lee el pedido (la constancia vieja)...
        leido = await SqlAlchemyClaimRepository(admin).get_by_id(claim_id)
        # ...el comercio reenvía otra (sigue pendiente)...
        await VerificationService(SqlAlchemyClaimRepository(comercio)).submit_business_document(
            user_id, nueva
        )
        # ...y el admin guarda su decisión con lo que leyó.
        if decision == "aprobar":
            leido.approve(uuid4(), datetime.now(timezone.utc))
        else:
            leido.reject(uuid4(), "ilegible", datetime.now(timezone.utc))
        with pytest.raises(ClaimChangedError):
            await SqlAlchemyClaimRepository(admin).update(leido)

    estado, vigentes, cola = await _estado(session_factory)
    # No se decidió nada: sigue pendiente con la constancia nueva, y la vieja
    # quedó en la cola de borrado (la mandó el reenvío). Ningún archivo
    # sin dueño.
    assert estado == ClaimStatus.PENDIENTE.value
    assert vigentes == {nueva.public_id}
    assert cola == {vieja.public_id}


async def test_un_reenvio_con_una_lectura_vieja_no_deshace_la_aprobacion(session_factory):
    """Al revés: la persona leyó el pedido pendiente, el admin aprueba y
    recién después llega el reenvío. El reenvío pierde, relee y ve que ya
    está verificada."""
    vieja, nueva = _file(), _file()
    user_id, claim_id = await _pending_constancia(session_factory, vieja)

    async with session_factory() as s:
        comercio = SqlAlchemyClaimRepository(s)
        leido = await comercio.get_for_user(user_id, ClaimType.NEGOCIO_VERIFICADO)
        async with session_factory() as admin:
            await VerificationService(SqlAlchemyClaimRepository(admin)).approve_claim(
                claim_id, uuid4()
            )
        leido.submit(
            [Evidence(evidence_type=EvidenceType.CONSTANCIA_CUIT, file=nueva)],
            VerificationMethod.ADMIN_MANUAL,
            datetime.now(timezone.utc),
        )
        with pytest.raises(ClaimChangedError):
            await comercio.update(leido)

    estado, vigentes, cola = await _estado(session_factory)
    assert estado == ClaimStatus.VERIFICADA.value
    assert vigentes == {None}  # la constancia aprobada, purgada
    assert cola == {vieja.public_id}


# --- Caso de uso: qué le dice al admin y a la persona -------------------------


async def test_aprobar_mientras_la_persona_reenvia_responde_que_reenvio(
    session_factory, monkeypatch
):
    vieja, nueva = _file(), _file()
    user_id, claim_id = await _pending_constancia(session_factory, vieja)

    original = SqlAlchemyClaimRepository.get_by_id
    reenvio = {"pendiente": True}

    async def get_by_id(self, claim_id):
        claim = await original(self, claim_id)
        if reenvio["pendiente"]:
            reenvio["pendiente"] = False
            # Entre la lectura de la aprobación y su guardado, el comercio
            # reenvía desde otra sesión.
            async with session_factory() as otra:
                await VerificationService(
                    SqlAlchemyClaimRepository(otra)
                ).submit_business_document(user_id, nueva)
        return claim

    monkeypatch.setattr(SqlAlchemyClaimRepository, "get_by_id", get_by_id)
    borrados: list[list[UUID]] = []
    async with session_factory() as s:
        service = VerificationService(
            SqlAlchemyClaimRepository(s), delete_files_later=borrados.append
        )
        with pytest.raises(ClaimChangedError):
            await service.approve_claim(claim_id, uuid4())

    estado, vigentes, cola = await _estado(session_factory)
    assert estado == ClaimStatus.PENDIENTE.value
    assert vigentes == {nueva.public_id}
    assert cola == {vieja.public_id}
    assert borrados == []  # la aprobación que perdió no mandó a borrar nada


async def test_dos_decisiones_a_la_vez_la_segunda_ve_que_ya_no_esta_pendiente(
    session_factory, monkeypatch
):
    _, claim_id = await _pending_constancia(session_factory, _file())

    original = SqlAlchemyClaimRepository.get_by_id
    otra_decision = {"pendiente": True}

    async def get_by_id(self, claim_id):
        claim = await original(self, claim_id)
        if otra_decision["pendiente"]:
            otra_decision["pendiente"] = False
            async with session_factory() as otra:
                await VerificationService(SqlAlchemyClaimRepository(otra)).reject_claim(
                    claim_id, uuid4(), "ilegible"
                )
        return claim

    monkeypatch.setattr(SqlAlchemyClaimRepository, "get_by_id", get_by_id)
    async with session_factory() as s:
        with pytest.raises(ClaimNotPendingError):
            await VerificationService(SqlAlchemyClaimRepository(s)).approve_claim(
                claim_id, uuid4()
            )

    estado, _, _ = await _estado(session_factory)
    assert estado == ClaimStatus.RECHAZADA.value


async def test_el_reenvio_que_choca_con_una_aprobacion_dice_que_ya_esta_verificada(
    session_factory, monkeypatch
):
    vieja, nueva = _file(), _file()
    user_id, claim_id = await _pending_constancia(session_factory, vieja)

    original = SqlAlchemyClaimRepository.get_for_user
    aprobacion = {"pendiente": True}

    async def get_for_user(self, user_id, claim_type):
        claim = await original(self, user_id, claim_type)
        if aprobacion["pendiente"]:
            aprobacion["pendiente"] = False
            async with session_factory() as admin:
                await VerificationService(SqlAlchemyClaimRepository(admin)).approve_claim(
                    claim_id, uuid4()
                )
        return claim

    monkeypatch.setattr(SqlAlchemyClaimRepository, "get_for_user", get_for_user)
    async with session_factory() as s:
        with pytest.raises(ClaimAlreadyVerifiedError):
            await VerificationService(SqlAlchemyClaimRepository(s)).submit_business_document(
                user_id, nueva
            )

    estado, _, cola = await _estado(session_factory)
    assert estado == ClaimStatus.VERIFICADA.value
    assert cola == {vieja.public_id}


# --- Dominio: se decide sobre el envío revisado -------------------------------


def test_decidir_sobre_otro_envio_que_el_revisado_no_cambia_nada():
    enviado = datetime(2026, 11, 19, 15, 30, 0, 123456, tzinfo=timezone.utc)
    claim = Claim(user_id=uuid4(), claim_type=ClaimType.DOCUMENTO_VERIFICADO)
    claim.submit(
        [Evidence(evidence_type=EvidenceType.SELFIE, file=_file())],
        VerificationMethod.ADMIN_MANUAL,
        enviado,
    )
    with pytest.raises(ClaimChangedError):
        claim.approve(uuid4(), enviado, reviewed_submission=enviado - timedelta(seconds=40))
    with pytest.raises(ClaimChangedError):
        claim.reject(uuid4(), None, enviado, reviewed_submission=enviado + timedelta(microseconds=1))
    assert claim.status == ClaimStatus.PENDIENTE
    assert claim.files_to_delete == []

    # El mismo instante, aunque venga sin zona (así vuelve de SQLite) o en
    # otra zona horaria, es el envío revisado.
    otra_zona = enviado.astimezone(timezone(timedelta(hours=-3)))
    claim.approve(uuid4(), enviado, reviewed_submission=otra_zona)
    assert claim.status == ClaimStatus.VERIFICADA


# --- API: la cola manda el envío que mostró -----------------------------------


@pytest.mark.parametrize(
    "ruta,payload,rol",
    [
        ("/api/v1/identity/me/document", _doc_payload, "worker"),
        ("/api/v1/identity/me/business", _constancia_payload, "employer"),
    ],
)
@pytest.mark.parametrize("accion", ["approve", "reject"])
async def test_api_decidir_sobre_lo_que_se_vio_antes_de_un_reenvio_es_409(
    client: AsyncClient, session_factory, evidence_storage, ruta, payload, rol, accion
):
    persona = await auth_headers(client, rol, f"esc01-{rol}-{accion}@test.com")
    if rol == "employer":
        await client.post(
            "/api/v1/companies/me/profile",
            headers=persona,
            json={"name": "Bar Reenvío", "city": "Palermo"},
        )
    admin = await make_admin(client, session_factory, f"esc01-admin-{rol}-{accion}@test.com")

    primero = payload()
    assert (await client.post(ruta, headers=persona, json=primero)).status_code == 200
    # El admin abre la cola: ve el primer envío.
    visto = (await client.get("/api/v1/identity/claims/pending", headers=admin)).json()[0]

    # La persona se arrepiente de la foto y vuelve a mandar.
    segundo = payload()
    assert (await client.post(ruta, headers=persona, json=segundo)).status_code == 200

    body = {"submitted_at": visto["submitted_at"]}
    if accion == "reject":
        body["reason"] = "ilegible"
    res = await client.post(
        f"/api/v1/identity/claims/{visto['claim_id']}/{accion}", headers=admin, json=body
    )
    assert res.status_code == 409, res.text
    assert res.json()["detail"] == RESUBMITTED

    # Sigue pendiente con lo nuevo; no se borró nada del segundo envío.
    cola = (await client.get("/api/v1/identity/claims/pending", headers=admin)).json()
    assert len(cola) == 1 and cola[0]["submitted_at"] != visto["submitted_at"]
    nuevos = {f["public_id"] for f in segundo.values()}
    estado, vigentes, en_cola = await _estado(session_factory)
    assert estado == ClaimStatus.PENDIENTE.value
    assert vigentes == nuevos
    assert not (nuevos & en_cola)
    assert not (nuevos & {f.public_id for f in evidence_storage.deleted})

    # Con el envío que ahora muestra la cola, la decisión se aplica.
    body["submitted_at"] = cola[0]["submitted_at"]
    res = await client.post(
        f"/api/v1/identity/claims/{visto['claim_id']}/{accion}", headers=admin, json=body
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == ("verificada" if accion == "approve" else "rechazada")
