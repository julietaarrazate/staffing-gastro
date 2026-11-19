"""Adaptadores del CV privado (ADR-0021, actualización 2026-11-19: el CV
también).

- `CloudinaryCvFileStorage`: el link que vence es `private_download_url` (la
  API de descarga firmada, la misma de los documentos de identidad); que un
  archivo lo subió una cuenta lo dice la marca de su nombre
  (`app.core.cloudinary.is_cv_upload_of`).
- `QueuedCvFileDeletion`: el CV que se deja de usar entra a la cola de
  borrado de archivos del ADR-0021 (la de las evidencias de identidad, con
  sus reintentos del scheduler) en el mismo commit que el perfil.
"""

from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cloudinary import is_cv_upload_of, parse_cloudinary_url, private_download_url
from app.modules.verification.domain.value_objects import EvidenceFile
from app.modules.verification.infrastructure.file_cleanup_job import queue_file_deletions
from app.modules.worker.domain.repositories import CvFileDeletionQueue, CvFileStorage
from app.modules.worker.domain.value_objects import CvFile


class CloudinaryCvFileStorage(CvFileStorage):
    def link_for(self, file: CvFile, expires_at: datetime, download: bool = False) -> str:
        """Tira `CloudinaryNotConfiguredError` si falta la configuración."""
        return private_download_url(
            public_id=file.public_id,
            file_format=file.format,
            resource_type=file.resource_type,
            delivery_type=file.delivery_type,
            expires_at=int(expires_at.timestamp()),
            attachment=download,
        )

    def was_uploaded_by(self, file: CvFile, user_id: UUID) -> bool:
        return is_cv_upload_of(file.public_id, user_id)

    def file_from_url(self, url: str) -> CvFile | None:
        parsed = parse_cloudinary_url(url)
        if parsed is None:
            return None
        return CvFile(
            public_id=parsed.public_id,
            resource_type=parsed.resource_type,
            format=parsed.format,
            delivery_type=parsed.type,
        )


class QueuedCvFileDeletion(CvFileDeletionQueue):
    def __init__(
        self, session: AsyncSession, after_response: Callable[[list[UUID]], None]
    ) -> None:
        """`session` es la del perfil (el pedido entra en su commit);
        `after_response` agenda el borrado para después de responder."""
        self._session = session
        self._after_response = after_response

    async def enqueue(self, files: list[CvFile]) -> None:
        ids = queue_file_deletions(
            self._session,
            [
                EvidenceFile(
                    public_id=f.public_id,
                    resource_type=f.resource_type,
                    format=f.format,
                    delivery_type=f.delivery_type,
                )
                for f in files
            ],
        )
        self._after_response(ids)
