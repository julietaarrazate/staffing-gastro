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
import uuid

from app.core.config import settings

ALLOWED_CV_FORMATS = "pdf,doc,docx,jpg,jpeg,png"

# Constancia de inscripción de AFIP (ADR-0013). Más angosto que el CV a
# propósito: una constancia de AFIP nunca es un documento de Word, y en una
# subida que respalda una decisión de confianza el default correcto es
# aceptar lo mínimo que sirve.
ALLOWED_BUSINESS_DOC_FORMATS = "pdf,jpg,jpeg,png"

# Fotos (perfil, logo, portada, DNI y selfie). Antes subían con un preset
# unsigned que viajaba en el código del navegador: cualquiera podía subir lo
# que quisiera a la cuenta (auditoría de seguridad 2026-10-14).
ALLOWED_IMAGE_FORMATS = "jpg,jpeg,png,webp,heic,heif"

# Carpeta por tipo de subida, para ordenar la cuenta y poder aplicar reglas
# por carpeta (por ejemplo, borrar evidencias de identidad viejas).
FOLDERS = {
    "cv": "oido/cv",
    "business_document": "oido/constancias",
    "profile": "oido/perfiles",
    "cover": "oido/portadas",
    "identity": "oido/identidad",
}


class CloudinaryNotConfiguredError(Exception):
    """`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` no están seteadas."""


def sign_upload(allowed_formats: str, folder: str) -> dict[str, str]:
    """Parámetros que el cliente necesita para subir un archivo directo a
    Cloudinary con una subida firmada (sin `upload_preset`).

    `allowed_formats` viaja **dentro de la firma**: el cliente no lo puede
    ampliar sin invalidarla. Por eso cada caso de uso pasa su lista y no hay
    una sola global — el que sube una constancia no puede subir un `.docx`
    aunque el endpoint del CV sí lo permita.

    También van firmados la carpeta, un nombre de archivo al azar que decide
    el servidor (`public_id`) y `overwrite=false`: el cliente no puede elegir
    dónde ni con qué nombre guarda, ni pisar un archivo que ya existe."""
    if not settings.cloudinary_api_key or not settings.cloudinary_api_secret:
        raise CloudinaryNotConfiguredError()

    params_to_sign = {
        "allowed_formats": allowed_formats,
        "folder": folder,
        "overwrite": "false",
        "public_id": uuid.uuid4().hex,
        "timestamp": str(int(time.time())),
    }
    return {
        **params_to_sign,
        "signature": _sign(params_to_sign, settings.cloudinary_api_secret),
        "api_key": settings.cloudinary_api_key,
    }


def sign_cv_upload() -> dict[str, str]:
    """Firma para el CV del trabajador."""
    return sign_upload(ALLOWED_CV_FORMATS, FOLDERS["cv"])


def sign_business_document_upload() -> dict[str, str]:
    """Firma para la constancia de AFIP del comercio (ADR-0013)."""
    return sign_upload(ALLOWED_BUSINESS_DOC_FORMATS, FOLDERS["business_document"])


def sign_image_upload(kind: str) -> dict[str, str]:
    """Firma para una foto: `profile` (perfil o logo), `cover` (portada del
    comercio) o `identity` (DNI y selfie)."""
    return sign_upload(ALLOWED_IMAGE_FORMATS, FOLDERS[kind])


def _sign(params: dict[str, str], api_secret: str) -> str:
    """Algoritmo de firma de Cloudinary: los parámetros (menos `file`,
    `cloud_name`, `resource_type`, `api_key`) se ordenan alfabéticamente, se
    unen como `k=v&k2=v2`, se les pega el `api_secret` al final sin
    separador, y se hashea con SHA-1 (hex) — ver la documentación oficial de
    "Signed uploads" de Cloudinary."""
    to_sign = "&".join(f"{key}={params[key]}" for key in sorted(params))
    return hashlib.sha1(f"{to_sign}{api_secret}".encode()).hexdigest()
