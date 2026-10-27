"""Borrado de los documentos de verificación al decidir (ADR-0021, «Borrado
al decidir»).

Cubren: aprobar o rechazar (identidad y comercio) borra cada archivo de la
evidencia en el storage después de responder; si el storage falla, la
decisión igual sale y el archivo queda en la cola; el scheduler reintenta,
espaciado; "not found" cuenta como borrado (y un 404 de la API no); un
reenvío estando pendiente borra lo que reemplaza. El storage es un doble
(`evidence_storage`, `tests/conftest.py`); el adaptador de Cloudinary se
prueba con `httpx.MockTransport`.
"""

from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import select

from app.core.cloudinary import CloudinaryDestroyError
from app.core.config import settings
from app.core.dt import naive
from app.modules.shift.application import scheduler
from app.modules.verification.domain.entities import (
    FILE_DELETION_MAX_RETRY,
    Claim,
    Evidence,
    EvidenceFileDeletion,
)
from app.modules.verification.domain.value_objects import (
    ClaimType,
    EvidenceFile,
    EvidenceType,
    VerificationMethod,
)
from app.modules.verification.infrastructure.evidence_file_storage import (
    CloudinaryEvidenceFileStorage,
)
from app.modules.verification.infrastructure.file_cleanup_job import (
    run_evidence_file_cleanup,
)
from app.modules.verification.infrastructure.models import (
    EvidenceFileDeletionModel,
    IdentityEvidenceModel,
)
from tests.conftest import auth_headers, make_admin


def _file(folder: str = "oido/identidad", fmt: str = "jpg") -> dict:
    return {
        "public_id": f"{folder}/{uuid4().hex}",
        "resource_type": "image",
        "format": fmt,
        "type": "private",
    }


async def _admin(client, session_factory, email: str) -> dict:
    return await make_admin(client, session_factory, email)


async def _pending_claim_id(client, admin: dict, claim_type: str) -> str:
    pending = (await client.get("/api/v1/identity/claims/pending", headers=admin)).json()
    return next(c["claim_id"] for c in pending if c["claim_type"] == claim_type)


async def _queue(session_factory) -> list[EvidenceFileDeletionModel]:
    async with session_factory() as session:
        return list((await session.execute(select(EvidenceFileDeletionModel))).scalars())


async def _evidences(session_factory) -> list[IdentityEvidenceModel]:
    async with session_factory() as session:
        return list((await session.execute(select(IdentityEvidenceModel))).scalars())


# --- Dominio -------------------------------------------------------------------


def _ev(evidence_type: EvidenceType, public_id: str) -> Evidence:
    return Evidence(
        evidence_type=evidence_type,
        file=EvidenceFile(public_id=public_id, resource_type="image", format="jpg"),
    )


def _pending_claim() -> Claim:
    claim = Claim(user_id=uuid4(), claim_type=ClaimType.DOCUMENTO_VERIFICADO)
    claim.submit(
        [
            _ev(EvidenceType.DNI_FRENTE, "oido/identidad/a"),
            _ev(EvidenceType.SELFIE, "oido/identidad/b"),
        ],
        VerificationMethod.ADMIN_MANUAL,
        datetime.now(UTC),
    )
    return claim


@pytest.mark.parametrize("decide", ["approve", "reject"])
def test_decidir_manda_cada_archivo_a_la_cola(decide):
    claim = _pending_claim()
    assert claim.files_to_delete == []
    now = datetime.now(UTC)
    if decide == "approve":
        claim.approve(uuid4(), now)
    else:
        claim.reject(uuid4(), "borrosa", now)
    assert [d.file.public_id for d in claim.files_to_delete] == [
        "oido/identidad/a",
        "oido/identidad/b",
    ]
    assert all(d.next_attempt_at == now and d.attempts == 0 for d in claim.files_to_delete)
    assert all(e.file is None and e.data_purged for e in claim.evidences)


