"""Esquemas HTTP (Pydantic) del módulo saved_shift."""

from uuid import UUID

from pydantic import BaseModel


class SavedShiftStatusResponse(BaseModel):
    is_saved: bool


class SavedShiftIdsResponse(BaseModel):
    shift_ids: list[UUID]
