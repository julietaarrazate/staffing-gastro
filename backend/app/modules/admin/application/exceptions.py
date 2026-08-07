"""Excepciones del módulo de administración (agnósticas del transporte)."""


class AdminError(Exception):
    """Excepción base del módulo de administración."""


class TargetUserNotFoundError(AdminError):
    """No se encontró el usuario destino de la acción administrativa."""


class CannotModifySelfError(AdminError):
    """Un administrador no puede aplicarse a sí mismo esta acción (ej. suspenderse)."""


class CannotImpersonateAdminError(AdminError):
    """No se puede "ver como" otra cuenta administradora (evita escalada y
    confusión de sesiones entre admins)."""