def test_una_evidencia_vieja_con_url_no_entra_a_la_cola():
    """Las de antes del ADR-0021 no tienen referencia: su archivo queda
    huérfano y lo borra el script."""
    claim = Claim(user_id=uuid4(), claim_type=ClaimType.DOCUMENTO_VERIFICADO)
    claim.submit(
        [Evidence(evidence_type=EvidenceType.DNI_FRENTE, data_url="https://x/dni.jpg")],
        VerificationMethod.ADMIN_MANUAL,
        datetime.now(UTC),
    )
    claim.approve(uuid4(), datetime.now(UTC))
    assert claim.files_to_delete == []
    assert claim.evidences[0].data_url is None


def test_reenviar_estando_pendiente_manda_a_borrar_lo_reemplazado():
    claim = _pending_claim()
    claim.submit(
        [_ev(EvidenceType.DNI_FRENTE, "oido/identidad/c")],
        VerificationMethod.ADMIN_MANUAL,
        datetime.now(UTC),
    )
    assert [d.file.public_id for d in claim.files_to_delete] == [
        "oido/identidad/a",
        "oido/identidad/b",
    ]
    assert claim.evidences[0].file.public_id == "oido/identidad/c"


def test_los_reintentos_se_espacian_hasta_una_vez_por_dia():
    now = datetime(2026, 10, 23, tzinfo=UTC)
    deletion = EvidenceFileDeletion.request(
        EvidenceFile(public_id="x", resource_type="image", format="jpg"), now
    )
    delays = []
    for _ in range(12):
        deletion.record_failure("caído", now)
        delays.append(deletion.next_attempt_at - now)
    assert delays[:3] == [timedelta(minutes=15), timedelta(minutes=30), timedelta(hours=1)]
    assert delays[-1] == FILE_DELETION_MAX_RETRY
    assert deletion.attempts == 12
    # Nunca se rinde ni desborda: el intento 400 sigue siendo una vez por día.
    deletion.attempts = 400
    deletion.record_failure("caído", now)
    assert deletion.next_attempt_at - now == FILE_DELETION_MAX_RETRY


# --- API: decidir borra --------------------------------------------------------


@pytest.mark.asyncio
async def test_aprobar_la_identidad_borra_dni_dorso_y_selfie(
    client, session_factory, evidence_storage
):
    worker = await auth_headers(client, "worker", "w-borra@test.com")
    admin = await _admin(client, session_factory, "a-borra@test.com")
    files = {"dni_frente": _file(), "dni_dorso": _file(), "selfie": _file()}
    sent = await client.post("/api/v1/identity/me/document", headers=worker, json=files)
    assert sent.status_code == 200
    assert evidence_storage.deleted == []

    claim_id = await _pending_claim_id(client, admin, "documento_verificado")
    resp = await client.post(f"/api/v1/identity/claims/{claim_id}/approve", headers=admin)
    assert resp.status_code == 200

    assert sorted(f.public_id for f in evidence_storage.deleted) == sorted(
        f["public_id"] for f in files.values()
    )
    assert all(f.delivery_type == "private" for f in evidence_storage.deleted)
    # Confirmado el borrado, no queda ninguna referencia en la base.
    assert await _queue(session_factory) == []
    assert all(
        e.file_public_id is None and e.data_purged for e in await _evidences(session_factory)
    )


@pytest.mark.asyncio
async def test_rechazar_la_constancia_del_comercio_la_borra(
    client, session_factory, evidence_storage
):
    employer = await auth_headers(client, "employer", "biz-borra@test.com")
    admin = await _admin(client, session_factory, "a-biz-borra@test.com")
    constancia = _file("oido/constancias", "pdf")
    sent = await client.post(
        "/api/v1/identity/me/business", headers=employer, json={"constancia": constancia}
    )
    assert sent.status_code == 200

    claim_id = await _pending_claim_id(client, admin, "negocio_verificado")
    resp = await client.post(
        f"/api/v1/identity/claims/{claim_id}/reject",
        headers=admin,
        json={"reason": "No se lee"},
    )
    assert resp.status_code == 200
    assert [f.public_id for f in evidence_storage.deleted] == [constancia["public_id"]]
    assert await _queue(session_factory) == []


