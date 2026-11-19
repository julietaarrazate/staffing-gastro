"""Qué entrega Cloudinary sin firma, según el tipo de entrega (ADR-0021,
actualización 2026-11-19). Corre contra el Cloudinary de mentira del arnés
(`tools/e2e-local/fakes.py`), que imita las reglas de acceso del real.

La revisión del 2026-11-19 encontró que `private` no alcanza: protege el
original, pero Cloudinary entrega sin firma cualquier versión transformada.
Con lo que trae el link que vence (cuenta, tipo, `public_id`, formato) se
podía armar `…/image/private/w_2000/<public_id>.jpg` y abrir el documento
para siempre. `authenticated` pide firma también en las transformaciones.
"""

import importlib.util
import time
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

import httpx
import pytest

from app.core.cloudinary import (
    ALLOWED_IMAGE_FORMATS,
    FOLDERS,
    private_download_url,
    sign_cv_upload,
    sign_upload,
)
from tests.test_cv_privado import cloudinary_on  # noqa: F401

pytestmark = pytest.mark.asyncio

FAKES = Path(__file__).resolve().parents[2] / "tools" / "e2e-local" / "fakes.py"
PDF = b"%PDF-1.4\n% CV de prueba con telefono y domicilio\n%%EOF\n"


@pytest.fixture
def fake_cloudinary(tmp_path, monkeypatch, cloudinary_on):  # noqa: F811
    """El Cloudinary de mentira del arnés, con las credenciales de los tests
    y los archivos en un directorio propio."""
    monkeypatch.setenv("E1_DIR", str(tmp_path))
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", "oido-test")
    monkeypatch.setenv("CLOUDINARY_API_KEY", "test-api-key")
    monkeypatch.setenv("CLOUDINARY_API_SECRET", "test-api-secret")
    spec = importlib.util.spec_from_file_location(f"fakes_{uuid4().hex}", FAKES)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def _upload(fakes, params: dict[str, str], filename: str, data: bytes) -> dict:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=fakes.app), base_url="http://fake"
    ) as client:
        resp = await client.post(
            "/cloudinary/v1_1/oido-test/auto/upload",
            data=params,
            files={"file": (filename, data)},
        )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _get(fakes, url: str) -> httpx.Response:
    """Una URL de `res.cloudinary.com` o de `api.cloudinary.com`, contra el
    arnés (que las sirve en `/res/…` y `/cloudinary/…`)."""
    parsed = urlparse(url)
    prefix = "/res" if parsed.netloc == "res.cloudinary.com" else "/cloudinary"
    path = f"{prefix}{parsed.path}" + (f"?{parsed.query}" if parsed.query else "")
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=fakes.app), base_url="http://fake"
    ) as client:
        return await client.get(path)


async def test_un_cv_authenticated_no_se_ve_sin_firma_ni_transformado(fake_cloudinary):
    cv = await _upload(fake_cloudinary, sign_cv_upload(uuid4()), "cv.pdf", PDF)
    assert cv["type"] == "authenticated"
    public_id = cv["public_id"]
    base = "https://res.cloudinary.com/oido-test/image/authenticated"

    for url in (
        f"{base}/v1/{public_id}.pdf",  # el original
        f"{base}/w_2000/{public_id}.jpg",  # una versión agrandada
        f"{base}/pg_1/{public_id}.jpg",  # la primera página del PDF
        f"{base}/fl_attachment/{public_id}.pdf",
        f"{base}/s--abcd1234--/w_2000/{public_id}.jpg",  # firma inventada
    ):
        assert (await _get(fake_cloudinary, url)).status_code == 401, url

    # Quien puede verlo recibe el link de la API de descarga, que vence.
    link = private_download_url(public_id, "pdf", "image", "authenticated", int(time.time()) + 300)
    resp = await _get(fake_cloudinary, link)
    assert resp.status_code == 200
    assert resp.content == PDF
    vencido = private_download_url(public_id, "pdf", "image", "authenticated", int(time.time()) - 1)
    assert (await _get(fake_cloudinary, vencido)).status_code == 401


async def test_private_deja_ver_las_versiones_transformadas(fake_cloudinary):
    """Por qué se dejó `private`: el original da 401, pero la misma imagen
    con una transformación se entrega sin firma y sin vencimiento."""
    png = fake_cloudinary.placeholder_png("photo", 1)
    params = sign_upload(ALLOWED_IMAGE_FORMATS, FOLDERS["identity"], "private")
    dni = await _upload(fake_cloudinary, params, "dni.png", png)
    base = "https://res.cloudinary.com/oido-test/image/private"

    assert (await _get(fake_cloudinary, f"{base}/v1/{dni['public_id']}.png")).status_code == 401
    transformada = await _get(fake_cloudinary, f"{base}/w_2000/{dni['public_id']}.png")
    assert transformada.status_code == 200
    assert transformada.content == png
