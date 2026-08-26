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

**Despierta por deadline, no por reloj (incidente 2026-08-26, cuota de Neon).**
Antes el loop sondeaba la base cada 5 minutos las 24 horas, aunque no hubiera
nada que hacer — eso mantenía el cómputo de Neon despierto de noche y en horas
muertas y agotaba la cuota del plan free (detalle en `core/database.py`).
Ahora cada pasada calcula **cuándo** es la próxima acción real posible (el
recordatorio/no-show de un turno confirmado, la escalada de un turno recién
publicado) y **duerme hasta ese momento**, no un intervalo fijo. Si no hay
ningún turno pendiente, duerme hasta `MAX_SLEEP` (un latido de seguridad, no
un sondeo). Cuando aparece trabajo nuevo mientras duerme, `notify_scheduler()`
(`scheduler_signal.py`) lo despierta antes de tiempo. Efecto: la base sólo se
toca cuando de verdad hace falta, así que Neon puede suspenderse entre medio.

Un turno publicado para un día futuro ya no despierta nada cada 5 minutos: su
única deadline es la de su propia hora, y el loop duerme hasta ahí.

Al arrancar (y tras cada reinicio de Render, que borra el estado en memoria)
la primera pasada recorre la base y reconstruye la próxima deadline sola — no
hace falta persistir timers.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.dt import naive as _naive
from app.modules.shift.application.scheduler_signal import wait_for_wakeup
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

# Piso del sueño: aunque la próxima deadline sea "ya mismo", nunca se re-
# consulta la base más seguido que esto, para no girar en falso si un turno
# quedara al borde de su umbral. 30s de atraso sobre una escalada de 8
# minutos o un recordatorio de 20 es irrelevante (el sistema viejo llegaba
# hasta 5 minutos tarde).
MIN_SLEEP = timedelta(seconds=30)

# Techo del sueño: latido de seguridad. Aunque no haya ninguna deadline
# pendiente ni llegue ninguna señal, el loop se despierta al menos cada tanto
# para re-chequear — red de contención por si se perdiera una señal o el
# reloj diera un salto. Con la base dormida entre medio, despertarse ~cada 6h
# es intrascendente para la cuota (4 consultas/día, no 288).
MAX_SLEEP = timedelta(hours=6)

# Si un chequeo lanzó una excepción (ej. error transitorio de la base), no
# conviene dormir las 6h del techo: se reintenta pronto, como hacía el loop
# viejo cada 5 minutos.
ERROR_RETRY = timedelta(minutes=5)


def _earlier(a: datetime | None, b: datetime | None) -> datetime | None:
    """La más temprana de dos deadlines, ignorando las `None`."""
    if a is None:
        return b
    if b is None:
        return a
    return min(a, b)


def _seconds_until(next_deadline: datetime | None, *, had_error: bool) -> float:
    """Cuánto dormir hasta la próxima deadline, acotado a [MIN_SLEEP, MAX_SLEEP]
    (o a ERROR_RETRY si la pasada falló)."""
    if next_deadline is None:
        base = MAX_SLEEP.total_seconds()
    else:
        remaining = (next_deadline - _naive(datetime.now(timezone.utc))).total_seconds()
        base = min(max(remaining, MIN_SLEEP.total_seconds()), MAX_SLEEP.total_seconds())
    if had_error:
        base = min(base, ERROR_RETRY.total_seconds())
    return base


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