@pytest.mark.asyncio
async def test_reenviar_estando_pendiente_borra_los_archivos_reemplazados(
    client, session_factory, evidence_storage
):
    worker = await auth_headers(client, "worker", "w-reenvia@test.com")
    primero = {"dni_frente": _file(), "selfie": _file()}
    await client.post("/api/v1/identity/me/document", headers=worker, json=primero)
    segundo = {"dni_frente": _file(), "selfie": _file()}
    resp = await client.post("/api/v1/identity/me/document", headers=worker, json=segundo)
    assert resp.status_code == 200
    assert sorted(f.public_id for f in evidence_storage.deleted) == sorted(
        f["public_id"] for f in primero.values()
    )
    vigentes = {e.file_public_id for e in await _evidences(session_factory)}
    assert vigentes == {f["public_id"] for f in segundo.values()}


# --- Falla del storage: la decisión sale igual y el scheduler reintenta ------


@pytest.mark.asyncio
async def test_si_cloudinary_falla_la_decision_sale_y_el_scheduler_reintenta(
    client, session_factory, evidence_storage
):
    worker = await auth_headers(client, "worker", "w-falla@test.com")
    admin = await _admin(client, session_factory, "a-falla@test.com")
    files = {"dni_frente": _file(), "selfie": _file()}
    await client.post("/api/v1/identity/me/document", headers=worker, json=files)
    claim_id = await _pending_claim_id(client, admin, "documento_verificado")

    evidence_storage.fail = True
    antes = datetime.now(UTC)
    resp = await client.post(f"/api/v1/identity/claims/{claim_id}/approve", headers=admin)
    assert resp.status_code == 200
    assert resp.json()["status"] == "verificada"

    # El puntero salió de la evidencia, pero la referencia quedó en la cola.
    queue = await _queue(session_factory)
    assert sorted(q.public_id for q in queue) == sorted(f["public_id"] for f in files.values())
    assert all(q.attempts == 1 and "no responde" in q.last_error for q in queue)
    retry_at = naive(queue[0].next_attempt_at)
    assert naive(antes) + timedelta(minutes=14) < retry_at < naive(antes) + timedelta(minutes=16)

    # Antes de la hora no se reintenta, y el scheduler sabe cuándo despertarse.
    deadline = await run_evidence_file_cleanup(session_factory, evidence_storage)
    assert deadline == retry_at
    assert len(await _queue(session_factory)) == 2

    # Sigue caído a la hora del reintento: espera más.
    later = datetime.now(UTC) + timedelta(minutes=16)
    deadline = await run_evidence_file_cleanup(session_factory, evidence_storage, now=later)
    assert all(q.attempts == 2 for q in await _queue(session_factory))
    assert deadline == naive(later + timedelta(minutes=30))

    # Vuelve Cloudinary: el reintento borra todo y vacía la cola.
    evidence_storage.fail = False
    much_later = later + timedelta(minutes=31)
    assert (
        await run_evidence_file_cleanup(session_factory, evidence_storage, now=much_later)
        is None
    )
    assert sorted(f.public_id for f in evidence_storage.deleted) == sorted(
        f["public_id"] for f in files.values()
    )
    assert await _queue(session_factory) == []


@pytest.mark.asyncio
async def test_con_la_cola_vacia_el_chequeo_no_pide_despertar(session_factory, evidence_storage):
    assert await run_evidence_file_cleanup(session_factory, evidence_storage) is None


