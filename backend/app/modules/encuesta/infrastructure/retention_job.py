"""Retención de la encuesta (ADR-0024): a los 12 meses se borra el contacto.

Un chequeo del scheduler en proceso, inyectado desde `app/main.py` por
`extra_checks` (el scheduler no importa la infraestructura de otros módulos).
Corre como mucho una vez por día y devuelve `None`: no es una deadline que
justifique despertar la base (cuota de Neon).
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.database import AsyncSessionLocal
from app.modules.encuesta.application.services import SurveyService
from app.modules.encuesta.infrastructure.repositories import SqlAlchemySurveyRepository

logger = logging.getLogger(__name__)

INTERVAL = timedelta(hours=24)
_last_run: datetime | None = None


async def run_survey_retention(
    sessions: async_sessionmaker[AsyncSession] | None = None,
    now: datetime | None = None,
    *,
    force: bool = False,
) -> datetime | None:
    """Una pasada. Los parámetros son para los tests; el scheduler la llama
    sin ninguno."""
    global _last_run
    moment = now or datetime.now(timezone.utc)
    if not force and _last_run is not None and moment - _last_run < INTERVAL:
        return None
    async with (sessions or AsyncSessionLocal)() as session:
        purged = await SurveyService(SqlAlchemySurveyRepository(session)).purge_expired_contacts(
            moment
        )
    _last_run = moment
    if purged:
        logger.info("encuesta.contact_purged", extra={"purged": purged})
    return None
