"""Modelos ORM del dominio de verificación de identidad (ADR-0010).

Dos tablas que reflejan la separación Claim/Evidence:
- `identity_claims`: las afirmaciones auditables (lo que persiste como
  constancia). Un claim por tipo y por usuario.
- `identity_evidences`: las pruebas. Su `data_url` (puntero al DNI/selfie) se
  pone en `NULL` tras la decisión (retención): la fila queda como auditoría
  pero sin el dato sensible.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.types import GUID
from app.modules.verification.domain.value_objects import ClaimStatus


class IdentityClaimModel(Base):
    __tablename__ = "identity_claims"
    __table_args__ = (
        UniqueConstraint("user_id", "claim_type", name="uq_identity_claim_user_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    claim_type: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=ClaimStatus.NO_PRESENTADA.value
    )
    confidence: Mapped[str | None] = mapped_column(String(10), nullable=True)
    method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Quién decidió (admin en F1). SET NULL para no perder el claim si se borra
    # la cuenta del revisor.
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    evidences: Mapped[list["IdentityEvidenceModel"]] = relationship(
        "IdentityEvidenceModel",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="IdentityEvidenceModel.created_at",
    )


class IdentityEvidenceModel(Base):
    __tablename__ = "identity_evidences"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    claim_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("identity_claims.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    evidence_type: Mapped[str] = mapped_column(String(20), nullable=False)
    method: Mapped[str] = mapped_column(String(20), nullable=False)
    # Puntero al archivo sensible. NULL cuando se purgó tras la decisión.
    data_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    data_purged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
