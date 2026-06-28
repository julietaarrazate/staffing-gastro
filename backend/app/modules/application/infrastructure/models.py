"""Modelo ORM de las postulaciones (tabla `shift_applications`)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID
from app.modules.application.domain.value_objects import ApplicationStatus


class ShiftApplicationModel(Base):
    __tablename__ = "shift_applications"
    __table_args__ = (
        UniqueConstraint(
            "shift_id", "worker_profile_id", name="uq_shift_applications_shift_worker"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    shift_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("shifts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    worker_profile_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("worker_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=ApplicationStatus.PENDIENTE.value
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
