"""Excepciones del dominio de leads."""


class LeadError(Exception):
    """Excepción base del módulo lead."""


class LeadNotFoundError(LeadError):
    """El lead no existe."""


class UnknownBarrioError(LeadError):
    """El barrio no está en la lista de barrios de la Ciudad."""


class PlaceSourceUnavailableError(LeadError):
    """La fuente de comercios (OpenStreetMap) no respondió o respondió mal."""


class PlaceSnapshotMissingError(LeadError):
    """Todavía no hay copia de OpenStreetMap de ese barrio (ADR-0029)."""


class PlaceSourcePartialError(PlaceSourceUnavailableError):
    """La fuente respondió, pero con un error de ejecución (Overpass cortó la
    consulta a la mitad): los comercios pueden estar incompletos. Trae lo que
    llegó, por si el barrio no tiene ninguna copia todavía (ADR-0029)."""

    def __init__(self, message: str, candidates: list | None = None) -> None:
        super().__init__(message)
        self.candidates = candidates or []
