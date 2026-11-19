"""Objetos de valor del dominio de perfil del trabajador."""

from dataclasses import dataclass
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


# Tipo de entrega del CV subido desde el 2026-11-19 (ADR-0021): ni el
# original ni una versión transformada se entregan sin firma; se ve con un
# link firmado que vence. (`private` no alcanza: deja ver sin firma las
# versiones transformadas.)
CV_PROTECTED_DELIVERY = "authenticated"


@dataclass(frozen=True)
class CvFile:
    """Dónde está guardado el CV que subió el trabajador (ADR-0021,
    actualización 2026-11-19: el CV también).

    No es una URL: es la referencia al archivo **protegido** en el storage
    (`public_id`, tipo de recurso, formato y tipo de entrega). El CV trae
    teléfono, email y domicilio: para verlo hay que pedir un link que vence
    (`CvFileStorage.link_for`), y sólo quien hoy puede verlo lo consigue. Un
    link visto una vez deja de servir a los pocos minutos."""

    public_id: str
    resource_type: str
    format: str
    delivery_type: str = CV_PROTECTED_DELIVERY

    def same_file(self, other: "CvFile | None") -> bool:
        """¿Es el mismo archivo en el storage? Lo identifican el `public_id`,
        el tipo de recurso y el de entrega; el formato no (es cómo se pide,
        y un pedido con otro formato no puede hacer borrar el que está)."""
        return other is not None and (
            self.public_id,
            self.resource_type,
            self.delivery_type,
        ) == (other.public_id, other.resource_type, other.delivery_type)
