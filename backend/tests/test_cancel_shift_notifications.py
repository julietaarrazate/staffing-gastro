"""A quién se le avisa cuando el comercio cancela un turno (T3e: U076, U077).

Un test por estado desde el que se puede cancelar: publicado, con
postulantes, asignado sin confirmar, confirmado y con la llegada marcada.
En cada uno se mira quién recibe aviso, quién no, y que sea uno solo por
persona. La regla de cancelación tardía (ADR-0007) no cambia: sólo cuenta
con el trabajador ya comprometido.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from app.modules.notification.domain.value_objects import NotificationType, deep_link_for
from app.modules.notification.infrastructure.fake_push_sender import FakePushSender
from app.modules.notification.infrastructure.push_tasks import drain_pending_pushes
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio

_CANCEL_TYPES = {"shift_cancelled", "shift_cancelled_late", "applied_shift_cancelled"}
_SHIFT_TITLE = "Mozo para el sábado"


async def _employer(client: AsyncClient, email: str, name: str = "Bar Palermo") -> dict:
    headers = await auth_headers(client, "employer", email, name)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": name, "city": "Palermo"},
    )
    return headers


async def _worker(client: AsyncClient, email: str, full_name: str) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email, full_name)
    profile = await client.post(
        "/api/v1/workers/me/profile", headers=headers, json={"skills": ["mozo"]}
    )
    return headers, profile.json()["id"]


async def _published_shift(client: AsyncClient, employer: dict) -> str:
    # A 15 minutos: abierto para postularse y dentro de la ventana en la que
    # ya se puede marcar la llegada (mismo criterio que
    # `test_no_show_and_late_cancellation.py`).
    start = datetime.now(timezone.utc) + timedelta(minutes=15)
    end = start + timedelta(hours=7)
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json={
            "title": _SHIFT_TITLE,
            "position": "mozo",
            "quantity": 1,
            "start_at": start.replace(tzinfo=None).isoformat(),
            "end_at": end.replace(tzinfo=None).isoformat(),
            "pay_amount": "70000.00",
            "city": "Palermo",
        },
    )
    assert created.status_code == 201, created.text
    shift_id = created.json()["id"]
    published = await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    assert published.status_code == 200, published.text
    return shift_id


async def _apply(client: AsyncClient, shift_id: str, worker: dict) -> str:
    applied = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    assert applied.status_code == 201, applied.text
    return applied.json()["id"]


async def _cancel(client: AsyncClient, shift_id: str, employer: dict, **extra_headers):
    return await client.post(
        f"/api/v1/shifts/{shift_id}/cancel", headers={**employer, **extra_headers}
    )


async def _cancel_notices(client: AsyncClient, headers: dict) -> list[dict]:
    """Los avisos de cancelación que le llegaron a esta cuenta (los demás
    tipos, como «turno cerca» o «te asignaron», no cuentan acá)."""
    listed = await client.get("/api/v1/notifications", headers=headers)
    assert listed.status_code == 200
    return [n for n in listed.json() if n["type"] in _CANCEL_TYPES]


async def _application_status(client: AsyncClient, shift_id: str, worker: dict) -> str:
    mine = await client.get("/api/v1/applications/mine", headers=worker)
    return next(a["status"] for a in mine.json() if a["shift_id"] == shift_id)


async def _late_cancellations(client: AsyncClient, employer: dict) -> int:
    profile = await client.get("/api/v1/companies/me/profile", headers=employer)
    return profile.json()["late_cancellations"]


# --- Por estado -------------------------------------------------------------


async def test_publicado_sin_postulantes_no_avisa_a_nadie(client: AsyncClient):
    employer = await _employer(client, "ca_emp1@staffya.com")
    bystander, _ = await _worker(client, "ca_w1@staffya.com", "Ana Sin Postular")
    shift_id = await _published_shift(client, employer)

    cancelled = await _cancel(client, shift_id, employer)

    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelado"
    # Quien no se postuló no recibe nada, aunque le haya llegado «turno cerca».
    assert await _cancel_notices(client, bystander) == []
    assert await _cancel_notices(client, employer) == []
    assert await _late_cancellations(client, employer) == 0


async def test_con_postulantes_avisa_a_cada_postulacion_pendiente(client: AsyncClient):
    """U076: antes no le llegaba nada a nadie."""
    employer = await _employer(client, "ca_emp2@staffya.com")
    shift_id = await _published_shift(client, employer)
    ana, _ = await _worker(client, "ca_w2a@staffya.com", "Ana Gomez")
    beto, _ = await _worker(client, "ca_w2b@staffya.com", "Beto Ruiz")
    caro, _ = await _worker(client, "ca_w2c@staffya.com", "Caro Diaz")
    dani, _ = await _worker(client, "ca_w2d@staffya.com", "Dani Sosa")
    await _apply(client, shift_id, ana)
    await _apply(client, shift_id, beto)
    # Caro se postuló y retiró la postulación: ya no está en carrera.
    caro_application = await _apply(client, shift_id, caro)
    withdrawn = await client.post(
        f"/api/v1/applications/{caro_application}/withdraw", headers=caro
    )
    assert withdrawn.status_code == 200

    cancelled = await _cancel(client, shift_id, employer)
    assert cancelled.status_code == 200

    for headers in (ana, beto):
        notices = await _cancel_notices(client, headers)
        assert [n["type"] for n in notices] == ["applied_shift_cancelled"]
        assert notices[0]["title"] == "Se canceló un turno al que te postulaste"
        assert notices[0]["message"] == (
            f'El comercio canceló "{_SHIFT_TITLE}". Tu postulación quedó sin '
            "efecto: mirá otros turnos cerca."
        )
        # La postulación deja de figurar como pendiente.
        assert await _application_status(client, shift_id, headers) == "rechazada"

    # Ni la que retiró la postulación ni quien nunca se postuló.
    assert await _cancel_notices(client, caro) == []
    assert await _application_status(client, shift_id, caro) == "retirada"
    assert await _cancel_notices(client, dani) == []
    # Sin nadie comprometido no es cancelación tardía.
    assert await _late_cancellations(client, employer) == 0


async def test_el_aviso_al_postulante_no_nombra_a_los_otros_postulantes(
    client: AsyncClient,
):
    employer = await _employer(client, "ca_emp3@staffya.com")
    shift_id = await _published_shift(client, employer)
    ana, _ = await _worker(client, "ca_w3a@staffya.com", "Ana Gomez")
    beto, _ = await _worker(client, "ca_w3b@staffya.com", "Beto Ruiz")
    await _apply(client, shift_id, ana)
    await _apply(client, shift_id, beto)

    await _cancel(client, shift_id, employer)

    (notice,) = await _cancel_notices(client, ana)
    text = f"{notice['title']} {notice['message']}"
    assert "Beto" not in text and "Ruiz" not in text
    assert "ca_w3b@staffya.com" not in text
    # El destino es genérico: no lleva un id ni datos de nadie.
    assert notice["link"] is None


async def test_asignado_sin_confirmar_avisa_al_asignado(client: AsyncClient):
    """U077: el panel decía «se le avisa» y al trabajador no le llegaba nada."""
    employer = await _employer(client, "ca_emp4@staffya.com")
    shift_id = await _published_shift(client, employer)
    ana, ana_profile_id = await _worker(client, "ca_w4a@staffya.com", "Ana Gomez")
    beto, _ = await _worker(client, "ca_w4b@staffya.com", "Beto Ruiz")
    await _apply(client, shift_id, ana)
    await _apply(client, shift_id, beto)
    assigned = await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": ana_profile_id},
    )
    assert assigned.json()["status"] == "asignado"

    cancelled = await _cancel(client, shift_id, employer)
    assert cancelled.status_code == 200

    notices = await _cancel_notices(client, ana)
    assert [n["type"] for n in notices] == ["shift_cancelled"]
    assert notices[0]["title"] == "El comercio canceló el turno"
    assert notices[0]["message"] == (
        f'"{_SHIFT_TITLE}" se canceló antes de que confirmaras. '
        "Ya no tenés que responder."
    )
    # Beto había quedado afuera al asignarse el turno: su postulación ya no
    # estaba viva y no se le avisa (la regla de no avisarle al que no quedó
    # sigue igual).
    assert await _cancel_notices(client, beto) == []
    # Asignado sin confirmar no es cancelación tardía (ADR-0007).
    assert await _late_cancellations(client, employer) == 0


async def test_asignado_directo_sin_postulacion_tambien_recibe_el_aviso(
    client: AsyncClient,
):
    employer = await _employer(client, "ca_emp5@staffya.com")
    shift_id = await _published_shift(client, employer)
    ana, ana_profile_id = await _worker(client, "ca_w5a@staffya.com", "Ana Gomez")
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": ana_profile_id},
    )

    await _cancel(client, shift_id, employer)

    assert [n["type"] for n in await _cancel_notices(client, ana)] == ["shift_cancelled"]


async def _confirmed(client: AsyncClient, employer: dict, worker: dict, profile_id: str) -> str:
    shift_id = await _published_shift(client, employer)
    await _apply(client, shift_id, worker)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": profile_id},
    )
    confirmed = await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker)
    assert confirmed.json()["status"] == "confirmado"
    return shift_id


async def test_confirmado_avisa_la_cancelacion_tardia_una_sola_vez(client: AsyncClient):
    employer = await _employer(client, "ca_emp6@staffya.com")
    ana, ana_profile_id = await _worker(client, "ca_w6a@staffya.com", "Ana Gomez")
    shift_id = await _confirmed(client, employer, ana, ana_profile_id)

    cancelled = await _cancel(client, shift_id, employer)
    assert cancelled.status_code == 200

    # Sólo el aviso de cancelación tardía: no se suma el de «sin confirmar».
    notices = await _cancel_notices(client, ana)
    assert [n["type"] for n in notices] == ["shift_cancelled_late"]
    assert await _late_cancellations(client, employer) == 1


async def test_con_llegada_marcada_avisa_la_cancelacion_tardia(client: AsyncClient):
    employer = await _employer(client, "ca_emp7@staffya.com")
    ana, ana_profile_id = await _worker(client, "ca_w7a@staffya.com", "Ana Gomez")
    shift_id = await _confirmed(client, employer, ana, ana_profile_id)
    checked_in = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers=ana,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    assert checked_in.json()["status"] == "check_in"

    cancelled = await _cancel(client, shift_id, employer)
    assert cancelled.status_code == 200

    notices = await _cancel_notices(client, ana)
    assert [n["type"] for n in notices] == ["shift_cancelled_late"]
    assert await _late_cancellations(client, employer) == 1


# --- Sin duplicados ---------------------------------------------------------


async def test_cancelar_dos_veces_no_duplica_el_aviso(client: AsyncClient):
    employer = await _employer(client, "ca_emp8@staffya.com")
    shift_id = await _published_shift(client, employer)
    ana, _ = await _worker(client, "ca_w8a@staffya.com", "Ana Gomez")
    await _apply(client, shift_id, ana)

    first = await _cancel(client, shift_id, employer)
    second = await _cancel(client, shift_id, employer)

    assert first.status_code == 200
    # Un turno cancelado no se vuelve a cancelar.
    assert second.status_code == 400
    assert len(await _cancel_notices(client, ana)) == 1


async def test_reintento_con_la_misma_clave_no_duplica_el_aviso(client: AsyncClient):
    """El reintento de red (misma `Idempotency-Key`) devuelve la respuesta
    guardada: no vuelve a cancelar ni a avisar."""
    employer = await _employer(client, "ca_emp9@staffya.com")
    ana, ana_profile_id = await _worker(client, "ca_w9a@staffya.com", "Ana Gomez")
    shift_id = await _confirmed(client, employer, ana, ana_profile_id)
    key = {"Idempotency-Key": "cancelar-avisa-reintento"}

    first = await _cancel(client, shift_id, employer, **key)
    retry = await _cancel(client, shift_id, employer, **key)

    assert first.status_code == 200 and retry.status_code == 200
    assert len(await _cancel_notices(client, ana)) == 1
    assert await _late_cancellations(client, employer) == 1


# --- No-disclosure ----------------------------------------------------------


async def test_turno_ajeno_o_inexistente_es_404_y_no_avisa(client: AsyncClient):
    owner = await _employer(client, "ca_emp10@staffya.com")
    stranger = await _employer(client, "ca_emp10b@staffya.com", "Otro Bar")
    shift_id = await _published_shift(client, owner)
    ana, _ = await _worker(client, "ca_w10a@staffya.com", "Ana Gomez")
    await _apply(client, shift_id, ana)

    foreign = await _cancel(client, shift_id, stranger)
    missing = await _cancel(client, "00000000-0000-0000-0000-000000000000", stranger)

    assert foreign.status_code == 404
    assert missing.status_code == 404
    # Mismo cuerpo: no se distingue «no es tuyo» de «no existe».
    assert foreign.json() == missing.json()
    assert await _cancel_notices(client, ana) == []
    assert await _application_status(client, shift_id, ana) == "pendiente"
    shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=owner)
    assert shift.json()["status"] != "cancelado"


# --- Un fallo de los avisos no rompe la cancelación -------------------------


async def test_si_fallan_los_avisos_la_cancelacion_queda_completa(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
):
    """Si guardar el aviso explota, el comercio no recibe un 500 por un turno
    que ya quedó cancelado, y nada queda a medias: postulaciones rechazadas."""
    employer = await _employer(client, "ca_emp11@staffya.com")
    shift_id = await _published_shift(client, employer)
    ana, _ = await _worker(client, "ca_w11a@staffya.com", "Ana Gomez")
    await _apply(client, shift_id, ana)

    async def _boom(self, *args, **kwargs):
        raise RuntimeError("avisos caídos")

    monkeypatch.setattr(SqlAlchemyNotificationRepository, "add", _boom)
    monkeypatch.setattr(SqlAlchemyNotificationRepository, "add_many", _boom)

    cancelled = await _cancel(client, shift_id, employer)

    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelado"
    assert await _application_status(client, shift_id, ana) == "rechazada"


async def test_si_fallan_los_avisos_la_cancelacion_tardia_igual_se_cuenta(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
):
    employer = await _employer(client, "ca_emp12@staffya.com")
    ana, ana_profile_id = await _worker(client, "ca_w12a@staffya.com", "Ana Gomez")
    shift_id = await _confirmed(client, employer, ana, ana_profile_id)

    async def _boom(self, *args, **kwargs):
        raise RuntimeError("avisos caídos")

    monkeypatch.setattr(SqlAlchemyNotificationRepository, "add", _boom)
    monkeypatch.setattr(SqlAlchemyNotificationRepository, "add_many", _boom)

    cancelled = await _cancel(client, shift_id, employer)

    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelado"
    assert await _late_cancellations(client, employer) == 1


async def test_push_caido_no_rompe_la_cancelacion_y_el_aviso_queda_en_la_campanita(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
):
    employer = await _employer(client, "ca_emp13@staffya.com")
    shift_id = await _published_shift(client, employer)
    ana, _ = await _worker(client, "ca_w13a@staffya.com", "Ana Gomez")
    await _apply(client, shift_id, ana)
    await client.post(
        "/api/v1/push/subscribe",
        json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/cancelar-caido",
            "keys": {"p256dh": "p", "auth": "a"},
        },
        headers=ana,
    )
    monkeypatch.setattr(
        "app.modules.notification.infrastructure.repositories._get_push_sender",
        lambda: FakePushSender(raise_on_send=True),
    )

    cancelled = await _cancel(client, shift_id, employer)
    await drain_pending_pushes()

    assert cancelled.status_code == 200
    assert len(await _cancel_notices(client, ana)) == 1


# --- Push -------------------------------------------------------------------


async def test_el_aviso_tambien_sale_por_push_uno_por_persona(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
):
    employer = await _employer(client, "ca_emp14@staffya.com")
    shift_id = await _published_shift(client, employer)
    ana, _ = await _worker(client, "ca_w14a@staffya.com", "Ana Gomez")
    await _apply(client, shift_id, ana)
    await client.post(
        "/api/v1/push/subscribe",
        json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/cancelar-ok",
            "keys": {"p256dh": "p", "auth": "a"},
        },
        headers=ana,
    )
    fake_sender = FakePushSender()
    monkeypatch.setattr(
        "app.modules.notification.infrastructure.repositories._get_push_sender",
        lambda: fake_sender,
    )

    await _cancel(client, shift_id, employer)
    await drain_pending_pushes()

    assert [p.title for p in fake_sender.sent] == [
        "Se canceló un turno al que te postulaste"
    ]


async def test_destino_de_los_avisos_nuevos():
    # Al asignado, su lista: el turno sigue ahí, marcado como cancelado.
    assert deep_link_for(NotificationType.SHIFT_CANCELLED) == "/my-shifts"
    # Al postulante, el Inicio: su postulación ya no figura en ninguna lista.
    assert deep_link_for(NotificationType.APPLIED_SHIFT_CANCELLED) == "/feed"
    # Entran en la columna `notifications.type` (String(30)), sin migración.
    assert all(len(t.value) <= 30 for t in NotificationType)