@pytest.mark.asyncio
async def test_el_scheduler_corre_los_chequeos_inyectados_y_duerme_hasta_su_deadline(
    monkeypatch,
):
    """`app/main.py` le pasa el reintento del borrado al scheduler
    (`extra_checks`) para que el scheduler no importe la infraestructura de
    verificación (candado de capas)."""

    async def nada(*_args, **_kwargs):
        return None

    for name in (
        "run_attendance_check",
        "run_escalation_check",
        "run_coverage_check",
        "run_available_now_cleanup",
        "run_subscription_expiry_check",
        "run_retention_cleanup",
    ):
        monkeypatch.setattr(scheduler, name, nada)

    class Corte(Exception):
        pass

    sleeps: list[float] = []

    async def wait(seconds: float) -> None:
        sleeps.append(seconds)
        raise Corte

    monkeypatch.setattr(scheduler, "wait_for_wakeup", wait)
    in_ten_minutes = naive(datetime.now(UTC)) + timedelta(minutes=10)

    async def reintento() -> datetime:
        return in_ten_minutes

    async def roto() -> datetime:
        raise RuntimeError("falla de un chequeo inyectado")

    with pytest.raises(Corte):
        await scheduler.scheduler_loop(extra_checks=(reintento,))
    assert 9 * 60 < sleeps[0] <= 10 * 60

    # Uno que falla no mata el loop: se reintenta pronto (ERROR_RETRY).
    with pytest.raises(Corte):
        await scheduler.scheduler_loop(extra_checks=(roto,))
    assert sleeps[1] == scheduler.ERROR_RETRY.total_seconds()


def test_main_le_pasa_el_reintento_del_borrado_al_scheduler():
    import inspect

    from app import main

    assert "extra_checks=(run_evidence_file_cleanup,)" in inspect.getsource(main.lifespan)


# --- Adaptador de Cloudinary ---------------------------------------------------


@pytest.fixture
def cloudinary_on():
    keys = ("cloudinary_api_key", "cloudinary_api_secret", "cloudinary_cloud_name")
    original = {k: getattr(settings, k) for k in keys}
    settings.cloudinary_api_key = "test-api-key"
    settings.cloudinary_api_secret = "test-api-secret"
    settings.cloudinary_cloud_name = "oido-test"
    yield
    for k, v in original.items():
        setattr(settings, k, v)


def _storage(status: int, body: dict | None, calls: list[httpx.Request]):
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(status, json=body)

    return CloudinaryEvidenceFileStorage(httpx.AsyncClient(transport=httpx.MockTransport(handler)))


DNI = EvidenceFile(public_id="oido/identidad/abc", resource_type="image", format="jpg")


@pytest.mark.asyncio
async def test_cloudinary_destroy_firmado_privado_e_invalidando_cache(cloudinary_on):
    calls: list[httpx.Request] = []
    await _storage(200, {"result": "ok"}, calls).delete(DNI)
    (request,) = calls
    assert request.method == "POST"
    assert str(request.url) == "https://api.cloudinary.com/v1_1/oido-test/image/destroy"
    form = {k: v[0] for k, v in parse_qs(request.content.decode()).items()}
    assert (form["public_id"], form["type"], form["invalidate"]) == (
        "oido/identidad/abc",
        "private",
        "true",
    )
    assert form["api_key"] == "test-api-key" and form["signature"]


@pytest.mark.asyncio
async def test_not_found_cuenta_como_borrado(cloudinary_on):
    await _storage(200, {"result": "not found"}, []).delete(DNI)


@pytest.mark.asyncio
async def test_un_404_o_un_resultado_raro_no_cuentan_como_borrado(cloudinary_on):
    """Un 404 de la API también es un `cloud_name` que no existe: tomarlo como
    borrado haría olvidar un archivo que sigue en Cloudinary."""
    with pytest.raises(httpx.HTTPStatusError):
        await _storage(404, {"error": {"message": "Invalid cloud_name"}}, []).delete(DNI)
    with pytest.raises(CloudinaryDestroyError):
        await _storage(200, {"result": "error"}, []).delete(DNI)
