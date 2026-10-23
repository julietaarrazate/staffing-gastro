"""Documentos de identidad privados en Cloudinary (ADR-0021).

Cubren: la firma de la subida (`type=private` firmado), el link de descarga
que vence, los datos que acepta el envío (referencia privada, no URL), el
endpoint de admin para ver una evidencia (no-disclosure) y el script que
pasa a privados los archivos ya subidos (con un Cloudinary de mentira).
"""

import hashlib
import time
from urllib.parse import parse_qs, urlparse
from uuid import UUID, uuid4

import httpx
import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.cloudinary import (
    CloudinaryNotConfiguredError,
    private_download_url,
    sign_business_document_upload,
    sign_image_upload,
)
from app.core.config import settings
from app.modules.identity.infrastructure.models import UserModel
from app.modules.verification.api.schemas import (
    SubmitBusinessDocumentInput,
    SubmitIdentityDocumentInput,
)
from app.modules.verification.infrastructure.models import (
    IdentityClaimModel,
    IdentityEvidenceModel,
)
from scripts import privatize_identity_evidence as script
from tests.conftest import auth_headers, make_admin


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


def _sha1(params: dict[str, str]) -> str:
    to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params))
    return hashlib.sha1(f"{to_sign}test-api-secret".encode()).hexdigest()


def _ident() -> dict:
    return {
        "public_id": f"oido/identidad/{uuid4().hex}",
        "resource_type": "image",
        "format": "jpg",
        "type": "private",
    }


# --- Firma de la subida ----------------------------------------------------


def test_dni_y_selfie_suben_privados_con_el_tipo_dentro_de_la_firma(cloudinary_on):
    result = sign_image_upload("identity")
    assert result["type"] == "private"
    signed = {k: v for k, v in result.items() if k not in ("signature", "api_key")}
    assert result["signature"] == _sha1(signed)


def test_la_constancia_sube_privada(cloudinary_on):
    assert sign_business_document_upload()["type"] == "private"


def test_perfil_y_portada_siguen_publicos(cloudinary_on):
    assert "type" not in sign_image_upload("profile")
    assert "type" not in sign_image_upload("cover")


# --- Link de descarga que vence ---------------------------------------------


def test_el_link_privado_esta_firmado_y_vence(cloudinary_on):
    expires = int(time.time()) + 300
    url = private_download_url("oido/identidad/abc", "jpg", "image", "private", expires)
    parsed = urlparse(url)
    assert parsed.netloc == "api.cloudinary.com"
    assert parsed.path == "/v1_1/oido-test/image/download"
    params = {k: v[0] for k, v in parse_qs(parsed.query).items()}
    assert params["expires_at"] == str(expires)
    assert params["type"] == "private"
    assert params["api_key"] == "test-api-key"
    signed = {k: v for k, v in params.items() if k not in ("signature", "api_key")}
    assert params["signature"] == _sha1(signed)


def test_el_link_de_un_raw_no_manda_formato_vacio(cloudinary_on):
    url = private_download_url("oido/constancias/a.pdf", "", "raw", "private", 1)
    assert "format=" not in url
    assert "/raw/download" in url


def test_sin_cloud_name_no_hay_link(cloudinary_on):
    settings.cloudinary_cloud_name = ""
    with pytest.raises(CloudinaryNotConfiguredError):
        private_download_url("x", "jpg", "image", "private", 1)


# --- Lo que acepta el envío ---------------------------------------------------


@pytest.mark.parametrize(
    "public_id",
    [
        "oido/perfiles/" + "a" * 32,  # carpeta de otro flujo
        "oido/identidad/../x",
        "https://res.cloudinary.com/demo/image/upload/v1/dni.jpg",
        "oido/identidad/corto",
    ],
)
def test_rechaza_public_id_fuera_de_la_carpeta(public_id):
    with pytest.raises(ValidationError):
        SubmitIdentityDocumentInput(
            dni_frente={**_ident(), "public_id": public_id}, selfie=_ident()
        )


def test_rechaza_un_archivo_publico():
    with pytest.raises(ValidationError):
        SubmitIdentityDocumentInput(dni_frente={**_ident(), "type": "upload"}, selfie=_ident())


