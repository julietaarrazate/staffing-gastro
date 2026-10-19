"""Validación de URLs que carga el usuario (fotos, CV, documentos).

El frontend las muestra como enlaces (`<a href>`) o imágenes. Un texto libre
permitía guardar `javascript:…`, `data:…` o un `http://` cualquiera, y quien
abría "Ver CV" o la evidencia en la cola del admin iba a parar ahí
(auditoría de seguridad del 2026-10-14). Sólo se aceptan URLs `https://`
absolutas, con host.
"""

from typing import Annotated
from urllib.parse import urlsplit

from pydantic import AfterValidator, Field


def _https_only(value: str) -> str:
    parts = urlsplit(value.strip())
    if parts.scheme != "https" or not parts.netloc:
        raise ValueError("La dirección tiene que empezar con https://")
    return value.strip()


HttpsUrl = Annotated[str, Field(max_length=512), AfterValidator(_https_only)]
"""URL `https://` de hasta 512 caracteres (el largo de las columnas)."""
