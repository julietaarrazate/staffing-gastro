"""Entidades del dominio de chat."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4


@dataclass(frozen=True)
class Thread:
    """El hilo: la conversación del comercio con UNA persona asignada al turno.

    Un turno puede pasar por más de una persona (rechazo, baja, ausencia y
    reasignación). Cada una tiene su propio hilo con el comercio, identificado
    por el turno y el `user_id` de ese trabajador. Quien recibe el turno
    después arranca con un hilo vacío y no ve los anteriores.
    """

    shift_id: UUID
    worker_user_id: UUID


@dataclass
class ChatMessage:
    """Un mensaje dentro de un hilo (ver `Thread`).

    La conversación no es una entidad propia: se identifica por el `shift_id`
    y el `worker_user_id` de la persona con la que el comercio estaba hablando
    cuando se escribió el mensaje. Cada mensaje guarda además quién lo envió
    (el comercio o esa persona) y si ya fue leído.
    """

    shift_id: UUID
    worker_user_id: UUID
    sender_user_id: UUID
    body: str

    read: bool = False

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None

    @property
    def thread(self) -> Thread:
        return Thread(shift_id=self.shift_id, worker_user_id=self.worker_user_id)


@dataclass(frozen=True)
class InboxCandidate:
    """Fila cruda de un posible ítem del inbox: el turno y sus dos contrapartes
    de hoy (el comercio y la persona asignada en este momento).

    Se arma con un único JOIN (turno + comercio + trabajador + usuario del
    trabajador) para poder construir el inbox del chat sin N+1 (ver
    `ChatMessageRepository.list_inbox_candidates` y
    `docs/audits/PERFORMANCE_REPORT.md` P1). El servicio de aplicación decide, según
    el `user_id` que consulta, cuál de las dos contrapartes es "la otra".
    """

    shift_id: UUID
    shift_title: str
    company_user_id: UUID
    company_name: str
    company_logo_url: str | None
    worker_user_id: UUID
    worker_full_name: str
    worker_photo_url: str | None

    @property
    def thread(self) -> Thread:
        """El hilo vigente del turno: el del comercio con quien está asignado."""
        return Thread(shift_id=self.shift_id, worker_user_id=self.worker_user_id)
