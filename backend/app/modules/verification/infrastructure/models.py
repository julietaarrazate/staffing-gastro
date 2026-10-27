"""Modelos ORM del dominio de verificación de identidad (ADR-0010).

Tablas que reflejan la separación Claim/Evidence:
- `identity_claims`: las afirmaciones auditables (lo que persiste como
  constancia). Un claim por tipo y por usuario.
- `identity_evidences`: las pruebas. Su puntero al archivo (DNI/selfie,
  constancia) se pone en `NULL` tras la decisión (retención): la fila queda
  como auditoría pero sin el dato sensible.
- `identity_evidence_file_deletions`: la cola de archivos que hay que borrar
  del storage (ADR-0021 «Borrado al decidir»). El puntero pasa de la
  evidencia a esta tabla en el mismo commit, y la fila se borra cuando
  Cloudinary confirma.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
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
    # Puntero VIEJO al archivo sensible: URL pública, sólo en evidencias
    # subidas antes del ADR-0021 que todavía no pasaron por
    # `scripts/privatize_identity_evidence.py`. NULL en las nuevas y cuando se
    # purgó tras la decisión.
    data_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Puntero al archivo PRIVADO en Cloudinary (ADR-0021). No es una URL: para
    # verlo hay que pedir un link que vence. NULL cuando se purgó.
    file_public_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_resource_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
    file_format: Mapped[str | None] = mapped_column(String(10), nullable=True)
    file_delivery_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    data_purged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class EvidenceFileDeletionModel(Base):
    """Un archivo de evidencia pendiente de borrar en Cloudinary (ADR-0021).

    Sin FK al claim ni a la evidencia a propósito: si el claim o la cuenta
    se borran, el archivo igual se tiene que borrar."""

    __tablename__ = "identity_evidence_file_deletions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    public_id: Mapped[str] = mapped_column(String(255), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(10), nullable=False)
    file_format: Mapped[str] = mapped_column(String(10), nullable=False, default="")
    delivery_type: Mapped[str] = mapped_column(String(20), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    next_attempt_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
