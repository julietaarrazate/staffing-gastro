"""Rutas HTTP del módulo saved_shift (el trabajador guarda turnos abiertos
para evaluarlos después, sin postularse todavía)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.modules.company.api.dependencies import get_company_repository
from app.modules.company.domain.repositories import CompanyProfileRepository
from app.modules.saved_shift.api.dependencies import get_saved_shift_service
from app.modules.saved_shift.api.schemas import SavedShiftStatusResponse
from app.modules.saved_shift.application.services import SavedShiftService
from app.modules.saved_shift.domain.exceptions import ShiftNotSavableError
from app.modules.shift.api.dependencies import get_my_worker_profile_id
from app.modules.shift.api.schemas import ShiftResponse
from app.modules.shift.domain.entities import Shift
from app.modules.verification.api.dependencies import get_verification_service
from app.modules.verification.application.services import VerificationService

router = APIRouter(prefix="/saved-shifts", tags=["saved-shifts"])

ServiceDep = Annotated[SavedShiftService, Depends(get_saved_shift_service)]
WorkerProfileIdDep = Annotated[UUID, Depends(get_my_worker_profile_id)]
CompaniesDep = Annotated[CompanyProfileRepository, Depends(get_company_repository)]
VerificationDep = Annotated[VerificationService, Depends(get_verification_service)]

_SHIFT_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="Turno no encontrado"
)


# Mismo enriquecimiento que `shift/api/routes.py::_with_company_info` (nombre
# de comercio, logo, verificado) — no se reusa esa función porque es privada
# de ese router; acá se repite en chico a propósito, mismo criterio que ya
# usa `favorite/infrastructure/repositories.py` para su propio JOIN
# enriquecido en vez de depender de otro módulo de rutas.
async def _with_company_info(
    shifts: list[Shift], companies: CompaniesDep, verification: VerificationDep
) -> list[ShiftResponse]:
    unique_ids = list({shift.company_id for shift in shifts})
    companies_by_id = await companies.list_by_ids(unique_ids)
    owner_ids = [c.user_id for c in companies_by_id.values()]
    verified_owner_ids = await verification.verified_business_user_ids(owner_ids) if owner_ids else set()
    responses = []
    for shift in shifts:
        company = companies_by_id.get(shift.company_id)
        response = ShiftResponse.model_validate(shift)
        if company:
            response.company_name = company.name
            response.company_logo_url = company.logo_url
            response.company_verified = company.user_id in verified_owner_ids
        responses.append(response)
    return responses


@router.get(
    "",
    response_model=list[ShiftResponse],
    summary="Mis turnos guardados (trabajador), ordenados por fecha del turno",
)
async def list_my_saved_shifts(
    worker_profile_id: WorkerProfileIdDep,
    service: ServiceDep,
    companies: CompaniesDep,
    verification: VerificationDep,
):
    shifts = await service.list_my_saved_shifts(worker_profile_id)
    return await _with_company_info(shifts, companies, verification)


@router.put(
    "/{shift_id}",
    response_model=SavedShiftStatusResponse,
    summary="Guardar un turno para más tarde (trabajador)",
)
async def save_shift(
    shift_id: UUID, worker_profile_id: WorkerProfileIdDep, service: ServiceDep
):
    try:
        await service.save(worker_profile_id, shift_id)
    except ShiftNotSavableError as exc:
        raise _SHIFT_NOT_FOUND from exc
    return SavedShiftStatusResponse(is_saved=True)


@router.delete(
    "/{shift_id}",
    response_model=SavedShiftStatusResponse,
    summary="Sacar un turno de guardados (trabajador)",
)
async def unsave_shift(
    shift_id: UUID, worker_profile_id: WorkerProfileIdDep, service: ServiceDep
):
    await service.unsave(worker_profile_id, shift_id)
    return SavedShiftStatusResponse(is_saved=False)


@router.get(
    "/{shift_id}/status",
    response_model=SavedShiftStatusResponse,
    summary="Saber si un turno ya está guardado (trabajador)",
)
async def get_saved_shift_status(
    shift_id: UUID, worker_profile_id: WorkerProfileIdDep, service: ServiceDep
):
    is_saved = await service.is_saved(worker_profile_id, shift_id)
    return SavedShiftStatusResponse(is_saved=is_saved)
