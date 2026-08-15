"""Adaptador SQLAlchemy del SubscriptionRepository."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dt import naive as _naive
from app.modules.subscription.domain.entities import PERIOD_LENGTH, Subscription
from app.modules.subscription.domain.plans import DEFAULT_PLAN_CODE
from app.modules.subscription.domain.repositories import SubscriptionRepository
from app.modules.subscription.domain.value_objects import SubscriptionStatus
from app.modules.subscription.infrastructure.models import SubscriptionModel


def _to_entity(model: SubscriptionModel) -> Subscription:
    return Subscription(
        id=model.id,
        company_id=model.company_id,
        plan_code=model.plan_code,
        status=SubscriptionStatus(model.status),
        period_start=model.period_start,
        period_end=model.period_end,
        turnos_usados_mes=model.turnos_usados_mes,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class SqlAlchemySubscriptionRepository(SubscriptionRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, subscription: Subscription) -> Subscription:
        model = SubscriptionModel(
            id=subscription.id,
            company_id=subscription.company_id,
            plan_code=subscription.plan_code,
            status=subscription.status.value,
            period_start=subscription.period_start,
            period_end=subscription.period_end,
            turnos_usados_mes=subscription.turnos_usados_mes,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def update(self, subscription: Subscription) -> Subscription:
        model = await self._session.get(SubscriptionModel, subscription.id)
        if model is None:
            raise ValueError("La suscripción no existe")
        model.plan_code = subscription.plan_code
        model.status = subscription.status.value
        model.period_start = subscription.period_start
        model.period_end = subscription.period_end
        model.turnos_usados_mes = subscription.turnos_usados_mes
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def get_by_company_id(self, company_id: UUID) -> Subscription | None:
        stmt = select(SubscriptionModel).where(SubscriptionModel.company_id == company_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_entity(model) if model else None

    async def get_or_create(self, company_id: UUID) -> Subscription:
        existing = await self.get_by_company_id(company_id)
        if existing is not None:
            return existing
        now = datetime.now(timezone.utc)
        subscription = Subscription(
            company_id=company_id,
            plan_code=DEFAULT_PLAN_CODE,
            status=SubscriptionStatus.ACTIVA,
            period_start=now,
            period_end=now + PERIOD_LENGTH,
        )
        return await self.add(subscription)

    async def count_by_plan_and_status(self) -> list[tuple[str, str, int]]:
        stmt = select(
            SubscriptionModel.plan_code, SubscriptionModel.status, func.count()
        ).group_by(SubscriptionModel.plan_code, SubscriptionModel.status)
        result = await self._session.execute(stmt)
        return [(plan_code, status, count) for plan_code, status, count in result.all()]

    async def count_at_plan_limit(self, limits: dict[str, int], *, now: datetime) -> int:
        if not limits:
            return 0
        conditions = [
            and_(SubscriptionModel.plan_code == plan_code, SubscriptionModel.turnos_usados_mes >= limit)
            for plan_code, limit in limits.items()
        ]
        # `period_end` se filtra en Python (no en el WHERE) por el mismo
        # motivo que `roll_period_if_expired` en el dominio: SQLite (tests)
        # devuelve datetimes naive, Postgres los devuelve con tz — comparar
        # directo en SQL mezclaría los dos formatos. Volumen chico en esta
        # etapa (un comercio por fila), sin costo real.
        stmt = select(SubscriptionModel.period_end).where(or_(*conditions))
        result = await self._session.execute(stmt)
        now_naive = _naive(now)
        return sum(1 for period_end in result.scalars().all() if _naive(period_end) > now_naive)
