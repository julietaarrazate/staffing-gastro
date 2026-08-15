"""Esquemas HTTP (Pydantic) del módulo saved_shift."""

from pydantic import BaseModel


class SavedShiftStatusResponse(BaseModel):
    is_saved: bool
