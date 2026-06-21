"""Rutas HTTP del módulo matching (top de candidatos recomendados)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.modules.matching.api.dependencies import get_matching_service
from app.modules.matching.api.schemas import CandidateMatchResponse
from app.modules.matching.application.services import MatchingService
from app.modules.shift.api.dependencies import get_my_company_id
from app.modules.shift.domain.exceptions import ShiftNotFoundError

router = APIRouter(prefix="/shifts", tags=["matching"])

ServiceDep = Annotated[MatchingService, Depends(get_matching_service)]
CompanyIdDep = Annotated[UUID, Depends(get_my_company_id)]


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
