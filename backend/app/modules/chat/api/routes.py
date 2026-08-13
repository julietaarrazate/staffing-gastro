"""Rutas HTTP del módulo chat."""

from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    WebSocketException,
    status,
)

from app.core.rate_limit import RateLimiter
from app.core.ws_manager import ws_manager
from app.modules.chat.api.dependencies import get_chat_service
from app.modules.chat.api.schemas import (
    ConversationResponse,
    MessageResponse,
    SendMessageRequest,
)
from app.modules.chat.application.services import ChatService
from app.modules.chat.domain.exceptions import (
    ConversationNotFoundError,
    EmptyMessageError,
)
from app.modules.identity.api.dependencies import get_current_user, get_current_user_ws
from app.modules.identity.domain.entities import User

router = APIRouter(prefix="/chats", tags=["chat"])

ServiceDep = Annotated[ChatService, Depends(get_chat_service)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]

# PRODUCTION_HARDENING.md: antes sin ningún límite — es un endpoint
# autenticado (no anónimo como login/register), así que se limita por
# usuario, no por IP (ver RateLimiter.check en app/core/rate_limit.py).
_send_message_rate_limit = RateLimiter(
    max_attempts=30, window_seconds=60, name="chat_send_message"
)
# TECH_DEBT.md S2: el POST de arriba ya limitaba mensajes reales, pero el
# WS en sí no tenía ningún tope sobre cuántos frames podía mandar el
# cliente por la conexión — un cliente con bug o malicioso podía mandar
# frames sin parar (el servidor los descarta, pero cada uno igual entra al
# loop). Más generoso que el POST (30/min) porque acá cuenta cualquier
# frame, no sólo mensajes de verdad enviados.
_ws_frame_rate_limit = RateLimiter(
    max_attempts=120, window_seconds=60, name="chat_ws_frame"
)


@router.get(
    "",
    response_model=list[ConversationResponse],
    summary="Mis conversaciones (inbox)",
)
async def my_conversations(current_user: CurrentUserDep, service: ServiceDep):
    return await service.list_conversations(current_user.id)


@router.get(
    "/{shift_id}/messages",
    response_model=list[MessageResponse],
    summary="Mensajes de la conversación de un turno",
)
async def conversation_messages(
    shift_id: UUID, current_user: CurrentUserDep, service: ServiceDep
):
    try:
        return await service.list_messages(current_user.id, shift_id)
    except ConversationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversación no encontrada",
        ) from exc


@router.post(
    "/{shift_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enviar un mensaje en la conversación de un turno",
)
async def send_message(
    shift_id: UUID,
    payload: SendMessageRequest,
    current_user: CurrentUserDep,
    service: ServiceDep,
):
    _send_message_rate_limit.check(str(current_user.id))
    try:
        return await service.send_message(current_user.id, shift_id, payload.body)
    except ConversationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversación no encontrada",
        ) from exc
    except EmptyMessageError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="El mensaje no puede estar vacío",
        ) from exc


@router.websocket("/{shift_id}/ws")
async def chat_stream(
    websocket: WebSocket,
    shift_id: UUID,
    current_user: Annotated[User, Depends(get_current_user_ws)],
    service: ServiceDep,
):
    """Push en tiempo real de mensajes nuevos para la conversación de un turno."""
    try:
        await service.assert_participant(current_user.id, shift_id)
    except ConversationNotFoundError as exc:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION) from exc

    await websocket.accept()
    if not ws_manager.connect_chat(shift_id, websocket):
        # Tope de conexiones concurrentes por turno (PRODUCTION_HARDENING.md).
        await websocket.close(code=status.WS_1013_TRY_AGAIN_LATER)
        return
    try:
        while True:
            await websocket.receive_text()
            try:
                _ws_frame_rate_limit.check(str(current_user.id))
            except HTTPException:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                break
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect_chat(shift_id, websocket)
