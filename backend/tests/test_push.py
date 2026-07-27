"""Tests de suscripciones Web Push y del hook best-effort al crear una
notificación in-app (ver `SqlAlchemyNotificationRepository.add`)."""

from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.notification.infrastructure.fake_push_sender import FakePushSender
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio

_SUBSCRIBE_PATH = "/api/v1/push/subscribe"


async def test_push_public_key_without_vapid_configured(client: AsyncClient):
    """Sin VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY en el servidor (default de
    test): el frontend no debe ofrecer el toggle."""
    response = await client.get("/api/v1/push/public-key")
    assert response.status_code == 200
    assert response.json() == {"vapid_public_key": None}


async def test_push_subscribe_requires_auth(client: AsyncClient):
    response = await client.post(
        _SUBSCRIBE_PATH,
        json={"endpoint": "https://fcm.googleapis.com/fcm/send/x", "keys": {"p256dh": "a", "auth": "b"}},
    )
    assert response.status_code in (401, 403)


async def test_push_subscribe_is_idempotent_and_can_unsubscribe(client: AsyncClient):
    headers = await auth_headers(client, "worker", "push1@staffya.com")
    payload = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/abc123",
        "keys": {"p256dh": "clave-p256dh", "auth": "clave-auth"},
    }

    first = await client.post(_SUBSCRIBE_PATH, json=payload, headers=headers)
    assert first.status_code == 201

    # Suscribir el mismo endpoint de nuevo (p. ej. el usuario tocó "Activar"
    # dos veces) no falla ni duplica la fila.
    second = await client.post(_SUBSCRIBE_PATH, json=payload, headers=headers)
    assert second.status_code == 201

    unsubscribe = await client.request(
        "DELETE", _SUBSCRIBE_PATH, json={"endpoint": payload["endpoint"]}, headers=headers
    )
    assert unsubscribe.status_code == 204

    # Desuscribir de nuevo (ya no existe) es un no-op idempotente, no rompe.
    again = await client.request(
        "DELETE", _SUBSCRIBE_PATH, json={"endpoint": payload["endpoint"]}, headers=headers
    )
    assert again.status_code == 204


async def test_notification_creation_sends_push_best_effort(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
):
    """Crear una notificación in-app (el mismo camino que usan shift/chat/
    review/application) manda push a las suscripciones del usuario."""
    headers = await auth_headers(client, "worker", "push2@staffya.com")
    me = await client.get("/api/v1/auth/me", headers=headers)
    user_id = me.json()["id"]

    await client.post(
        _SUBSCRIBE_PATH,
        json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/xyz789",
            "keys": {"p256dh": "p", "auth": "a"},
        },
        headers=headers,
    )

    fake_sender = FakePushSender()
    monkeypatch.setattr(
        "app.modules.notification.infrastructure.repositories._get_push_sender",
        lambda: fake_sender,
    )

    async with session_factory() as session:
        repo = SqlAlchemyNotificationRepository(session)
        await repo.add(
            Notification(
                user_id=UUID(user_id),
                type=NotificationType.SHIFT_ASSIGNED,
                title="Te asignaron un turno",
                message="Revisá los detalles en la app.",
            )
        )

    assert len(fake_sender.sent) == 1
    assert fake_sender.sent[0].title == "Te asignaron un turno"


async def test_notification_creation_survives_push_failure(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
):
    """Si el envío de push explota (proveedor caído, lo que sea), la
    notificación in-app se crea igual: el fallo nunca se propaga."""
    headers = await auth_headers(client, "worker", "push3@staffya.com")
    me = await client.get("/api/v1/auth/me", headers=headers)
    user_id = me.json()["id"]

    await client.post(
        _SUBSCRIBE_PATH,
        json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/boom",
            "keys": {"p256dh": "p", "auth": "a"},
        },
        headers=headers,
    )

    monkeypatch.setattr(
        "app.modules.notification.infrastructure.repositories._get_push_sender",
        lambda: FakePushSender(raise_on_send=True),
    )

    async with session_factory() as session:
        repo = SqlAlchemyNotificationRepository(session)
        created = await repo.add(
            Notification(
                user_id=UUID(user_id),
                type=NotificationType.SHIFT_ASSIGNED,
                title="Igual se crea",
                message="Aunque el envío de push explote.",
            )
        )
    assert created.title == "Igual se crea"

    # Y quedó persistida: se puede listar por HTTP con normalidad.
    listed = await client.get("/api/v1/notifications", headers=headers)
    assert any(n["title"] == "Igual se crea" for n in listed.json())


async def test_push_subscription_without_any_device_does_not_break_notification(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    """Usuario sin ninguna suscripción push: crear la notificación in-app
    funciona igual (el hook no encuentra nada que mandar y no hace nada)."""
    headers = await auth_headers(client, "worker", "push4@staffya.com")
    me = await client.get("/api/v1/auth/me", headers=headers)
    user_id = me.json()["id"]

    async with session_factory() as session:
        repo = SqlAlchemyNotificationRepository(session)
        created = await repo.add(
            Notification(
                user_id=UUID(user_id),
                type=NotificationType.SHIFT_ASSIGNED,
                title="Sin dispositivos suscriptos",
                message="No pasa nada.",
            )
        )
    assert created.title == "Sin dispositivos suscriptos"


async def test_deep_link_por_tipo_de_notificacion():
    """El push tiene que abrir la pantalla de la que habla el aviso, no la
    landing: antes todas caían en "/" y el usuario tenía que buscar a mano de
    qué le hablaban. La pantalla se elige por el destinatario real de cada tipo
    (trabajador -> sus turnos, comercio -> su panel)."""
    from app.modules.notification.domain.value_objects import deep_link_for

    # Trabajador
    assert deep_link_for(NotificationType.SHIFT_ASSIGNED) == "/my-shifts"
    assert deep_link_for(NotificationType.SHIFT_CANCELLED_LATE) == "/my-shifts"
    # Comercio
    assert deep_link_for(NotificationType.NEW_APPLICANT) == "/shifts"
    assert deep_link_for(NotificationType.SHIFT_CONFIRMED) == "/shifts"
    # Ambos roles
    assert deep_link_for(NotificationType.CHAT_MESSAGE) == "/chats"
    assert deep_link_for(NotificationType.REVIEW_RECEIVED) == "/profile"
    # Todo tipo conocido tiene destino: ninguno cae al fallback de la landing.
    assert all(deep_link_for(t) != "/" for t in NotificationType)
