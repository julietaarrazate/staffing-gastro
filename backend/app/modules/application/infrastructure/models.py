"""Modelo ORM de las postulaciones (tabla `shift_applications`)."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    false,
    func,
    true,
)
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
        # El motivo va con una postulación desasignada, y sólo con ella (G4).
        CheckConstraint(
            "(status = 'desasignada') = (motivo IS NOT NULL)",
            name="ck_shift_applications_motivo_desasignada",
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
    # `MotivoDesasignacion`: por qué dejó el turno quien lo tenía asignado.
    motivo: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Falso sólo en la fila creada para quien fue asignado sin postularse y
    # dejó el turno: no cuenta como postulación suya (privacidad, métricas).
    se_postulo: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    # Carril urgente (ADR-0032): reconocimiento «Puedo ir ya» guardado al postular.
    se_ofrecio_para_ya: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
