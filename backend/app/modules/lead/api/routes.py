"""Rutas HTTP del módulo lead: lista de comercios a captar (solo admin)."""

from dataclasses import asdict
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.modules.identity.api.dependencies import require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.lead.api.dependencies import get_lead_service
from app.modules.lead.api.schemas import (
    LeadImportRequest,
    LeadImportResponse,
    LeadResponse,
    LeadSummaryResponse,
    LeadUpdateRequest,
)
from app.modules.lead.application.services import LeadService
from app.modules.lead.domain.entities import Lead
from app.modules.lead.domain.exceptions import (
    LeadNotFoundError,
    PlaceSourceUnavailableError,
    UnknownBarrioError,
)
from app.modules.lead.domain.value_objects import BARRIOS_CABA, LeadStatus

router = APIRouter(prefix="/admin/leads", tags=["admin"])

ServiceDep = Annotated[LeadService, Depends(get_lead_service)]
AdminDep = Annotated[User, Depends(require_roles(UserRole.ADMIN))]
LimitDep = Annotated[int, Query(ge=1, le=1000)]
OffsetDep = Annotated[int, Query(ge=0)]


def _to_response(lead: Lead) -> LeadResponse:
    return LeadResponse(**asdict(lead), priority=lead.priority)


@router.get("/barrios", response_model=list[str], summary="Barrios que se pueden importar")
async def list_barrios(_: AdminDep):
    return list(BARRIOS_CABA)


@router.get("", response_model=list[LeadResponse], summary="Comercios a captar")
async def list_leads(
    _: AdminDep,
    service: ServiceDep,
    status_filter: Annotated[LeadStatus | None, Query(alias="status")] = None,
    barrio: str | None = None,
    limit: LimitDep = 500,
    offset: OffsetDep = 0,
):
    leads = await service.list_leads(
        status=status_filter, barrio=barrio, limit=limit, offset=offset
    )
    return [_to_response(lead) for lead in leads]


@router.get("/summary", response_model=LeadSummaryResponse, summary="Comercios por estado")
async def summary(_: AdminDep, service: ServiceDep, barrio: str | None = None):
    counts = await service.summary(barrio=barrio)
    return LeadSummaryResponse(counts=counts, total=sum(counts.values()))


@router.post(
    "/import",
    response_model=LeadImportResponse,
    summary="Importar los comercios gastronómicos de un barrio desde OpenStreetMap",
)
async def import_barrio(body: LeadImportRequest, _: AdminDep, service: ServiceDep):
    try:
        result = await service.import_barrio(body.barrio)
    except UnknownBarrioError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Ese barrio no está en la lista de barrios de la Ciudad",
        ) from exc
    except PlaceSourceUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenStreetMap no respondió. Probá de nuevo en unos minutos.",
        ) from exc
    return LeadImportResponse(**asdict(result))


@router.patch("/{lead_id}", response_model=LeadResponse, summary="Cambiar estado o notas")
async def update_lead(
    lead_id: UUID, body: LeadUpdateRequest, _: AdminDep, service: ServiceDep
):
    try:
        lead = await service.update_follow_up(lead_id, status=body.status, notes=body.notes)
    except LeadNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comercio no encontrado"
        ) from exc
    return _to_response(lead)
