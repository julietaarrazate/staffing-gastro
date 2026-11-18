"""Objetos de valor del dominio de postulaciones."""

from enum import Enum


class ApplicationStatus(str, Enum):
    """Estado de la postulación de un trabajador a un turno."""

    PENDIENTE = "pendiente"
    ACEPTADA = "aceptada"
    RECHAZADA = "rechazada"
    RETIRADA = "retirada"
    # Estuvo asignada al turno y lo dejó (G4): rechazó la asignación, canceló
    # después de confirmar o no se presentó. Lleva su `MotivoDesasignacion`.
    DESASIGNADA = "desasignada"


class MotivoDesasignacion(str, Enum):
    """Por qué una persona que tenía el turno asignado dejó de tenerlo.

    Es lo que ve el comercio en la lista de postulantes («Rechazó este
    turno», «Canceló», «No se presentó»). Una suspensión no es un motivo: la
    decide un admin, no la persona, y no deja marca (ADR-0024)."""

    RECHAZO = "rechazo"
    CANCELACION = "cancelacion"
    AUSENCIA = "ausencia"
