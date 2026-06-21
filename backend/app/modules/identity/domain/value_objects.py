"""Objetos de valor del dominio de identidad."""

from enum import Enum


class UserRole(str, Enum):
    """Roles del sistema, según el spec de Staffya.

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
