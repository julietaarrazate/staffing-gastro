"""Schemas Pydantic del módulo de verificación de identidad.

Regla de no-disclosure: la respuesta del propio estado de identidad
(`IdentitySummaryResponse`) **nunca** incluye punteros a evidencias (DNI/selfie).
Desde el ADR-0021 tampoco la cola del admin: los archivos son privados y el
admin pide un link que vence por evidencia (`EvidenceLinkResponse`).
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.cloudinary import FOLDERS
from app.modules.verification.domain.value_objects import (
    AssuranceLevel,
    ClaimStatus,
    ClaimType,
    ConfidenceLevel,
    EvidenceFile,
    EvidenceType,
)

# El `public_id` lo decide el servidor al firmar (128 bits al azar, en hex)
# dentro de la carpeta del flujo. Según el modo de carpetas de la cuenta de
# Cloudinary, la respuesta de la subida lo trae con la carpeta adelante o sin
# ella: se aceptan las dos formas, y nada más.
_HEX_ID = r"[0-9a-f]{32}"


class _EvidenceFileInput(BaseModel):
    """Lo que devuelve Cloudinary al subir un archivo privado (ADR-0021).
    No es una URL: con esto el servidor arma después el link que vence."""

    public_id: str
    resource_type: Literal["image", "raw"] = "image"
    format: str = Field(default="", pattern=r"^[a-z0-9]{0,10}$")
    type: Literal["private"] = "private"

    def to_domain(self) -> EvidenceFile:
        return EvidenceFile(
            public_id=self.public_id,
            resource_type=self.resource_type,
            format=self.format,
            delivery_type=self.type,
        )


class IdentityFileInput(_EvidenceFileInput):
    """DNI o selfie: tiene que estar en la carpeta de identidad."""

    public_id: str = Field(
        pattern=rf"^({FOLDERS['identity']}/)?{_HEX_ID}$", max_length=255
    )


class BusinessFileInput(_EvidenceFileInput):
    """Constancia de AFIP: tiene que estar en la carpeta de constancias."""

    public_id: str = Field(
        pattern=rf"^({FOLDERS['business_document']}/)?{_HEX_ID}$", max_length=255
    )


class SubmitIdentityDocumentInput(BaseModel):
    """El trabajador envía su DNI + selfie a revisión (archivos privados)."""

    dni_frente: IdentityFileInput
    selfie: IdentityFileInput
    dni_dorso: IdentityFileInput | None = None


class SubmitBusinessDocumentInput(BaseModel):
    """El comercio envía su constancia de inscripción de AFIP (ADR-0013).

    Un solo campo, y a propósito: NO se pide el número de CUIT. No hay
    ninguna funcionalidad que lo necesite, y en un monotributista está atado
    a su DNI — o sea que sería dato personal guardado sin uso, sólo porque
    pasó por delante (ADR-0013 §3)."""

    constancia: BusinessFileInput


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
    """Una evidencia de la cola, sin URL (ADR-0021): para verla, el admin
    pide `GET /identity/evidences/{evidence_id}/link`."""

    evidence_id: UUID
    evidence_type: EvidenceType
    available: bool


class EvidenceLinkResponse(BaseModel):
    """Link para ver una evidencia. Vence en `expires_at` (5 minutos);
    `null` sólo en evidencias viejas todavía públicas."""

    url: str
    expires_at: datetime | None = None


class PendingClaimResponse(BaseModel):
    """Ítem de la cola de revisión del admin (qué evidencias hay, sin URLs)."""

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
