"""Excepciones del dominio de leads."""


class LeadError(Exception):
    """Excepción base del módulo lead."""


class LeadNotFoundError(LeadError):
    """El lead no existe."""


class UnknownBarrioError(LeadError):
    """El barrio no está en la lista de barrios de la Ciudad."""


class PlaceSourceUnavailableError(LeadError):
    """La fuente de comercios (OpenStreetMap) no respondió o respondió mal."""
