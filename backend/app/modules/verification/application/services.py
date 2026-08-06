"""Casos de uso del dominio de verificación de identidad (ADR-0010).

Orquesta sobre el puerto `ClaimRepository`. En F1 el único método de
verificación es `admin_manual`: el trabajador presenta DNI + selfie
(`documento_verificado`) y un admin lo aprueba o rechaza. El nivel de garantía
resultante se calcula agregando los claims (dominio puro).
"""

from datetime import datetime, timezone
from uuid import UUID

from app.modules.verification.application.dtos import (
    ClaimSummary,
    IdentitySummary,
    PendingClaimItem,
    PendingEvidenceItem,
)
from app.modules.verification.domain.entities import Claim, Evidence
from app.modules.verification.domain.exceptions import ClaimNotFoundError
from app.modules.verification.domain.repositories import ClaimRepository
from app.modules.verification.domain.services import (
    compute_assurance_level,
    has_verified_identity,
)
from app.modules.verification.domain.value_objects import (
    ClaimType,
    EvidenceType,
    VerificationMethod,
)


def _now() -> datetime:
    """Timestamp de auditoría en UTC (constancia de la decisión, ver CLAUDE.md:
    las fechas de auditoría van en UTC a propósito, distinto de las de negocio)."""
    return datetime.now(timezone.utc)


class VerificationService:
    def __init__(self, claims: ClaimRepository) -> None:
        self._claims = claims

    async def submit_identity_document(
        self,
        user_id: UUID,
        dni_frente_url: str,
        selfie_url: str,
        dni_dorso_url: str | None = None,
    ) -> Claim:
        """El trabajador presenta (o reenvía) su DNI + selfie a revisión.

        Modela un claim `documento_verificado` respaldado por las evidencias
        DNI (frente, y dorso opcional) + selfie. Idempotente sobre el tipo de
        claim: si ya existe uno para el usuario, se reenvía sobre él."""
        evidences = [
            Evidence(
                evidence_type=EvidenceType.DNI_FRENTE,
                method=VerificationMethod.ADMIN_MANUAL,
                data_url=dni_frente_url,
            ),
            Evidence(
                evidence_type=EvidenceType.SELFIE,
                method=VerificationMethod.ADMIN_MANUAL,
                data_url=selfie_url,
            ),
        ]
        if dni_dorso_url:
            evidences.insert(
                1,
                Evidence(
                    evidence_type=EvidenceType.DNI_DORSO,
                    method=VerificationMethod.ADMIN_MANUAL,
                    data_url=dni_dorso_url,
                ),
            )

        claim = await self._claims.get_for_user(
            user_id, ClaimType.DOCUMENTO_VERIFICADO
        )
        is_new = claim is None
        if claim is None:
            claim = Claim(user_id=user_id, claim_type=ClaimType.DOCUMENTO_VERIFICADO)

        claim.submit(evidences, VerificationMethod.ADMIN_MANUAL, _now())
        return await (self._claims.add(claim) if is_new else self._claims.update(claim))

    async def approve_claim(self, claim_id: UUID, admin_id: UUID) -> Claim:
        """Un admin aprueba un claim pendiente (purga la evidencia sensible)."""
        claim = await self._claims.get_by_id(claim_id)
        if claim is None:
            raise ClaimNotFoundError(str(claim_id))
        claim.approve(admin_id, _now())
        return await self._claims.update(claim)

    async def reject_claim(
        self, claim_id: UUID, admin_id: UUID, reason: str | None
    ) -> Claim:
        """Un admin rechaza un claim pendiente (purga la evidencia sensible)."""
        claim = await self._claims.get_by_id(claim_id)
        if claim is None:
            raise ClaimNotFoundError(str(claim_id))
        claim.reject(admin_id, reason, _now())
        return await self._claims.update(claim)

    async def list_pending(self) -> list[PendingClaimItem]:
        """Cola de revisión del admin. Incluye los punteros a evidencias
        (visibles sólo acá, mientras el claim está pendiente)."""
        claims = await self._claims.list_pending()
        return [
            PendingClaimItem(
                claim_id=claim.id,
                user_id=claim.user_id,
                claim_type=claim.claim_type,
                submitted_at=claim.submitted_at,
                evidences=[
                    PendingEvidenceItem(
                        evidence_type=e.evidence_type, data_url=e.data_url
                    )
                    for e in claim.evidences
                ],
            )
            for claim in claims
        ]

    async def get_identity_summary(self, user_id: UUID) -> IdentitySummary:
        """Estado de identidad del sujeto (sin datos sensibles): nivel de
        garantía + flag visible + estado de cada claim."""
        claims = await self._claims.list_for_user(user_id)
        return IdentitySummary(
            user_id=user_id,
            assurance_level=compute_assurance_level(claims),
            identidad_verificada=has_verified_identity(claims),
            claims=[
                ClaimSummary(
                    claim_type=c.claim_type,
                    status=c.status,
                    confidence=c.confidence,
                    decided_at=c.decided_at,
                    rejection_reason=c.rejection_reason,
                )
                for c in claims
            ],
        )
