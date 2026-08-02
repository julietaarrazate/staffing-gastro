"""Scheduler en proceso del ciclo de vida del turno.

Dos chequeos independientes, un solo loop:

1. **Asistencia (ADR-0008):** turnos CONFIRMADO/EN_CAMINO sin check-in —
   manda un recordatorio push de "¿ya llegaste?" una sola vez, o marca
   no-show automático si ya pasó el período de gracia.
2. **Escalada de urgencia:** turnos abiertos (PUBLICADO/BUSCANDO_PERSONAL)
   que no se cubren rápido — los marca `urgent` y avisa a un círculo más
   amplio de candidatos (`ShiftService.escalate_urgency`).

Corre como un loop `asyncio` arrancado en el `lifespan` de FastAPI
(`app/main.py`) — no un servicio de Cron aparte: el plan free de Render sólo
tiene un web service (ver `render.yaml`), así que agregar infraestructura
nueva no es necesario ni gratis. Gateado a producción
(`settings.is_production`) para no correr durante los tests: el único test
que dispara el lifespan (`test_chat.py`, vía `TestClient`) no debe quedar
esperando un loop infinito ni tocando la base de datos de fondo.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.modules.application.infrastructure.repositories import (
    SqlAlchemyShiftApplicationRepository,
)
from app.modules.company.infrastructure.repositories import (
    SqlAlchemyCompanyProfileRepository,
)
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.matching.infrastructure.repositories import (
    SqlAlchemyCandidateRepository,
)
from app.modules.notification.infrastructure.null_email_sender import NullEmailSender
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from app.modules.shift.application.services import (
    CHECKIN_REMINDER_DELAY,
    ESCALATION_DELAY,
    NO_SHOW_GRACE_PERIOD,
    ShiftService,
)
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from app.modules.subscription.infrastructure.repositories import (
    SqlAlchemySubscriptionRepository,
)
from app.modules.worker.infrastructure.repositories import (
    SqlAlchemyWorkerProfileRepository,
)

logger = logging.getLogger(__name__)

# Cada cuánto corre el chequeo. No necesita ser fino: los umbrales de arriba
# se miden en minutos/horas, así que revisar cada 5 minutos alcanza sin
# generar carga.
CHECK_INTERVAL = timedelta(minutes=5)


def _naive(dt: datetime) -> datetime:
    return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt


def _build_service(session) -> ShiftService:
    return ShiftService(
        shifts=SqlAlchemyShiftRepository(session),
        workers=SqlAlchemyWorkerProfileRepository(session),
        companies=SqlAlchemyCompanyProfileRepository(session),
        notifications=SqlAlchemyNotificationRepository(session),
        applications=SqlAlchemyShiftApplicationRepository(session),
        subscriptions=SqlAlchemySubscriptionRepository(session),
        users=SqlAlchemyUserRepository(session),
        email_sender=NullEmailSender(),
        # Sin esto `escalate_urgency` no podría avisar a nadie (mismo puerto
        # que habilita el aviso al publicar, ver `get_shift_service`).
        candidates=SqlAlchemyCandidateRepository(session),
    )


async def run_attendance_check() -> None:
    """Una pasada del chequeo de asistencia. Público para poder testearlo
    sin el loop."""
    async with AsyncSessionLocal() as session:
        service = _build_service(session)
        now = datetime.now(timezone.utc)
        shifts = await service.list_shifts_awaiting_checkin()
        for shift in shifts:
            elapsed = _naive(now) - _naive(shift.start_at)
            if elapsed < CHECKIN_REMINDER_DELAY:
                continue
            if elapsed >= NO_SHOW_GRACE_PERIOD:
                await service.auto_mark_no_show(shift.id)
            elif shift.checkin_reminder_sent_at is None:
                await service.send_checkin_reminder(shift.id)


async def run_escalation_check() -> None:
    """Una pasada del chequeo de escalada de urgencia. Público para poder
    testearlo sin el loop."""
    async with AsyncSessionLocal() as session:
        service = _build_service(session)
        now = datetime.now(timezone.utc)
        shifts = await service.list_shifts_awaiting_escalation()
        for shift in shifts:
            if shift.published_at is None:
                continue
            elapsed = _naive(now) - _naive(shift.published_at)
            if elapsed >= ESCALATION_DELAY:
                await service.escalate_urgency(shift.id)


async def scheduler_loop() -> None:
    """Loop infinito: corre ambos chequeos cada `CHECK_INTERVAL`.

    Los errores de una pasada no matan el loop (best-effort, mismo criterio
    que el resto de las tareas de fondo del repo, ej. el push best-effort de
    `SqlAlchemyNotificationRepository`) — se logean y se reintenta en el
    próximo tick. Un chequeo que falla no bloquea al otro."""
    while True:
        try:
            await run_attendance_check()
        except Exception:
            logger.exception("Error en el chequeo de asistencia")
        try:
            await run_escalation_check()
        except Exception:
            logger.exception("Error en el chequeo de escalada de urgencia")
        await asyncio.sleep(CHECK_INTERVAL.total_seconds())


def start_scheduler() -> asyncio.Task | None:
    """Arranca el loop como task de fondo, sólo en producción.

    En desarrollo/tests (`settings.is_production` False) es un no-op, mismo
    patrón "flag por ausencia" que el resto del repo (Sentry, VAPID, Google,
    Resend) — nunca corre en `pytest` ni en un entorno local sin querer."""
    if not settings.is_production:
        return None
    return asyncio.create_task(scheduler_loop())
