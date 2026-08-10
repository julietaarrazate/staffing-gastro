"""Rutas HTTP del módulo upload.

Sin domain/application/infrastructure: no hay persistencia ni entidad de
negocio acá — es un endpoint chico que traduce una firma criptográfica
(`app/core/cloudinary.py`) a HTTP, misma categoría que `idempotency.py`/
`rate_limit.py` en `app/core/`, sólo que necesita ser alcanzable por HTTP
(C.2(b), auditoría de producto 2026-08-10).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.cloudinary import CloudinaryNotConfiguredError, sign_cv_upload
from app.modules.identity.api.dependencies import require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.upload.api.schemas import SignedUploadResponse

router = APIRouter(prefix="/uploads", tags=["uploads"])

WorkerDep = Annotated[User, Depends(require_roles(UserRole.WORKER))]


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
