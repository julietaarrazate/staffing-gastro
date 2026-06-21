"""Rutas HTTP del módulo shift (publicación y ciclo de vida del turno)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.modules.identity.api.dependencies import get_current_user
from app.modules.identity.domain.entities import User
from app.modules.shift.api.dependencies import get_my_company_id, get_shift_service
from app.modules.shift.api.schemas import ShiftInput, ShiftResponse
from app.modules.shift.application.dtos import ShiftData
from app.modules.shift.application.services import ShiftService
from app.modules.shift.domain.exceptions import (
    InvalidShiftScheduleError,
    InvalidShiftTransitionError,
    ShiftNotEditableError,
    ShiftNotFoundError,
)
from app.modules.worker.domain.value_objects import WorkerSkill

router = APIRouter(prefix="/shifts", tags=["shifts"])

ServiceDep = Annotated[ShiftService, Depends(get_shift_service)]
CompanyIdDep = Annotated[UUID, Depends(get_my_company_id)]
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
