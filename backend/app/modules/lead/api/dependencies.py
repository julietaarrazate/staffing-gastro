"""Dependencias de FastAPI del módulo lead."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.lead.application.services import LeadService
from app.modules.lead.domain.repositories import PlaceSource
from app.modules.lead.infrastructure.overpass_place_source import OverpassPlaceSource
from app.modules.lead.infrastructure.repositories import SqlAlchemyLeadRepository


def get_place_source() -> PlaceSource:
    """Fuente de comercios. Los tests la reemplazan con una falsa."""
    return OverpassPlaceSource()


def get_lead_service(
    session: Annotated[AsyncSession, Depends(get_session)],
    places: Annotated[PlaceSource, Depends(get_place_source)],
) -> LeadService:
    return LeadService(leads=SqlAlchemyLeadRepository(session), places=places)
