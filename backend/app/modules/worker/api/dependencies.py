"""Dependencias de FastAPI del módulo worker."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.application.infrastructure.repositories import (
    SqlAlchemyShiftApplicationRepository,
)
from app.modules.company.infrastructure.repositories import SqlAlchemyCompanyProfileRepository
from app.modules.identity.domain.repositories import UserRepository
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from app.modules.worker.application.services import WorkerProfileService
from app.modules.worker.domain.repositories import WorkerProfileRepository
from app.modules.worker.infrastructure.repositories import (
    SqlAlchemyWorkerProfileRepository,
)


def get_worker_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkerProfileService:
    repository = SqlAlchemyWorkerProfileRepository(session)
    return WorkerProfileService(repository, SqlAlchemyShiftRepository(session))


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


class EmployerWorkerRelation:
    """¿Este comercio tiene (o tuvo) un turno o una postulación con este
    trabajador? Decide quién ve datos que el perfil público no muestra, como
    el CV (revisión de seguridad 2026-10-20). Vive en `api/` porque cruza
    tres módulos (company, shift, application) sólo para leer."""

    def __init__(self, session: AsyncSession) -> None:
        self._companies = SqlAlchemyCompanyProfileRepository(session)
        self._shifts = SqlAlchemyShiftRepository(session)
        self._applications = SqlAlchemyShiftApplicationRepository(session)

    async def exists(self, employer_user_id: UUID, worker_profile_id: UUID) -> bool:
        company = await self._companies.get_by_user_id(employer_user_id)
        if company is None:
            return False
        assigned = await self._shifts.list_by_worker(
            worker_profile_id, limit=_RELATION_LOOKBACK
        )
        if any(shift.company_id == company.id for shift in assigned):
            return True
        applications = await self._applications.list_by_worker(
            worker_profile_id, limit=_RELATION_LOOKBACK
        )
        applied = await self._shifts.list_by_ids([a.shift_id for a in applications])
        return any(shift.company_id == company.id for shift in applied)


def get_employer_worker_relation(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> EmployerWorkerRelation:
    return EmployerWorkerRelation(session)
