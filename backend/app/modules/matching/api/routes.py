"""Rutas HTTP del módulo matching (top de candidatos recomendados y mapa de búsqueda)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.modules.identity.api.dependencies import require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.matching.api.dependencies import get_matching_service
from app.modules.matching.api.schemas import CandidateMatchResponse, WorkerMapResponse
from app.modules.matching.application.services import MatchingService
from app.modules.shift.api.dependencies import get_my_company_id
from app.modules.shift.domain.exceptions import ShiftNotFoundError
from app.modules.worker.domain.value_objects import WorkerSkill

router = APIRouter(prefix="/shifts", tags=["matching"])
search_router = APIRouter(prefix="/matching", tags=["matching"])

ServiceDep = Annotated[MatchingService, Depends(get_matching_service)]
CompanyIdDep = Annotated[UUID, Depends(get_my_company_id)]
EmployerDep = Annotated[User, Depends(require_roles(UserRole.EMPLOYER))]


@router.get(
    "/{shift_id}/candidates",
    response_model=list[CandidateMatchResponse],
    summary="Top de candidatos recomendados para un turno propio",
)
async def get_top_candidates(
    shift_id: UUID,
    company_id: CompanyIdDep,
    service: ServiceDep,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
):
    try:
        return await service.get_top_candidates(shift_id, company_id, limit=limit)
    except ShiftNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Turno no encontrado"
        ) from exc


@search_router.get(
    "/search",
    response_model=list[WorkerMapResponse],
    summary="Buscar trabajadores disponibles para el mapa, por rol y distancia",
)
async def search_workers(
    service: ServiceDep,
    _current_user: EmployerDep,
    skill: WorkerSkill | None = None,
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, ge=1, le=200),
):
    return await service.search_workers(
        skill=skill, latitude=latitude, longitude=longitude, radius_km=radius_km
    )
