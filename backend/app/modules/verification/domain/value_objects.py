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
    # Identidad de NEGOCIO, no de persona (sujeto = CompanyProfile.user_id) —
    # el ejemplo que este mismo docstring ya anticipaba, TRUST_SYSTEM.md §11.
    # Reusa el mecanismo de aprobación genérico (approve_claim/reject_claim).
    # Desde ADR-0013 tiene flujo real: el comercio sube su constancia de AFIP
    # (`EvidenceType.CONSTANCIA_CUIT`) y un admin la revisa.
    #
    # OJO — esto NO es `cuit_verificado`, que TRUST_SYSTEM.md §11.3 reserva
    # para la validación AUTOMÁTICA contra AFIP (la contraparte de Renaper
    # para personas). Acá una persona mira un PDF: el método es
    # `ADMIN_MANUAL`. Usar el otro nombre dejaría al sistema afirmando que se
    # validó contra la fuente cuando no pasó. Cuando exista la integración,
    # entra como un claim y un método más — para eso el modelo es extensible.
    NEGOCIO_VERIFICADO = "negocio_verificado"


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
    # Prueba de NEGOCIO, no de persona (ADR-0013): la constancia de
    # inscripción de AFIP que respalda el claim `negocio_verificado`. Se
    # eligió sobre la habilitación municipal porque la baja gratis cualquiera
    # que esté inscripto — un requisito que la mayoría no puede cumplir deja
    # el sello apagado para siempre, que es justo el problema a resolver.
    CONSTANCIA_CUIT = "constancia_cuit"


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
