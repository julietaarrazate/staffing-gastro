"""Objetos de valor del dominio de suscripción."""

from enum import Enum


class SubscriptionStatus(str, Enum):
    """Estado persistido de la suscripción del comercio.

    Independiente del estado transitorio de checkout ("pendiente") que puede
    devolver `POST /subscription/subscribe` con el feature-flag de cobro
    encendido — ese valor vive sólo en la respuesta HTTP
    (`application/services.py::SubscribeResult`), nunca en este enum.
    """

    ACTIVA = "activa"
    VENCIDA = "vencida"
    CANCELADA = "cancelada"
