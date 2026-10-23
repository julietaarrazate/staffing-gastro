"""Modelos ORM de la suscripción del comercio (`subscriptions`) y de sus
pagos mensuales (`subscription_payments`, ADR-0021)."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class SubscriptionModel(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("company_profiles.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    plan_code: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    turnos_usados_mes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    paid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    renews: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    expiry_notice: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SubscriptionPaymentModel(Base):
    """Un intento de pago mensual. `id` es el `external_reference` de la
    preferencia; `mp_payment_id` es único para que un mismo pago de Mercado
    Pago no se acredite dos veces."""

    __tablename__ = "subscription_payments"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("company_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_code: Mapped[str] = mapped_column(String(40), nullable=False)
    amount_ars: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="ARS")
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    mp_payment_id: Mapped[str | None] = mapped_column(String(40), nullable=True, unique=True)
    mp_preference_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
