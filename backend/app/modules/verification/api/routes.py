"""Rutas HTTP del dominio de verificación de identidad (ADR-0010).

Trabajador: enviar DNI+selfie a revisión, ver el estado de su identidad.
Admin: cola de revisión, aprobar/rechazar. Mapea las excepciones de dominio a
códigos HTTP; el estado propio no expone evidencias (no-disclosure).
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.modules.identity.api.dependencies import get_current_user, require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.repositories import UserRepository
from app.modules.identity.domain.value_objects import UserRole
from app.modules.verification.api.dependencies import get_verification_service
from app.modules.verification.api.schemas import (
    ClaimSummaryResponse,
    IdentitySummaryResponse,
    PendingClaimResponse,
    PendingEvidenceResponse,
    RejectClaimInput,
    SubmitIdentityDocumentInput,
)
from app.modules.verification.application.dtos import IdentitySummary
from app.modules.verification.application.services import VerificationService
from app.modules.verification.domain.exceptions import (
    ClaimAlreadyVerifiedError,
    ClaimNotFoundError,
    ClaimNotPendingError,
    EvidenceRequiredError,
)
from app.modules.worker.api.dependencies import get_user_repository

router = APIRouter(prefix="/identity", tags=["identity-verification"])

ServiceDep = Annotated[VerificationService, Depends(get_verification_service)]
UsersDep = Annotated[UserRepository, Depends(get_user_repository)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
AdminDep = Annotated[User, Depends(require_roles(UserRole.ADMIN))]


def _to_summary_response(summary: IdentitySummary) -> IdentitySummaryResponse:
    return IdentitySummaryResponse(
        user_id=summary.user_id,
        assurance_level=summary.assurance_level,
        identidad_verificada=summary.identidad_verificada,
        claims=[
            ClaimSummaryResponse(
                claim_type=c.claim_type,
                status=c.status,
                confidence=c.confidence,
                decided_at=c.decided_at,
                rejection_reason=c.rejection_reason,
            )
            for c in summary.claims
        ],
    )


@router.get(
    "/me",
    response_model=IdentitySummaryResponse,
    summary="Estado de mi identidad (nivel de garantía + claims, sin datos sensibles)",
)
async def get_my_identity(current_user: CurrentUserDep, service: ServiceDep):
    summary = await service.get_identity_summary(current_user.id)
    return _to_summary_response(summary)


@router.post(
    "/me/document",
    response_model=IdentitySummaryResponse,
    summary="Enviar mi DNI + selfie a verificación",
)
async def submit_my_document(
    payload: SubmitIdentityDocumentInput,
    current_user: CurrentUserDep,
    service: ServiceDep,
):
    try:
        await service.submit_identity_document(
            current_user.id,
            payload.dni_frente_url,
            payload.selfie_url,
            payload.dni_dorso_url,
        )
    except ClaimAlreadyVerifiedError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tu identidad ya está verificada",
        ) from exc
    except EvidenceRequiredError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Necesitás subir el DNI y la selfie",
        ) from exc
    summary = await service.get_identity_summary(current_user.id)
    return _to_summary_response(summary)


@router.get(
    "/claims/pending",
    response_model=list[PendingClaimResponse],
    summary="Cola de claims de identidad pendientes de revisión (admin)",
)
async def list_pending_claims(
    _current_user: AdminDep, service: ServiceDep, users: UsersDep
):
    items = await service.list_pending()
    responses: list[PendingClaimResponse] = []
    for item in items:
        user = await users.get_by_id(item.user_id)
        responses.append(
            PendingClaimResponse(
                claim_id=item.claim_id,
                user_id=item.user_id,
                claim_type=item.claim_type,
                full_name=user.full_name if user else None,
                submitted_at=item.submitted_at,
                evidences=[
                    PendingEvidenceResponse(
                        evidence_type=e.evidence_type, data_url=e.data_url
                    )
                    for e in item.evidences
                ],
            )
        )
    return responses


@router.post(
    "/claims/{claim_id}/approve",
    response_model=ClaimSummaryResponse,
    summary="Aprobar un claim de identidad (admin)",
)
async def approve_claim(
    claim_id: UUID, current_user: AdminDep, service: ServiceDep
):
    try:
        claim = await service.approve_claim(claim_id, current_user.id)
    except ClaimNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Claim no encontrado"
        ) from exc
    except ClaimNotPendingError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El claim no está pendiente de revisión",
        ) from exc
    return ClaimSummaryResponse(
        claim_type=claim.claim_type,
        status=claim.status,
        confidence=claim.confidence,
        decided_at=claim.decided_at,
        rejection_reason=claim.rejection_reason,
    )


@router.post(
    "/claims/{claim_id}/reject",
    response_model=ClaimSummaryResponse,
    summary="Rechazar un claim de identidad (admin)",
)
async def reject_claim(
    claim_id: UUID,
    payload: RejectClaimInput,
    current_user: AdminDep,
    service: ServiceDep,
):
    try:
        claim = await service.reject_claim(claim_id, current_user.id, payload.reason)
    except ClaimNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Claim no encontrado"
        ) from exc
    except ClaimNotPendingError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El claim no está pendiente de revisión",
        ) from exc
    return ClaimSummaryResponse(
        claim_type=claim.claim_type,
        status=claim.status,
        confidence=claim.confidence,
        decided_at=claim.decided_at,
        rejection_reason=claim.rejection_reason,
    )
