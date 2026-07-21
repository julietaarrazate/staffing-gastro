"""Rutas HTTP del módulo application (postulación del trabajador a un turno)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.idempotency import IdempotencyRecorder, idempotent
from app.modules.application.api.dependencies import get_application_service
from app.modules.application.api.schemas import ApplicantResponse, ApplicationResponse
from app.modules.application.application.services import ApplicationService
from app.modules.application.domain.exceptions import (
    AlreadyAppliedError,
    ApplicationNotFoundError,
    InvalidApplicationTransitionError,
    ShiftNotApplicableError,
)
from app.modules.shift.api.dependencies import get_my_company_id, get_my_worker_profile_id

router = APIRouter(prefix="/applications", tags=["applications"])

ServiceDep = Annotated[ApplicationService, Depends(get_application_service)]
WorkerProfileIdDep = Annotated[UUID, Depends(get_my_worker_profile_id)]
CompanyIdDep = Annotated[UUID, Depends(get_my_company_id)]
LimitDep = Annotated[int, Query(ge=1, le=100)]
OffsetDep = Annotated[int, Query(ge=0)]
# Idempotencia (product/IDEMPOTENCIA_SPEC.md): último parámetro de
# dependencia, después de `worker_profile_id`/`company_id`.
RecorderDep = Annotated[IdempotencyRecorder, Depends(idempotent)]

_SHIFT_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="Turno no encontrado o no disponible para postularse",
)


@router.post(
    "/shifts/{shift_id}",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Postularme a un turno abierto (trabajador)",
)
async def apply_to_shift(
    shift_id: UUID,
    worker_profile_id: WorkerProfileIdDep,
    service: ServiceDep,
    recorder: RecorderDep,
):
    try:
        application = await service.apply(worker_profile_id, shift_id)
    except ShiftNotApplicableError as exc:
        raise _SHIFT_NOT_FOUND from exc
    except AlreadyAppliedError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya te postulaste a este turno",
        ) from exc
    response = ApplicationResponse.model_validate(application)
    await recorder.save(status.HTTP_201_CREATED, response.model_dump(mode="json"))
    return response


@router.post(
    "/{application_id}/withdraw",
    response_model=ApplicationResponse,
    summary="Cancelar mi postulación pendiente (trabajador)",
)
async def withdraw_application(
    application_id: UUID, worker_profile_id: WorkerProfileIdDep, service: ServiceDep
):
    try:
        return await service.withdraw(worker_profile_id, application_id)
    except ApplicationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Postulación no encontrada",
        ) from exc
    except InvalidApplicationTransitionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/mine",
    response_model=list[ApplicationResponse],
    summary="Mis postulaciones (trabajador)",
)
async def my_applications(
    worker_profile_id: WorkerProfileIdDep,
    service: ServiceDep,
    limit: LimitDep = 50,
    offset: OffsetDep = 0,
):
    return await service.list_my_applications(worker_profile_id, limit=limit, offset=offset)


@router.get(
    "/shifts/{shift_id}",
    response_model=list[ApplicantResponse],
    summary="Postulantes de un turno propio (comercio)",
)
async def shift_applicants(
    shift_id: UUID,
    company_id: CompanyIdDep,
    service: ServiceDep,
):
    try:
        applicants = await service.list_applicants(company_id, shift_id)
    except ShiftNotApplicableError as exc:
        raise _SHIFT_NOT_FOUND from exc

    # Enriquecido ya viene resuelto del repo (JOIN, sin N+1): sólo se mapea
    # al esquema de respuesta (mismo shape que antes).
    return [
        ApplicantResponse(
            application_id=applicant.application_id,
            worker_profile_id=applicant.worker_profile_id,
            full_name=applicant.full_name,
            photo_url=applicant.photo_url,
            rating=applicant.rating,
            is_available=applicant.is_available,
            status=applicant.status.value,
            created_at=applicant.created_at,
        )
        for applicant in applicants
    ]
