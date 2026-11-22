"""Dependencias de FastAPI del módulo lead."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.lead.application.services import LeadService
from app.modules.lead.infrastructure.repositories import (
    SqlAlchemyLeadRepository,
    SqlAlchemyPlaceSnapshotRepository,
)


def get_lead_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> LeadService:
    # Ya no hay fuente en vivo: se importa desde la copia semanal (ADR-0029).
    return LeadService(
        leads=SqlAlchemyLeadRepository(session),
        snapshots=SqlAlchemyPlaceSnapshotRepository(session),
    )
