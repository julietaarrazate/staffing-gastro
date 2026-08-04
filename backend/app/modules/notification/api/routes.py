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

from app.core.config import settings as app_settings
from app.core.ws_manager import ws_manager
from app.modules.identity.api.dependencies import get_current_user, get_current_user_ws
from app.modules.identity.domain.entities import User
from app.modules.notification.api.dependencies import (
    get_notification_service,
    get_push_service,
)
from app.modules.notification.api.schemas import (
    NotificationResponse,
    PushPublicKeyResponse,
    PushSubscribeRequest,
    PushUnsubscribeRequest,
)
from app.modules.notification.application.services import NotificationService, PushService
from app.modules.notification.domain.exceptions import NotificationNotFoundError

router = APIRouter(prefix="/notifications", tags=["notification"])
push_router = APIRouter(prefix="/push", tags=["push"])

ServiceDep = Annotated[NotificationService, Depends(get_notification_service)]
PushServiceDep = Annotated[PushService, Depends(get_push_service)]
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
    if not ws_manager.connect_notification(current_user.id, websocket):
        # Tope de conexiones concurrentes por usuario (PRODUCTION_HARDENING.md).
        await websocket.close(code=status.WS_1013_TRY_AGAIN_LATER)
        return
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect_notification(current_user.id, websocket)


# --- Web Push (ver docs/reference/ACCESO_MODERNO.md) -------------------------------


@push_router.get(
    "/public-key",
    response_model=PushPublicKeyResponse,
    summary="Clave pública VAPID (para suscribirse desde el browser)",
)
async def push_public_key() -> PushPublicKeyResponse:
    """Sin autenticar a propósito: es una clave pública, la necesita el
    frontend antes de saber si conviene mostrar el toggle de notificaciones
    (`vapid_public_key=None` = push desactivado en este servidor)."""
    return PushPublicKeyResponse(vapid_public_key=app_settings.vapid_public_key or None)


@push_router.post(
    "/subscribe",
    status_code=status.HTTP_201_CREATED,
    summary="Suscribir este dispositivo a notificaciones push",
)
async def push_subscribe(
    payload: PushSubscribeRequest, current_user: CurrentUserDep, service: PushServiceDep
) -> dict[str, bool]:
    await service.subscribe(
        current_user.id,
        endpoint=payload.endpoint,
        p256dh_key=payload.keys.p256dh,
        auth_key=payload.keys.auth,
    )
    return {"ok": True}


@push_router.delete(
    "/subscribe",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Desuscribir este dispositivo de notificaciones push",
)
async def push_unsubscribe(
    payload: PushUnsubscribeRequest, current_user: CurrentUserDep, service: PushServiceDep
) -> None:
    await service.unsubscribe(payload.endpoint)
