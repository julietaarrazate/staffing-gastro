"""Adaptadores SQLAlchemy de los repositorios de suscripción y de pagos."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dt import naive as _naive
from app.modules.subscription.domain.entities import (
    PERIOD_LENGTH,
    Subscription,
    SubscriptionPayment,
)
from app.modules.subscription.domain.plans import DEFAULT_PLAN_CODE
from app.modules.subscription.domain.repositories import (
    SubscriptionPaymentRepository,
    SubscriptionRepository,
)
from app.modules.subscription.domain.value_objects import (
    ExpiryNotice,
    PaymentStatus,
    SubscriptionStatus,
)
from app.modules.subscription.infrastructure.models import (
    SubscriptionModel,
    SubscriptionPaymentModel,
)


def _to_entity(model: SubscriptionModel) -> Subscription:
    return Subscription(
        id=model.id,
        company_id=model.company_id,
        plan_code=model.plan_code,
        status=SubscriptionStatus(model.status),
        period_start=model.period_start,
        period_end=model.period_end,
        turnos_usados_mes=model.turnos_usados_mes,
        paid_until=model.paid_until,
        renews=model.renews,
        expiry_notice=ExpiryNotice(model.expiry_notice) if model.expiry_notice else None,
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
            paid_until=subscription.paid_until,
            renews=subscription.renews,
            expiry_notice=subscription.expiry_notice.value if subscription.expiry_notice else None,
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
        model.paid_until = subscription.paid_until
        model.renews = subscription.renews
        model.expiry_notice = (
            subscription.expiry_notice.value if subscription.expiry_notice else None
        )
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def get_by_company_id(self, company_id: UUID) -> Subscription | None:
        stmt = select(SubscriptionModel).where(SubscriptionModel.company_id == company_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_entity(model) if model else None

    async def get_or_create(
        self,
        company_id: UUID,
        *,
        initial_status: SubscriptionStatus = SubscriptionStatus.ACTIVA,
    ) -> Subscription:
        existing = await self.get_by_company_id(company_id)
        if existing is not None:
            return existing
        now = datetime.now(UTC)
        subscription = Subscription(
            company_id=company_id,
            plan_code=DEFAULT_PLAN_CODE,
            status=initial_status,
            period_start=now,
            period_end=now + PERIOD_LENGTH,
        )
        return await self.add(subscription)

    async def list_paid(self) -> list[Subscription]:
        stmt = select(SubscriptionModel).where(
            SubscriptionModel.status == SubscriptionStatus.ACTIVA.value,
            SubscriptionModel.paid_until.is_not(None),
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

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
            and_(
                SubscriptionModel.plan_code == plan_code,
                SubscriptionModel.turnos_usados_mes >= limit,
            )
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


def _payment_to_entity(model: SubscriptionPaymentModel) -> SubscriptionPayment:
    return SubscriptionPayment(
        id=model.id,
        company_id=model.company_id,
        plan_code=model.plan_code,
        amount_ars=model.amount_ars,
        currency=model.currency,
        status=PaymentStatus(model.status),
        mp_payment_id=model.mp_payment_id,
        mp_preference_id=model.mp_preference_id,
        approved_at=model.approved_at,
        refunded_at=model.refunded_at,
        created_at=model.created_at,
    )


class SqlAlchemySubscriptionPaymentRepository(SubscriptionPaymentRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, payment: SubscriptionPayment) -> SubscriptionPayment:
        model = SubscriptionPaymentModel(
            id=payment.id,
            company_id=payment.company_id,
            plan_code=payment.plan_code,
            amount_ars=payment.amount_ars,
            currency=payment.currency,
            status=payment.status.value,
            mp_payment_id=payment.mp_payment_id,
            mp_preference_id=payment.mp_preference_id,
            approved_at=payment.approved_at,
            refunded_at=payment.refunded_at,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _payment_to_entity(model)

    async def update(self, payment: SubscriptionPayment) -> SubscriptionPayment:
        model = await self._session.get(SubscriptionPaymentModel, payment.id)
        if model is None:
            raise ValueError("El pago no existe")
        model.status = payment.status.value
        model.mp_payment_id = payment.mp_payment_id
        model.mp_preference_id = payment.mp_preference_id
        model.approved_at = payment.approved_at
        model.refunded_at = payment.refunded_at
        await self._session.commit()
        await self._session.refresh(model)
        return _payment_to_entity(model)

    async def get_by_id(self, payment_id: UUID) -> SubscriptionPayment | None:
        model = await self._session.get(SubscriptionPaymentModel, payment_id)
        return _payment_to_entity(model) if model else None

    async def get_by_mp_payment_id(self, mp_payment_id: str) -> SubscriptionPayment | None:
        stmt = select(SubscriptionPaymentModel).where(
            SubscriptionPaymentModel.mp_payment_id == mp_payment_id
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _payment_to_entity(model) if model else None

    async def try_approve(
        self, payment_id: UUID, *, mp_payment_id: str, approved_at: datetime
    ) -> bool:
        stmt = (
            update(SubscriptionPaymentModel)
            .where(
                SubscriptionPaymentModel.id == payment_id,
                SubscriptionPaymentModel.status.in_(
                    (PaymentStatus.PENDIENTE.value, PaymentStatus.RECHAZADO.value)
                ),
            )
            .values(
                status=PaymentStatus.APROBADO.value,
                mp_payment_id=mp_payment_id,
                approved_at=approved_at,
            )
            .execution_options(synchronize_session=False)
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.rowcount == 1

    async def list_approved_by_company(self, company_id: UUID) -> list[SubscriptionPayment]:
        stmt = (
            select(SubscriptionPaymentModel)
            .where(
                SubscriptionPaymentModel.company_id == company_id,
                SubscriptionPaymentModel.status.in_(
                    (PaymentStatus.APROBADO.value, PaymentStatus.REEMBOLSADO.value)
                ),
            )
            .order_by(SubscriptionPaymentModel.approved_at.asc())
        )
        result = await self._session.execute(stmt)
        return [_payment_to_entity(m) for m in result.scalars().all()]
