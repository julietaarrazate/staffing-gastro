"""Documentos de identidad privados en Cloudinary (ADR-0021).

Cubren: la firma de la subida (`type=private` firmado), el link de descarga
que vence, los datos que acepta el envío (referencia privada, no URL), el
endpoint de admin para ver una evidencia (no-disclosure) y el script que
pasa a privados los archivos pendientes y borra los huérfanos (con un
Cloudinary de mentira). El borrado al decidir está en
`test_borrado_evidencias.py`.
"""

import hashlib
import time
from datetime import UTC, datetime, timedelta
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
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.verification.api.schemas import (
    SubmitBusinessDocumentInput,
    SubmitIdentityDocumentInput,
)
from app.modules.verification.infrastructure.models import (
    IdentityClaimModel,
    IdentityEvidenceModel,
)
from scripts import privatize_identity_evidence as script
from tests.conftest import auth_headers, login


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
    await auth_headers(client, "employer", email)
    async with session_factory() as session:
        repo = SqlAlchemyUserRepository(session)
        user = await repo.get_by_email(email)
        user.promote_to_admin()
        await repo.update(user)
    tokens = await login(client, email)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


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


AHORA = datetime(2026, 10, 23, 12, 0, tzinfo=UTC)
VIEJO = AHORA - timedelta(days=3)


def _asset(public_id, fmt="jpg", type_="upload", rt="image", created_at=VIEJO):
    return script.Asset(public_id, rt, fmt, type_, created_at)


class FakeAdmin:
    """Cloudinary de mentira: un dict `(resource_type, public_id) → Asset`."""

    def __init__(self, assets: list[script.Asset]) -> None:
        self.assets = {(a.resource_type, a.public_id): a for a in assets}
        self.made_private: list[str] = []
        self.deleted: list[str] = []
        self.fail_delete: set[str] = set()

    def find(self, public_id, resource_type):
        return self.assets.get((resource_type, public_id))

    def list_files(self, folder, resource_type):
        return [
            a
            for a in self.assets.values()
            if a.resource_type == resource_type and a.public_id.startswith(f"{folder}/")
        ]

    def make_private(self, asset):
        self.made_private.append(asset.public_id)
        self.assets[(asset.resource_type, asset.public_id)] = script.Asset(
            asset.public_id, asset.resource_type, asset.format, "private", asset.created_at
        )

    def delete(self, asset):
        if asset.public_id in self.fail_delete:
            raise httpx.ConnectError("Cloudinary no responde")
        self.deleted.append(asset.public_id)
        del self.assets[(asset.resource_type, asset.public_id)]


async def _run(session_factory, admin, apply):
    return await script.run(session_factory, admin, apply=apply, out=lambda _: None, now=AHORA)


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
    admin = FakeAdmin(
        [
            _asset("oido/identidad/aaa"),
            _asset("oido/constancias/huerfana", "pdf", "private"),
        ]
    )
    report = await _run(session_factory, admin, apply=False)
    assert report.rows_migrated == 1
    assert report.files_made_private == 1
    assert report.orphans_deleted == 1
    assert admin.made_private == []
    assert admin.deleted == []
    assert len(admin.assets) == 2
    assert (await _row(session_factory, row.id)).data_url is not None


async def _pending_private_row(session_factory, public_id: str) -> None:
    """Una evidencia nueva (ADR-0021) de un claim pendiente."""
    row = await _legacy_row(session_factory, URL_VIEJA.format("tmp"))
    async with session_factory() as session:
        fila = await session.get(IdentityEvidenceModel, row.id)
        fila.data_url = None
        fila.file_public_id = public_id
        fila.file_resource_type = "image"
        fila.file_format = "jpg"
        fila.file_delivery_type = "private"
        await session.commit()


@pytest.mark.asyncio
async def test_apply_migra_lo_pendiente_y_borra_solo_los_huerfanos(session_factory):
    row = await _legacy_row(session_factory, URL_VIEJA.format("bbb"))
    await _pending_private_row(session_factory, "oido/identidad/pendiente")
    admin = FakeAdmin(
        [
            # Pendiente vieja (URL pública en la base): se privatiza, no se borra.
            _asset("oido/identidad/bbb"),
            # Pendiente nueva (privada, la apunta la base): no se toca.
            _asset("oido/identidad/pendiente", type_="private"),
            # Huérfanos de claims ya decididos, públicos o privados: se borran.
            _asset("oido/constancias/ccc", "pdf"),
            _asset("oido/identidad/decidida", type_="private"),
            _asset("oido/constancias/doc.pdf", "", "private", rt="raw"),
            # Recién subido, todavía sin enviar: no se toca.
            _asset("oido/identidad/reciente", type_="private", created_at=AHORA),
            # Foto de perfil: pública a propósito, no es de estas carpetas.
            _asset("oido/perfiles/ddd"),
        ]
    )
    report = await _run(session_factory, admin, apply=True)
    assert admin.made_private == ["oido/identidad/bbb"]
    assert sorted(admin.deleted) == [
        "oido/constancias/ccc",
        "oido/constancias/doc.pdf",
        "oido/identidad/decidida",
    ]
    assert (report.files_made_private, report.orphans_deleted) == (1, 3)
    assert report.recent_skipped == 1
    assert sorted(public_id for _rt, public_id in admin.assets) == [
        "oido/identidad/bbb",
        "oido/identidad/pendiente",
        "oido/identidad/reciente",
        "oido/perfiles/ddd",
    ]

    migrated = await _row(session_factory, row.id)
    assert migrated.data_url is None
    assert migrated.file_public_id == "oido/identidad/bbb"
    assert (migrated.file_resource_type, migrated.file_format) == ("image", "jpg")
    assert migrated.file_delivery_type == "private"

    again = await _run(session_factory, admin, apply=True)
    assert (again.rows_migrated, again.files_made_private, again.orphans_deleted) == (0, 0, 0)


