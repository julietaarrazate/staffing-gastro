"""Puerto de persistencia del registro de consultas al asistente."""

from abc import ABC, abstractmethod

from app.modules.assistant.domain.entities import AssistantQueryLogEntry


class AssistantQueryLogRepository(ABC):
    @abstractmethod
    async def add(self, entry: AssistantQueryLogEntry) -> None:
        """Persiste el registro. Fire-and-forget a propósito: un fallo acá
        (ver uso en `api/routes.py`) nunca debe interrumpir la respuesta real
        al comercio — la señal de uso es una mejora, no el propósito del
        endpoint."""
