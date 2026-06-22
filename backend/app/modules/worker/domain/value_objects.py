"""Objetos de valor del dominio de perfil del trabajador."""

from enum import Enum


class WorkerSkill(str, Enum):
    """Cargos / habilidades de un trabajador, según el spec de Staffya."""

    MOZO = "mozo"
    BARTENDER = "bartender"
    BARISTA = "barista"
    RUNNER = "runner"
    COCINERO = "cocinero"
    CAJERO = "cajero"
    RECEPCIONISTA = "recepcionista"
    PERSONAL_EVENTOS = "personal_eventos"
    AYUDANTE_COCINA = "ayudante_cocina"
    PERSONAL_SALON = "personal_salon"


class WorkerBadge(str, Enum):
    """Insignias que puede obtener un trabajador."""

    NUNCA_FALTO = "nunca_falto"
    TOP_MOZO = "top_mozo"
    TOP_BARTENDER = "top_bartender"
    EVENTOS_PREMIUM = "eventos_premium"
    PERFIL_VERIFICADO = "perfil_verificado"


class GamificationLevel(str, Enum):
    """Niveles de gamificación (visibilidad y prioridad en el matching)."""

    BRONCE = "bronce"
    PLATA = "plata"
    ORO = "oro"
    PLATINO = "platino"
