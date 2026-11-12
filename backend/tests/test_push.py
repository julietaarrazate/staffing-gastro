"""Tests de suscripciones Web Push y del hook best-effort al crear una
notificación in-app (ver `SqlAlchemyNotificationRepository.add`).

Los push salen después de responder, en una tarea de fondo
(`push_tasks.py`): los tests que miran qué se envió esperan antes con
`drain_pending_pushes()`."""

import asyncio
import logging
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.push_sender import PushSendResult
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.notification.infrastructure.fake_push_sender import FakePushSender
from app.modules.notification.infrastructure.models import PushSubscriptionModel
from app.modules.notification.infrastructure.push_tasks import (
    drain_pending_pushes,
    shutdown_pending_pushes,
    spawn_push_task,
)
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
    SqlAlchemyPushSubscriptionRepository,
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


@pytest.mark.parametrize(
    "endpoint",
    [
        "http://fcm.googleapis.com/fcm/send/x",  # sin https
        "https://10.0.0.5/push",  # red interna
        "https://evil.example.com/fcm.googleapis.com",
        "https://fcm.googleapis.com.evil.com/x",
        "https://fcm.googleapis.com:8443/x",
    ],
)
async def test_push_subscribe_rejects_unknown_push_services(
    client: AsyncClient, endpoint: str
):
    """Revisión de seguridad 2026-10-20: el backend le hace POST al endpoint,
    así que sólo se aceptan los servicios push de los navegadores."""
    headers = await auth_headers(client, "worker", "push_ssrf@staffya.com")
    response = await client.post(
        _SUBSCRIBE_PATH,
        json={"endpoint": endpoint, "keys": {"p256dh": "a", "auth": "b"}},
        headers=headers,
    )
    assert response.status_code == 422


