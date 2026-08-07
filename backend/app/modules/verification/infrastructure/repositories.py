"""Adaptador SQLAlchemy de `ClaimRepository`.

Mapea el agregado `Claim` (con sus `Evidence`) a/desde las tablas
`identity_claims` / `identity_evidences`.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.verification.domain.entities import Claim, Evidence
from app.modules.verification.domain.repositories import ClaimRepository
from app.modules.verification.domain.value_objects import (
    ClaimStatus,
    ClaimType,
    ConfidenceLevel,
    EvidenceType,
    VerificationMethod,
)
from app.modules.verification.infrastructure.models import (
    IdentityClaimModel,
    IdentityEvidenceModel,
)


def _evidence_to_entity(model: IdentityEvidenceModel) -> Evidence:
    return Evidence(
        id=model.id,
        evidence_type=EvidenceType(model.evidence_type),
        method=VerificationMethod(model.method),
        data_url=model.data_url,
        data_purged=model.data_purged,
        created_at=model.created_at,
    )


def _to_entity(model: IdentityClaimModel) -> Claim:
    return Claim(
        id=model.id,
        user_id=model.user_id,
        claim_type=ClaimType(model.claim_type),
        status=ClaimStatus(model.status),
        confidence=ConfidenceLevel(model.confidence) if model.confidence else None,
        method=VerificationMethod(model.method) if model.method else None,
        evidences=[_evidence_to_entity(e) for e in model.evidences],
        submitted_at=model.submitted_at,
        decided_at=model.decided_at,
        reviewed_by=model.reviewed_by,
        rejection_reason=model.rejection_reason,
        expires_at=model.expires_at,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _apply_claim_fields(model: IdentityClaimModel, claim: Claim) -> None:
    model.status = claim.status.value
    model.confidence = claim.confidence.value if claim.confidence else None
    model.method = claim.method.value if claim.method else None
    model.submitted_at = claim.submitted_at
    model.decided_at = claim.decided_at
    model.reviewed_by = claim.reviewed_by
    model.rejection_reason = claim.rejection_reason
    model.expires_at = claim.expires_at


def _sync_evidences(model: IdentityClaimModel, claim: Claim) -> None:
    """Reemplaza las evidencias del modelo por las de la entidad (delete-orphan
    se encarga de borrar las que ya no están: p. ej. un reenvío)."""
    model.evidences = [
        IdentityEvidenceModel(
            id=evidence.id,
            claim_id=claim.id,
            evidence_type=evidence.evidence_type.value,
            method=evidence.method.value,
            data_url=evidence.data_url,
            data_purged=evidence.data_purged,
        )
        for evidence in claim.evidences
    ]


class SqlAlchemyClaimRepository(ClaimRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, claim: Claim) -> Claim:
        model = IdentityClaimModel(
            id=claim.id, user_id=claim.user_id, claim_type=claim.claim_type.value
        )
        _apply_claim_fields(model, claim)
        _sync_evidences(model, claim)
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def update(self, claim: Claim) -> Claim:
        model = await self._session.get(IdentityClaimModel, claim.id)
        if model is None:
            raise ValueError("El claim no existe")
        _apply_claim_fields(model, claim)
        _sync_evidences(model, claim)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def get_by_id(self, claim_id: UUID) -> Claim | None:
        model = await self._session.get(IdentityClaimModel, claim_id)
        return _to_entity(model) if model else None

    async def get_for_user(
        self, user_id: UUID, claim_type: ClaimType
    ) -> Claim | None:
        stmt = select(IdentityClaimModel).where(
            IdentityClaimModel.user_id == user_id,
            IdentityClaimModel.claim_type == claim_type.value,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_entity(model) if model else None

    async def list_for_user(self, user_id: UUID) -> list[Claim]:
        stmt = select(IdentityClaimModel).where(IdentityClaimModel.user_id == user_id)
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_pending(self) -> list[Claim]:
        stmt = (
            select(IdentityClaimModel)
            .where(IdentityClaimModel.status == ClaimStatus.PENDIENTE.value)
            .order_by(IdentityClaimModel.submitted_at)
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def verified_user_ids(
        self, user_ids: list[UUID], claim_type: ClaimType
    ) -> set[UUID]:
        if not user_ids:
            return set()
        stmt = select(IdentityClaimModel.user_id).where(
            IdentityClaimModel.user_id.in_(user_ids),
            IdentityClaimModel.claim_type == claim_type.value,
            IdentityClaimModel.status == ClaimStatus.VERIFICADA.value,
        )
        result = await self._session.execute(stmt)
        return {row[0] for row in result.all()}
