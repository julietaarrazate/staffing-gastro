"""Puertos (interfaces) del dominio de verificación de identidad.

Las capas de aplicación dependen de estas abstracciones; la infraestructura las
implementa con SQLAlchemy. El claim es la raíz del agregado: se persiste con
sus evidencias.
"""

from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from app.modules.verification.domain.entities import Claim, EvidenceFileDeletion
from app.modules.verification.domain.value_objects import ClaimType, EvidenceFile


class ClaimRepository(ABC):
    """Persistencia de claims (con sus evidencias como parte del agregado).

    `add` y `update` también guardan `claim.files_to_delete` en la cola de
    borrado, **en el mismo commit** que el claim: si se guarda la purga del
    puntero, se guarda el pedido de borrar el archivo (ADR-0021)."""

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
    async def get_by_evidence_id(self, evidence_id: UUID) -> Claim | None:
        """El claim dueño de esa evidencia, o None si no existe."""

    @abstractmethod
    async def list_pending(self) -> list[Claim]:
        """Cola de revisión: claims en estado PENDIENTE (con sus evidencias)."""

    @abstractmethod
    async def verified_user_ids(
        self, user_ids: list[UUID], claim_type: ClaimType
    ) -> set[UUID]:
        """De los `user_ids` dados, cuáles tienen un claim VERIFICADA de ese
        tipo. Consulta batch para que los consumidores (perfil público, cola
        de candidatos) no hagan N+1."""


class EvidenceLinkSigner(ABC):
    """Arma un link para ver el archivo privado de una evidencia, que deja de
    andar en `expires_at` (ADR-0021). El adaptador es Cloudinary; el dominio
    sólo sabe que existe un link que vence."""

    @abstractmethod
    def link_for(self, file: EvidenceFile, expires_at: datetime) -> str: ...


class EvidenceFileDeletionRepository(ABC):
    """Cola de archivos de evidencia que hay que borrar del storage
    (ADR-0021). La llenan las decisiones (vía `ClaimRepository`); la vacía
    `EvidenceFileCleaner`."""

    @abstractmethod
    async def list_due(
        self, now: datetime, ids: list[UUID] | None = None, limit: int = 100
    ) -> list[EvidenceFileDeletion]:
        """Los pendientes cuyo `next_attempt_at` ya llegó (sólo esos `ids`,
        si se pasan), los más viejos primero."""

    @abstractmethod
    async def next_attempt_at(self) -> datetime | None:
        """El `next_attempt_at` más temprano de la cola, o None si está vacía."""

    @abstractmethod
    async def remove(self, deletion_id: UUID) -> None:
        """El storage confirmó el borrado: se olvida la referencia."""

    @abstractmethod
    async def save_failure(self, deletion: EvidenceFileDeletion) -> None:
        """Guarda el intento fallido (`attempts`, `last_error`,
        `next_attempt_at`)."""


class EvidenceFileStorage(ABC):
    """Donde viven los archivos de las evidencias. El adaptador es
    Cloudinary; el dominio sólo sabe que se pueden borrar."""

    @abstractmethod
    async def delete(self, file: EvidenceFile) -> None:
        """Borra el archivo. Que ya no exista cuenta como borrado (no lanza).
        Lanza si no se pudo (red, credenciales, error del storage)."""
