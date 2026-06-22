"""Casos de uso del módulo chat (conversación trabajador ↔ comercio por turno)."""

from uuid import UUID

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
        return message

    async def list_conversations(self, user_id: UUID) -> list[ConversationSummary]:
        """Inbox: una tarjeta por turno con mensajes en el que participa el usuario."""
        summaries: list[ConversationSummary] = []
        for shift in await self._shifts_for_user(user_id):
            last = await self._messages.last_message(shift.id)
            if last is None or last.created_at is None:
                continue
            try:
                company_user_id, worker_user_id = await self._participants(shift)
            except ConversationNotFoundError:
                continue

            if user_id == company_user_id:
                name, photo = await self._worker_display(shift, worker_user_id)
            elif user_id == worker_user_id:
                name, photo = await self._company_display(shift)
            else:
                continue

            summaries.append(
                ConversationSummary(
                    shift_id=shift.id,
                    shift_title=shift.title or shift.position.value,
                    other_party_name=name,
                    other_party_photo=photo,
                    last_message=last.body,
                    last_message_at=last.created_at,
                    unread_count=await self._messages.count_unread(shift.id, user_id),
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

    async def _worker_display(
        self, shift: Shift, worker_user_id: UUID
    ) -> tuple[str, str | None]:
        worker = await self._workers.get_by_id(shift.worker_profile_id)
        user = await self._users.get_by_id(worker_user_id)
        name = user.full_name if user is not None else "Trabajador"
        photo = worker.photo_url if worker is not None else None
        return name, photo

    async def _company_display(self, shift: Shift) -> tuple[str, str | None]:
        company = await self._companies.get_by_id(shift.company_id)
        name = company.name if company is not None else "Comercio"
        photo = company.logo_url if company is not None else None
        return name, photo

    async def _shifts_for_user(self, user_id: UUID) -> list[Shift]:
        shifts: list[Shift] = []
        company = await self._companies.get_by_user_id(user_id)
        if company is not None:
            shifts.extend(await self._shifts.list_by_company(company.id))
        worker = await self._workers.get_by_user_id(user_id)
        if worker is not None:
            shifts.extend(await self._shifts.list_by_worker(worker.id))
        return shifts

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
