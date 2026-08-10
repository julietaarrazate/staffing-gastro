"""Rutas HTTP del módulo favorite (el comercio marca trabajadores para recontratar)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.modules.favorite.api.dependencies import get_favorite_service
from app.modules.favorite.api.schemas import FavoriteStatusResponse, FavoriteWorkerResponse
from app.modules.favorite.application.services import FavoriteService
from app.modules.favorite.domain.exceptions import WorkerNotFavoritableError
from app.modules.shift.api.dependencies import get_my_company_id

router = APIRouter(prefix="/favorites", tags=["favorites"])

ServiceDep = Annotated[FavoriteService, Depends(get_favorite_service)]
CompanyIdDep = Annotated[UUID, Depends(get_my_company_id)]
LimitDep = Annotated[int, Query(ge=1, le=100)]
OffsetDep = Annotated[int, Query(ge=0)]

_WORKER_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="Trabajador no encontrado"
)


@router.get(
    "",
    response_model=list[FavoriteWorkerResponse],
    summary="Mis trabajadores favoritos (comercio)",
)
async def list_my_favorites(
    company_id: CompanyIdDep,
    service: ServiceDep,
    limit: LimitDep = 50,
    offset: OffsetDep = 0,
):
    return await service.list_my_favorites(company_id, limit=limit, offset=offset)


@router.put(
    "/{worker_profile_id}",
    response_model=FavoriteStatusResponse,
    summary="Marcar un trabajador como favorito (comercio)",
)
async def mark_favorite(
    worker_profile_id: UUID, company_id: CompanyIdDep, service: ServiceDep
):
    try:
        await service.mark(company_id, worker_profile_id)
    except WorkerNotFavoritableError as exc:
        raise _WORKER_NOT_FOUND from exc
    return FavoriteStatusResponse(is_favorite=True)


@router.delete(
    "/{worker_profile_id}",
    response_model=FavoriteStatusResponse,
    summary="Desmarcar un trabajador favorito (comercio)",
)
async def unmark_favorite(
    worker_profile_id: UUID, company_id: CompanyIdDep, service: ServiceDep
):
    await service.unmark(company_id, worker_profile_id)
    return FavoriteStatusResponse(is_favorite=False)


@router.get(
    "/{worker_profile_id}/status",
    response_model=FavoriteStatusResponse,
    summary="Saber si un trabajador ya está marcado como favorito (comercio)",
)
async def get_favorite_status(
    worker_profile_id: UUID, company_id: CompanyIdDep, service: ServiceDep
):
    is_favorite = await service.is_favorite(company_id, worker_profile_id)
    return FavoriteStatusResponse(is_favorite=is_favorite)
