"""`FakeEmailSender`: doble de `EmailSender` para tests.

No llama a ningún proveedor; registra los envíos (`sent`) para asserts, y
opcionalmente puede simular que el proveedor "explota" (`raise_on_send`) para
probar que los call sites nunca dejan que un fallo de envío rompa el flujo de
negocio que lo dispara (mismo rol que `FakeBillingGateway` para `subscription`).
"""

from dataclasses import dataclass, field

from app.modules.notification.domain.email_sender import EmailSender


@dataclass
class SentEmail:
    to: str
    subject: str
    html: str


@dataclass
class FakeEmailSender(EmailSender):
    raise_on_send: bool = False
    sent: list[SentEmail] = field(default_factory=list)

    async def send(self, to: str, subject: str, html: str) -> None:
        if self.raise_on_send:
            raise RuntimeError("FakeEmailSender: fallo simulado del proveedor")
        self.sent.append(SentEmail(to=to, subject=subject, html=html))