@pytest.mark.asyncio
async def test_un_borrado_que_falla_queda_en_problemas_y_sigue(session_factory):
    admin = FakeAdmin(
        [_asset("oido/identidad/falla", type_="private"), _asset("oido/identidad/anda")]
    )
    admin.fail_delete = {"oido/identidad/falla"}
    report = await _run(session_factory, admin, apply=True)
    assert admin.deleted == ["oido/identidad/anda"]
    assert report.orphans_deleted == 1
    assert len(report.problems) == 1 and "oido/identidad/falla" in report.problems[0]


@pytest.mark.asyncio
async def test_si_el_archivo_ya_es_privado_solo_actualiza_la_fila(session_factory):
    """Una corrida que se cortó entre el `rename` y el commit."""
    row = await _legacy_row(session_factory, URL_VIEJA.format("eee"))
    admin = FakeAdmin([_asset("oido/identidad/eee", type_="private")])
    report = await _run(session_factory, admin, apply=True)
    assert admin.made_private == []
    assert admin.deleted == []
    assert report.already_private == 1
    assert (await _row(session_factory, row.id)).file_public_id == "oido/identidad/eee"


@pytest.mark.asyncio
async def test_reporta_lo_que_no_puede_migrar(session_factory):
    await _legacy_row(session_factory, "https://otro.com/dni.jpg")
    await _legacy_row(session_factory, URL_VIEJA.format("fff"))
    report = await _run(session_factory, FakeAdmin([]), apply=True)
    assert report.rows_migrated == 0
    assert len(report.problems) == 2


def test_el_cliente_http_lista_por_tipo_y_hace_rename_y_destroy_firmados(cloudinary_on):
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        path = request.url.path
        if path.endswith("/resources/image/upload/oido/identidad/x"):
            return httpx.Response(404)
        if path.endswith("/resources/image/private/oido/identidad/x"):
            return httpx.Response(
                200,
                json={"public_id": "oido/identidad/x", "format": "jpg", "type": "private"},
            )
        if path.endswith("/resources/image/upload"):
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
        if path.endswith("/resources/image/private"):
            return httpx.Response(
                200,
                json={
                    "resources": [
                        {
                            "public_id": "oido/identidad/v1",
                            "type": "private",
                            "created_at": "2026-10-01T10:00:00Z",
                        }
                    ]
                },
            )
        if path.endswith("/resources/image/authenticated"):
            return httpx.Response(200, json={"resources": []})
        if path.endswith("/resources/by_asset_folder"):
            return httpx.Response(400)
        if path.endswith("/image/destroy"):
            return httpx.Response(200, json={"result": "not found"})
        return httpx.Response(200, json={})

    admin = script.HttpCloudinaryAdmin(httpx.Client(transport=httpx.MockTransport(handler)))
    assert admin.find("oido/identidad/x", "image").type == "private"
    listed = list(admin.list_files("oido/identidad", "image"))
    assert [a.public_id for a in listed] == [
        "oido/identidad/p1",
        "oido/identidad/p2",
        "oido/identidad/v1",
    ]
    assert listed[2].created_at == datetime(2026, 10, 1, 10, 0, tzinfo=UTC)

    admin.make_private(_asset("oido/identidad/p1"))
    rename = calls[-1]
    assert rename.method == "POST"
    assert str(rename.url) == "https://api.cloudinary.com/v1_1/oido-test/image/rename"
    form = {k: v[0] for k, v in parse_qs(rename.content.decode()).items()}
    assert form["from_public_id"] == form["to_public_id"] == "oido/identidad/p1"
    assert (form["type"], form["to_type"], form["invalidate"]) == ("upload", "private", "true")
    signed = {k: v for k, v in form.items() if k not in ("signature", "api_key")}
    assert form["signature"] == _sha1(signed)

    # "not found" cuenta como borrado: no lanza.
    admin.delete(listed[2])
    destroy = calls[-1]
    assert str(destroy.url) == "https://api.cloudinary.com/v1_1/oido-test/image/destroy"
    form = {k: v[0] for k, v in parse_qs(destroy.content.decode()).items()}
    assert (form["public_id"], form["type"], form["invalidate"]) == (
        "oido/identidad/v1",
        "private",
        "true",
    )
    signed = {k: v for k, v in form.items() if k not in ("signature", "api_key")}
    assert form["signature"] == _sha1(signed)


def test_el_cliente_http_exige_configuracion():
    with pytest.raises(CloudinaryNotConfiguredError):
        script.HttpCloudinaryAdmin()
