"""Objetos de valor del dominio de perfil del trabajador."""

from enum import Enum


class WorkerSkill(str, Enum):
    """Cargos / habilidades de un trabajador, según el spec de Oído."""

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

    @property
    def label(self) -> str:
        """Nombre para mostrar a una persona. El valor es un identificador
        ("ayudante_cocina") y llegó así hasta el asunto de un mail. Espeja
        `SKILL_LABELS` de `frontend/lib/types.ts`."""
        return _SKILL_LABELS[self]


_SKILL_LABELS: dict[WorkerSkill, str] = {
    WorkerSkill.MOZO: "Mozo/a",
    WorkerSkill.BARTENDER: "Bartender",
    WorkerSkill.BARISTA: "Barista",
    WorkerSkill.RUNNER: "Runner",
    WorkerSkill.COCINERO: "Cocinero/a",
    WorkerSkill.CAJERO: "Cajero/a",
    WorkerSkill.RECEPCIONISTA: "Recepcionista",
    WorkerSkill.PERSONAL_EVENTOS: "Personal de eventos",
    WorkerSkill.AYUDANTE_COCINA: "Ayudante de cocina",
    WorkerSkill.PERSONAL_SALON: "Personal de salón",
}


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
