"""Borrado de los archivos de evidencia que dejó una decisión (ADR-0021,
«Borrado al decidir»), armado con los adaptadores reales.

Desde el 2026-11-19 la cola también recibe el CV del trabajador que se
cambió o se sacó (`queue_file_deletions`, ADR-0021 «Actualización: el CV
también»): mismo storage, mismo borrado y mismos reintentos.

Dos entradas, el mismo caso de uso (`EvidenceFileCleaner`):

- `delete_released_files`: corre **después de responder** la decisión del
  admin (o el reenvío del trabajador), sólo con los archivos que dejó ese
  pedido. Sesión propia (la del request ya está cerrada). Nunca lanza: si
  algo falla, el pedido sigue en la cola y lo reintenta el scheduler.
- `run_evidence_file_cleanup`: un chequeo del scheduler en proceso
  (`shift/application/scheduler.py`, inyectado desde `app/main.py` para no
  cruzar capas). Reintenta los pendientes que ya tocan y devuelve cuándo es
  el próximo reintento, para que el loop se despierte a esa hora. Con la
  cola vacía devuelve `None` y no agrega despertares (cuota de Neon).
"""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.database import AsyncSessionLocal
from app.core.dt import naive
from app.modules.verification.application.dtos import FileCleanupReport
from app.modules.verification.application.services import EvidenceFileCleaner
from app.modules.verification.domain.entities import EvidenceFileDeletion
from app.modules.verification.domain.repositories import EvidenceFileStorage
from app.modules.verification.domain.value_objects import EvidenceFile
from app.modules.verification.infrastructure.evidence_file_storage import (
    CloudinaryEvidenceFileStorage,
)
from app.modules.verification.infrastructure.repositories import (
    SqlAlchemyEvidenceFileDeletionRepository,
)

logger = logging.getLogger(__name__)


def queue_file_deletions(
    session: AsyncSession, files: list[EvidenceFile], now: datetime | None = None
) -> list[UUID]:
    """Puerta de la cola para otro módulo que guarda archivos privados en el
    mismo storage (el CV del trabajador). Los pedidos entran en la sesión de
    quien llama y se confirman con su commit; devuelve los ids para
    `delete_released_files` después de responder."""
    now = now or datetime.now(UTC)
    deletions = [EvidenceFileDeletion.request(file, now) for file in files]
    SqlAlchemyEvidenceFileDeletionRepository(session).add_pending(deletions)
    return [deletion.id for deletion in deletions]


async def file_deletion_requested(session: AsyncSession, public_id: str) -> bool:
    """¿Ese archivo ya se mandó a borrar, esté pendiente o ya borrado? Lo usa
    el perfil del trabajador para no volver a aceptar un CV que la persona
    ya cambió o sacó (un formulario abierto desde antes)."""
    return await SqlAlchemyEvidenceFileDeletionRepository(session).was_requested(public_id)


async def _run(
    sessions: async_sessionmaker[AsyncSession],
    storage: EvidenceFileStorage,
    ids: list[UUID] | None,
    now: datetime | None = None,
) -> FileCleanupReport:
    async with sessions() as session:
        report = await EvidenceFileCleaner(
            SqlAlchemyEvidenceFileDeletionRepository(session), storage
        ).run(ids, now)
    if report.deleted or report.failed:
        logger.info(
            "verification.evidence_files_deleted",
            extra={"deleted": report.deleted, "failed": report.failed},
        )
    return report


async def delete_released_files(
    sessions: async_sessionmaker[AsyncSession],
    storage: EvidenceFileStorage,
    ids: list[UUID],
) -> None:
    """Después de responder: borra los archivos de esos pedidos de la cola."""
    try:
        await _run(sessions, storage, ids)
    except Exception:
        logger.exception(
            "Borrado de evidencias después de responder: falló la pasada; "
            "quedan en la cola y los reintenta el scheduler"
        )


async def run_evidence_file_cleanup(
    sessions: async_sessionmaker[AsyncSession] | None = None,
    storage: EvidenceFileStorage | None = None,
    now: datetime | None = None,
) -> datetime | None:
    """Chequeo del scheduler. Devuelve la próxima deadline (naive UTC, como
    el resto de los chequeos) o `None` si la cola quedó vacía. Los
    parámetros son para los tests; el scheduler lo llama sin ninguno."""
    report = await _run(
        sessions or AsyncSessionLocal,
        storage or CloudinaryEvidenceFileStorage(),
        None,
        now,
    )
    return naive(report.next_attempt_at) if report.next_attempt_at else None
