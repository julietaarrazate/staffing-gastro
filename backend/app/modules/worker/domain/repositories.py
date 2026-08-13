"""Puerto del repositorio de perfiles de trabajador."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID

from app.modules.worker.domain.entities import WorkerProfile


@dataclass
class WorkerEngagementStats:
    """Conteos agregados de `worker_profiles` para `no_show_rate` y
    `worker_completion_repeat_rate` (panel de admin). Agregado en SQL sobre
    columnas ya existentes (`events_completed`/`cancellations`/`no_shows`,
    ver docs/reference/REPUTATION.md) — sin tabla nueva.

    `no_show_rate` = `no_shows_total / (completed_total + cancellations_total
    + no_shows_total)`: mismo denominador que `_performance_score` de
    matching (`matching/domain/scoring.py`), pero agregado a nivel
    plataforma en vez de por trabajador.

    `worker_completion_repeat_rate` = `workers_with_2plus_events /
    workers_with_1plus_events`. OJO: mide repetición de COMPLETACIÓN entre
    quienes ya completaron ≥1 turno — NO es "% de trabajadores que vuelven a
    usar Oído" (retención). Un trabajador que se postuló muchas veces y
    nunca fue elegido (`events_completed == 0`) no entra en ninguno de los
    dos conteos. Ver docs/audits/ETAPA1_QUALITY_REVIEW.md §1.4.
    """

    completed_total: int
    cancellations_total: int
    no_shows_total: int
    workers_with_1plus_events: int
    workers_with_2plus_events: int


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

    @abstractmethod
    async def count_engagement_stats(self) -> WorkerEngagementStats:
        """Cuenta agregados de compromiso de trabajadores (`no_show_rate`,
        `worker_repeat_rate`, panel de admin) — agregado en SQL, no una
        lista de filas."""
