"""Entidades del dominio de verificación de identidad: `Claim` y `Evidence`.

Formaliza la diferencia central del modelo (ADR-0010 §2):

- **Claim** — la *afirmación* auditable sobre el sujeto ("documento
  verificado"). Es lo que el resto del sistema consulta; no expone datos
  sensibles. Es la raíz del agregado.
- **Evidence** — la *prueba* concreta que respalda el claim (imagen del DNI,
  selfie). Registra método/verificador/fecha. Su dato sensible (`data_url`) se
  **borra tras la decisión** (retención, ADR-0010 §4).

La máquina de estados (NO_PRESENTADA → PENDIENTE → VERIFICADA/RECHAZADA, con
reenvío) se reutiliza de la v1 stasheada, pero reubicada a nivel de claim en
vez de vivir sobre `WorkerProfile`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.verification.domain.exceptions import (
    ClaimAlreadyVerifiedError,
    ClaimNotPendingError,
    EvidenceRequiredError,
)
from app.modules.verification.domain.value_objects import (
    ClaimStatus,
    ClaimType,
    ConfidenceLevel,
    EvidenceType,
    VerificationMethod,
)


@dataclass
class Evidence:
    """Una prueba que respalda un claim.

    `data_url` es el puntero al archivo sensible (imagen del DNI/selfie). Es
    `None` cuando la evidencia todavía no se cargó o —lo importante— cuando ya
    **se purgó tras la decisión**: en ese caso la fila queda como constancia de
    auditoría (tipo, método, quién/cuándo) pero sin el dato sensible.
    """

    evidence_type: EvidenceType
    method: VerificationMethod = VerificationMethod.ADMIN_MANUAL
    data_url: str | None = None
    data_purged: bool = False
    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None

    def purge_data(self) -> None:
        """Borra el puntero al dato sensible dejando la constancia (retención)."""
        self.data_url = None
        self.data_purged = True


@dataclass
class Claim:
    """Afirmación auditable sobre la identidad del sujeto, respaldada por 1..N
    evidencias. Raíz del agregado: las evidencias se manipulan a través suyo."""

    user_id: UUID
    claim_type: ClaimType
    status: ClaimStatus = ClaimStatus.NO_PRESENTADA
    confidence: ConfidenceLevel | None = None
    method: VerificationMethod | None = None
    evidences: list[Evidence] = field(default_factory=list)
    submitted_at: datetime | None = None
    decided_at: datetime | None = None
    reviewed_by: UUID | None = None
    rejection_reason: str | None = None
    expires_at: datetime | None = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @property
    def is_verified(self) -> bool:
        return self.status == ClaimStatus.VERIFICADA

    @property
    def is_pending(self) -> bool:
        return self.status == ClaimStatus.PENDIENTE

    def submit(
        self,
        evidences: list[Evidence],
        method: VerificationMethod,
        now: datetime,
    ) -> None:
        """El sujeto presenta (o reenvía) evidencia y el claim pasa a PENDIENTE.

        Permitido desde NO_PRESENTADA, RECHAZADA o PENDIENTE (reenvío que
        reemplaza las evidencias anteriores). Si ya está VERIFICADA no tiene
        sentido reenviar. Se exige al menos una evidencia con dato cargado."""
        if self.status == ClaimStatus.VERIFICADA:
            raise ClaimAlreadyVerifiedError(str(self.user_id))
        if not evidences or all(e.data_url is None for e in evidences):
            raise EvidenceRequiredError(str(self.claim_type))
        self.evidences = evidences
        self.method = method
        self.status = ClaimStatus.PENDIENTE
        self.submitted_at = now
        # Reenvío: se limpia la decisión anterior.
        self.decided_at = None
        self.reviewed_by = None
        self.rejection_reason = None
        self.confidence = None

    def approve(
        self,
        reviewed_by: UUID,
        now: datetime,
        confidence: ConfidenceLevel = ConfidenceLevel.MEDIA,
    ) -> None:
        """Un verificador aprueba el claim pendiente. Purga la evidencia
        sensible dejando la constancia (retención, ADR-0010 §4)."""
        if not self.is_pending:
            raise ClaimNotPendingError(str(self.claim_type))
        self.status = ClaimStatus.VERIFICADA
        self.confidence = confidence
        self.decided_at = now
        self.reviewed_by = reviewed_by
        self.rejection_reason = None
        self._purge_evidence_data()

    def reject(
        self, reviewed_by: UUID, reason: str | None, now: datetime
    ) -> None:
        """Un verificador rechaza el claim pendiente. También purga la
        evidencia sensible: ya cumplió su finalidad (se decidió)."""
        if not self.is_pending:
            raise ClaimNotPendingError(str(self.claim_type))
        self.status = ClaimStatus.RECHAZADA
        self.confidence = None
        self.decided_at = now
        self.reviewed_by = reviewed_by
        self.rejection_reason = reason
        self._purge_evidence_data()

    def _purge_evidence_data(self) -> None:
        for evidence in self.evidences:
            evidence.purge_data()
