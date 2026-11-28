"""Excepciones del dominio de postulaciones."""


class ApplicationError(Exception):
    """Excepción base del módulo application."""


class ShiftNotApplicableError(ApplicationError):
    """El turno no existe, no es accesible o no está abierto a postulaciones.

    No-disclosure: el mismo error cubre "no existe", "no es tuyo" y "no está
    abierto", para no revelar turnos ajenos.
    """


class AlreadyAppliedError(ApplicationError):
    """El trabajador ya tiene una postulación a ese turno que no puede volver
    a presentar: está activa (PENDIENTE o ACEPTADA) o la rechazó el comercio.
    Una RETIRADA no cae acá: se reactiva."""


class PuedoIrYaRequeridoError(ApplicationError):
    """Carril urgente: el turno empieza en menos de 6 horas y la persona no
    reconoció «Puedo ir ya» (una pantalla vieja, cargada antes de la ventana).
    La postulación no se crea: la pantalla tiene que preguntar y reintentar."""

    def __init__(self, shift_id: str = "") -> None:
        super().__init__(f"El turno {shift_id} empieza pronto: hace falta confirmar que puede ir")


class AlreadyUnassignedError(AlreadyAppliedError):
    """El trabajador tuvo ese turno asignado y lo dejó (rechazó, canceló o no
    se presentó): su postulación está DESASIGNADA. Sigue en la lista del
    comercio, que decide si lo vuelve a elegir; no se postula otra vez."""


class ApplicationNotFoundError(ApplicationError):
    """La postulación no existe (o no pertenece al trabajador que la busca).

    No-disclosure: mismo error para "no existe" y "es de otro trabajador".
    """


class InvalidApplicationTransitionError(ApplicationError):
    """La transición de estado solicitada no es válida desde el estado actual."""
