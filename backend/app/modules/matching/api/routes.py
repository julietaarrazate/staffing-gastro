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
from app.modules.verification.api.dependencies import get_verification_service
from app.modules.verification.application.services import VerificationService
from app.modules.worker.domain.value_objects import WorkerSkill

router = APIRouter(prefix="/shifts", tags=["matching"])
search_router = APIRouter(prefix="/matching", tags=["matching"])

ServiceDep = Annotated[MatchingService, Depends(get_matching_service)]
VerificationDep = Annotated[VerificationService, Depends(get_verification_service)]
CompanyIdDep = Annotated[UUID, Depends(get_my_company_id)]
EmployerDep = Annotated[User, Depends(require_roles(UserRole.EMPLOYER))]
# El admin puede explorar el mapa de trabajadores en modo sólo-lectura (mismo
# pedido de Julieta que "Ver como", pero sin tener que impersonar a nadie
# puntual) — sólo se relaja acá, no en `/candidates` (asignar sigue siendo
# exclusivo del comercio dueño del turno, vía `get_my_company_id`).
EmployerOrAdminDep = Annotated[
    User, Depends(require_roles(UserRole.EMPLOYER, UserRole.ADMIN))
]
LimitDep = Annotated[int, Query(ge=1, le=100)]
OffsetDep = Annotated[int, Query(ge=0)]


@router.get(
    "/{shift_id}/candidates",
    response_model=list[CandidateMatchResponse],
    summary="Top de candidatos recomendados para un turno propio",
)
async def get_top_candidates(
    shift_id: UUID,
    company_id: CompanyIdDep,
    service: ServiceDep,
    verification: VerificationDep,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
):
    try:
        results = await service.get_top_candidates(shift_id, company_id, limit=limit)
    except ShiftNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Turno no encontrado"
        ) from exc
    # Enriquecemos con "Identidad verificada" (dominio Identity, por puerto):
    # el matching no sabe de identidad; se compone acá, en la capa API.
    verified = await verification.verified_user_ids([r.user_id for r in results])
    responses: list[CandidateMatchResponse] = []
    for r in results:
        response = CandidateMatchResponse.model_validate(r)
        response.identidad_verificada = r.user_id in verified
        responses.append(response)
    return responses


@search_router.get(
    "/search",
    response_model=list[WorkerMapResponse],
    summary="Buscar trabajadores disponibles para el mapa, por rol y distancia",
)
async def search_workers(
    service: ServiceDep,
    _current_user: EmployerOrAdminDep,
    skill: WorkerSkill | None = None,
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, ge=1, le=200),
    limit: LimitDep = 50,
    offset: OffsetDep = 0,
):
    return await service.search_workers(
        skill=skill,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        limit=limit,
        offset=offset,
    )
