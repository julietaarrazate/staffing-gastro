"""Tests de la firma de subida de CV a Cloudinary (C.2(b), auditoría de
producto 2026-08-10): unitarios del algoritmo puro + integración del
endpoint HTTP.
"""

import hashlib

import pytest
from httpx import AsyncClient

from app.core.cloudinary import CloudinaryNotConfiguredError, sign_cv_upload
from app.core.config import settings
from tests.conftest import auth_headers


@pytest.fixture
def configured_cloudinary():
    """Setea las credenciales para el test y las restaura al terminar (mismo
    patrón que `settings.rate_limit_enabled` en conftest.py)."""
    original_key, original_secret = settings.cloudinary_api_key, settings.cloudinary_api_secret
    settings.cloudinary_api_key = "test-api-key"
    settings.cloudinary_api_secret = "test-api-secret"
    yield
    settings.cloudinary_api_key, settings.cloudinary_api_secret = original_key, original_secret


def test_sign_cv_upload_raises_when_not_configured():
    assert settings.cloudinary_api_key == ""
    with pytest.raises(CloudinaryNotConfiguredError):
        sign_cv_upload()


def test_sign_cv_upload_produces_a_valid_cloudinary_signature(configured_cloudinary):
    result = sign_cv_upload()
    assert result["api_key"] == "test-api-key"
    assert result["allowed_formats"] == "pdf,doc,docx,jpg,jpeg,png"
    assert result["timestamp"].isdigit()

    # Recalculado a mano con el algoritmo documentado de Cloudinary: params
    # (menos file/cloud_name/resource_type/api_key) ordenados, unidos
    # `k=v&k2=v2`, `api_secret` pegado al final, SHA-1 hex.
    to_sign = (
        "allowed_formats=pdf,doc,docx,jpg,jpeg,png"
        f"&folder=oido/cv&overwrite=false&public_id={result['public_id']}"
        f"&timestamp={result['timestamp']}"
    )
    expected = hashlib.sha1(f"{to_sign}test-api-secret".encode()).hexdigest()
    assert result["signature"] == expected


@pytest.mark.asyncio
async def test_sign_cv_endpoint_returns_503_when_not_configured(client: AsyncClient):
    worker = await auth_headers(client, "worker", "w_cvsign1@staffya.com")
    response = await client.post("/api/v1/uploads/sign-cv", headers=worker)
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_sign_cv_endpoint_returns_signature_when_configured(
    client: AsyncClient, configured_cloudinary
):
    worker = await auth_headers(client, "worker", "w_cvsign2@staffya.com")
    response = await client.post("/api/v1/uploads/sign-cv", headers=worker)
    assert response.status_code == 200
    body = response.json()
    assert body["api_key"] == "test-api-key"
    assert body["signature"]
    assert body["timestamp"]


@pytest.mark.asyncio
async def test_employer_cannot_sign_cv_upload(client: AsyncClient, configured_cloudinary):
    """Sólo el trabajador sube CV — el comercio no tiene ese campo."""
    employer = await auth_headers(client, "employer", "emp_cvsign1@staffya.com")
    response = await client.post("/api/v1/uploads/sign-cv", headers=employer)
    assert response.status_code == 403


# --- Fotos firmadas (auditoría de seguridad 2026-10-14) -------------------


def test_cada_firma_trae_nombre_al_azar_carpeta_y_no_sobrescribe(configured_cloudinary):
    from app.core.cloudinary import sign_image_upload

    a, b = sign_image_upload("profile"), sign_image_upload("profile")
    assert a["public_id"] != b["public_id"]
    assert a["folder"] == "oido/perfiles"
    assert a["overwrite"] == "false"
    assert "heic" in a["allowed_formats"] and "pdf" not in a["allowed_formats"]


@pytest.mark.parametrize(
    ("role", "kind", "esperado"),
    [
        ("worker", "profile", 200),
        ("employer", "profile", 200),
        ("employer", "cover", 200),
        ("worker", "cover", 403),
        ("worker", "identity", 200),
        ("employer", "identity", 403),
    ],
)
async def test_quien_puede_pedir_cada_firma_de_foto(
    client: AsyncClient, configured_cloudinary, role, kind, esperado
):
    headers = await auth_headers(client, role, f"{role}_{kind}_img@staffya.com")
    res = await client.post(f"/api/v1/uploads/sign-image?kind={kind}", headers=headers)
    assert res.status_code == esperado
    if esperado == 200:
        assert res.json()["folder"].startswith("oido/")


async def test_firma_de_foto_sin_sesion_es_401(client: AsyncClient, configured_cloudinary):
    res = await client.post("/api/v1/uploads/sign-image?kind=profile")
    assert res.status_code == 401
