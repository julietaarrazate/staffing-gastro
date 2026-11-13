"""Casos de uso del módulo chat (conversación del comercio con la persona
asignada a un turno: un hilo por turno y trabajador, ver `Thread`)."""

from uuid import UUID

from app.core.ws_manager import ws_manager
from app.modules.chat.application.dtos import ConversationSummary
from app.modules.chat.domain.entities import ChatMessage, Thread
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
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.worker.domain.repositories import WorkerProfileRepository

_SNIPPET_MAX = 80


def _serialize_message(message: ChatMessage) -> dict:
    return {
        "type": "message",
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

    La conversación es con UNA persona: cada mensaje queda en el hilo
    (`Thread`) del trabajador que estaba asignado cuando se escribió. Si el
    turno se reasigna, quien lo recibe arranca con un hilo vacío, el comercio
    ve sólo el hilo con la persona asignada ahora y la anterior deja de tener
    acceso. Todo lo que se lee o se avisa acá (mensajes, bandeja, no leídos,
    marcar como leído, push en vivo) es del hilo vigente, nunca del turno
    entero.
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
        """Lista los mensajes del hilo vigente del turno y marca como leídos
        los que el usuario recibió en ese hilo."""
        thread, _company_user_id = await self._authorize(user_id, shift_id)
        marked_something = await self._messages.mark_read(thread, user_id)
        if marked_something:
            # Avisa en vivo, por el mismo socket del chat, a quien tiene la
            # conversación abierta: sin esto el "visto" sólo se actualizaba
            # la próxima vez que volvía a pedir los mensajes por HTTP (al
            # reconectar el socket, o al mandar otro mensaje) — no en el
            # momento real en que el otro lo leyó.
            await ws_manager.broadcast_chat(
                shift_id,
                thread.worker_user_id,
                {"type": "read", "reader_user_id": str(user_id)},
            )
        return await self._messages.list_by_thread(thread)

    async def send_message(
        self, user_id: UUID, shift_id: UUID, body: str
    ) -> ChatMessage:
        """Envía un mensaje en el hilo vigente del turno y avisa al otro."""
        body = body.strip()
        if not body:
            raise EmptyMessageError()

        thread, company_user_id = await self._authorize(user_id, shift_id)
        message = await self._messages.add(
            ChatMessage(
                shift_id=shift_id,
                worker_user_id=thread.worker_user_id,
                sender_user_id=user_id,
                body=body,
            )
        )

        recipient_id = (
            thread.worker_user_id if user_id == company_user_id else company_user_id
        )
        await self._notify_recipient(recipient_id, user_id, body, shift_id)
        await ws_manager.broadcast_chat(
            shift_id, thread.worker_user_id, _serialize_message(message)
        )
        return message

    async def assert_participant(self, user_id: UUID, shift_id: UUID) -> Thread:
        """Verifica que el usuario participe de la conversación y devuelve el
        hilo vigente, sobre el que queda abierta la conexión (uso en websockets)."""
        thread, _company_user_id = await self._authorize(user_id, shift_id)
        return thread

    async def list_conversations(self, user_id: UUID) -> list[ConversationSummary]:
        """Inbox: una tarjeta por turno en el que participa el usuario y cuyo
        hilo vigente (el del comercio con la persona asignada hoy) tiene mensajes.

        Arma el inbox en 3 consultas totales en vez de una por conversación
        (fix de P1, `docs/audits/PERFORMANCE_REPORT.md`): 1) turnos + ambas
        contrapartes posibles vía JOIN, 2) último mensaje por hilo, 3) no
        leídos por hilo. Todo agregado por lote (`IN`), sin loop de `await`.
        """
        candidates = await self._messages.list_inbox_candidates(user_id)
        threads = [c.thread for c in candidates]
        if not threads:
            return []

        last_messages = await self._messages.last_messages(threads)
        unread_counts = await self._messages.unread_counts(threads, user_id)

        summaries: list[ConversationSummary] = []
        for candidate in candidates:
            last = last_messages.get(candidate.thread)
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
                    unread_count=unread_counts.get(candidate.thread, 0),
                )
            )

        summaries.sort(key=lambda s: s.last_message_at, reverse=True)
        return summaries

    # --- helpers ---

    async def _authorize(self, user_id: UUID, shift_id: UUID) -> tuple[Thread, UUID]:
        """Verifica que el usuario participe HOY de la conversación del turno.

        Devuelve el hilo vigente (el del comercio con la persona asignada en
        este momento) y el `user_id` del comercio. Quien tuvo el turno antes
        ya no es participante: para esa persona la conversación no existe."""
        shift = await self._shifts.get_by_id(shift_id)
        # Sin trabajador asignado no hay con quién chatear.
        if shift is None or shift.worker_profile_id is None:
            raise ConversationNotFoundError(str(shift_id))
        company = await self._companies.get_by_id(shift.company_id)
        worker = await self._workers.get_by_id(shift.worker_profile_id)
        if company is None or worker is None:
            raise ConversationNotFoundError(str(shift_id))
        # No revelamos turnos ajenos: si no sos participante, es "inexistente".
        if user_id not in (company.user_id, worker.user_id):
            raise ConversationNotFoundError(str(shift_id))
        return Thread(shift_id=shift_id, worker_user_id=worker.user_id), company.user_id

    async def _notify_recipient(
        self, recipient_id: UUID, sender_id: UUID, body: str, shift_id: UUID
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
                # Abre ESA conversación, no la lista de chats.
                link=f"/chats/{shift_id}",
            )
        )
