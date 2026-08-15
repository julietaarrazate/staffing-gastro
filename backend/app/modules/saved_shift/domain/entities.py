"""Entidades del dominio de turnos guardados (un trabajador guarda un turno
para evaluarlo después, sin postularse todavía)."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4


@dataclass(frozen=True)
class SavedShift:
    """Marca privada de un trabajador sobre un turno abierto, para
    encontrarlo fácil más tarde y decidir con calma ("empezar a evaluar
    opciones que convengan" — pedido de Julieta). Es un bookmark sin ningún
    efecto sobre matching, postulación ni reputación: guardar un turno no es
    postularse a él (mismo criterio que `Favorite`, el bookmark comercio →
    trabajador — ver `favorite/domain/entities.py`)."""

    worker_profile_id: UUID
    shift_id: UUID

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
