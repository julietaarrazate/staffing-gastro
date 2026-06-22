"""Puerto del repositorio de candidatos para el motor de matching."""

from abc import ABC, abstractmethod

from app.modules.matching.domain.entities import CandidateProfile
from app.modules.worker.domain.value_objects import WorkerSkill


class CandidateRepository(ABC):
    """Puerto de lectura de candidatos elegibles para un turno."""

    @abstractmethod
    async def list_available(
        self, skill: WorkerSkill | None = None
    ) -> list[CandidateProfile]:
        """Lista trabajadores disponibles, opcionalmente filtrados por habilidad."""
