"""Puerto de envío de email transaccional (degradación elegante).

`EmailSender` es el punto de extensión para cualquier flujo de negocio que
necesite avisar por email (recuperación de contraseña, aceptación de turno,
etc.). Cero conocimiento de proveedor: las implementaciones concretas viven
en la capa de infraestructura (`ResendEmailSender`, `NullEmailSender`).

Contrato de "nunca romper un flujo de negocio": ninguna implementación debe
dejar que un fallo de envío (red, credenciales, proveedor caído) se propague
como excepción no controlada hacia el caso de uso que la invoca — cada
adaptador atrapa sus propios errores y los loguea. Los call sites, además,
invocan `send` best-effort (try/except) como defensa en profundidad.
"""

from abc import ABC, abstractmethod


class EmailSender(ABC):
    """Puerto de envío de email. Cero import de infraestructura ni de proveedor."""

    @abstractmethod
    async def send(self, to: str, subject: str, html: str) -> None:
        """Envía un email HTML. No debe lanzar en condiciones normales de
        fallo del proveedor (ver contrato de degradación elegante arriba)."""
