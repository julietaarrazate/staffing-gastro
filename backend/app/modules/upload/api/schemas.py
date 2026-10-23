"""Esquemas HTTP (Pydantic) del módulo upload."""

from pydantic import BaseModel


class SignedUploadResponse(BaseModel):
    timestamp: str
    signature: str
    api_key: str
    allowed_formats: str
    folder: str
    public_id: str
    overwrite: str
    # Sólo en las subidas privadas (DNI, selfie, constancia; ADR-0021):
    # `private`, firmado. El cliente lo tiene que mandar tal cual.
    type: str | None = None