async def test_push_unsubscribe_only_removes_your_own_subscription(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    owner = await auth_headers(client, "worker", "push_own@staffya.com")
    other = await auth_headers(client, "worker", "push_other@staffya.com")
    endpoint = "https://updates.push.services.mozilla.com/wpush/v2/abc"
    await client.post(
        _SUBSCRIBE_PATH,
        json={"endpoint": endpoint, "keys": {"p256dh": "a", "auth": "b"}},
        headers=owner,
    )

    response = await client.request(
        "DELETE", _SUBSCRIBE_PATH, json={"endpoint": endpoint}, headers=other
    )
    assert response.status_code == 204

    owner_id = UUID((await client.get("/api/v1/auth/me", headers=owner)).json()["id"])
    async with session_factory() as session:
        remaining = await SqlAlchemyPushSubscriptionRepository(session).list_by_user(owner_id)
    assert [s.endpoint for s in remaining] == [endpoint]


async def _filas_del_endpoint(
    session_factory: async_sessionmaker[AsyncSession], endpoint: str
) -> list[PushSubscriptionModel]:
    async with session_factory() as session:
        result = await session.execute(
            select(PushSubscriptionModel).where(PushSubscriptionModel.endpoint == endpoint)
        )
        return list(result.scalars().all())


async def test_endpoint_de_otra_cuenta_pasa_a_la_cuenta_que_lo_suscribe(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
):
    """Navegador compartido (o dos cuentas en el mismo dispositivo): el
    endpoint es del navegador, no de la persona. Si la cuenta B lo suscribe
    después que A, pasa a ser de B: antes quedaba a nombre de A y quien usara
    el dispositivo seguía viendo los avisos de A, mientras B no recibía nada.
    Es el mismo navegador, así que manda el mismo endpoint con las mismas
    claves."""
    de_a = await auth_headers(client, "worker", "push_compartido_a@staffya.com")
    de_b = await auth_headers(client, "employer", "push_compartido_b@staffya.com")
    a_id = UUID((await client.get("/api/v1/auth/me", headers=de_a)).json()["id"])
    b_id = UUID((await client.get("/api/v1/auth/me", headers=de_b)).json()["id"])
    endpoint = "https://fcm.googleapis.com/fcm/send/navegador-compartido"
    del_navegador = {
        "endpoint": endpoint,
        "keys": {"p256dh": "p-del-navegador", "auth": "auth-del-navegador"},
    }

    primero = await client.post(_SUBSCRIBE_PATH, json=del_navegador, headers=de_a)
    assert primero.status_code == 201
    despues = await client.post(_SUBSCRIBE_PATH, json=del_navegador, headers=de_b)
    assert despues.status_code == 201

    # Un endpoint, una fila: ahora es de B.
    filas = await _filas_del_endpoint(session_factory, endpoint)
    assert [(f.user_id, f.p256dh_key, f.auth_key) for f in filas] == [
        (b_id, "p-del-navegador", "auth-del-navegador")
    ]

    fake_sender = FakePushSender()
    monkeypatch.setattr(
        "app.modules.notification.infrastructure.repositories._get_push_sender",
        lambda: fake_sender,
    )
    async with session_factory() as session:
        repo = SqlAlchemyNotificationRepository(session)
        await repo.add(
            Notification(
                user_id=a_id,
                type=NotificationType.SHIFT_ASSIGNED,
                title="Aviso para A",
                message="No tiene que salir a un dispositivo que ya es de B.",
            )
        )
        await repo.add(
            Notification(
                user_id=b_id,
                type=NotificationType.NEW_APPLICANT,
                title="Aviso para B",
                message="Sale al dispositivo donde B tiene la sesión.",
            )
        )
    assert await drain_pending_pushes() == 0
    assert [(s.user_id, s.title) for s in fake_sender.sent] == [(b_id, "Aviso para B")]

    # La baja de A (p. ej. un cierre de sesión que llega tarde) no le saca el
    # dispositivo a B.
    baja_de_a = await client.request(
        "DELETE", _SUBSCRIBE_PATH, json={"endpoint": endpoint}, headers=de_a
    )
    assert baja_de_a.status_code == 204
    assert [f.user_id for f in await _filas_del_endpoint(session_factory, endpoint)] == [b_id]


@pytest.mark.parametrize(
    "claves",
    [
        {"p256dh": "p-inventada", "auth": "auth-inventada"},
        {"p256dh": "p-del-navegador", "auth": "auth-inventada"},
        {"p256dh": "p-inventada", "auth": "auth-del-navegador"},
        {"p256dh": "p-del-navegador", "auth": "auth-ñ-inventada"},
    ],
    ids=["ninguna", "solo-p256dh", "solo-auth", "no-ascii"],
)
async def test_conocer_un_endpoint_ajeno_sin_sus_claves_no_alcanza_para_quedarselo(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
    claves: dict[str, str],
):
    """El mismo navegador manda siempre las mismas claves para su endpoint.
    Quien sólo conoce el endpoint de otra persona no es ese navegador: no se
    lo queda ni le corta los avisos (lo mismo que la revisión de seguridad del
    2026-10-20 cerró para la baja). La respuesta no distingue el caso."""
    de_a = await auth_headers(client, "worker", "push_duenia@staffya.com")
    de_otra = await auth_headers(client, "employer", "push_ajena@staffya.com")
    a_id = UUID((await client.get("/api/v1/auth/me", headers=de_a)).json()["id"])
    otra_id = UUID((await client.get("/api/v1/auth/me", headers=de_otra)).json()["id"])
    endpoint = "https://fcm.googleapis.com/fcm/send/celular-de-a"

    alta = await client.post(
        _SUBSCRIBE_PATH,
        json={
            "endpoint": endpoint,
            "keys": {"p256dh": "p-del-navegador", "auth": "auth-del-navegador"},
        },
        headers=de_a,
    )
    assert alta.status_code == 201
    intento = await client.post(
        _SUBSCRIBE_PATH, json={"endpoint": endpoint, "keys": claves}, headers=de_otra
    )
    assert intento.status_code == 201
    assert intento.json() == alta.json()

    # Sigue siendo de A, con las claves de su navegador.
    filas = await _filas_del_endpoint(session_factory, endpoint)
    assert [(f.user_id, f.p256dh_key, f.auth_key) for f in filas] == [
        (a_id, "p-del-navegador", "auth-del-navegador")
    ]

    fake_sender = FakePushSender()
    monkeypatch.setattr(
        "app.modules.notification.infrastructure.repositories._get_push_sender",
        lambda: fake_sender,
    )
    async with session_factory() as session:
        repo = SqlAlchemyNotificationRepository(session)
        await repo.add(
            Notification(
                user_id=a_id,
                type=NotificationType.SHIFT_ASSIGNED,
                title="Aviso para A",
                message="Sigue saliendo a su celular.",
            )
        )
        await repo.add(
            Notification(
                user_id=otra_id,
                type=NotificationType.NEW_APPLICANT,
                title="Aviso para la otra cuenta",
                message="No sale al celular de A.",
            )
        )
    assert await drain_pending_pushes() == 0
    assert [(s.user_id, s.title) for s in fake_sender.sent] == [(a_id, "Aviso para A")]


async def test_la_misma_cuenta_dos_veces_sigue_siendo_una_fila(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    """Al iniciar sesión el frontend registra solo la suscripción que el
    navegador ya tiene: repetir el alta de la misma cuenta no duplica ni
    cambia de dueño."""
    headers = await auth_headers(client, "worker", "push_repetido@staffya.com")
    user_id = UUID((await client.get("/api/v1/auth/me", headers=headers)).json()["id"])
    payload = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/mi-celular",
        "keys": {"p256dh": "p", "auth": "a"},
    }

    for _ in range(2):
        response = await client.post(_SUBSCRIBE_PATH, json=payload, headers=headers)
        assert response.status_code == 201

    filas = await _filas_del_endpoint(session_factory, payload["endpoint"])
    assert [(f.user_id, f.p256dh_key, f.auth_key) for f in filas] == [(user_id, "p", "a")]


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

    assert await drain_pending_pushes() == 0
    assert len(fake_sender.sent) == 1
    assert fake_sender.sent[0].title == "Te asignaron un turno"


async def test_add_many_guarda_todo_en_un_commit_y_manda_push_a_cada_uno(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
):
    """El aviso masivo (turno nuevo a los de la zona) guarda todas las
    notificaciones juntas y manda el push de cada usuario con su texto."""
    user_ids = []
    for i in range(3):
        headers = await auth_headers(client, "worker", f"pushmany{i}@staffya.com")
        me = await client.get("/api/v1/auth/me", headers=headers)
        user_ids.append(UUID(me.json()["id"]))
        await client.post(
            _SUBSCRIBE_PATH,
            json={
                "endpoint": f"https://fcm.googleapis.com/fcm/send/many{i}",
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
        saved = await repo.add_many(
            [
                Notification(
                    user_id=uid,
                    type=NotificationType.NEW_SHIFT_NEARBY,
                    title=f"Turno {n}",
                    message="Postulate.",
                    link="/feed",
                )
                for n, uid in enumerate(user_ids)
            ]
        )
        assert [n.created_at is not None for n in saved] == [True, True, True]
        for n, uid in enumerate(user_ids):
            listed = await repo.list_by_user(uid)
            assert [x.title for x in listed] == [f"Turno {n}"]

    assert await drain_pending_pushes() == 0
    assert sorted(s.title for s in fake_sender.sent) == ["Turno 0", "Turno 1", "Turno 2"]


async def test_notification_creation_survives_push_failure(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
):
    """Si el envío de push explota (proveedor caído, lo que sea), la
    notificación in-app se crea igual: el fallo nunca se propaga y, como el
    envío corre en el fondo, queda en el log."""
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
    with caplog.at_level(logging.ERROR):
        assert await drain_pending_pushes() == 0
    assert "Push: falló el envío" in caplog.text

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


async def test_link_concreto_gana_al_destino_generico_por_tipo(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    """El `link` de la notificación apunta a la entidad exacta (los candidatos
    de ESE turno, ESA conversación) y es lo que abre el push. El destino por
    tipo sólo llega a la pantalla de lista, que es donde el usuario tenía que
    seguir buscando a mano."""
    headers = await auth_headers(client, "employer", "link1@staffya.com")
    me = await client.get("/api/v1/auth/me", headers=headers)
    user_id = me.json()["id"]

    async with session_factory() as session:
        created = await SqlAlchemyNotificationRepository(session).add(
            Notification(
                user_id=UUID(user_id),
                type=NotificationType.NEW_APPLICANT,
                title="Un postulante",
                message="Se postuló alguien.",
                link="/shifts/abc-123/candidates",
            )
        )
    assert created.link == "/shifts/abc-123/candidates"

    # Y viaja al frontend por HTTP (la campanita lo usa para navegar).
    listed = await client.get("/api/v1/notifications", headers=headers)
    row = next(n for n in listed.json() if n["title"] == "Un postulante")
    assert row["link"] == "/shifts/abc-123/candidates"


async def test_notificacion_sin_link_cae_al_destino_por_tipo(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    """Los avisos creados antes de la columna `link` (migración 0016) siguen
    funcionando: quedan en `None` y el destino se resuelve por tipo."""
    headers = await auth_headers(client, "worker", "link2@staffya.com")
    me = await client.get("/api/v1/auth/me", headers=headers)

    async with session_factory() as session:
        created = await SqlAlchemyNotificationRepository(session).add(
            Notification(
                user_id=UUID(me.json()["id"]),
                type=NotificationType.SHIFT_ASSIGNED,
                title="Sin link",
                message="Aviso viejo.",
            )
        )
    assert created.link is None


@pytest.mark.parametrize(
    "endpoint",
    [
        "https://169.254.169.254/latest/meta-data/",
        "http://fcm.googleapis.com/fcm/send/plano",
    ],
)
async def test_suscripcion_vieja_con_endpoint_arbitrario_no_recibe_post_y_se_purga(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
    endpoint: str,
):
    """Suscripciones guardadas antes de validar el alta (endpoint interno o
    sin https): el sender real no les hace POST y se borran (SSRF persistente,
    revisión 2026-10-21). La válida del mismo usuario sí recibe el aviso."""
    from app.core.config import get_settings
    from app.modules.notification.domain.entities import PushSubscription
    from app.modules.notification.infrastructure.webpush_sender import WebPushSender

    headers = await auth_headers(client, "worker", f"push-ssrf-{len(endpoint)}@staffya.com")
    me = await client.get("/api/v1/auth/me", headers=headers)
    user_id = UUID(me.json()["id"])
    valido = "https://fcm.googleapis.com/fcm/send/legit"

    # Se guarda directo por el repositorio: simula un registro previo al deploy
    # que el schema de alta hoy rechazaría.
    async with session_factory() as session:
        repo = SqlAlchemyPushSubscriptionRepository(session)
        for ep in (endpoint, valido):
            await repo.add(
                PushSubscription(user_id=user_id, endpoint=ep, p256dh_key="p", auth_key="a")
            )

    llamados: list[str] = []
    monkeypatch.setattr(
        "pywebpush.webpush",
        lambda subscription_info, **_: llamados.append(subscription_info["endpoint"]),
    )
    monkeypatch.setattr(
        "app.modules.notification.infrastructure.repositories._get_push_sender",
        lambda: WebPushSender(get_settings()),
    )

    async with session_factory() as session:
        await SqlAlchemyNotificationRepository(session).add(
            Notification(
                user_id=user_id,
                type=NotificationType.SHIFT_ASSIGNED,
                title="Aviso",
                message="Solo al servicio push conocido.",
            )
        )

    await drain_pending_pushes()
    assert llamados == [valido]
    async with session_factory() as session:
        restantes = await SqlAlchemyPushSubscriptionRepository(session).list_by_user(user_id)
    assert [s.endpoint for s in restantes] == [valido]


# --- El push sale después de responder (2026-10-23) ------------------------


class _GatedPushSender(FakePushSender):
    """Envío que no termina hasta que el test abre la compuerta: deja ver qué
    pasa mientras el proveedor de push todavía no contestó."""

    def __init__(self, result: PushSendResult = PushSendResult.SENT) -> None:
        super().__init__(result_override=result)
        self.gate = asyncio.Event()

    async def send(self, subscription, *, title, body, url="/"):
        await self.gate.wait()
        return await super().send(subscription, title=title, body=body, url=url)


async def _worker_with_subscription(client: AsyncClient, email: str, endpoint: str) -> UUID:
    headers = await auth_headers(client, "worker", email)
    me = await client.get("/api/v1/auth/me", headers=headers)
    await client.post(
        _SUBSCRIBE_PATH,
        json={"endpoint": endpoint, "keys": {"p256dh": "p", "auth": "a"}},
        headers=headers,
    )
    return UUID(me.json()["id"])


async def test_add_no_espera_el_envio_del_push(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
):
    """`add` vuelve con el aviso guardado aunque el proveedor de push todavía
    no haya contestado; el push sale igual, después."""
    user_id = await _worker_with_subscription(
        client, "push_lento@staffya.com", "https://fcm.googleapis.com/fcm/send/lento"
    )
    sender = _GatedPushSender()
    monkeypatch.setattr(
        "app.modules.notification.infrastructure.repositories._get_push_sender",
        lambda: sender,
    )

    async with session_factory() as session:
        created = await SqlAlchemyNotificationRepository(session).add(
            Notification(
                user_id=user_id,
                type=NotificationType.NEW_APPLICANT,
                title="Nueva postulación",
                message="Alguien se postuló.",
            )
        )
    assert created.id is not None
    assert sender.sent == []  # el request ya terminó y el push sigue en curso
    assert await drain_pending_pushes(timeout=0.05) == 1

    sender.gate.set()
    assert await drain_pending_pushes() == 0
    assert [s.title for s in sender.sent] == ["Nueva postulación"]


async def test_suscripcion_dada_de_baja_se_purga_con_una_sesion_propia(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
):
    """Si el proveedor contesta 404/410 (GONE), la suscripción se borra aunque
    la sesión del request ya esté cerrada: la purga abre una sesión propia."""
    user_id = await _worker_with_subscription(
        client, "push_gone@staffya.com", "https://fcm.googleapis.com/fcm/send/gone"
    )
    sender = _GatedPushSender(result=PushSendResult.GONE)
    monkeypatch.setattr(
        "app.modules.notification.infrastructure.repositories._get_push_sender",
        lambda: sender,
    )

    async with session_factory() as session:
        await SqlAlchemyNotificationRepository(session).add(
            Notification(
                user_id=user_id,
                type=NotificationType.SHIFT_ASSIGNED,
                title="Aviso",
                message="A un dispositivo dado de baja.",
            )
        )
    # La sesión del "request" ya se cerró; recién ahora contesta el proveedor.
    sender.gate.set()
    assert await drain_pending_pushes() == 0

    async with session_factory() as session:
        restantes = await SqlAlchemyPushSubscriptionRepository(session).list_by_user(user_id)
    assert restantes == []


async def test_apagado_espera_los_push_y_loguea_los_que_no_terminan(
    caplog: pytest.LogCaptureFixture,
):
    """Al apagar la app (lifespan), un push que no termina a tiempo se cancela
    y queda en el log, no se pierde en silencio."""
    trabado = asyncio.Event()
    task = spawn_push_task(trabado.wait())

    with caplog.at_level(logging.WARNING):
        assert await shutdown_pending_pushes(timeout=0.05) == 1
    await asyncio.sleep(0)
    assert task.cancelled()
    assert "1 envío(s) de push sin terminar" in caplog.text
    assert await shutdown_pending_pushes(timeout=0.05) == 0
