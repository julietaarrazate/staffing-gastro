"""Adaptador SQLAlchemy del ShiftApplicationRepository.

`list_by_shift_enriched` importa modelos de `worker`/`identity` para resolver
el perfil y el usuario de cada postulante con un único JOIN (fix de P2 en
`docs/audits/PERFORMANCE_REPORT.md`); es el mismo patrón ya usado en
`matching/infrastructure/repositories.py` para lecturas agregadas.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import case, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.application.domain.entities import (
    ApplicantMatch,
    EnrichedApplicant,
    ShiftApplication,
)
from app.modules.application.domain.exceptions import AlreadyAppliedError
from app.modules.application.domain.repositories import (
    ApplicationStats,
    ShiftApplicationRepository,
)
from app.modules.application.domain.value_objects import (
    ApplicationStatus,
    MotivoDesasignacion,
)
from app.modules.application.infrastructure.models import ShiftApplicationModel
from app.modules.identity.domain.value_objects import UserStatus
from app.modules.identity.infrastructure.models import UserModel
from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.worker.domain.value_objects import GamificationLevel, WorkerBadge
from app.modules.worker.infrastructure.models import WorkerProfileModel


def _es_postulacion_repetida(exc: IntegrityError) -> bool:
    """La violación es la de la fila única (turno, trabajador): Postgres
    nombra la restricción; SQLite, las columnas."""
    texto = str(exc.orig)
    return "uq_shift_applications_shift_worker" in texto or (
        "shift_applications.shift_id" in texto and "worker_profile_id" in texto
    )


def _to_entity(model: ShiftApplicationModel) -> ShiftApplication:
    return ShiftApplication(
        id=model.id,
        shift_id=model.shift_id,
        worker_profile_id=model.worker_profile_id,
        status=ApplicationStatus(model.status),
        created_at=model.created_at,
        motivo=MotivoDesasignacion(model.motivo) if model.motivo else None,
        se_postulo=model.se_postulo,
    )


class SqlAlchemyShiftApplicationRepository(ShiftApplicationRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _commit_or_reset(self) -> None:
        """Guarda; si la base lo rechaza, deja la sesión usable y propaga el
        error (mismo criterio que el repositorio de avisos).

        Una escritura rechazada (p. ej. la fila única por turno y trabajador,
        si dos pedidos llegan a la vez) deja la sesión con la transacción
        rota, y esa sesión es la del pedido: todo lo que venga después falla
        con `PendingRollbackError`. Quien atrapa el error para seguir
        (`ShiftService._mark_unassigned`) terminaba igual en 500. El
        `rollback` no deshace nada anterior: cada repositorio confirma su
        propia escritura."""
        try:
            await self._session.commit()
        except Exception:
            await self._session.rollback()
            raise

    async def add(self, application: ShiftApplication) -> ShiftApplication:
        model = ShiftApplicationModel(
            id=application.id,
            shift_id=application.shift_id,
            worker_profile_id=application.worker_profile_id,
            status=application.status.value,
            motivo=application.motivo.value if application.motivo else None,
            se_postulo=application.se_postulo,
        )
        self._session.add(model)
        try:
            await self._commit_or_reset()
        except IntegrityError as exc:
            # Dos pedidos a la vez (otra pantalla, otro dispositivo) leyeron
            # «no hay postulación» y los dos insertaron: la fila única por
            # turno y trabajador frenó al segundo. Para la persona es lo mismo
            # que postularse de nuevo: «ya te postulaste», no un 500. Cualquier
            # otra violación (una clave foránea) se propaga. `_commit_or_reset`
            # ya hizo el `rollback`: la sesión queda usable.
            if _es_postulacion_repetida(exc):
                raise AlreadyAppliedError(str(application.shift_id)) from None
            raise
        await self._session.refresh(model)
        return _to_entity(model)

    async def update(self, application: ShiftApplication) -> ShiftApplication:
        model = await self._session.get(ShiftApplicationModel, application.id)
        if model is None:
            raise ValueError(f"Postulación {application.id} no encontrada")
        model.status = application.status.value
        model.motivo = application.motivo.value if application.motivo else None
        model.se_postulo = application.se_postulo
        # La fecha sólo cambia cuando el trabajador vuelve a postularse
        # (`ShiftApplication.reapply`); en el resto de las transiciones es la
        # misma que se leyó y no se reescribe.
        if application.created_at is not None:
            model.created_at = application.created_at
        await self._commit_or_reset()
        await self._session.refresh(model)
        return _to_entity(model)

    async def get_by_id(self, application_id: UUID) -> ShiftApplication | None:
        # `populate_existing`: siempre lo que hay en la base (CON-04 relee la
        # postulación después de que otro pedido pudo cambiarla).
        model = await self._session.get(
            ShiftApplicationModel, application_id, populate_existing=True
        )
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
            # Quien retiró su postulación no aparece (G4): ya no quiere el
            # turno, y si vuelve a postularse la misma fila se reactiva.
            .where(ShiftApplicationModel.status != ApplicationStatus.RETIRADA.value)
            # Cuenta suspendida: no se muestra (ADR-0024, mismo criterio que
            # «Recomendados»). Sin usuario resuelto sigue el fallback de arriba.
            .where(or_(UserModel.id.is_(None), UserModel.status == UserStatus.ACTIVE.value))
            # Quien tuvo el turno y lo dejó va al final, con su marca.
            .order_by(
                case(
                    (ShiftApplicationModel.status == ApplicationStatus.DESASIGNADA.value, 1),
                    else_=0,
                ),
                ShiftApplicationModel.created_at.desc(),
            )
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
                motivo=(
                    MotivoDesasignacion(application.motivo) if application.motivo else None
                ),
                events_completed=worker.events_completed,
                punctuality_rate=worker.punctuality_rate,
                years_experience=worker.years_experience,
                badges=tuple(WorkerBadge(b) for b in (worker.badges or [])),
                level=GamificationLevel(worker.level),
                user_id=worker.user_id,
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
                # Gente que se postuló: no quien fue asignado sin postularse.
                ShiftApplicationModel.se_postulo.is_(True),
                UserModel.full_name.ilike(f"%{name_query}%"),
                # Igual que la lista de postulantes: una cuenta suspendida no
                # se encuentra (ADR-0024).
                UserModel.status == UserStatus.ACTIVE.value,
            )
            .order_by(ShiftApplicationModel.created_at.desc())
            .limit(1)
        )
        row = (await self._session.execute(stmt)).first()
        if row is None:
            return None
        return ApplicantMatch(user_id=row.id, full_name=row.full_name)

    async def count_application_stats(self) -> ApplicationStats:
        # Sólo postulaciones de verdad: no las filas que el sistema escribe
        # para quien fue asignado sin postularse y dejó el turno (G4).
        stmt = select(
            func.count().label("total"),
            func.sum(
                case((ShiftApplicationModel.status == ApplicationStatus.ACEPTADA.value, 1), else_=0)
            ).label("accepted"),
        ).where(ShiftApplicationModel.se_postulo.is_(True))
        row = (await self._session.execute(stmt)).one()
        return ApplicationStats(total=row.total or 0, accepted=row.accepted or 0)

    async def count_active_by_shift_ids(self, shift_ids: list[UUID]) -> dict[UUID, int]:
        if not shift_ids:
            return {}
        stmt = (
            select(ShiftApplicationModel.shift_id, func.count())
            .where(
                ShiftApplicationModel.shift_id.in_(shift_ids),
                # Ni las retiradas ni quien tuvo el turno y lo dejó (G4).
                ShiftApplicationModel.status.notin_(
                    [ApplicationStatus.RETIRADA.value, ApplicationStatus.DESASIGNADA.value]
                ),
            )
            .group_by(ShiftApplicationModel.shift_id)
        )
        result = await self._session.execute(stmt)
        return {shift_id: count for shift_id, count in result.all()}

    async def count_pending_by_shift_ids(self, shift_ids: list[UUID]) -> dict[UUID, int]:
        if not shift_ids:
            return {}
        # Mismas filas que la lista de postulantes (`list_by_shift_enriched`):
        # sin perfil no cuenta, y una cuenta suspendida tampoco (ADR-0024).
        stmt = (
            select(ShiftApplicationModel.shift_id, func.count())
            .join(
                WorkerProfileModel,
                WorkerProfileModel.id == ShiftApplicationModel.worker_profile_id,
            )
            .outerjoin(UserModel, UserModel.id == WorkerProfileModel.user_id)
            .where(
                ShiftApplicationModel.shift_id.in_(shift_ids),
                ShiftApplicationModel.status == ApplicationStatus.PENDIENTE.value,
                or_(UserModel.id.is_(None), UserModel.status == UserStatus.ACTIVE.value),
            )
            .group_by(ShiftApplicationModel.shift_id)
        )
        result = await self._session.execute(stmt)
        return {shift_id: count for shift_id, count in result.all()}

    async def count_created_by_period(
        self, *, previous_start: datetime, current_start: datetime, end: datetime
    ) -> tuple[int, int]:
        created = ShiftApplicationModel.created_at
        stmt = select(
            func.sum(case(((created >= current_start) & (created < end), 1), else_=0)),
            func.sum(case(((created >= previous_start) & (created < current_start), 1), else_=0)),
        ).where(
            created >= previous_start,
            created < end,
            ShiftApplicationModel.se_postulo.is_(True),
        )
        current, previous = (await self._session.execute(stmt)).one()
        return current or 0, previous or 0
