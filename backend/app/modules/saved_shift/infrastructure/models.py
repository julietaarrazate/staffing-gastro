"""Modelo ORM de los turnos guardados (tabla `saved_shifts`)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class SavedShiftModel(Base):
    __tablename__ = "saved_shifts"
    __table_args__ = (
        UniqueConstraint(
            "worker_profile_id", "shift_id", name="uq_saved_shifts_worker_shift"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    worker_profile_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("worker_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shift_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("shifts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
