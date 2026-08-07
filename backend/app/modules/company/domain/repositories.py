"""Puerto del repositorio de perfiles de comercio."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.company.domain.entities import CompanyProfile


class CompanyProfileRepository(ABC):
    """Puerto de persistencia para PerfilComercio."""

    @abstractmethod
    async def add(self, profile: CompanyProfile) -> CompanyProfile:
        """Persiste un nuevo perfil y lo devuelve."""

    @abstractmethod
    async def update(self, profile: CompanyProfile) -> CompanyProfile:
        """Actualiza un perfil existente y lo devuelve."""

    @abstractmethod
    async def get_by_id(self, profile_id: UUID) -> CompanyProfile | None:
        """Busca un perfil por su id."""

    @abstractmethod
    async def list_by_ids(self, profile_ids: list[UUID]) -> dict[UUID, CompanyProfile]:
        """Busca varios perfiles por id en una sola consulta (`WHERE id IN
        (...)`). Devuelve un dict `{id: perfil}` (los ids inexistentes
        simplemente no aparecen). Usado para anotar listados (feed/mis-turnos)
        con nombre/logo de comercio sin 1 query por fila — ver P3,
        docs/audits/PERFORMANCE_REPORT.md."""

    @abstractmethod
    async def get_by_user_id(self, user_id: UUID) -> CompanyProfile | None:
        """Busca el perfil asociado a un usuario."""

    @abstractmethod
    async def exists_by_user_id(self, user_id: UUID) -> bool:
        """Indica si el usuario ya tiene un perfil de comercio."""

    @abstractmethod
    async def photo_urls_by_user_ids(self, user_ids: list[UUID]) -> dict[UUID, str | None]:
        """Logo del comercio (`logo_url`) por id de usuario, en una sola
        consulta (misma idea que `VerificationRepository.verified_user_ids`).
        Usado para anotar listados que no pasan por `get_by_user_id` fila por
        fila (panel de admin)."""

    @abstractmethod
    async def update_rating(self, profile_id: UUID, rating: float) -> None:
        """Actualiza el promedio de reputación calculado a partir de las reseñas."""

    @abstractmethod
    async def record_late_cancellation(self, profile_id: UUID) -> None:
        """Registra que el comercio canceló un turno con el trabajador ya
        confirmado (ADR-0007). Incrementa `late_cancellations` en 1. Nunca es
        un UPDATE manual: siempre pasa por acá, disparado por
        `ShiftService.cancel_shift`."""

    @abstractmethod
    async def record_published_shift(self, profile_id: UUID) -> None:
        """Incrementa `events_published` en 1. Disparado por
        `ShiftService.publish_shift` en cada transición BORRADOR→PUBLICADO."""

    @abstractmethod
    async def record_payment(self, profile_id: UUID, *, on_time: bool) -> None:
        """Recalcula `on_time_payment_rate` como promedio móvil simple sobre
        `payments_recorded` (contador interno, no expuesto en la API).
        Disparado por `ShiftService.mark_paid` — `on_time` lo decide el
        servicio comparando `paid_at` contra `end_at` con la tolerancia de
        `PAYMENT_TOLERANCE`."""
