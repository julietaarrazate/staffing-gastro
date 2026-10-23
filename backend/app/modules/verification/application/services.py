"""Casos de uso del dominio de verificación de identidad (ADR-0010).

Orquesta sobre el puerto `ClaimRepository`. En F1 el único método de
verificación es `admin_manual`: el trabajador presenta DNI + selfie
(`documento_verificado`) y un admin lo aprueba o rechaza. El nivel de garantía
resultante se calcula agregando los claims (dominio puro).
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.modules.verification.application.dtos import (
    ClaimSummary,
    EvidenceLink,
    IdentitySummary,
    PendingClaimItem,
    PendingEvidenceItem,
)
from app.modules.verification.domain.entities import Claim, Evidence
from app.modules.verification.domain.exceptions import (
    ClaimNotFoundError,
    EvidenceNotFoundError,
)
from app.modules.verification.domain.repositories import (
    ClaimRepository,
    EvidenceLinkSigner,
)
from app.modules.verification.domain.services import (
    compute_assurance_level,
    has_verified_identity,
)
from app.modules.verification.domain.value_objects import (
    ClaimType,
    EvidenceFile,
    EvidenceType,
    VerificationMethod,
)

# Cuánto dura el link de una evidencia privada (ADR-0021).
EVIDENCE_LINK_TTL = timedelta(minutes=5)


def _now() -> datetime:
    """Timestamp de auditoría en UTC (constancia de la decisión: las fechas de auditoría van en UTC a propósito, distinto de las de negocio)."""
    return datetime.now(timezone.utc)


class VerificationService:
    def __init__(
        self,
        claims: ClaimRepository,
        link_signer: EvidenceLinkSigner | None = None,
    ) -> None:
        self._claims = claims
        self._link_signer = link_signer

    async def submit_identity_document(
        self,
        user_id: UUID,
        dni_frente: EvidenceFile,
        selfie: EvidenceFile,
        dni_dorso: EvidenceFile | None = None,
    ) -> Claim:
        """El trabajador presenta (o reenvía) su DNI + selfie a revisión.

        Modela un claim `documento_verificado` respaldado por las evidencias
        DNI (frente, y dorso opcional) + selfie. Idempotente sobre el tipo de
        claim: si ya existe uno para el usuario, se reenvía sobre él."""
        evidences = [
            Evidence(
                evidence_type=EvidenceType.DNI_FRENTE,
                method=VerificationMethod.ADMIN_MANUAL,
                file=dni_frente,
            ),
            Evidence(
                evidence_type=EvidenceType.SELFIE,
                method=VerificationMethod.ADMIN_MANUAL,
                file=selfie,
            ),
        ]
        if dni_dorso:
            evidences.insert(
                1,
                Evidence(
                    evidence_type=EvidenceType.DNI_DORSO,
                    method=VerificationMethod.ADMIN_MANUAL,
                    file=dni_dorso,
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

    async def submit_business_document(
        self, user_id: UUID, constancia: EvidenceFile
    ) -> Claim:
        """El comercio presenta (o reenvía) su constancia de AFIP a revisión
        (ADR-0013).

        Es el mismo caso de uso que `submit_identity_document` con otro tipo
        de claim y otra evidencia — el agregado `Claim` ya es genérico por
        `claim_type`, así que no hay nada que redominar: el sujeto sigue
        siendo un `User` (el dueño del comercio), y la máquina de estados,
        la purga de evidencia y la cola del admin se reusan tal cual.

        `user_id` es `CompanyProfile.user_id`, no el id del perfil: el claim
        cuelga del usuario dueño. Es la parte que más fácil se hace mal (ver
        ADR-0013 §4)."""
        evidences = [
            Evidence(
                evidence_type=EvidenceType.CONSTANCIA_CUIT,
                method=VerificationMethod.ADMIN_MANUAL,
                file=constancia,
            )
        ]

        claim = await self._claims.get_for_user(user_id, ClaimType.NEGOCIO_VERIFICADO)
        is_new = claim is None
        if claim is None:
            claim = Claim(user_id=user_id, claim_type=ClaimType.NEGOCIO_VERIFICADO)

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
        """Cola de revisión del admin. Dice qué evidencias hay, pero no dónde
        están: para verlas, `evidence_link` (ADR-0021)."""
        claims = await self._claims.list_pending()
        return [
            PendingClaimItem(
                claim_id=claim.id,
                user_id=claim.user_id,
                claim_type=claim.claim_type,
                submitted_at=claim.submitted_at,
                evidences=[
                    PendingEvidenceItem(
                        evidence_id=e.id,
                        evidence_type=e.evidence_type,
                        available=e.has_data,
                    )
                    for e in claim.evidences
                ],
            )
            for claim in claims
        ]

    async def evidence_link(
        self, evidence_id: UUID, now: datetime | None = None
    ) -> EvidenceLink:
        """Link para que el admin vea una evidencia mientras revisa (ADR-0021).

        Sólo para claims PENDIENTES con el dato todavía cargado: una vez
        decidido el claim, la evidencia ya cumplió su finalidad y no se
        vuelve a mirar. Ajena, inexistente o purgada responden igual
        (`EvidenceNotFoundError`), para no revelar qué existe.

        Archivo privado → link firmado que vence en `EVIDENCE_LINK_TTL`.
        Evidencia vieja todavía pública (antes de correr la migración) → su
        URL tal cual, para que el admin no quede ciego entre el deploy y la
        migración."""
        claim = await self._claims.get_by_evidence_id(evidence_id)
        if claim is None or not claim.is_pending:
            raise EvidenceNotFoundError(str(evidence_id))
        evidence = next((e for e in claim.evidences if e.id == evidence_id), None)
        if evidence is None or not evidence.has_data:
            raise EvidenceNotFoundError(str(evidence_id))
        if evidence.file is None:
            return EvidenceLink(url=str(evidence.data_url), expires_at=None)
        if self._link_signer is None:
            raise RuntimeError("VerificationService sin EvidenceLinkSigner")
        expires_at = (now or _now()) + EVIDENCE_LINK_TTL
        return EvidenceLink(
            url=self._link_signer.link_for(evidence.file, expires_at),
            expires_at=expires_at,
        )

    async def verified_user_ids(self, user_ids: list[UUID]) -> set[UUID]:
        """De los `user_ids` dados, cuáles tienen la identidad verificada
        (documento verificado = L2+). Para que perfil público y cola de
        candidatos muestren "Identidad verificada" sin exponer evidencias."""
        return await self._claims.verified_user_ids(
            user_ids, ClaimType.DOCUMENTO_VERIFICADO
        )

    async def verified_business_user_ids(self, user_ids: list[UUID]) -> set[UUID]:
        """Igual que `verified_user_ids` pero para el claim de NEGOCIO — sujeto
        distinto (`CompanyProfile.user_id`, no un trabajador). Para que el feed
        del trabajador pueda mostrar "Comercio verificado" (ADR-0011) sin
        mezclar el claim de negocio con el de persona."""
        return await self._claims.verified_user_ids(
            user_ids, ClaimType.NEGOCIO_VERIFICADO
        )

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
