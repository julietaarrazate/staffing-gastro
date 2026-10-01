"""Objetos de valor del dominio de identidad."""

from enum import Enum


class UserRole(str, Enum):
    """Roles del sistema, según el spec de Oído.

    - WORKER (Trabajador): mozo, bartender, runner, cocinero, etc.
    - EMPLOYER (Empleador): dueño, encargado, gerente, organizador, catering.
    - ADMIN (Administrador): moderación, verificación, soporte.
    """

    WORKER = "worker"
    EMPLOYER = "employer"
    ADMIN = "admin"


class UserStatus(str, Enum):
    """Estado de la cuenta de usuario."""

    ACTIVE = "active"
    SUSPENDED = "suspended"
    DELETED = "deleted"


# Versión vigente de /terminos y /privacidad, la que se registra cuando
# alguien las acepta al crear su cuenta (`TermsAcceptance`). Se sube en el
# MISMO cambio que edita el texto de cualquiera de las dos páginas: si no, el
# registro diría que la persona aceptó una versión que no fue la que leyó.
# Formato año-mes, igual que la "Última actualización" que muestran las
# páginas (`frontend/lib/legal.ts`).
LEGAL_TERMS_VERSION = "2026-09-29"


class TermsAcceptanceChannel(str, Enum):
    """Desde dónde se aceptaron los términos al crear la cuenta."""

    EMAIL = "email"
    GOOGLE = "google"
