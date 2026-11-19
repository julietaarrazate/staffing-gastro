"""Dependencias de FastAPI del módulo worker."""

from typing import Annotated
from uuid import UUID

from fastapi import BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session, sessions_like
from app.modules.application.infrastructure.repositories import (
    SqlAlchemyShiftApplicationRepository,
)
from app.modules.company.infrastructure.repositories import SqlAlchemyCompanyProfileRepository
from app.modules.identity.domain.repositories import UserRepository
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.shift.domain.value_objects import COMMITTED_STATUSES, ShiftStatus
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from app.modules.verification.api.dependencies import get_evidence_file_storage
from app.modules.verification.domain.repositories import EvidenceFileStorage
from app.modules.verification.infrastructure.file_cleanup_job import (
    delete_released_files,
)
from app.modules.worker.application.services import WorkerProfileService
from app.modules.worker.domain.repositories import WorkerProfileRepository
from app.modules.worker.infrastructure.cv_files import (
    CloudinaryCvFileStorage,
    QueuedCvFileDeletion,
)
from app.modules.worker.infrastructure.repositories import (
    SqlAlchemyWorkerProfileRepository,
)


def get_worker_service(
    session: Annotated[AsyncSession, Depends(get_session)],
    background_tasks: BackgroundTasks,
    storage: Annotated[EvidenceFileStorage, Depends(get_evidence_file_storage)],
) -> WorkerProfileService:
    sessions = sessions_like(session)

    def delete_after_response(ids: list[UUID]) -> None:
        # El CV que se dejó de usar se borra después de responder, con sesión
        # propia, por el mismo camino que los documentos de identidad
        # (ADR-0021): si Cloudinary falla, queda en la cola y reintenta el
        # scheduler.
        background_tasks.add_task(delete_released_files, sessions, storage, ids)

    repository = SqlAlchemyWorkerProfileRepository(session)
    return WorkerProfileService(
        repository,
        SqlAlchemyShiftRepository(session),
        CloudinaryCvFileStorage(),
        QueuedCvFileDeletion(session, delete_after_response),
    )


def get_user_repository(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserRepository:
    return SqlAlchemyUserRepository(session)


def get_worker_repository(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkerProfileRepository:
    """El repositorio suelto, sin el servicio: lo usa otro módulo (shift) que
    sólo necesita leer datos de trabajadores para anotar su respuesta, no la
    lógica de perfiles. Mismo patrón que `get_company_repository`."""
    return SqlAlchemyWorkerProfileRepository(session)


# Cuántos turnos/postulaciones del trabajador se miran para decidir si un
# comercio "lo conoce". Alcanza de sobra para la beta; si algún día no
# alcanza, pasa a ser una consulta SQL con JOIN.
_RELATION_LOOKBACK = 200

# Turnos que cuentan como vínculo: sólo los que el trabajador CONFIRMÓ (o
# siguieron de ahí en el ciclo). ASIGNADO no alcanza: la asignación directa
# la hace el comercio solo, sin consentimiento, y con eso se fabricaba el
# vínculo (revisión 2026-10-21). CANCELADO/NO_CUBIERTO quedan afuera porque
# se llega a ellos también desde ASIGNADO sin que el trabajador confirmara.
_LINKED_SHIFT_STATUSES: frozenset[ShiftStatus] = COMMITTED_STATUSES | frozenset(
    {ShiftStatus.FINALIZADO, ShiftStatus.PAGADO}
)


class EmployerWorkerRelation:
    """¿Este trabajador eligió a este comercio? Cuenta sólo lo que hizo la
    persona: una postulación suya a un turno del comercio, o un turno del
    comercio que confirmó (`_LINKED_SHIFT_STATUSES`). Una asignación directa
    sin confirmar no cuenta: la hace el comercio solo. Decide quién ve datos
    que el perfil público no muestra, como el CV (revisión de seguridad
    2026-10-20/21). Vive en `api/` porque cruza tres módulos (company,
    shift, application) sólo para leer."""

    def __init__(self, session: AsyncSession) -> None:
        self._companies = SqlAlchemyCompanyProfileRepository(session)
        self._shifts = SqlAlchemyShiftRepository(session)
        self._applications = SqlAlchemyShiftApplicationRepository(session)

    async def exists(self, employer_user_id: UUID, worker_profile_id: UUID) -> bool:
        company = await self._companies.get_by_user_id(employer_user_id)
        if company is None:
            return False
        confirmed = await self._shifts.list_by_worker_and_statuses(
            worker_profile_id, _LINKED_SHIFT_STATUSES
        )
        if any(shift.company_id == company.id for shift in confirmed):
            return True
        applications = await self._applications.list_by_worker(
            worker_profile_id, limit=_RELATION_LOOKBACK
        )
        # Sólo las postulaciones que hizo la persona. La fila que el sistema
        # escribe cuando alguien asignado SIN postularse deja el turno
        # (`se_postulo` en falso, G4) no cuenta: si no, el comercio volvía a
        # poder fabricarse el vínculo asignando directo.
        applied = await self._shifts.list_by_ids(
            [a.shift_id for a in applications if a.se_postulo]
        )
        return any(shift.company_id == company.id for shift in applied)


def get_employer_worker_relation(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> EmployerWorkerRelation:
    return EmployerWorkerRelation(session)
