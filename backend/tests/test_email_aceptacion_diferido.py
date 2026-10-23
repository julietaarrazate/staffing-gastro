"""El email de aceptación sale DESPUÉS de responder (2026-10-23).

`POST /shifts/{id}/assign` esperaba al proveedor de email (hasta 10 s) antes
de contestarle al comercio. Ahora las lecturas para armar el mail siguen en
el request, pero el envío se entrega a `run_after_response` (en la API,
`BackgroundTasks.add_task`). Con httpx + ASGITransport las background tasks
corren antes de que vuelva la respuesta, así que los tests de ruta no ven la
diferencia: esto lo prueba sobre el servicio.
"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.modules.notification.infrastructure.fake_email_sender import FakeEmailSender
from app.modules.shift.application.services import ShiftService
from app.modules.worker.domain.value_objects import WorkerSkill


def _service(email_sender, run_after_response=None) -> ShiftService:
    workers = MagicMock()
    workers.get_by_id = AsyncMock(return_value=SimpleNamespace(user_id=uuid4()))
    users = MagicMock()
    users.get_by_id = AsyncMock(
        return_value=SimpleNamespace(email="w@staffya.com", full_name="Ana")
    )
    companies = MagicMock()
    companies.get_by_id = AsyncMock(return_value=SimpleNamespace(name="Bar Palermo"))
    return ShiftService(
        shifts=MagicMock(),
        workers=workers,
        companies=companies,
        notifications=MagicMock(),
        applications=MagicMock(),
        subscriptions=MagicMock(),
        users=users,
        email_sender=email_sender,
        run_after_response=run_after_response,
    )


def _shift():
    start = datetime.now(UTC) + timedelta(days=1)
    return SimpleNamespace(
        company_id=uuid4(),
        position=WorkerSkill.MOZO,
        start_at=start,
        end_at=start + timedelta(hours=6),
    )


async def test_con_run_after_response_el_envio_queda_para_despues():
    sender = FakeEmailSender()
    diferidos: list[tuple] = []
    service = _service(sender, lambda fn, *args: diferidos.append((fn, args)))

    await service._send_acceptance_email(uuid4(), _shift())

    assert sender.sent == []  # no esperó al proveedor
    assert len(diferidos) == 1
    fn, args = diferidos[0]
    await fn(*args)
    assert len(sender.sent) == 1
    assert sender.sent[0].to == "w@staffya.com"
    assert "Bar Palermo" in sender.sent[0].subject


async def test_sin_run_after_response_envia_en_el_momento():
    sender = FakeEmailSender()
    await _service(sender)._send_acceptance_email(uuid4(), _shift())
    assert len(sender.sent) == 1


async def test_el_envio_diferido_que_falla_no_explota():
    sender = FakeEmailSender()
    sender.raise_on_send = True
    diferidos: list[tuple] = []
    service = _service(sender, lambda fn, *args: diferidos.append((fn, args)))

    await service._send_acceptance_email(uuid4(), _shift())
    fn, args = diferidos[0]
    await fn(*args)  # se loguea, no se propaga
