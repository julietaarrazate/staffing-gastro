"""Puertos (interfaces) del dominio de verificación de identidad.

Las capas de aplicación dependen de estas abstracciones; la infraestructura las
implementa con SQLAlchemy. El claim es la raíz del agregado: se persiste con
sus evidencias.
"""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.verification.domain.entities import Claim
from app.modules.verification.domain.value_objects import ClaimType


class ClaimRepository(ABC):
    """Persistencia de claims (con sus evidencias como parte del agregado)."""

    @abstractmethod
    async def add(self, claim: Claim) -> Claim: ...

    @abstractmethod
    async def update(self, claim: Claim) -> Claim: ...

    @abstractmethod
    async def get_by_id(self, claim_id: UUID) -> Claim | None: ...

    @abstractmethod
    async def get_for_user(
        self, user_id: UUID, claim_type: ClaimType
    ) -> Claim | None:
        """Devuelve el claim de ese tipo para el sujeto, o None si no existe."""

    @abstractmethod
    async def list_for_user(self, user_id: UUID) -> list[Claim]:
        """Todos los claims del sujeto (para calcular su nivel de garantía)."""

    @abstractmethod
    async def list_pending(self) -> list[Claim]:
        """Cola de revisión: claims en estado PENDIENTE (con sus evidencias)."""
