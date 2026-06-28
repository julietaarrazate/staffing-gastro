"""Objetos de valor del dominio de postulaciones."""

from enum import Enum


class ApplicationStatus(str, Enum):
    """Estado de la postulación de un trabajador a un turno."""

    PENDIENTE = "pendiente"
    ACEPTADA = "aceptada"
    RECHAZADA = "rechazada"
    RETIRADA = "retirada"
