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
import hmac
import re
import time
import uuid
from dataclasses import dataclass
from urllib.parse import urlencode
from uuid import UUID

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


# Tipo de entrega de los archivos con datos personales: DNI, selfie,
# constancia de AFIP y CV (ADR-0021, actualización 2026-11-19).
# `authenticated`: ni el original ni NINGUNA versión transformada se entregan
# por `res.cloudinary.com` sin una firma del servidor. Quien puede verlos
# recibe un link de la API de descarga firmado y con vencimiento
# (`private_download_url`). Antes subían como `upload` (público): cualquiera
# con el link los veía para siempre.
PROTECTED_DELIVERY_TYPE = "authenticated"

# El tipo que usó el ADR-0021 del 2026-10-23 al 2026-11-19. `private` protege
# sólo el ORIGINAL: Cloudinary entrega sin firma cualquier versión
# transformada (`…/image/private/w_2000/<public_id>.jpg`, o `pg_1` para cada
# página de un PDF). Las evidencias pendientes de entonces lo siguen teniendo
# hasta correr `scripts/privatize_identity_evidence.py`, que las pasa a
# `authenticated`.
OLD_PRIVATE_DELIVERY_TYPE = "private"

# Cuánto dura el link que ve el admin al revisar una evidencia (ADR-0021).
# Alcanza para mirar la foto o abrir el PDF; si se filtra, vence enseguida.
PRIVATE_LINK_TTL_SECONDS = 5 * 60

API_BASE = "https://api.cloudinary.com/v1_1"


class CloudinaryNotConfiguredError(Exception):
    """`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` (o, para los links de
    descarga, `CLOUDINARY_CLOUD_NAME`) no están seteadas."""


def sign_upload(
    allowed_formats: str,
    folder: str,
    delivery_type: str | None = None,
    public_id: str | None = None,
) -> dict[str, str]:
    """Parámetros que el cliente necesita para subir un archivo directo a
    Cloudinary con una subida firmada (sin `upload_preset`).

    `allowed_formats` viaja **dentro de la firma**: el cliente no lo puede
    ampliar sin invalidarla. Por eso cada caso de uso pasa su lista y no hay
    una sola global — el que sube una constancia no puede subir un `.docx`
    aunque el endpoint del CV sí lo permita.

    También van firmados la carpeta, un nombre de archivo al azar que decide
    el servidor (`public_id`) y `overwrite=false`: el cliente no puede elegir
    dónde ni con qué nombre guarda, ni pisar un archivo que ya existe.

    Con `delivery_type` (`authenticated` para los documentos de identidad y
    el CV, ADR-0021) también viaja firmado el `type`: el cliente no puede
    subir un DNI como público sin invalidar la firma.

    `public_id` lo pasa quien necesita un nombre con marca (el CV,
    `cv_public_id_for`); si no, es uno al azar."""
    if not settings.cloudinary_api_key or not settings.cloudinary_api_secret:
        raise CloudinaryNotConfiguredError()

    params_to_sign = {
        "allowed_formats": allowed_formats,
        "folder": folder,
        "overwrite": "false",
        "public_id": public_id or uuid.uuid4().hex,
        "timestamp": str(int(time.time())),
    }
    if delivery_type:
        params_to_sign["type"] = delivery_type
    return {
        **params_to_sign,
        "signature": _sign(params_to_sign, settings.cloudinary_api_secret),
        "api_key": settings.cloudinary_api_key,
    }


def sign_cv_upload(owner_id: UUID) -> dict[str, str]:
    """Firma para el CV del trabajador. Protegido (`authenticated`), como los
    documentos de identidad (ADR-0021, actualización 2026-11-19): el CV trae
    teléfono, email y domicilio. El nombre del archivo lleva la marca de quien
    lo sube (`cv_public_id_for`)."""
    if not settings.cloudinary_api_key or not settings.cloudinary_api_secret:
        raise CloudinaryNotConfiguredError()
    return sign_upload(
        ALLOWED_CV_FORMATS,
        FOLDERS["cv"],
        PROTECTED_DELIVERY_TYPE,
        public_id=cv_public_id_for(owner_id),
    )


