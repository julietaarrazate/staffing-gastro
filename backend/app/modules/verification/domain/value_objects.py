"""Objetos de valor del dominio de verificación de identidad (ADR-0010).

Todo lo que acá es un `Enum` está pensado para **crecer agregando miembros**,
no rediseñando: un tipo de claim nuevo (p. ej. `negocio_verificado` para el
comercio, §11 de TRUST_SYSTEM.md) o un método de verificación nuevo (KYC,
Renaper) es un valor más, no un cambio de esquema.
"""

from enum import Enum


class ClaimType(str, Enum):
    """La afirmación que se hace sobre el sujeto. Catálogo inicial, extensible.

    F1 construye `documento_verificado` (y, como parte del mismo flujo,
    `selfie_verificada`). El resto queda declarado para que el dominio no
    tenga que rediseñarse cuando entren (teléfono, liveness, mayoría de edad
    validada contra el documento)."""

    EMAIL_VERIFICADO = "email_verificado"
    TELEFONO_VERIFICADO = "telefono_verificado"
    DOCUMENTO_VERIFICADO = "documento_verificado"
    SELFIE_VERIFICADA = "selfie_verificada"
    PRUEBA_DE_VIDA = "prueba_de_vida"
    MAYORIA_DE_EDAD = "mayoria_de_edad"


class ClaimStatus(str, Enum):
    """Estado del claim. `NO_PRESENTADA` es el implícito (no hay fila todavía);
    se incluye para poder responder el estado de un claim inexistente sin
    ramas especiales."""

    NO_PRESENTADA = "no_presentada"
    PENDIENTE = "pendiente"
    VERIFICADA = "verificada"
    RECHAZADA = "rechazada"
    EXPIRADA = "expirada"


class EvidenceType(str, Enum):
    """La prueba concreta que respalda un claim."""

    DNI_FRENTE = "dni_frente"
    DNI_DORSO = "dni_dorso"
    SELFIE = "selfie"
    LIVENESS = "liveness"


class VerificationMethod(str, Enum):
    """Cómo se verificó la evidencia. Es una **estrategia**: cambiar de
    `admin_manual` a un proveedor automático no toca `Claim`/`Evidence` ni las
    reglas de agregación (ADR-0010 §3)."""

    ADMIN_MANUAL = "admin_manual"
    KYC_PROVIDER = "kyc_provider"
    RENAPER = "renaper"


class ConfidenceLevel(str, Enum):
    """Nivel de confianza de un claim verificado. Una revisión manual da
    confianza `MEDIA`; una fuente autoritativa (Renaper) daría `ALTA`."""

    BAJA = "baja"
    MEDIA = "media"
    ALTA = "alta"


class AssuranceLevel(str, Enum):
    """Nivel de garantía de la identidad del sujeto: la **agregación** de sus
    claims verificados (estilo NIST IAL / eIDAS, TRUST_SYSTEM.md §4). No es
    reputación: un L3 recién llegado tiene identidad fuerte y reputación cero."""

    L0 = "L0"  # anónimo (registrado, sin claims)
    L1 = "L1"  # contacto verificado (email/teléfono)
    L2 = "L2"  # documento verificado
    L3 = "L3"  # presencia (selfie/liveness = persona del documento)
    L4 = "L4"  # reforzado (fuente autoritativa: Renaper/KYC)