def test_ya_no_acepta_urls():
    with pytest.raises(ValidationError):
        SubmitIdentityDocumentInput(
            dni_frente_url="https://x/dni.jpg", selfie_url="https://x/s.jpg"
        )
    with pytest.raises(ValidationError):
        SubmitBusinessDocumentInput(constancia_url="https://x/c.pdf")


def test_acepta_el_public_id_con_o_sin_carpeta():
    hex_id = uuid4().hex
    doc = SubmitIdentityDocumentInput(
        dni_frente={**_ident(), "public_id": hex_id}, selfie=_ident()
    )
    assert doc.dni_frente.to_domain().public_id == hex_id
    assert doc.dni_dorso is None
    biz = SubmitBusinessDocumentInput(
        constancia={"public_id": f"oido/constancias/{hex_id}", "format": "pdf"}
    )
    assert biz.constancia.to_domain().delivery_type == "private"


# --- Endpoint del admin -------------------------------------------------------


async def _admin(client, session_factory, email: str) -> dict:
    return await make_admin(client, session_factory, email)


async def _submit_and_list(client, session_factory, worker_email, admin_email):
    worker = await auth_headers(client, "worker", worker_email)
    admin = await _admin(client, session_factory, admin_email)
    sent = await client.post(
        "/api/v1/identity/me/document",
        headers=worker,
        json={"dni_frente": _ident(), "selfie": _ident()},
    )
    assert sent.status_code == 200
    pending = (await client.get("/api/v1/identity/claims/pending", headers=admin)).json()
    return worker, admin, pending[0]


