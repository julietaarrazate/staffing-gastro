"""Rutas HTTP del módulo notification."""

from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)

from app.core.ws_manager import ws_manager
from app.modules.identity.api.dependencies import get_current_user, get_current_user_ws
from app.modules.identity.domain.entities import User
from app.modules.notification.api.dependencies import get_notification_service
from app.modules.notification.api.schemas import NotificationResponse
from app.modules.notification.application.services import NotificationService
from app.modules.notification.domain.exceptions import NotificationNotFoundError

router = APIRouter(prefix="/notifications", tags=["notification"])

ServiceDep = Annotated[NotificationService, Depends(get_notification_service)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
LimitDep = Annotated[int, Query(ge=1, le=100)]
OffsetDep = Annotated[int, Query(ge=0)]


@router.get(
    "",
    response_model=list[NotificationResponse],
    summary="Mis notificaciones",
)
async def my_notifications(
    current_user: CurrentUserDep,
    service: ServiceDep,
    limit: LimitDep = 50,
    offset: OffsetDep = 0,
):
    return await service.list_mine(current_user.id, limit=limit, offset=offset)


@router.post(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Marcar una notificación como leída",
)
async def mark_as_read(
    notification_id: UUID, current_user: CurrentUserDep, service: ServiceDep
):
    try:
        return await service.mark_read(current_user.id, notification_id)
    except NotificationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notificación no encontrada",
        ) from exc


@router.websocket("/ws")
async def notifications_stream(
    websocket: WebSocket,
    current_user: Annotated[User, Depends(get_current_user_ws)],
):
    """Push en tiempo real de notificaciones nuevas para el usuario autenticado."""
    await websocket.accept()
    ws_manager.connect_notification(current_user.id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect_notification(current_user.id, websocket)
