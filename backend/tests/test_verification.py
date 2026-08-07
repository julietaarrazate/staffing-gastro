"""Tests del dominio de verificación de identidad (EPIC-001, ADR-0010).

Cubren: la máquina de estados del claim, la purga de evidencia tras la decisión
(retención), la agregación claim→nivel de garantía, y el flujo HTTP completo
worker→admin (incluyendo no-disclosure: el estado propio no expone evidencias).
"""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.verification.domain.entities import Claim, Evidence
from app.modules.verification.domain.exceptions import (
    ClaimAlreadyVerifiedError,
    ClaimNotPendingError,
    EvidenceRequiredError,
)
from app.modules.verification.domain.services import (
    compute_assurance_level,
    has_verified_identity,
)
from app.modules.verification.domain.value_objects import (
    AssuranceLevel,
    ClaimStatus,
    ClaimType,
    EvidenceType,
    VerificationMethod,
)
from tests.conftest import auth_headers, login


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _doc_evidences() -> list[Evidence]:
    return [
        Evidence(evidence_type=EvidenceType.DNI_FRENTE, data_url="https://x/dni.jpg"),
        Evidence(evidence_type=EvidenceType.SELFIE, data_url="https://x/selfie.jpg"),
    ]


# --- Dominio: máquina de estados ------------------------------------------


def test_submit_moves_claim_to_pending():
    claim = Claim(user_id=uuid4(), claim_type=ClaimType.DOCUMENTO_VERIFICADO)
    claim.submit(_doc_evidences(), VerificationMethod.ADMIN_MANUAL, _now())
    assert claim.status == ClaimStatus.PENDIENTE
    assert claim.submitted_at is not None


def test_submit_without_evidence_data_raises():
    claim = Claim(user_id=uuid4(), claim_type=ClaimType.DOCUMENTO_VERIFICADO)
    empty = [Evidence(evidence_type=EvidenceType.DNI_FRENTE, data_url=None)]
    with pytest.raises(EvidenceRequiredError):
        claim.submit(empty, VerificationMethod.ADMIN_MANUAL, _now())


def test_approve_verifies_and_purges_evidence():
    claim = Claim(user_id=uuid4(), claim_type=ClaimType.DOCUMENTO_VERIFICADO)
    claim.submit(_doc_evidences(), VerificationMethod.ADMIN_MANUAL, _now())
    admin_id = uuid4()
    claim.approve(admin_id, _now())
    assert claim.is_verified
    assert claim.reviewed_by == admin_id
    assert claim.decided_at is not None
    # Retención: la evidencia sensible se purga, la constancia queda.
    assert all(e.data_url is None and e.data_purged for e in claim.evidences)


def test_reject_records_reason_and_purges_evidence():
    claim = Claim(user_id=uuid4(), claim_type=ClaimType.DOCUMENTO_VERIFICADO)
    claim.submit(_doc_evidences(), VerificationMethod.ADMIN_MANUAL, _now())
    claim.reject(uuid4(), "DNI ilegible", _now())
    assert claim.status == ClaimStatus.RECHAZADA
    assert claim.rejection_reason == "DNI ilegible"
    assert all(e.data_purged for e in claim.evidences)


def test_cannot_resubmit_when_verified():
    claim = Claim(user_id=uuid4(), claim_type=ClaimType.DOCUMENTO_VERIFICADO)
    claim.submit(_doc_evidences(), VerificationMethod.ADMIN_MANUAL, _now())
    claim.approve(uuid4(), _now())
    with pytest.raises(ClaimAlreadyVerifiedError):
        claim.submit(_doc_evidences(), VerificationMethod.ADMIN_MANUAL, _now())


def test_can_resubmit_after_rejection():
    claim = Claim(user_id=uuid4(), claim_type=ClaimType.DOCUMENTO_VERIFICADO)
    claim.submit(_doc_evidences(), VerificationMethod.ADMIN_MANUAL, _now())
    claim.reject(uuid4(), "borroso", _now())
    claim.submit(_doc_evidences(), VerificationMethod.ADMIN_MANUAL, _now())
    assert claim.is_pending
    assert claim.rejection_reason is None  # se limpió la decisión anterior


def test_cannot_approve_when_not_pending():
    claim = Claim(user_id=uuid4(), claim_type=ClaimType.DOCUMENTO_VERIFICADO)
    with pytest.raises(ClaimNotPendingError):
        claim.approve(uuid4(), _now())


# --- Dominio: agregación de nivel de garantía ------------------------------


def test_assurance_level_l0_without_verified_claims():
    assert compute_assurance_level([]) == AssuranceLevel.L0
    assert not has_verified_identity([])


def test_assurance_level_l2_with_verified_document():
    claim = Claim(user_id=uuid4(), claim_type=ClaimType.DOCUMENTO_VERIFICADO)
    claim.submit(_doc_evidences(), VerificationMethod.ADMIN_MANUAL, _now())
    claim.approve(uuid4(), _now())
    assert compute_assurance_level([claim]) == AssuranceLevel.L2
    assert has_verified_identity([claim])


def test_assurance_level_l4_with_authoritative_method():
    claim = Claim(user_id=uuid4(), claim_type=ClaimType.DOCUMENTO_VERIFICADO)
    claim.submit(
        [Evidence(evidence_type=EvidenceType.DNI_FRENTE, data_url="x")],
        VerificationMethod.RENAPER,
        _now(),
    )
    claim.approve(uuid4(), _now())
    assert compute_assurance_level([claim]) == AssuranceLevel.L4


