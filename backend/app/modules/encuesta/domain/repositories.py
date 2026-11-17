"""Puerto de persistencia de la encuesta."""

from abc import ABC, abstractmethod
from datetime import datetime

from app.modules.encuesta.domain.entities import SurveyResponse


class SurveyRepository(ABC):
    @abstractmethod
    async def get_by_client_key(self, client_key: str) -> SurveyResponse | None:
        """La respuesta ya guardada con esa clave de reintento, si hay."""

    @abstractmethod
    async def add(self, response: SurveyResponse) -> bool:
        """Guarda la respuesta. Devuelve `False` (sin duplicar) si otra con la
        misma `client_key` ganó la carrera."""

    @abstractmethod
    async def list_recent(
        self, *, limit: int, offset: int, only_with_contact: bool
    ) -> tuple[list[SurveyResponse], int]:
        """Página de respuestas, lo más nuevo primero, y el total del filtro."""

    @abstractmethod
    async def list_all(self) -> list[SurveyResponse]:
        """Todas las respuestas (para el resumen)."""

    @abstractmethod
    async def purge_contact_before(self, cutoff: datetime) -> int:
        """Borra nombre, teléfono y email (el nombre del local queda) de las respuestas anteriores a
        `cutoff`. Devuelve cuántas tenían contacto."""
