"""Tests del dominio de verificación de identidad (EPIC-001, ADR-0010).

Cubren: la máquina de estados del claim, la purga de evidencia tras la decisión
(retención), la agregación claim→nivel de garantía, y el flujo HTTP completo
worker→admin (incluyendo no-disclosure: el estado propio no expone evidencias).
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.main import app
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.notification.api.dependencies import get_email_sender
from app.modules.notification.infrastructure.fake_email_sender import FakeEmailSender
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


# --- Recordatorio de verificación por email (admin) ------------------------


@pytest.fixture
def fake_email_sender():
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_email_sender, None)


async def _worker_user_id(client: AsyncClient, headers: dict) -> str:
    me = await client.get("/api/v1/identity/me", headers=headers)
    return me.json()["user_id"]


def _subjects(fake_email_sender: FakeEmailSender) -> list[str]:
    return [email.subject for email in fake_email_sender.sent]


@pytest.mark.asyncio
async def test_admin_can_send_identity_verification_reminder(
    client, session_factory, fake_email_sender: FakeEmailSender
):
    worker = await auth_headers(client, "worker", "w-remind@test.com")
    admin = await _make_admin(client, session_factory, "admin-remind@test.com")
    user_id = await _worker_user_id(client, worker)

    resp = await client.post(
        f"/api/v1/identity/claims/document/{user_id}/remind", headers=admin
    )
    assert resp.status_code == 202
    assert resp.json() == {"sent": True}
    # `auth_headers` ya disparó 2 emails de confirmación (worker + admin) antes
    # de esto — lo que importa es que el de recordatorio se haya sumado.
    assert "Verificá tu identidad" in _subjects(fake_email_sender)[-1]


@pytest.mark.asyncio
async def test_reminder_rejects_already_verified_worker(
    client, session_factory, fake_email_sender: FakeEmailSender
):
    worker = await auth_headers(client, "worker", "w-remind-ok@test.com")
    admin = await _make_admin(client, session_factory, "admin-remind-ok@test.com")
    user_id = await _worker_user_id(client, worker)

    await client.post(
        "/api/v1/identity/me/document",
        headers=worker,
        json={"dni_frente_url": "https://x/a.jpg", "selfie_url": "https://x/b.jpg"},
    )
    pending = await client.get("/api/v1/identity/claims/pending", headers=admin)
    claim_id = pending.json()[0]["claim_id"]
    await client.post(f"/api/v1/identity/claims/{claim_id}/approve", headers=admin)
    sent_before = len(fake_email_sender.sent)

    resp = await client.post(
        f"/api/v1/identity/claims/document/{user_id}/remind", headers=admin
    )
    assert resp.status_code == 409
    assert not any("Verificá tu identidad" in s for s in _subjects(fake_email_sender))
    assert len(fake_email_sender.sent) == sent_before


@pytest.mark.asyncio
async def test_reminder_rejects_non_worker(
    client, session_factory, fake_email_sender: FakeEmailSender
):
    admin = await _make_admin(client, session_factory, "admin-remind-emp@test.com")
    employer = await auth_headers(client, "employer", "emp-remind@test.com")
    employer_id = await _worker_user_id(client, employer)
    sent_before = len(fake_email_sender.sent)

    resp = await client.post(
        f"/api/v1/identity/claims/document/{employer_id}/remind", headers=admin
    )
    assert resp.status_code == 422
    assert len(fake_email_sender.sent) == sent_before


@pytest.mark.asyncio
async def test_non_admin_cannot_send_reminder(client, session_factory):
    worker = await auth_headers(client, "worker", "w-remind-noadmin@test.com")
    user_id = await _worker_user_id(client, worker)

    resp = await client.post(
        f"/api/v1/identity/claims/document/{user_id}/remind", headers=worker
    )
    assert resp.status_code == 403


# --- Verificación del COMERCIO (ADR-0013) ----------------------------------
#
# El sello "Comercio verificado" existía en la UI desde el ADR-0011 pero
# `company_verified` no podía dar `true` nunca: nada creaba el claim. Estos
# tests recorren el flujo real de punta a punta — hasta ahora el único test
# que cubría el sello insertaba el claim a mano con el repositorio, porque no
# había flujo que ejercitar.


@pytest.mark.asyncio
async def test_flujo_completo_de_verificacion_de_comercio(client, session_factory):
    """Comercio manda constancia → admin la ve con el nombre del local →
    aprueba → el comercio queda verificado."""
    employer = await auth_headers(client, "employer", "biz-flow@test.com")
    await client.post(
        "/api/v1/companies/me/profile",
        headers=employer,
        json={"name": "Bar La Esquina", "city": "Palermo"},
    )
    admin = await _make_admin(client, session_factory, "admin-biz@test.com")

    submit = await client.post(
        "/api/v1/identity/me/business",
        headers=employer,
        json={"constancia_url": "https://x/constancia.pdf"},
    )
    assert submit.status_code == 200, submit.text
    body = submit.json()
    # No-disclosure, igual que del lado del trabajador.
    assert "evidences" not in body
    assert body["claims"][0]["claim_type"] == "negocio_verificado"
    assert body["claims"][0]["status"] == "pendiente"

    pending = await client.get("/api/v1/identity/claims/pending", headers=admin)
    item = next(
        i for i in pending.json() if i["claim_type"] == "negocio_verificado"
    )
    # Lo que hace revisable la constancia: poder comparar la razón social del
    # PDF contra el nombre cargado en la app. Sin esto el admin aprueba a ciegas.
    assert item["company_name"] == "Bar La Esquina"
    assert item["evidences"][0]["evidence_type"] == "constancia_cuit"
    assert item["evidences"][0]["data_url"] == "https://x/constancia.pdf"

    approve = await client.post(
        f"/api/v1/identity/claims/{item['claim_id']}/approve", headers=admin
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "verificada"


@pytest.mark.asyncio
async def test_aprobar_el_claim_enciende_el_sello_en_el_feed(client, session_factory):
    """La razón de ser de todo esto: que `company_verified` deje de ser
    siempre `false`. Recorrido real (sin insertar claims a mano) desde que el
    comercio manda la constancia hasta que el trabajador ve el sello."""
    employer = await auth_headers(client, "employer", "biz-feed@test.com")
    await client.post(
        "/api/v1/companies/me/profile",
        headers=employer,
        json={"name": "Bar Verificado", "city": "Palermo"},
    )
    start = datetime.now(timezone.utc) + timedelta(days=3)
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json={
            "position": "mozo",
            "quantity": 1,
            "start_at": start.replace(tzinfo=None).isoformat(),
            "end_at": (start + timedelta(hours=6)).replace(tzinfo=None).isoformat(),
            "pay_amount": "60000",
            "tips": True,
            "city": "Palermo",
        },
    )
    assert created.status_code == 201, created.text
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)

    worker = await auth_headers(client, "worker", "w-sees-badge@test.com")
    await client.post(
        "/api/v1/workers/me/profile", headers=worker, json={"skills": ["mozo"]}
    )

    def _badge(feed_json: list[dict]) -> bool:
        return next(s["company_verified"] for s in feed_json if s["id"] == shift_id)

    antes = await client.get("/api/v1/shifts/feed", headers=worker, params={"limit": 100})
    assert _badge(antes.json()) is False

    await client.post(
        "/api/v1/identity/me/business",
        headers=employer,
        json={"constancia_url": "https://x/constancia.pdf"},
    )
    # Pendiente todavía NO es verificado: el sello no se enciende al mandarlo.
    mitad = await client.get("/api/v1/shifts/feed", headers=worker, params={"limit": 100})
    assert _badge(mitad.json()) is False

    admin = await _make_admin(client, session_factory, "admin-feed@test.com")
    pending = await client.get("/api/v1/identity/claims/pending", headers=admin)
    claim_id = next(
        i["claim_id"] for i in pending.json() if i["claim_type"] == "negocio_verificado"
    )
    await client.post(f"/api/v1/identity/claims/{claim_id}/approve", headers=admin)

    despues = await client.get(
        "/api/v1/shifts/feed", headers=worker, params={"limit": 100}
    )
    assert _badge(despues.json()) is True


@pytest.mark.asyncio
async def test_la_constancia_se_purga_al_decidir(client, session_factory):
    """Retención (ADR-0010 §4, ADR-0013 §3): del papel queda la constancia de
    la decisión, no el papel. Un CUIT en un monotributista está atado a su
    DNI — guardarlo después de decidir sería dato personal sin uso."""
    employer = await auth_headers(client, "employer", "biz-purge@test.com")
    await client.post(
        "/api/v1/companies/me/profile",
        headers=employer,
        json={"name": "Bar Purga", "city": "Palermo"},
    )
    admin = await _make_admin(client, session_factory, "admin-purge@test.com")
    await client.post(
        "/api/v1/identity/me/business",
        headers=employer,
        json={"constancia_url": "https://x/constancia.pdf"},
    )
    pending = await client.get("/api/v1/identity/claims/pending", headers=admin)
    item = next(i for i in pending.json() if i["claim_type"] == "negocio_verificado")
    await client.post(
        f"/api/v1/identity/claims/{item['claim_id']}/reject",
        headers=admin,
        json={"reason": "Constancia vencida"},
    )

    # Rechazado: ya no está en la cola, y el comercio puede reenviar.
    despues = await client.get("/api/v1/identity/claims/pending", headers=admin)
    assert all(i["claim_type"] != "negocio_verificado" for i in despues.json())

    estado = await client.get("/api/v1/identity/me", headers=employer)
    claim = next(
        c for c in estado.json()["claims"] if c["claim_type"] == "negocio_verificado"
    )
    assert claim["status"] == "rechazada"
    assert claim["rejection_reason"] == "Constancia vencida"

    reenvio = await client.post(
        "/api/v1/identity/me/business",
        headers=employer,
        json={"constancia_url": "https://x/constancia-2.pdf"},
    )
    assert reenvio.json()["claims"][0]["status"] == "pendiente"


@pytest.mark.asyncio
async def test_un_trabajador_no_puede_usar_el_flujo_de_negocio(client: AsyncClient):
    """El claim de negocio afirma que hay un comercio registrado atrás: sólo
    tiene sentido para quien tiene uno. Vale para el envío y para la firma de
    subida del documento."""
    worker = await auth_headers(client, "worker", "w-not-biz@test.com")

    envio = await client.post(
        "/api/v1/identity/me/business",
        headers=worker,
        json={"constancia_url": "https://x/constancia.pdf"},
    )
    assert envio.status_code == 403

    firma = await client.post("/api/v1/uploads/sign-business-document", headers=worker)
    assert firma.status_code == 403


@pytest.mark.asyncio
async def test_el_comercio_no_reenvia_una_verificacion_ya_aprobada(
    client, session_factory
):
    employer = await auth_headers(client, "employer", "biz-dup@test.com")
    await client.post(
        "/api/v1/companies/me/profile",
        headers=employer,
        json={"name": "Bar Dup", "city": "Palermo"},
    )
    admin = await _make_admin(client, session_factory, "admin-dup@test.com")
    await client.post(
        "/api/v1/identity/me/business",
        headers=employer,
        json={"constancia_url": "https://x/constancia.pdf"},
    )
    pending = await client.get("/api/v1/identity/claims/pending", headers=admin)
    item = next(i for i in pending.json() if i["claim_type"] == "negocio_verificado")
    await client.post(
        f"/api/v1/identity/claims/{item['claim_id']}/approve", headers=admin
    )

    otra_vez = await client.post(
        "/api/v1/identity/me/business",
        headers=employer,
        json={"constancia_url": "https://x/otra.pdf"},
    )
    assert otra_vez.status_code == 409


def test_el_claim_de_negocio_no_da_nivel_de_garantia_de_persona():
    """Un comercio verificado NO es una persona con identidad verificada: son
    preguntas distintas. Si el claim de negocio contara para el nivel de
    garantía personal, el dueño de un bar aprobado aparecería como persona
    verificada sin haber mostrado nunca su DNI."""
    claim = Claim(user_id=uuid4(), claim_type=ClaimType.NEGOCIO_VERIFICADO)
    claim.submit(
        [
            Evidence(
                evidence_type=EvidenceType.CONSTANCIA_CUIT,
                data_url="https://x/constancia.pdf",
            )
        ],
        VerificationMethod.ADMIN_MANUAL,
        _now(),
    )
    claim.approve(uuid4(), _now())

    assert has_verified_identity([claim]) is False
    assert compute_assurance_level([claim]) == AssuranceLevel.L0