# --- API: flujo worker → admin end-to-end ----------------------------------


async def _make_admin(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    email: str,
) -> dict:
    await auth_headers(client, "employer", email)
    async with session_factory() as session:
        repo = SqlAlchemyUserRepository(session)
        user = await repo.get_by_email(email)
        user.promote_to_admin()
        await repo.update(user)
    tokens = await login(client, email)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.mark.asyncio
async def test_worker_starts_at_l0(client: AsyncClient):
    worker = await auth_headers(client, "worker", "w-l0@test.com")
    resp = await client.get("/api/v1/identity/me", headers=worker)
    assert resp.status_code == 200
    body = resp.json()
    assert body["assurance_level"] == "L0"
    assert body["identidad_verificada"] is False
    assert body["claims"] == []


@pytest.mark.asyncio
async def test_full_verification_flow(client, session_factory):
    worker = await auth_headers(client, "worker", "w-flow@test.com")
    admin = await _make_admin(client, session_factory, "admin-v@test.com")

    # 1) El trabajador envía DNI + selfie.
    submit = await client.post(
        "/api/v1/identity/me/document",
        headers=worker,
        json={
            "dni_frente_url": "https://x/dni.jpg",
            "selfie_url": "https://x/selfie.jpg",
        },
    )
    assert submit.status_code == 200
    body = submit.json()
    # No-disclosure: el estado propio no expone evidencias, y sigue sin verificar.
    assert "evidences" not in body
    assert body["identidad_verificada"] is False
    assert body["claims"][0]["status"] == "pendiente"

    # 2) El admin ve la cola con las URLs de evidencia (sólo acá).
    pending = await client.get("/api/v1/identity/claims/pending", headers=admin)
    assert pending.status_code == 200
    items = pending.json()
    assert len(items) == 1
    claim_id = items[0]["claim_id"]
    assert items[0]["full_name"] is not None
    assert any(e["data_url"] for e in items[0]["evidences"])

    # 3) El admin aprueba.
    approve = await client.post(
        f"/api/v1/identity/claims/{claim_id}/approve", headers=admin
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "verificada"

    # 4) El trabajador queda verificado (L2) y ya no hay pendientes.
    me = await client.get("/api/v1/identity/me", headers=worker)
    me_body = me.json()
    assert me_body["identidad_verificada"] is True
    assert me_body["assurance_level"] == "L2"

    empty = await client.get("/api/v1/identity/claims/pending", headers=admin)
    assert empty.json() == []


@pytest.mark.asyncio
async def test_public_worker_profile_shows_verified_identity(client, session_factory):
    """El comercio ve "Identidad verificada" en el perfil público del
    trabajador una vez aprobada (enriquecido por puerto, sin exponer evidencias)."""
    worker = await auth_headers(client, "worker", "w-pub@test.com")
    admin = await _make_admin(client, session_factory, "admin-pub@test.com")

    profile = await client.post(
        "/api/v1/workers/me/profile", headers=worker, json={"skills": ["mozo"]}
    )
    profile_id = profile.json()["id"]
    assert profile.json()["identidad_verificada"] is False

    await client.post(
        "/api/v1/identity/me/document",
        headers=worker,
        json={"dni_frente_url": "https://x/a.jpg", "selfie_url": "https://x/b.jpg"},
    )
    pending = await client.get("/api/v1/identity/claims/pending", headers=admin)
    claim_id = pending.json()[0]["claim_id"]
    await client.post(f"/api/v1/identity/claims/{claim_id}/approve", headers=admin)

    # Otro usuario (comercio) mira el perfil público: lo ve verificado.
    viewer = await auth_headers(client, "employer", "viewer-pub@test.com")
    public = await client.get(f"/api/v1/workers/{profile_id}", headers=viewer)
    assert public.status_code == 200
    body = public.json()
    assert body["identidad_verificada"] is True
    # No-disclosure: el perfil público nunca trae evidencias.
    assert "evidences" not in body


@pytest.mark.asyncio
async def test_non_admin_cannot_list_or_approve(client: AsyncClient):
    worker = await auth_headers(client, "worker", "w-noadmin@test.com")
    resp = await client.get("/api/v1/identity/claims/pending", headers=worker)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_reject_flow_lets_worker_resubmit(client, session_factory):
    worker = await auth_headers(client, "worker", "w-reject@test.com")
    admin = await _make_admin(client, session_factory, "admin-r@test.com")

    await client.post(
        "/api/v1/identity/me/document",
        headers=worker,
        json={"dni_frente_url": "https://x/a.jpg", "selfie_url": "https://x/b.jpg"},
    )
    pending = await client.get("/api/v1/identity/claims/pending", headers=admin)
    claim_id = pending.json()[0]["claim_id"]

    reject = await client.post(
        f"/api/v1/identity/claims/{claim_id}/reject",
        headers=admin,
        json={"reason": "DNI ilegible"},
    )
    assert reject.status_code == 200
    assert reject.json()["status"] == "rechazada"

    me = await client.get("/api/v1/identity/me", headers=worker)
    assert me.json()["claims"][0]["rejection_reason"] == "DNI ilegible"

    # Puede reenviar: vuelve a pendiente.
    resubmit = await client.post(
        "/api/v1/identity/me/document",
        headers=worker,
        json={"dni_frente_url": "https://x/c.jpg", "selfie_url": "https://x/d.jpg"},
    )
    assert resubmit.json()["claims"][0]["status"] == "pendiente"
