"""Esquemas HTTP (Pydantic) del módulo upload."""

from pydantic import BaseModel


class SignedUploadResponse(BaseModel):
    timestamp: str
    signature: str
    api_key: str
    allowed_formats: str
