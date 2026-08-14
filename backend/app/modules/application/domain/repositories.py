"""Puerto del repositorio de postulaciones."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID

from app.modules.application.domain.entities import (
    ApplicantMatch,
    EnrichedApplicant,
    ShiftApplication,
)


@dataclass
class ApplicationStats:
    """Conteos agregados de `applications` para `application_to_acceptance_rate`
    (panel de admin). Agregado en SQL, mismo patrón que `UserCounts`."""

    total: int
    accepted: int


class ShiftApplicationRepository(ABC):
    """Puerto de persistencia para las postulaciones."""

    @abstractmethod
    async def add(self, application: ShiftApplication) -> ShiftApplication:
        """Persiste una nueva postulación y la devuelve."""

    @abstractmethod
    async def update(self, application: ShiftApplication) -> ShiftApplication:
        """Actualiza una postulación existente y la devuelve."""

    @abstractmethod
    async def get_by_id(self, application_id: UUID) -> ShiftApplication | None:
        """Busca una postulación por su id."""

    @abstractmethod
    async def get_by_shift_and_worker(
        self, shift_id: UUID, worker_profile_id: UUID
    ) -> ShiftApplication | None:
        """Busca la postulación de un trabajador a un turno, si existe."""

    @abstractmethod
    async def list_by_shift(self, shift_id: UUID) -> list[ShiftApplication]:
        """Lista las postulaciones a un turno (más recientes primero)."""

    @abstractmethod
    async def list_by_worker(
        self, worker_profile_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[ShiftApplication]:
        """Lista las postulaciones de un trabajador (más recientes primero, paginado)."""

    @abstractmethod
    async def list_by_shift_enriched(self, shift_id: UUID) -> list[EnrichedApplicant]:
        """Postulantes de un turno con datos del trabajador (perfil + usuario),
        en pocas consultas (JOIN) en vez de 2 por postulante."""

    @abstractmethod
    async def find_applicant_by_name(
        self, company_id: UUID, name_query: str
    ) -> ApplicantMatch | None:
        """Busca, entre TODOS los postulantes a turnos de este comercio (no un
        directorio global de trabajadores — sólo gente que ya se postuló acá),
        el primero cuyo nombre contiene `name_query` (sin distinguir
        mayúsculas/acentos). Usado por el asistente de IA para "¿fulano está
        verificado?" sin necesitar una búsqueda de trabajadores por nombre a
        nivel plataforma, que no existe hoy y sería un alcance mayor."""

    @abstractmethod
    async def list_pending_by_worker(self, worker_profile_id: UUID) -> list[ShiftApplication]:
        """Todas las postulaciones PENDIENTE de un trabajador, sin paginar.

        Uso interno (no expuesto por API): detectar solapamiento de horarios
        al confirmar un turno (ver `ShiftService.confirm_assignment`, regla
        de doble turno)."""

    @abstractmethod
    async def count_application_stats(self) -> ApplicationStats:
        """Cuenta postulaciones totales y aceptadas (`application_to_acceptance_rate`,
        panel de admin) — agregado en SQL, no una lista de filas."""
