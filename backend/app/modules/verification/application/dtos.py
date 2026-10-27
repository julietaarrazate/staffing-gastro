"""DTOs de la capa de aplicación de verificación de identidad.

Separan lo que la app devuelve de las entidades de dominio y de los schemas
HTTP. En particular, `IdentitySummary` es lo que ve el propio usuario / un
comercio: nunca incluye punteros a evidencias (DNI/selfie)."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.modules.verification.domain.value_objects import (
    AssuranceLevel,
    ClaimStatus,
    ClaimType,
    ConfidenceLevel,
    EvidenceType,
)


@dataclass
class ClaimSummary:
    claim_type: ClaimType
    status: ClaimStatus
    confidence: ConfidenceLevel | None
    decided_at: datetime | None
    rejection_reason: str | None


@dataclass
class IdentitySummary:
    """Estado de identidad de un sujeto. Sin datos sensibles: sólo el nivel de
    garantía agregado, el flag visible y el estado de cada claim."""

    user_id: UUID
    assurance_level: AssuranceLevel
    identidad_verificada: bool
    claims: list[ClaimSummary]


@dataclass
class PendingEvidenceItem:
    """Evidencia de la cola del admin. Sin URL (ADR-0021): el admin pide un
    link que vence con `evidence_id` (`VerificationService.evidence_link`)."""

    evidence_id: UUID
    evidence_type: EvidenceType
    available: bool


@dataclass
class EvidenceLink:
    """Link para ver una evidencia. `expires_at` es `None` sólo para las
    evidencias viejas todavía públicas (antes de correr la migración)."""

    url: str
    expires_at: datetime | None


@dataclass
class PendingClaimItem:
    claim_id: UUID
    user_id: UUID
    claim_type: ClaimType
    submitted_at: datetime | None
    evidences: list[PendingEvidenceItem]


@dataclass
class FileCleanupReport:
    """Resultado de una pasada de `EvidenceFileCleaner` (ADR-0021).
    `next_attempt_at` es cuándo toca el próximo reintento, si queda algo."""

    deleted: int
    failed: int
    next_attempt_at: datetime | None
