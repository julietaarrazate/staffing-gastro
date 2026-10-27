"""Entidades del dominio de verificación de identidad: `Claim` y `Evidence`.

Formaliza la diferencia central del modelo (ADR-0010 §2):

- **Claim** — la *afirmación* auditable sobre el sujeto ("documento
  verificado"). Es lo que el resto del sistema consulta; no expone datos
  sensibles. Es la raíz del agregado.
- **Evidence** — la *prueba* concreta que respalda el claim (imagen del DNI,
  selfie). Registra método/verificador/fecha. Su dato sensible (`file`) se
  **borra tras la decisión** (retención, ADR-0010 §4): el puntero sale de la
  evidencia y el archivo pasa a la cola de borrado (`EvidenceFileDeletion`,
  ADR-0021), que lo borra del storage.

La máquina de estados (NO_PRESENTADA → PENDIENTE → VERIFICADA/RECHAZADA, con
reenvío) se reutiliza de la v1 stasheada, pero reubicada a nivel de claim en
vez de vivir sobre `WorkerProfile`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
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
    EvidenceFile,
    EvidenceType,
    VerificationMethod,
)


@dataclass
class Evidence:
    """Una prueba que respalda un claim.

    `file` es el puntero al archivo sensible (imagen del DNI/selfie, PDF de la
    constancia), guardado **privado** (ADR-0021). `data_url` es el puntero
    viejo: una URL pública, que sólo tienen las evidencias subidas antes del
    ADR-0021 hasta que corre `scripts/privatize_identity_evidence.py`.

    Los dos son `None` cuando la evidencia todavía no se cargó o —lo
    importante— cuando ya **se purgó tras la decisión**: en ese caso la fila
    queda como constancia de auditoría (tipo, método, quién/cuándo) pero sin
    el dato sensible.
    """

    evidence_type: EvidenceType
    method: VerificationMethod = VerificationMethod.ADMIN_MANUAL
    data_url: str | None = None
    file: EvidenceFile | None = None
    data_purged: bool = False
    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None

    @property
    def has_data(self) -> bool:
        return self.file is not None or self.data_url is not None

    def purge_data(self) -> EvidenceFile | None:
        """Borra el puntero al dato sensible dejando la constancia (retención).

        Devuelve el archivo que apuntaba, para que el claim lo mande a borrar
        del storage (ADR-0021): olvidar el puntero no borra el archivo. Una
        evidencia vieja con `data_url` (antes del ADR-0021) no devuelve nada:
        su archivo queda huérfano en la carpeta y lo borra
        `scripts/privatize_identity_evidence.py`."""
        released = self.file
        self.data_url = None
        self.file = None
        self.data_purged = True
        return released


# Reintentos del borrado de un archivo cuando el storage falla (ADR-0021):
# 15 min, 30 min, 1 h, 2 h… y después una vez por día, sin rendirse nunca.
# El techo es por la cuota de Neon: un reintento despierta la base, y un
# Cloudinary mal configurado no puede tenerla despierta todo el día.
FILE_DELETION_FIRST_RETRY = timedelta(minutes=15)
FILE_DELETION_MAX_RETRY = timedelta(hours=24)


@dataclass
class EvidenceFileDeletion:
    """Un archivo de evidencia que hay que borrar del storage (ADR-0021).

    Al decidir un claim (o al reemplazar sus evidencias con un reenvío), el
    puntero sale de la evidencia y queda acá, **en el mismo commit**: la
    referencia no se pierde aunque el storage falle o tarde, y la decisión
    del admin no lo espera. Se borra después de responder; si falla, el
    scheduler reintenta (`next_attempt_at`). Recién cuando el storage
    confirma (o dice que el archivo ya no existe) se olvida la referencia.

    No cuelga del claim en la base: si el claim o la cuenta desaparecen, el
    archivo igual se tiene que borrar."""

    file: EvidenceFile
    requested_at: datetime
    next_attempt_at: datetime
    attempts: int = 0
    last_error: str | None = None
    id: UUID = field(default_factory=uuid4)

    @classmethod
    def request(cls, file: EvidenceFile, now: datetime) -> EvidenceFileDeletion:
        return cls(file=file, requested_at=now, next_attempt_at=now)

    def record_failure(self, error: str, now: datetime) -> None:
        """El storage no pudo borrarlo: se reintenta más tarde, cada vez más
        espaciado (ver `FILE_DELETION_FIRST_RETRY`)."""
        self.attempts += 1
        self.last_error = error[:500]
        delay = FILE_DELETION_FIRST_RETRY * 2 ** min(self.attempts - 1, 7)
        self.next_attempt_at = now + min(delay, FILE_DELETION_MAX_RETRY)


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
    # Salida de `approve`/`reject`/`submit`: los archivos que esta operación
    # manda a borrar. El repositorio los guarda en la cola de borrado en el
    # mismo commit que el claim (ADR-0021). No se lee de la base.
    files_to_delete: list[EvidenceFileDeletion] = field(
        default_factory=list, compare=False, repr=False
    )

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
        sentido reenviar. Se exige al menos una evidencia con dato cargado.

        Un reenvío estando PENDIENTE reemplaza archivos que nadie va a
        revisar: van a la cola de borrado igual que al decidir (ADR-0021).
        Desde RECHAZADA ya se habían mandado a borrar al rechazar."""
        if self.status == ClaimStatus.VERIFICADA:
            raise ClaimAlreadyVerifiedError(str(self.user_id))
        if not evidences or not any(e.has_data for e in evidences):
            raise EvidenceRequiredError(str(self.claim_type))
        self._purge_evidence_data(now)
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
        sensible dejando la constancia (retención, ADR-0010 §4) y manda sus
        archivos a borrar (ADR-0021)."""
        if not self.is_pending:
            raise ClaimNotPendingError(str(self.claim_type))
        self.status = ClaimStatus.VERIFICADA
        self.confidence = confidence
        self.decided_at = now
        self.reviewed_by = reviewed_by
        self.rejection_reason = None
        self._purge_evidence_data(now)

    def reject(
        self, reviewed_by: UUID, reason: str | None, now: datetime
    ) -> None:
        """Un verificador rechaza el claim pendiente. También purga la
        evidencia sensible y manda sus archivos a borrar: ya cumplió su
        finalidad (se decidió)."""
        if not self.is_pending:
            raise ClaimNotPendingError(str(self.claim_type))
        self.status = ClaimStatus.RECHAZADA
        self.confidence = None
        self.decided_at = now
        self.reviewed_by = reviewed_by
        self.rejection_reason = reason
        self._purge_evidence_data(now)

    def _purge_evidence_data(self, now: datetime) -> None:
        for evidence in self.evidences:
            released = evidence.purge_data()
            if released is not None:
                self.files_to_delete.append(
                    EvidenceFileDeletion.request(released, now)
                )
