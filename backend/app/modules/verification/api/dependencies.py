"""Dependencias de FastAPI del módulo de verificación de identidad."""

from typing import Annotated
from uuid import UUID

from fastapi import BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session, sessions_like
from app.modules.verification.application.services import VerificationService
from app.modules.verification.domain.repositories import EvidenceFileStorage
from app.modules.verification.infrastructure.evidence_file_storage import (
    CloudinaryEvidenceFileStorage,
)
from app.modules.verification.infrastructure.evidence_link_signer import (
    CloudinaryEvidenceLinkSigner,
)
from app.modules.verification.infrastructure.file_cleanup_job import (
    delete_released_files,
)
from app.modules.verification.infrastructure.repositories import (
    SqlAlchemyClaimRepository,
)


def get_evidence_file_storage() -> EvidenceFileStorage:
    """Dónde se borran los archivos de las evidencias. Los tests la pisan
    con un doble (`tests/conftest.py`): nunca llaman a Cloudinary."""
    return CloudinaryEvidenceFileStorage()


def get_verification_service(
    session: Annotated[AsyncSession, Depends(get_session)],
    background_tasks: BackgroundTasks,
    storage: Annotated[EvidenceFileStorage, Depends(get_evidence_file_storage)],
) -> VerificationService:
    sessions = sessions_like(session)

    def delete_files_later(ids: list[UUID]) -> None:
        # Después de responder, con sesión propia (ADR-0021, «Borrado al
        # decidir»): la decisión del admin no espera a Cloudinary.
        background_tasks.add_task(delete_released_files, sessions, storage, ids)

    return VerificationService(
        SqlAlchemyClaimRepository(session),
        CloudinaryEvidenceLinkSigner(),
        delete_files_later,
    )