@pytest.mark.asyncio
async def test_el_admin_pide_un_link_que_vence_en_5_minutos(
    client, session_factory, cloudinary_on
):
    _, admin, claim = await _submit_and_list(
        client, session_factory, "w-link@test.com", "a-link@test.com"
    )
    evidence = claim["evidences"][0]
    assert set(evidence) == {"evidence_id", "evidence_type", "available"}

    antes = int(time.time())
    resp = await client.get(
        f"/api/v1/identity/evidences/{evidence['evidence_id']}/link", headers=admin
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["url"].startswith("https://api.cloudinary.com/v1_1/oido-test/image/download?")
    expires_at = int(parse_qs(urlparse(body["url"]).query)["expires_at"][0])
    assert antes + 290 <= expires_at <= int(time.time()) + 310
    assert body["expires_at"] is not None


@pytest.mark.asyncio
async def test_el_dueno_no_puede_volver_a_bajar_su_documento(
    client, session_factory, cloudinary_on
):
    worker, _, claim = await _submit_and_list(
        client, session_factory, "w-own@test.com", "a-own@test.com"
    )
    resp = await client.get(
        f"/api/v1/identity/evidences/{claim['evidences'][0]['evidence_id']}/link",
        headers=worker,
    )
    assert resp.status_code == 403
    me = (await client.get("/api/v1/identity/me", headers=worker)).json()
    assert me["claims"][0]["status"] == "pendiente"


@pytest.mark.asyncio
async def test_inexistente_y_ya_decidida_dan_404(client, session_factory, cloudinary_on):
    _, admin, claim = await _submit_and_list(
        client, session_factory, "w-404@test.com", "a-404@test.com"
    )
    missing = await client.get(f"/api/v1/identity/evidences/{uuid4()}/link", headers=admin)
    assert missing.status_code == 404

    await client.post(f"/api/v1/identity/claims/{claim['claim_id']}/approve", headers=admin)
    decided = await client.get(
        f"/api/v1/identity/evidences/{claim['evidences'][0]['evidence_id']}/link",
        headers=admin,
    )
    assert decided.status_code == 404


@pytest.mark.asyncio
async def test_sin_configuracion_responde_503(client, session_factory):
    _, admin, claim = await _submit_and_list(
        client, session_factory, "w-503@test.com", "a-503@test.com"
    )
    resp = await client.get(
        f"/api/v1/identity/evidences/{claim['evidences'][0]['evidence_id']}/link",
        headers=admin,
    )
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_una_evidencia_vieja_publica_se_sigue_viendo_hasta_migrarla(
    client, session_factory
):
    _, admin, claim = await _submit_and_list(
        client, session_factory, "w-old@test.com", "a-old@test.com"
    )
    evidence_id = claim["evidences"][0]["evidence_id"]
    viejo = "https://res.cloudinary.com/oido/image/upload/v1/oido/identidad/viejo.jpg"
    async with session_factory() as session:
        row = await session.get(IdentityEvidenceModel, UUID(evidence_id))
        row.file_public_id = None
        row.data_url = viejo
        await session.commit()

    resp = await client.get(f"/api/v1/identity/evidences/{evidence_id}/link", headers=admin)
    assert resp.status_code == 200
    assert resp.json() == {"url": viejo, "expires_at": None}


# --- Script de migración ------------------------------------------------------


class FakeAdmin:
    """Cloudinary de mentira: un dict `(resource_type, public_id) → Asset`."""

    def __init__(self, assets: list[script.Asset]) -> None:
        self.assets = {(a.resource_type, a.public_id): a for a in assets}
        self.made_private: list[str] = []

    def find(self, public_id, resource_type):
        return self.assets.get((resource_type, public_id))

    def list_public(self, folder, resource_type):
        return [
            a
            for a in self.assets.values()
            if a.type == "upload"
            and a.resource_type == resource_type
            and a.public_id.startswith(f"{folder}/")
        ]

    def make_private(self, asset):
        self.made_private.append(asset.public_id)
        self.assets[(asset.resource_type, asset.public_id)] = script.Asset(
            asset.public_id, asset.resource_type, asset.format, "private"
        )


def test_lee_las_urls_de_cloudinary():
    p = script.parse_cloudinary_url(
        "https://res.cloudinary.com/oido/image/upload/v1712/oido/identidad/ab12.jpg"
    )
    assert p == script.ParsedUrl("oido/identidad/ab12", "image", "jpg", "upload")
    p = script.parse_cloudinary_url(
        "https://res.cloudinary.com/oido/image/upload/fl_attachment/v1/x/doc.PDF"
    )
    assert p == script.ParsedUrl("x/doc", "image", "pdf", "upload")
    p = script.parse_cloudinary_url("https://res.cloudinary.com/oido/raw/upload/v2/c/a.pdf")
    assert p == script.ParsedUrl("c/a.pdf", "raw", "", "upload")
    assert script.parse_cloudinary_url("https://otro.com/a.jpg") is None


async def _legacy_row(session_factory, url: str) -> IdentityEvidenceModel:
    """Una evidencia como las de antes del ADR-0021: URL pública."""
    async with session_factory() as session:
        user = UserModel(
            email=f"{uuid4().hex[:8]}@test.com",
            hashed_password="x",
            full_name="Vieja",
            role="worker",
        )
        session.add(user)
        await session.flush()
        claim = IdentityClaimModel(
            user_id=user.id, claim_type="documento_verificado", status="pendiente"
        )
        session.add(claim)
        await session.flush()
        row = IdentityEvidenceModel(
            claim_id=claim.id, evidence_type="dni_frente", method="admin_manual", data_url=url
        )
        session.add(row)
        await session.commit()
        return row


async def _row(session_factory, row_id) -> IdentityEvidenceModel:
    async with session_factory() as session:
        return (
            await session.execute(
                select(IdentityEvidenceModel).where(IdentityEvidenceModel.id == row_id)
            )
        ).scalar_one()


URL_VIEJA = "https://res.cloudinary.com/oido/image/upload/v17/oido/identidad/{}.jpg"


@pytest.mark.asyncio
async def test_dry_run_no_cambia_nada(session_factory: async_sessionmaker[AsyncSession]):
    row = await _legacy_row(session_factory, URL_VIEJA.format("aaa"))
    admin = FakeAdmin([script.Asset("oido/identidad/aaa", "image", "jpg", "upload")])
    report = await script.run(session_factory, admin, apply=False, out=lambda _: None)
    assert report.rows_migrated == 1
    assert report.files_made_private == 1
    assert admin.made_private == []
    assert (await _row(session_factory, row.id)).data_url is not None


@pytest.mark.asyncio
async def test_apply_migra_la_fila_y_barre_las_carpetas_y_es_idempotente(
    session_factory,
):
    row = await _legacy_row(session_factory, URL_VIEJA.format("bbb"))
    admin = FakeAdmin(
        [
            script.Asset("oido/identidad/bbb", "image", "jpg", "upload"),
            # Archivo de un claim ya decidido: la base no lo apunta.
            script.Asset("oido/constancias/ccc", "image", "pdf", "upload"),
            # Foto de perfil: pública a propósito, no se toca.
            script.Asset("oido/perfiles/ddd", "image", "jpg", "upload"),
        ]
    )
    report = await script.run(session_factory, admin, apply=True, out=lambda _: None)
    assert sorted(admin.made_private) == ["oido/constancias/ccc", "oido/identidad/bbb"]
    assert report.files_made_private == 2

    migrated = await _row(session_factory, row.id)
    assert migrated.data_url is None
    assert migrated.file_public_id == "oido/identidad/bbb"
    assert (migrated.file_resource_type, migrated.file_format) == ("image", "jpg")
    assert migrated.file_delivery_type == "private"

    again = await script.run(session_factory, admin, apply=True, out=lambda _: None)
    assert (again.rows_migrated, again.files_made_private) == (0, 0)


@pytest.mark.asyncio
async def test_si_el_archivo_ya_es_privado_solo_actualiza_la_fila(session_factory):
    """Una corrida que se cortó entre el `rename` y el commit."""
    row = await _legacy_row(session_factory, URL_VIEJA.format("eee"))
    admin = FakeAdmin([script.Asset("oido/identidad/eee", "image", "jpg", "private")])
    report = await script.run(session_factory, admin, apply=True, out=lambda _: None)
    assert admin.made_private == []
    assert report.already_private == 1
    assert (await _row(session_factory, row.id)).file_public_id == "oido/identidad/eee"


@pytest.mark.asyncio
async def test_reporta_lo_que_no_puede_migrar(session_factory):
    await _legacy_row(session_factory, "https://otro.com/dni.jpg")
    await _legacy_row(session_factory, URL_VIEJA.format("fff"))
    report = await script.run(session_factory, FakeAdmin([]), apply=True, out=lambda _: None)
    assert report.rows_migrated == 0
    assert len(report.problems) == 2


def test_el_cliente_http_hace_el_rename_firmado(cloudinary_on):
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if request.url.path.endswith("/resources/image/upload/oido/identidad/x"):
            return httpx.Response(404)
        if request.url.path.endswith("/resources/image/private/oido/identidad/x"):
            return httpx.Response(
                200,
                json={"public_id": "oido/identidad/x", "format": "jpg", "type": "private"},
            )
        if request.url.path.endswith("/resources/image/upload"):
            cursor = request.url.params.get("next_cursor")
            if cursor is None:
                return httpx.Response(
                    200,
                    json={
                        "resources": [{"public_id": "oido/identidad/p1", "type": "upload"}],
                        "next_cursor": "2",
                    },
                )
            return httpx.Response(
                200, json={"resources": [{"public_id": "oido/identidad/p2", "type": "upload"}]}
            )
        if request.url.path.endswith("/resources/by_asset_folder"):
            return httpx.Response(400)
        return httpx.Response(200, json={})

    admin = script.HttpCloudinaryAdmin(httpx.Client(transport=httpx.MockTransport(handler)))
    assert admin.find("oido/identidad/x", "image").type == "private"
    listed = [a.public_id for a in admin.list_public("oido/identidad", "image")]
    assert listed == ["oido/identidad/p1", "oido/identidad/p2"]

    admin.make_private(script.Asset("oido/identidad/p1", "image", "jpg", "upload"))
    rename = calls[-1]
    assert rename.method == "POST"
    assert str(rename.url) == "https://api.cloudinary.com/v1_1/oido-test/image/rename"
    form = {k: v[0] for k, v in parse_qs(rename.content.decode()).items()}
    assert form["from_public_id"] == form["to_public_id"] == "oido/identidad/p1"
    assert (form["type"], form["to_type"], form["invalidate"]) == ("upload", "private", "true")
    signed = {k: v for k, v in form.items() if k not in ("signature", "api_key")}
    assert form["signature"] == _sha1(signed)


def test_el_cliente_http_exige_configuracion():
    with pytest.raises(CloudinaryNotConfiguredError):
        script.HttpCloudinaryAdmin()
