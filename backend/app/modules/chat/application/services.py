"""Casos de uso del módulo chat (conversación trabajador ↔ comercio por turno)."""

from uuid import UUID

from app.core.ws_manager import ws_manager
from app.modules.chat.application.dtos import ConversationSummary
from app.modules.chat.domain.entities import ChatMessage
from app.modules.chat.domain.exceptions import (
    ConversationNotFoundError,
    EmptyMessageError,
)
from app.modules.chat.domain.repositories import ChatMessageRepository
from app.modules.company.domain.repositories import CompanyProfileRepository
from app.modules.identity.domain.repositories import UserRepository
from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.repositories import NotificationRepository
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.worker.domain.repositories import WorkerProfileRepository

_SNIPPET_MAX = 80


def _serialize_message(message: ChatMessage) -> dict:
    return {
        "id": str(message.id),
        "shift_id": str(message.shift_id),
        "sender_user_id": str(message.sender_user_id),
        "body": message.body,
        "read": message.read,
        "created_at": message.created_at.isoformat() if message.created_at else None,
    }


class ChatService:
    """Servicio de aplicación para la mensajería de un turno.

    La conversación de un turno la integran el comercio y el trabajador
    asignado. No hay chat hasta que el turno tiene un trabajador asignado.
    """

    def __init__(
        self,
        messages: ChatMessageRepository,
        shifts: ShiftRepository,
        workers: WorkerProfileRepository,
        companies: CompanyProfileRepository,
        users: UserRepository,
        notifications: NotificationRepository,
    ) -> None:
        self._messages = messages
        self._shifts = shifts
        self._workers = workers
        self._companies = companies
        self._users = users
        self._notifications = notifications

    async def list_messages(self, user_id: UUID, shift_id: UUID) -> list[ChatMessage]:
        """Lista los mensajes de un turno y marca como leídos los recibidos."""
        await self._authorize(user_id, shift_id)
        await self._messages.mark_read(shift_id, user_id)
        return await self._messages.list_by_shift(shift_id)

    async def send_message(
        self, user_id: UUID, shift_id: UUID, body: str
    ) -> ChatMessage:
        """Envía un mensaje en la conversación de un turno y avisa al otro."""
        body = body.strip()
        if not body:
            raise EmptyMessageError()

        shift, company_user_id, worker_user_id = await self._authorize(user_id, shift_id)
        message = await self._messages.add(
            ChatMessage(shift_id=shift_id, sender_user_id=user_id, body=body)
        )

        recipient_id = (
            worker_user_id if user_id == company_user_id else company_user_id
        )
        await self._notify_recipient(recipient_id, user_id, body)
        await ws_manager.broadcast_chat(shift_id, _serialize_message(message))
        return message

    async def assert_participant(self, user_id: UUID, shift_id: UUID) -> None:
        """Verifica que el usuario participe de la conversación (uso en websockets)."""
        await self._authorize(user_id, shift_id)

    async def list_conversations(self, user_id: UUID) -> list[ConversationSummary]:
        """Inbox: una tarjeta por turno con mensajes en el que participa el usuario.

        Arma el inbox en 3 consultas totales en vez de una por conversación
        (fix de P1, `docs/PERFORMANCE_REPORT.md`): 1) turnos + ambas
        contrapartes posibles vía JOIN, 2) último mensaje por turno, 3) no
        leídos por turno. Todo agregado por lote (`IN`), sin loop de `await`.
        """
        candidates = await self._messages.list_inbox_candidates(user_id)
        shift_ids = [c.shift_id for c in candidates]
        if not shift_ids:
            return []

        last_messages = await self._messages.last_messages(shift_ids)
        unread_counts = await self._messages.unread_counts_by_shift(shift_ids, user_id)

        summaries: list[ConversationSummary] = []
        for candidate in candidates:
            last = last_messages.get(candidate.shift_id)
            if last is None or last.created_at is None:
                continue

            if user_id == candidate.company_user_id:
                name, photo = candidate.worker_full_name, candidate.worker_photo_url
            elif user_id == candidate.worker_user_id:
                name, photo = candidate.company_name, candidate.company_logo_url
            else:
                continue

            summaries.append(
                ConversationSummary(
                    shift_id=candidate.shift_id,
                    shift_title=candidate.shift_title,
                    other_party_name=name,
                    other_party_photo=photo,
                    last_message=last.body,
                    last_message_at=last.created_at,
                    unread_count=unread_counts.get(candidate.shift_id, 0),
                )
            )

        summaries.sort(key=lambda s: s.last_message_at, reverse=True)
        return summaries

    # --- helpers ---

    async def _authorize(
        self, user_id: UUID, shift_id: UUID
    ) -> tuple[Shift, UUID, UUID]:
        """Verifica que el usuario participe del turno y devuelve a sus dos partes."""
        shift = await self._shifts.get_by_id(shift_id)
        if shift is None:
            raise ConversationNotFoundError(str(shift_id))
        company_user_id, worker_user_id = await self._participants(shift)
        # No revelamos turnos ajenos: si no sos participante, es "inexistente".
        if user_id not in (company_user_id, worker_user_id):
            raise ConversationNotFoundError(str(shift_id))
        return shift, company_user_id, worker_user_id

    async def _participants(self, shift: Shift) -> tuple[UUID, UUID]:
        """Devuelve (user_id del comercio, user_id del trabajador) del turno."""
        if shift.worker_profile_id is None:
            raise ConversationNotFoundError(str(shift.id))
        company = await self._companies.get_by_id(shift.company_id)
        worker = await self._workers.get_by_id(shift.worker_profile_id)
        if company is None or worker is None:
            raise ConversationNotFoundError(str(shift.id))
        return company.user_id, worker.user_id

    async def _notify_recipient(
        self, recipient_id: UUID, sender_id: UUID, body: str
    ) -> None:
        sender = await self._users.get_by_id(sender_id)
        sender_name = sender.full_name if sender is not None else "Alguien"
        snippet = body if len(body) <= _SNIPPET_MAX else body[: _SNIPPET_MAX - 3] + "..."
        await self._notifications.add(
            Notification(
                user_id=recipient_id,
                type=NotificationType.CHAT_MESSAGE,
                title=f"Nuevo mensaje de {sender_name}",
                message=snippet,
            )
        )
