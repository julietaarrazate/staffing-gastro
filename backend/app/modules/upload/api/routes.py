"""Rutas HTTP del módulo upload.

Sin domain/application/infrastructure: no hay persistencia ni entidad de
negocio acá — es un endpoint chico que traduce una firma criptográfica
(`app/core/cloudinary.py`) a HTTP, misma categoría que `idempotency.py`/
`rate_limit.py` en `app/core/`, sólo que necesita ser alcanzable por HTTP
(C.2(b), auditoría de producto 2026-08-10).
"""

from enum import StrEnum
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.cloudinary import (
    CloudinaryNotConfiguredError,
    sign_business_document_upload,
    sign_cv_upload,
    sign_image_upload,
)
from app.modules.identity.api.dependencies import get_current_user, require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.upload.api.schemas import SignedUploadResponse

router = APIRouter(prefix="/uploads", tags=["uploads"])

WorkerDep = Annotated[User, Depends(require_roles(UserRole.WORKER))]
EmployerDep = Annotated[User, Depends(require_roles(UserRole.EMPLOYER))]
UserDep = Annotated[User, Depends(get_current_user)]


class ImageKind(StrEnum):
    PROFILE = "profile"
    COVER = "cover"
    IDENTITY = "identity"


# Quién puede pedir cada tipo de firma: la portada es del comercio; el DNI y
# la selfie, del trabajador; la foto de perfil (o el logo), de cualquiera.
_IMAGE_ROLES = {
    ImageKind.PROFILE: {UserRole.WORKER, UserRole.EMPLOYER, UserRole.ADMIN},
    ImageKind.COVER: {UserRole.EMPLOYER},
    ImageKind.IDENTITY: {UserRole.WORKER},
}


@router.post(
    "/sign-cv",
    response_model=SignedUploadResponse,
    summary="Firma para subir un CV directo a Cloudinary (subida firmada, no preset unsigned)",
)
async def sign_cv(_current_user: WorkerDep):
    try:
        return sign_cv_upload()
    except CloudinaryNotConfiguredError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La subida firmada de CV no está configurada en este servidor",
        ) from exc


@router.post(
    "/sign-business-document",
    response_model=SignedUploadResponse,
    summary="Firma para subir la constancia de AFIP del comercio (ADR-0013)",
)
async def sign_business_document(_current_user: EmployerDep):
    """Acotado al rol `employer`: el que sube una constancia de negocio es el
    dueño del comercio. Un trabajador que llame acá recibe 403 — no porque la
    firma sea secreta, sino porque cada rol usa la subida de su propio flujo
    y mezclarlas sólo amplía la superficie sin ganar nada."""
    try:
        return sign_business_document_upload()
    except CloudinaryNotConfiguredError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "La subida firmada de documentos no está configurada en este servidor"
            ),
        ) from exc


@router.post(
    "/sign-image",
    response_model=SignedUploadResponse,
    summary="Firma para subir una foto (perfil, portada o identidad) a Cloudinary",
)
async def sign_image(kind: ImageKind, current_user: UserDep):
    """Reemplaza al preset unsigned que viajaba en el código del navegador
    (auditoría de seguridad 2026-10-14)."""
    if current_user.role not in _IMAGE_ROLES[kind]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    try:
        return sign_image_upload(kind.value)
    except CloudinaryNotConfiguredError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La subida de fotos no está configurada en este servidor",
        ) from exc
