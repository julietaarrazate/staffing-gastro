"""`FakePushSender`: doble de `PushSender` para tests.

No llama a ningún proveedor; registra los envíos (`sent`) para asserts, y
puede simular fallos (`result_override`) para probar que crear una
notificación in-app nunca se rompe si el envío de push explota (mismo rol
que `FakeEmailSender`)."""

from dataclasses import dataclass, field

from app.modules.notification.domain.entities import PushSubscription
from app.modules.notification.domain.push_sender import PushSendResult, PushSender


@dataclass
class SentPush:
    user_id: object
    title: str
    body: str


@dataclass
class FakePushSender(PushSender):
    result_override: PushSendResult | None = None
    raise_on_send: bool = False
    sent: list[SentPush] = field(default_factory=list)

    async def send(
        self, subscription: PushSubscription, *, title: str, body: str, url: str = "/"
    ) -> PushSendResult:
        if self.raise_on_send:
            raise RuntimeError("FakePushSender: fallo simulado del proveedor")
        self.sent.append(SentPush(user_id=subscription.user_id, title=title, body=body))
        return self.result_override or PushSendResult.SENT
