"""Firma de subidas a Cloudinary (uploads firmados en vez de preset unsigned).

Cloudinary bloquea por default la entrega de recursos raw/PDF subidos con un
`upload_preset` unsigned (medida anti-abuso desde 2023) — es la causa real
confirmada de que un CV subido como PDF suba bien pero no abra
(`ERR_INVALID_RESPONSE`, ver docs/STATUS.md). La subida firmada evita
depender de un toggle de cuenta que puede resetearse, y permite acotar del
lado del servidor qué formatos se aceptan (`allowed_formats` viaja firmado:
el cliente no lo puede alterar sin invalidar la firma).
"""

import hashlib
import time

from app.core.config import settings

ALLOWED_CV_FORMATS = "pdf,doc,docx,jpg,jpeg,png"


class CloudinaryNotConfiguredError(Exception):
    """`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` no están seteadas."""


def sign_cv_upload() -> dict[str, str]:
    """Parámetros que el cliente necesita para subir un CV directo a
    Cloudinary con una subida firmada (sin `upload_preset`)."""
    if not settings.cloudinary_api_key or not settings.cloudinary_api_secret:
        raise CloudinaryNotConfiguredError()

    timestamp = str(int(time.time()))
    params_to_sign = {"allowed_formats": ALLOWED_CV_FORMATS, "timestamp": timestamp}
    return {
        "timestamp": timestamp,
        "signature": _sign(params_to_sign, settings.cloudinary_api_secret),
        "api_key": settings.cloudinary_api_key,
        "allowed_formats": ALLOWED_CV_FORMATS,
    }


def _sign(params: dict[str, str], api_secret: str) -> str:
    """Algoritmo de firma de Cloudinary: los parámetros (menos `file`,
    `cloud_name`, `resource_type`, `api_key`) se ordenan alfabéticamente, se
    unen como `k=v&k2=v2`, se les pega el `api_secret` al final sin
    separador, y se hashea con SHA-1 (hex) — ver la documentación oficial de
    "Signed uploads" de Cloudinary."""
    to_sign = "&".join(f"{key}={params[key]}" for key in sorted(params))
    return hashlib.sha1(f"{to_sign}{api_secret}".encode()).hexdigest()
