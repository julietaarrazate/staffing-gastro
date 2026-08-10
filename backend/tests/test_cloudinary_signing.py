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
    to_sign = f"allowed_formats=pdf,doc,docx,jpg,jpeg,png&timestamp={result['timestamp']}"
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