async def run_attendance_check() -> datetime | None:
    """Una pasada del chequeo de asistencia. Público para poder testearlo
    sin el loop.

    Devuelve la próxima deadline FUTURA que este chequeo conoce (la más
    temprana entre los recordatorios y no-shows todavía pendientes), o `None`
    si no queda nada por vigilar. El loop la usa para saber hasta cuándo
    dormir. La lógica de acción (recordatorio a `CHECKIN_REMINDER_DELAY`,
    no-show a `NO_SHOW_GRACE_PERIOD`) es idéntica a la de antes — sólo se
    agrega el cálculo de la próxima deadline."""
    async with AsyncSessionLocal() as session:
        service = _build_service(session)
        now = _naive(datetime.now(timezone.utc))
        shifts = await service.list_shifts_awaiting_checkin()
        next_deadline: datetime | None = None
        for shift in shifts:
            start = _naive(shift.start_at)
            reminder_at = start + CHECKIN_REMINDER_DELAY
            no_show_at = start + NO_SHOW_GRACE_PERIOD
            elapsed = now - start
            if elapsed >= NO_SHOW_GRACE_PERIOD:
                await service.auto_mark_no_show(shift.id)
                # Se resolvió (salió de CONFIRMADO/EN_CAMINO): no aporta deadline.
                continue
            if shift.checkin_reminder_sent_at is None and elapsed >= CHECKIN_REMINDER_DELAY:
                await service.send_checkin_reminder(shift.id)
                # Ya recordado: su próxima (y última) deadline es el no-show.
                next_deadline = _earlier(next_deadline, no_show_at)
                continue
            # Todavía no accionable: su próxima deadline es el umbral que falta.
            pending = reminder_at if shift.checkin_reminder_sent_at is None else no_show_at
            next_deadline = _earlier(next_deadline, pending)
        return next_deadline


async def run_escalation_check() -> datetime | None:
    """Una pasada del chequeo de escalada de urgencia. Público para poder
    testearlo sin el loop.

    Devuelve la próxima deadline de escalada FUTURA (el `published_at +
    ESCALATION_DELAY` más temprano entre los turnos abiertos sin escalar), o
    `None`. La lógica de acción es idéntica a la de antes."""
    async with AsyncSessionLocal() as session:
        service = _build_service(session)
        now = _naive(datetime.now(timezone.utc))
        shifts = await service.list_shifts_awaiting_escalation()
        next_deadline: datetime | None = None
        for shift in shifts:
            if shift.published_at is None:
                continue
            escalate_at = _naive(shift.published_at) + ESCALATION_DELAY
            if now >= escalate_at:
                await service.escalate_urgency(shift.id)
            else:
                next_deadline = _earlier(next_deadline, escalate_at)
        return next_deadline


async def scheduler_loop() -> None:
    """Loop infinito: corre ambos chequeos y duerme hasta la próxima deadline.

    En vez de un intervalo fijo, cada pasada calcula la deadline más temprana
    entre ambos chequeos y duerme hasta ahí (acotado a [MIN_SLEEP, MAX_SLEEP]),
    despertable antes por `notify_scheduler()` cuando entra trabajo nuevo.

    Los errores de una pasada no matan el loop (best-effort, mismo criterio
    que el resto de las tareas de fondo del repo, ej. el push best-effort de
    `SqlAlchemyNotificationRepository`) — se logean, se reintenta pronto
    (`ERROR_RETRY`) y un chequeo que falla no bloquea al otro."""
    while True:
        next_deadline: datetime | None = None
        had_error = False
        try:
            next_deadline = _earlier(next_deadline, await run_attendance_check())
        except Exception:
            had_error = True
            logger.exception("Error en el chequeo de asistencia")
        try:
            next_deadline = _earlier(next_deadline, await run_escalation_check())
        except Exception:
            had_error = True
            logger.exception("Error en el chequeo de escalada de urgencia")
        await wait_for_wakeup(_seconds_until(next_deadline, had_error=had_error))


def start_scheduler() -> asyncio.Task | None:
    """Arranca el loop como task de fondo, sólo en producción.

    En desarrollo/tests (`settings.is_production` False) es un no-op, mismo
    patrón "flag por ausencia" que el resto del repo (Sentry, VAPID, Google,
    Resend) — nunca corre en `pytest` ni en un entorno local sin querer."""
    if not settings.is_production:
        return None
    return asyncio.create_task(scheduler_loop())
