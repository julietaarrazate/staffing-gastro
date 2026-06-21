"""Rutas HTTP del módulo shift (publicación y ciclo de vida del turno)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.modules.identity.api.dependencies import get_current_user
from app.modules.identity.domain.entities import User
from app.modules.shift.api.dependencies import (
    get_my_company_id,
    get_my_worker_profile_id,
    get_shift_service,
)
from app.modules.shift.api.schemas import (
    AssignWorkerRequest,
    GeoCheckRequest,
    ShiftInput,
    ShiftResponse,
)
from app.modules.shift.application.dtos import ShiftData
from app.modules.shift.application.services import ShiftService
from app.modules.shift.domain.exceptions import (
    InvalidShiftScheduleError,
    InvalidShiftTransitionError,
    ShiftNotAssignedToWorkerError,
    ShiftNotEditableError,
    ShiftNotFoundError,
)
from app.modules.worker.domain.value_objects import WorkerSkill

router = APIRouter(prefix="/shifts", tags=["shifts"])

ServiceDep = Annotated[ShiftService, Depends(get_shift_service)]
CompanyIdDep = Annotated[UUID, Depends(get_my_company_id)]
WorkerProfileIdDep = Annotated[UUID, Depends(get_my_worker_profile_id)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


def _to_data(payload: ShiftInput) -> ShiftData:
    return ShiftData(**payload.model_dump())


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Turno no encontrado")


@router.post(
    "",
    response_model=ShiftResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Publicar un turno (crea en estado BORRADOR)",
)
async def create_shift(
    payload: ShiftInput, company_id: CompanyIdDep, service: ServiceDep
):
    try:
        return await service.create_shift(company_id, _to_data(payload))
    except InvalidShiftScheduleError as exc:
        raise _bad_request(str(exc)) from exc


@router.get(
    "/feed",
    response_model=list[ShiftResponse],
    summary="Feed de turnos abiertos (para trabajadores)",
)
async def feed(
    service: ServiceDep,
    _current_user: AuthUserDep,
    city: Annotated[str | None, Query()] = None,
    position: Annotated[WorkerSkill | None, Query()] = None,
    urgent: Annotated[bool | None, Query()] = None,
):
    return await service.list_feed(city=city, position=position, urgent=urgent)


@router.get(
    "/me",
    response_model=list[ShiftResponse],
    summary="Mis turnos publicados (comercio)",
)
async def my_shifts(company_id: CompanyIdDep, service: ServiceDep):
    return await service.list_company_shifts(company_id)


@router.get(
    "/mine",
    response_model=list[ShiftResponse],
    summary="Mis turnos asignados (trabajador)",
)
async def my_assigned_shifts(worker_profile_id: WorkerProfileIdDep, service: ServiceDep):
    return await service.list_worker_shifts(worker_profile_id)


@router.get(
    "/{shift_id}",
    response_model=ShiftResponse,
    summary="Ver un turno",
)
async def get_shift(shift_id: UUID, service: ServiceDep, _current_user: AuthUserDep):
    try:
        return await service.get_shift(shift_id)
    except ShiftNotFoundError as exc:
        raise _not_found() from exc


@router.put(
    "/{shift_id}",
    response_model=ShiftResponse,
    summary="Editar un turno (sólo en BORRADOR o PUBLICADO)",
)
async def update_shift(
    shift_id: UUID,
    payload: ShiftInput,
    company_id: CompanyIdDep,
    service: ServiceDep,
):
    try:
        return await service.update_shift(company_id, shift_id, _to_data(payload))
    except ShiftNotFoundError as exc:
        raise _not_found() from exc
    except ShiftNotEditableError as exc:
        raise _bad_request("El turno no puede editarse en su estado actual") from exc
    except InvalidShiftScheduleError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/publish",
    response_model=ShiftResponse,
    summary="Publicar un turno en borrador",
)
async def publish_shift(shift_id: UUID, company_id: CompanyIdDep, service: ServiceDep):
    try:
        return await service.publish_shift(company_id, shift_id)
    except ShiftNotFoundError as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/cancel",
    response_model=ShiftResponse,
    summary="Cancelar un turno",
)
async def cancel_shift(shift_id: UUID, company_id: CompanyIdDep, service: ServiceDep):
    try:
        return await service.cancel_shift(company_id, shift_id)
    except ShiftNotFoundError as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/assign",
    response_model=ShiftResponse,
    summary="Asignar el turno a uno de los candidatos recomendados",
)
async def assign_worker(
    shift_id: UUID,
    payload: AssignWorkerRequest,
    company_id: CompanyIdDep,
    service: ServiceDep,
):
    try:
        return await service.assign_worker(
            company_id, shift_id, payload.worker_profile_id
        )
    except ShiftNotFoundError as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/confirm",
    response_model=ShiftResponse,
    summary="Confirmar la asistencia a un turno asignado (trabajador)",
)
async def confirm_assignment(
    shift_id: UUID, worker_profile_id: WorkerProfileIdDep, service: ServiceDep
):
    try:
        return await service.confirm_assignment(worker_profile_id, shift_id)
    except (ShiftNotFoundError, ShiftNotAssignedToWorkerError) as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/reject",
    response_model=ShiftResponse,
    summary="Rechazar un turno asignado (trabajador)",
)
async def reject_assignment(
    shift_id: UUID, worker_profile_id: WorkerProfileIdDep, service: ServiceDep
):
    try:
        return await service.reject_assignment(worker_profile_id, shift_id)
    except (ShiftNotFoundError, ShiftNotAssignedToWorkerError) as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/depart",
    response_model=ShiftResponse,
    summary="Marcar que salí hacia el turno (trabajador)",
)
async def depart(
    shift_id: UUID, worker_profile_id: WorkerProfileIdDep, service: ServiceDep
):
    try:
        return await service.depart(worker_profile_id, shift_id)
    except (ShiftNotFoundError, ShiftNotAssignedToWorkerError) as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/check-in",
    response_model=ShiftResponse,
    summary="Marcar llegada al turno con ubicación (trabajador)",
)
async def check_in(
    shift_id: UUID,
    payload: GeoCheckRequest,
    worker_profile_id: WorkerProfileIdDep,
    service: ServiceDep,
):
    try:
        return await service.check_in(
            worker_profile_id, shift_id, payload.latitude, payload.longitude
        )
    except (ShiftNotFoundError, ShiftNotAssignedToWorkerError) as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/start-working",
    response_model=ShiftResponse,
    summary="Marcar el inicio efectivo del turno (trabajador)",
)
async def start_working(
    shift_id: UUID, worker_profile_id: WorkerProfileIdDep, service: ServiceDep
):
    try:
        return await service.start_working(worker_profile_id, shift_id)
    except (ShiftNotFoundError, ShiftNotAssignedToWorkerError) as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/check-out",
    response_model=ShiftResponse,
    summary="Marcar fin del turno con ubicación (trabajador)",
)
async def check_out(
    shift_id: UUID,
    payload: GeoCheckRequest,
    worker_profile_id: WorkerProfileIdDep,
    service: ServiceDep,
):
    try:
        return await service.check_out(
            worker_profile_id, shift_id, payload.latitude, payload.longitude
        )
    except (ShiftNotFoundError, ShiftNotAssignedToWorkerError) as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/finish",
    response_model=ShiftResponse,
    summary="Cerrar un turno ya trabajado (comercio)",
)
async def finish(shift_id: UUID, company_id: CompanyIdDep, service: ServiceDep):
    try:
        return await service.finish(company_id, shift_id)
    except ShiftNotFoundError as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/mark-paid",
    response_model=ShiftResponse,
    summary="Confirmar el pago de un turno finalizado (comercio)",
)
async def mark_paid(shift_id: UUID, company_id: CompanyIdDep, service: ServiceDep):
    try:
        return await service.mark_paid(company_id, shift_id)
    except ShiftNotFoundError as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc
