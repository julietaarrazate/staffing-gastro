"""Puertos del módulo lead: persistencia y fuente pública de comercios."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.lead.domain.entities import Lead, PlaceCandidate
from app.modules.lead.domain.value_objects import LeadStatus


class LeadRepository(ABC):
    """Puerto de persistencia para Lead."""

    @abstractmethod
    async def get_by_id(self, lead_id: UUID) -> Lead | None:
        """Busca un lead por id."""

    @abstractmethod
    async def get_by_osm_refs(self, osm_refs: list[str]) -> dict[str, Lead]:
        """Los leads ya guardados de esas referencias de OSM, por referencia."""

    @abstractmethod
    async def save_many(self, leads: list[Lead]) -> None:
        """Inserta o actualiza (por id) varios leads en una sola transacción."""

    @abstractmethod
    async def update(self, lead: Lead) -> Lead:
        """Guarda el seguimiento de un lead existente y lo devuelve."""

    @abstractmethod
    async def find(
        self,
        *,
        status: LeadStatus | None = None,
        barrio: str | None = None,
    ) -> list[Lead]:
        """Todos los leads que cumplen el filtro, sin paginar.

        La prioridad se calcula en el dominio (`Lead.priority`), así que el
        orden y la página los arma el caso de uso: paginar en SQL antes de
        ordenar devolvería los comercios equivocados (mismo criterio que la
        búsqueda por distancia de `MatchingService.search_workers`). Un barrio
        tiene a lo sumo unos cientos de comercios gastronómicos.
        """

    @abstractmethod
    async def count_by_status(self, *, barrio: str | None = None) -> dict[LeadStatus, int]:
        """Cuántos leads hay en cada estado (para el resumen del embudo)."""


class PlaceSource(ABC):
    """Puerto de la fuente pública de comercios (hoy, OpenStreetMap)."""

    @abstractmethod
    async def find_gastronomy(self, barrio: str) -> list[PlaceCandidate]:
        """Comercios gastronómicos con nombre dentro del barrio.

        Lanza `PlaceSourceUnavailableError` si la fuente no responde.
        """
