"""Rutas HTTP del módulo chat."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

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
from app.modules.identity.api.dependencies import get_current_user
from app.modules.identity.domain.entities import User

router = APIRouter(prefix="/chats", tags=["chat"])

ServiceDep = Annotated[ChatService, Depends(get_chat_service)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]


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
    try:
        return await service.send_message(current_user.id, shift_id, payload.body)
    except ConversationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversación no encontrada",
        ) from exc
    except EmptyMessageError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El mensaje no puede estar vacío",
        ) from exc
