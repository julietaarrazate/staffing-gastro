"""Reglas puras de dominio: agregación de claims → nivel de garantía.

Función pura, sin DB ni frameworks (mismo criterio que `worker/domain/rules.py`):
recibe los claims de un sujeto y devuelve su `AssuranceLevel`. El nivel es la
**agregación** de los claims verificados, no un booleano (TRUST_SYSTEM.md §4).
"""

from collections.abc import Iterable

from app.modules.verification.domain.entities import Claim
from app.modules.verification.domain.value_objects import (
    AssuranceLevel,
    ClaimType,
    VerificationMethod,
)

# Métodos que corresponden a una fuente autoritativa (verificación reforzada).
_AUTHORITATIVE_METHODS = {VerificationMethod.RENAPER, VerificationMethod.KYC_PROVIDER}

# Claims que acreditan "presencia" (la persona es la del documento).
_PRESENCE_CLAIMS = {ClaimType.SELFIE_VERIFICADA, ClaimType.PRUEBA_DE_VIDA}

# Claims que acreditan un canal de contacto real.
_CONTACT_CLAIMS = {ClaimType.EMAIL_VERIFICADO, ClaimType.TELEFONO_VERIFICADO}


def compute_assurance_level(claims: Iterable[Claim]) -> AssuranceLevel:
    """Nivel de garantía de la identidad del sujeto (L0–L4).

    Devuelve el nivel más alto que sus claims **verificados** habilitan. No es
    reputación: un L3 recién llegado tiene identidad fuerte y reputación cero.
    """
    verified = [c for c in claims if c.is_verified]
    if not verified:
        return AssuranceLevel.L0

    if any(c.method in _AUTHORITATIVE_METHODS for c in verified):
        return AssuranceLevel.L4

    verified_types = {c.claim_type for c in verified}
    if verified_types & _PRESENCE_CLAIMS:
        return AssuranceLevel.L3
    if ClaimType.DOCUMENTO_VERIFICADO in verified_types:
        return AssuranceLevel.L2
    if verified_types & _CONTACT_CLAIMS:
        return AssuranceLevel.L1
    return AssuranceLevel.L0


def has_verified_identity(claims: Iterable[Claim]) -> bool:
    """Resultado visible "Identidad verificada": el sujeto tiene el documento
    verificado (L2 o más). Es lo que ve un comercio; nunca las evidencias."""
    return compute_assurance_level(claims) in {
        AssuranceLevel.L2,
        AssuranceLevel.L3,
        AssuranceLevel.L4,
    }
