"""Entidades del dominio del asistente (aparte del contexto de turnos, que
reusa el puerto de `shift` — ver `application/services.py`).
"""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4


@dataclass(frozen=True)
class AssistantQueryLogEntry:
    """Registro de una consulta al asistente: qué preguntó el comercio y qué
    intención terminó resolviendo. Es la base de datos etiquetados que un
    aprendizaje real (P2, pedido de Julieta: "que vaya aprendiendo")
    necesitaría para tener sentido — hoy, sin volumen suficiente para
    entrenar nada, sólo sirve para revisión manual (qué tan seguido el
    asistente no entiende algo, qué pide la gente en la práctica). Nunca se
    edita: se agrega una fila por consulta, no se corrige."""

    company_id: UUID
    text: str
    intent: str
    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
