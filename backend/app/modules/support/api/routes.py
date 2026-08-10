"""Rutas HTTP del módulo support (tickets de soporte usuario ↔ Oído)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.rate_limit import RateLimiter
from app.modules.identity.api.dependencies import get_current_user, require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.support.api.dependencies import get_support_service
from app.modules.support.api.schemas import (
    AdminTicketResponse,
    CreateTicketRequest,
    MessageResponse,
    SendMessageRequest,
    TicketDetailResponse,
    TicketResponse,
)
from app.modules.support.application.services import SupportService
from app.modules.support.domain.exceptions import (
    EmptyMessageError,
    TicketClosedError,
    TicketNotFoundError,
)
from app.modules.support.domain.value_objects import TicketStatus

router = APIRouter(prefix="/support", tags=["support"])

ServiceDep = Annotated[SupportService, Depends(get_support_service)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
AdminDep = Annotated[User, Depends(require_roles(UserRole.ADMIN))]
LimitDep = Annotated[int, Query(ge=1, le=100)]
OffsetDep = Annotated[int, Query(ge=0)]

# PRODUCTION_HARDENING.md, mismo criterio que chat: autenticado, límite por
# usuario, no por IP.
_create_ticket_rate_limit = RateLimiter(
    max_attempts=10, window_seconds=3600, name="support_create_ticket"
)
_send_message_rate_limit = RateLimiter(
    max_attempts=30, window_seconds=60, name="support_send_message"
)

_TICKET_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado"
)


@router.post(
    "/tickets",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Abrir un ticket de soporte",
)
async def create_ticket(
    payload: CreateTicketRequest, current_user: CurrentUserDep, service: ServiceDep
):
    _create_ticket_rate_limit.check(str(current_user.id))
    try:
        ticket, _first_message = await service.create_ticket(
            current_user.id, payload.category, payload.subject, payload.body
        )
    except EmptyMessageError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El asunto y el mensaje no pueden estar vacíos",
        ) from exc
    return ticket


@router.get(
    "/tickets/mine",
    response_model=list[TicketResponse],
    summary="Mis tickets de soporte",
)
async def list_my_tickets(
    current_user: CurrentUserDep, service: ServiceDep, limit: LimitDep = 50, offset: OffsetDep = 0
):
    return await service.list_my_tickets(current_user.id, limit=limit, offset=offset)


@router.get(
    "/tickets",
    response_model=list[AdminTicketResponse],
    summary="Todos los tickets de soporte (admin)",
)
async def list_all_tickets(
    _admin: AdminDep,
    service: ServiceDep,
    ticket_status: Annotated[TicketStatus | None, Query(alias="status")] = None,
    limit: LimitDep = 50,
    offset: OffsetDep = 0,
):
    return await service.list_all_tickets(status=ticket_status, limit=limit, offset=offset)


@router.get(
    "/tickets/{ticket_id}",
    response_model=TicketDetailResponse,
    summary="Detalle de un ticket (dueño o admin)",
)
async def get_ticket(ticket_id: UUID, current_user: CurrentUserDep, service: ServiceDep):
    try:
        ticket, messages = await service.get_ticket(
            current_user.id, ticket_id, is_admin=current_user.role == UserRole.ADMIN
        )
    except TicketNotFoundError as exc:
        raise _TICKET_NOT_FOUND from exc
    return TicketDetailResponse(
        id=ticket.id,
        user_id=ticket.user_id,
        category=ticket.category,
        subject=ticket.subject,
        status=ticket.status,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        messages=[MessageResponse.model_validate(m, from_attributes=True) for m in messages],
    )


@router.post(
    "/tickets/{ticket_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Responder en un ticket (dueño, si está abierto, o admin)",
)
async def send_message(
    ticket_id: UUID,
    payload: SendMessageRequest,
    current_user: CurrentUserDep,
    service: ServiceDep,
):
    _send_message_rate_limit.check(str(current_user.id))
    is_admin = current_user.role == UserRole.ADMIN
    try:
        return await service.add_message(
            current_user.id, ticket_id, payload.body, is_admin=is_admin
        )
    except TicketNotFoundError as exc:
        raise _TICKET_NOT_FOUND from exc
    except TicketClosedError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este ticket ya está cerrado",
        ) from exc
    except EmptyMessageError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El mensaje no puede estar vacío",
        ) from exc


@router.post(
    "/tickets/{ticket_id}/close",
    response_model=TicketResponse,
    summary="Cerrar un ticket (dueño o admin)",
)
async def close_ticket(ticket_id: UUID, current_user: CurrentUserDep, service: ServiceDep):
    is_admin = current_user.role == UserRole.ADMIN
    try:
        return await service.close_ticket(current_user.id, ticket_id, is_admin=is_admin)
    except TicketNotFoundError as exc:
        raise _TICKET_NOT_FOUND from exc
    except TicketClosedError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este ticket ya está cerrado",
        ) from exc
