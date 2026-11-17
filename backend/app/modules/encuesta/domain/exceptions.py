"""Excepciones del dominio de la encuesta."""


class EncuestaError(Exception):
    """Base del módulo encuesta."""


class InvalidSurveyError(EncuestaError):
    """La respuesta rompe una regla de la encuesta. El mensaje es para la
    persona que la completa: va tal cual en el 422."""
