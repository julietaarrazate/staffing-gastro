"""Puerto del repositorio de perfiles de trabajador."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.worker.domain.entities import WorkerProfile


class WorkerProfileRepository(ABC):
    """Puerto de persistencia para PerfilTrabajador."""

    @abstractmethod
    async def add(self, profile: WorkerProfile) -> WorkerProfile:
        """Persiste un nuevo perfil y lo devuelve."""

    @abstractmethod
    async def update(self, profile: WorkerProfile) -> WorkerProfile:
        """Actualiza un perfil existente y lo devuelve."""

    @abstractmethod
    async def get_by_id(self, profile_id: UUID) -> WorkerProfile | None:
        """Busca un perfil por su id."""

    @abstractmethod
    async def get_by_user_id(self, user_id: UUID) -> WorkerProfile | None:
        """Busca el perfil asociado a un usuario."""

    @abstractmethod
    async def exists_by_user_id(self, user_id: UUID) -> bool:
        """Indica si el usuario ya tiene un perfil de trabajador."""

    @abstractmethod
    async def photo_urls_by_user_ids(self, user_ids: list[UUID]) -> dict[UUID, str | None]:
        """Foto de perfil por id de usuario, en una sola consulta (misma idea
        que `VerificationRepository.verified_user_ids`). Usado para anotar
        listados que no pasan por `get_by_user_id` fila por fila (panel de
        admin)."""

    @abstractmethod
    async def update_rating(self, profile_id: UUID, rating: float) -> None:
        """Actualiza el promedio de reputación calculado a partir de las reseñas."""

    @abstractmethod
    async def record_completed_shift(self, profile_id: UUID, *, punctual: bool) -> None:
        """Registra un turno finalizado con éxito para el trabajador.

        Incrementa `events_completed` en 1 y recalcula `punctuality_rate` como
        promedio móvil simple sobre los eventos completados (incluye el que se
        está registrando ahora). También recalcula `badges`/`level` (ADR-0004).
        """

    @abstractmethod
    async def record_cancellation(self, profile_id: UUID) -> None:
        """Registra que el trabajador canceló una asignación ya confirmada
        (ADR-0004). Incrementa `cancellations` en 1 y recalcula `badges`/
        `level`, igual que `record_completed_shift`.
        """

    @abstractmethod
    async def record_no_show(self, profile_id: UUID) -> None:
        """Registra que el comercio marcó al trabajador como no presentado
        en un turno ya confirmado (ADR-0007). Incrementa `no_shows` en 1 y
        recalcula `badges`/`level`, igual que `record_cancellation`. Nunca es
        un UPDATE manual: siempre pasa por acá, disparado por
        `ShiftService.mark_no_show`.
        """
