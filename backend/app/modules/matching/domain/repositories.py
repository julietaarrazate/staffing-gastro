"""Puerto del repositorio de candidatos para el motor de matching."""

from abc import ABC, abstractmethod

from app.modules.matching.domain.entities import CandidateProfile
from app.modules.worker.domain.value_objects import WorkerSkill


class CandidateRepository(ABC):
    """Puerto de lectura de candidatos elegibles para un turno."""

    @abstractmethod
    async def list_available_by_skill(
        self, skill: WorkerSkill
    ) -> list[CandidateProfile]:
        """Lista trabajadores disponibles que tengan la habilidad pedida."""
