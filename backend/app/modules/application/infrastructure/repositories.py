"""Adaptador SQLAlchemy del ShiftApplicationRepository.

`list_by_shift_enriched` importa modelos de `worker`/`identity` para resolver
el perfil y el usuario de cada postulante con un único JOIN (fix de P2 en
`docs/audits/PERFORMANCE_REPORT.md`); es el mismo patrón ya usado en
`matching/infrastructure/repositories.py` para lecturas agregadas.
"""

from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.application.domain.entities import (
    ApplicantMatch,
    EnrichedApplicant,
    ShiftApplication,
)
from app.modules.application.domain.repositories import (
    ApplicationStats,
    ShiftApplicationRepository,
)
from app.modules.application.domain.value_objects import ApplicationStatus
from app.modules.application.infrastructure.models import ShiftApplicationModel
from app.modules.identity.infrastructure.models import UserModel
from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.worker.domain.value_objects import GamificationLevel, WorkerBadge
from app.modules.worker.infrastructure.models import WorkerProfileModel


def _to_entity(model: ShiftApplicationModel) -> ShiftApplication:
    return ShiftApplication(
        id=model.id,
        shift_id=model.shift_id,
        worker_profile_id=model.worker_profile_id,
        status=ApplicationStatus(model.status),
        created_at=model.created_at,
    )


class SqlAlchemyShiftApplicationRepository(ShiftApplicationRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, application: ShiftApplication) -> ShiftApplication:
        model = ShiftApplicationModel(
            id=application.id,
            shift_id=application.shift_id,
            worker_profile_id=application.worker_profile_id,
            status=application.status.value,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def update(self, application: ShiftApplication) -> ShiftApplication:
        model = await self._session.get(ShiftApplicationModel, application.id)
        if model is None:
            raise ValueError(f"Postulación {application.id} no encontrada")
        model.status = application.status.value
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def get_by_id(self, application_id: UUID) -> ShiftApplication | None:
        model = await self._session.get(ShiftApplicationModel, application_id)
        return _to_entity(model) if model else None

    async def get_by_shift_and_worker(
        self, shift_id: UUID, worker_profile_id: UUID
    ) -> ShiftApplication | None:
        stmt = select(ShiftApplicationModel).where(
            ShiftApplicationModel.shift_id == shift_id,
            ShiftApplicationModel.worker_profile_id == worker_profile_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_entity(model) if model else None

    async def list_by_shift(self, shift_id: UUID) -> list[ShiftApplication]:
        stmt = (
            select(ShiftApplicationModel)
            .where(ShiftApplicationModel.shift_id == shift_id)
            .order_by(ShiftApplicationModel.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_by_worker(
        self, worker_profile_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[ShiftApplication]:
        stmt = (
            select(ShiftApplicationModel)
            .where(ShiftApplicationModel.worker_profile_id == worker_profile_id)
            .order_by(ShiftApplicationModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_pending_by_worker(self, worker_profile_id: UUID) -> list[ShiftApplication]:
        stmt = select(ShiftApplicationModel).where(
            ShiftApplicationModel.worker_profile_id == worker_profile_id,
            ShiftApplicationModel.status == ApplicationStatus.PENDIENTE.value,
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_by_shift_enriched(self, shift_id: UUID) -> list[EnrichedApplicant]:
        # INNER JOIN a worker_profiles: si el perfil no existe más, el
        # postulante se descarta (igual que el `if worker is None: continue`
        # original). LEFT JOIN a users: si el usuario no existe, se mantiene
        # el postulante con nombre de reserva (igual que el fallback original
        # "Trabajador").
        stmt = (
            select(ShiftApplicationModel, WorkerProfileModel, UserModel.full_name)
            .join(
                WorkerProfileModel,
                WorkerProfileModel.id == ShiftApplicationModel.worker_profile_id,
            )
            .outerjoin(UserModel, UserModel.id == WorkerProfileModel.user_id)
            .where(ShiftApplicationModel.shift_id == shift_id)
            .order_by(ShiftApplicationModel.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return [
            EnrichedApplicant(
                application_id=application.id,
                worker_profile_id=application.worker_profile_id,
                full_name=full_name or "Trabajador",
                photo_url=worker.photo_url,
                rating=worker.rating,
                is_available=worker.is_available,
                status=ApplicationStatus(application.status),
                created_at=application.created_at,
                events_completed=worker.events_completed,
                punctuality_rate=worker.punctuality_rate,
                years_experience=worker.years_experience,
                badges=tuple(WorkerBadge(b) for b in (worker.badges or [])),
                level=GamificationLevel(worker.level),
            )
            for application, worker, full_name in result.all()
        ]

    async def find_applicant_by_name(
        self, company_id: UUID, name_query: str
    ) -> ApplicantMatch | None:
        # INNER JOIN hasta `shifts` (para filtrar por comercio) y hasta
        # `users` (sin usuario no hay a quién verificar) — a diferencia de
        # `list_by_shift_enriched`, acá un postulante sin usuario resuelto no
        # sirve de nada, así que no hace falta el LEFT JOIN + fallback.
        stmt = (
            select(UserModel.id, UserModel.full_name)
            .join(WorkerProfileModel, WorkerProfileModel.user_id == UserModel.id)
            .join(
                ShiftApplicationModel,
                ShiftApplicationModel.worker_profile_id == WorkerProfileModel.id,
            )
            .join(ShiftModel, ShiftModel.id == ShiftApplicationModel.shift_id)
            .where(
                ShiftModel.company_id == company_id,
                UserModel.full_name.ilike(f"%{name_query}%"),
            )
            .order_by(ShiftApplicationModel.created_at.desc())
            .limit(1)
        )
        row = (await self._session.execute(stmt)).first()
        if row is None:
            return None
        return ApplicantMatch(user_id=row.id, full_name=row.full_name)

    async def count_application_stats(self) -> ApplicationStats:
        stmt = select(
            func.count().label("total"),
            func.sum(
                case((ShiftApplicationModel.status == ApplicationStatus.ACEPTADA.value, 1), else_=0)
            ).label("accepted"),
        )
        row = (await self._session.execute(stmt)).one()
        return ApplicationStats(total=row.total or 0, accepted=row.accepted or 0)