# El nombre de un CV es `<32 hex al azar><32 hex de marca>`, y la marca es un
# HMAC del dueño (ADR-0021, actualización 2026-11-19). El link que vence
# muestra el `public_id`: sin la marca, un comercio que abrió el CV una vez
# podía crearse una cuenta de trabajador, ponerse ese mismo archivo en su
# perfil y pedir links para siempre (o hacerlo borrar al «sacarlo»). Con la
# marca, el perfil sólo acepta un archivo nuevo que subió esa misma cuenta.
# Un `raw` (Word) puede volver con la extensión pegada al nombre.
_CV_PUBLIC_ID = re.compile(
    rf"^(?:{re.escape(FOLDERS['cv'])}/)?(?P<nonce>[0-9a-f]{{32}})(?P<mark>[0-9a-f]{{32}})"
    r"(?:\.[a-z0-9]{1,10})?$"
)


def _cv_mark(owner_id: UUID, nonce: str) -> str:
    message = f"oido-cv:{owner_id}:{nonce}".encode()
    key = settings.cloudinary_api_secret.encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()[:32]


def cv_public_id_for(owner_id: UUID) -> str:
    """Nombre al azar para el CV de `owner_id`, con su marca."""
    nonce = uuid.uuid4().hex
    return f"{nonce}{_cv_mark(owner_id, nonce)}"


def is_cv_upload_of(public_id: str, owner_id: UUID) -> bool:
    """¿Este archivo lo subió `owner_id` con una firma de `sign_cv_upload`?
    Acepta el `public_id` con o sin la carpeta (según el modo de carpetas
    de la cuenta) y con la extensión de un `raw`."""
    if not settings.cloudinary_api_secret:
        return False
    match = _CV_PUBLIC_ID.match(public_id)
    if match is None:
        return False
    return hmac.compare_digest(match["mark"], _cv_mark(owner_id, match["nonce"]))


def sign_business_document_upload() -> dict[str, str]:
    """Firma para la constancia de AFIP del comercio (ADR-0013). Protegida
    (`authenticated`, ADR-0021)."""
    return sign_upload(
        ALLOWED_BUSINESS_DOC_FORMATS,
        FOLDERS["business_document"],
        PROTECTED_DELIVERY_TYPE,
    )


def sign_image_upload(kind: str) -> dict[str, str]:
    """Firma para una foto: `profile` (perfil o logo), `cover` (portada del
    comercio) o `identity` (DNI y selfie). Las de identidad suben protegidas
    (`authenticated`, ADR-0021); perfil y portada son públicas a propósito
    (se muestran a todos)."""
    delivery_type = PROTECTED_DELIVERY_TYPE if kind == "identity" else None
    return sign_upload(ALLOWED_IMAGE_FORMATS, FOLDERS[kind], delivery_type)


def signed_api_params(params: dict[str, str]) -> dict[str, str]:
    """Firma parámetros de un pedido a la Upload API de Cloudinary (descarga
    privada, `rename`, `destroy`): descarta los vacíos, agrega `timestamp` si falta, y
    suma `signature` + `api_key`. Mismo algoritmo que `cloudinary.utils.
    sign_request` del SDK oficial."""
    if not settings.cloudinary_api_key or not settings.cloudinary_api_secret:
        raise CloudinaryNotConfiguredError()
    clean = {k: v for k, v in params.items() if v not in (None, "")}
    clean.setdefault("timestamp", str(int(time.time())))
    return {
        **clean,
        "signature": _sign(clean, settings.cloudinary_api_secret),
        "api_key": settings.cloudinary_api_key,
    }


def api_url(resource_type: str, action: str) -> str:
    """`https://api.cloudinary.com/v1_1/<cloud>/<resource_type>/<action>`."""
    if not settings.cloudinary_cloud_name:
        raise CloudinaryNotConfiguredError()
    return f"{API_BASE}/{settings.cloudinary_cloud_name}/{resource_type}/{action}"


def private_download_url(
    public_id: str,
    file_format: str,
    resource_type: str,
    delivery_type: str,
    expires_at: int,
    attachment: bool = False,
) -> str:
    """Link firmado a la API de descarga de Cloudinary que entrega el
    ORIGINAL de un archivo protegido (`authenticated`, o `private` en las
    evidencias de antes del 2026-11-19) y deja de andar en `expires_at`
    (Unix).

    Equivale a `cloudinary.utils.private_download_url` del SDK oficial
    (`GET /v1_1/<cloud>/<resource_type>/download` con `public_id`, `format`,
    `type`, `expires_at`, `timestamp`, firmados). Funciona en cualquier plan;
    la alternativa con vencimiento sobre `res.cloudinary.com` (token-based
    auth) es de los planes pagos (ADR-0021). Sin `attachment` el navegador
    lo muestra en vez de descargarlo (en la cola del admin va directo a un
    `<img>`); con `attachment=True` lo baja (el «Descargar» del CV)."""
    params = signed_api_params(
        {
            "public_id": public_id,
            "format": file_format,
            "type": delivery_type,
            "expires_at": str(expires_at),
            "attachment": "true" if attachment else "",
        }
    )
    return f"{api_url(resource_type, 'download')}?{urlencode(params)}"


