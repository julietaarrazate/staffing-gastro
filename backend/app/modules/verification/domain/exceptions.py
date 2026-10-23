"""Excepciones del dominio de verificación de identidad.

Son errores de **regla de negocio** (violaciones de la máquina de estados o de
las invariantes del claim). La capa `api` las mapea a códigos HTTP; el dominio
no sabe de HTTP.
"""


class VerificationError(Exception):
    """Base de los errores del dominio de verificación."""


class ClaimAlreadyVerifiedError(VerificationError):
    """Se intentó reenviar evidencia para un claim que ya está verificado."""


class EvidenceRequiredError(VerificationError):
    """Se intentó presentar un claim sin la evidencia mínima requerida."""


class ClaimNotPendingError(VerificationError):
    """Se intentó decidir (aprobar/rechazar) un claim que no está pendiente."""


class ClaimNotFoundError(VerificationError):
    """No existe el claim buscado (para el sujeto / id dados)."""


class EvidenceNotFoundError(VerificationError):
    """No hay archivo para mostrar: la evidencia no existe, ya se purgó, o su
    claim ya no está pendiente (ADR-0021: sólo se mira mientras se revisa)."""
