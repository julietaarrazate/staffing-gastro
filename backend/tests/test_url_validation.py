"""URLs que carga el usuario: sólo `https://` (auditoría 2026-10-14)."""

import pytest
from pydantic import ValidationError

from app.modules.company.api.schemas import CompanyProfileInput
from app.modules.verification.api.schemas import (
    SubmitBusinessDocumentInput,
    SubmitIdentityDocumentInput,
)
from app.modules.worker.api.schemas import WorkerProfileInput

PELIGROSAS = [
    "javascript:alert(1)",
    " JavaScript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "http://ejemplo.com/cv.pdf",
    "//ejemplo.com/cv.pdf",
    "https://",
    "cv.pdf",
]
VALIDA = "https://res.cloudinary.com/demo/raw/upload/v1/cv.pdf"


@pytest.mark.parametrize("url", PELIGROSAS)
def test_rechaza_urls_que_no_son_https(url):
    with pytest.raises(ValidationError):
        WorkerProfileInput(cv_url=url)
    with pytest.raises(ValidationError):
        WorkerProfileInput(photo_url=url)
    with pytest.raises(ValidationError):
        CompanyProfileInput(name="Bar", logo_url=url)
    with pytest.raises(ValidationError):
        CompanyProfileInput(name="Bar", cover_photo_url=url)
    with pytest.raises(ValidationError):
        SubmitIdentityDocumentInput(dni_frente_url=url, selfie_url=VALIDA)
    with pytest.raises(ValidationError):
        SubmitBusinessDocumentInput(constancia_url=url)


def test_acepta_https_y_vacio():
    assert WorkerProfileInput(cv_url=VALIDA, photo_url=None).cv_url == VALIDA
    assert CompanyProfileInput(name="Bar", logo_url=VALIDA).logo_url == VALIDA
    doc = SubmitIdentityDocumentInput(dni_frente_url=VALIDA, selfie_url=VALIDA)
    assert doc.dni_dorso_url is None


def test_respeta_el_largo_de_la_columna():
    with pytest.raises(ValidationError):
        WorkerProfileInput(cv_url="https://x.com/" + "a" * 600)