_DELIVERY_URL = re.compile(
    r"^https://res\.cloudinary\.com/(?P<cloud>[^/]+)/(?P<rt>image|raw|video)/"
    r"(?P<type>upload|private|authenticated)/(?P<rest>.+)$"
)
_VERSION = re.compile(r"^v\d+$")


@dataclass(frozen=True)
class ParsedUrl:
    public_id: str
    resource_type: str
    format: str
    type: str


def delivery_url_cloud(url: str) -> str | None:
    """El `cloud_name` de una URL de entrega de Cloudinary, o `None` si no
    es una."""
    match = _DELIVERY_URL.match(url.split("?", 1)[0])
    return match["cloud"] if match else None


def parse_cloudinary_url(url: str) -> ParsedUrl | None:
    """`https://res.cloudinary.com/<cloud>/image/upload/v123/oido/identidad/ab.jpg`
    → (`oido/identidad/ab`, `image`, `jpg`, `upload`). Lo que hay antes de la
    versión (`v123`) son transformaciones y se descarta. En `raw` la
    extensión es parte del `public_id` y el formato queda vacío. `None` si no
    es una URL de entrega de Cloudinary. Lo usan los scripts que pasan a
    privados los archivos viejos y el CV (ADR-0021)."""
    match = _DELIVERY_URL.match(url.split("?", 1)[0])
    if not match:
        return None
    segments = match["rest"].split("/")
    for i, segment in enumerate(segments):
        if _VERSION.match(segment):
            segments = segments[i + 1 :]
            break
    path = "/".join(segments)
    if not path:
        return None
    resource_type = match["rt"]
    if resource_type == "raw" or "." not in segments[-1]:
        return ParsedUrl(path, resource_type, "", match["type"])
    public_id, file_format = path.rsplit(".", 1)
    return ParsedUrl(public_id, resource_type, file_format.lower(), match["type"])


# Respuestas de `destroy` que cuentan como borrado (ADR-0021, «Borrado al
# decidir»): "ok", y "not found" (ya no estaba: otra pasada lo borró antes).
# Ojo: un HTTP 404 NO cuenta. Cloudinary lo devuelve también para un
# `cloud_name` que no existe, y tomarlo como borrado haría olvidar la
# referencia de un archivo que sigue ahí.
DESTROY_DONE_RESULTS = frozenset({"ok", "not found"})


class CloudinaryDestroyError(Exception):
    """`destroy` respondió 200 pero sin borrar (un `result` inesperado)."""


def destroy_request(
    public_id: str, resource_type: str, delivery_type: str
) -> tuple[str, dict[str, str]]:
    """URL y parámetros firmados para borrar un archivo con `destroy` de la
    Upload API (`POST /v1_1/<cloud>/<resource_type>/destroy`): `public_id`,
    `type` (el de entrega: `authenticated` para los documentos y el CV) e
    `invalidate=true`, para que el CDN deje de servir una copia en caché.
    Mismos parámetros que `cloudinary.uploader.destroy` del SDK oficial. Es
    de la Upload API a propósito: la Admin API tiene un tope por hora en el
    plan gratis; ésta no."""
    params = signed_api_params(
        {"public_id": public_id, "type": delivery_type, "invalidate": "true"}
    )
    return api_url(resource_type, "destroy"), params


def check_destroy_result(body: object) -> str:
    """Devuelve el `result` si cuenta como borrado; si no, lanza
    `CloudinaryDestroyError` (el pedido queda pendiente y se reintenta)."""
    result = body.get("result") if isinstance(body, dict) else None
    if result not in DESTROY_DONE_RESULTS:
        raise CloudinaryDestroyError(f"destroy respondió {result!r}")
    return str(result)


def _sign(params: dict[str, str], api_secret: str) -> str:
    """Algoritmo de firma de Cloudinary: los parámetros (menos `file`,
    `cloud_name`, `resource_type`, `api_key`) se ordenan alfabéticamente, se
    unen como `k=v&k2=v2`, se les pega el `api_secret` al final sin
    separador, y se hashea con SHA-1 (hex) — ver la documentación oficial de
    "Signed uploads" de Cloudinary."""
    to_sign = "&".join(f"{key}={params[key]}" for key in sorted(params))
    return hashlib.sha1(f"{to_sign}{api_secret}".encode()).hexdigest()
