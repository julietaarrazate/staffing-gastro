"""Schemas Pydantic del módulo de verificación de identidad.

Regla de no-disclosure: la respuesta del propio estado de identidad
(`IdentitySummaryResponse`) **nunca** incluye punteros a evidencias (DNI/selfie).
Las URLs sólo aparecen en la cola de revisión del admin
(`PendingClaimResponse`), mientras el claim está pendiente.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.verification.domain.value_objects import (
    AssuranceLevel,
    ClaimStatus,
    ClaimType,
    ConfidenceLevel,
    EvidenceType,
)


class SubmitIdentityDocumentInput(BaseModel):
    """El trabajador envía su DNI + selfie a revisión."""

    dni_frente_url: str = Field(min_length=1, max_length=512)
    selfie_url: str = Field(min_length=1, max_length=512)
    dni_dorso_url: str | None = Field(default=None, max_length=512)


class SubmitBusinessDocumentInput(BaseModel):
    """El comercio envía su constancia de inscripción de AFIP (ADR-0013).

    Un solo campo, y a propósito: NO se pide el número de CUIT. No hay
    ninguna funcionalidad que lo necesite, y en un monotributista está atado
    a su DNI — o sea que sería dato personal guardado sin uso, sólo porque
    pasó por delante (ADR-0013 §3)."""

    constancia_url: str = Field(min_length=1, max_length=512)


class RejectClaimInput(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class ClaimSummaryResponse(BaseModel):
    claim_type: ClaimType
    status: ClaimStatus
    confidence: ConfidenceLevel | None = None
    decided_at: datetime | None = None
    rejection_reason: str | None = None


class IdentitySummaryResponse(BaseModel):
    """Lo que ve el propio usuario / un comercio: nivel agregado + flag, sin PII."""

    user_id: UUID
    assurance_level: AssuranceLevel
    identidad_verificada: bool
    claims: list[ClaimSummaryResponse]


class ReminderSentResponse(BaseModel):
    sent: bool


class PendingEvidenceResponse(BaseModel):
    evidence_type: EvidenceType
    data_url: str | None = None


class PendingClaimResponse(BaseModel):
    """Ítem de la cola de revisión del admin (incluye URLs de evidencia)."""

    claim_id: UUID
    user_id: UUID
    claim_type: ClaimType
    full_name: str | None = None
    # Sólo para claims de negocio (ADR-0013): el nombre que el comercio cargó
    # en la app, para que el admin pueda compararlo contra la razón social de
    # la constancia. Sin esto no puede hacer la única comprobación que importa
    # — que el papel corresponda al comercio que lo mandó.
    company_name: str | None = None
    submitted_at: datetime | None = None
    evidences: list[PendingEvidenceResponse]
