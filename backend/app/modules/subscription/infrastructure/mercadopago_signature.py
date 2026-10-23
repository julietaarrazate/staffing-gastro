"""Validación de la firma `x-signature` de los webhooks de Mercado Pago.

Formato documentado por Mercado Pago (Webhooks → "Validar origen de la
notificación"):

- Header `x-signature: ts=<timestamp>,v1=<hmac>`.
- Header `x-request-id`.
- Manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, donde
  `data.id` viene del query param de la URL (en minúsculas si es
  alfanumérico). Si falta alguno de los valores, se saca esa parte del
  template.
- `v1` = HMAC-SHA256 del manifest con la clave secreta del webhook, en hex.

Funciones puras (sin red ni config) para poder probarlas con una clave de
test. Ver ADR-0021.
"""

import hashlib
import hmac


def parse_signature_header(header: str) -> tuple[str | None, str | None]:
    """`ts=...,v1=...` → `(ts, v1)`. Tolera espacios y orden distinto."""
    ts: str | None = None
    v1: str | None = None
    for part in header.split(","):
        key, _, value = part.strip().partition("=")
        if key == "ts":
            ts = value.strip()
        elif key == "v1":
            v1 = value.strip()
    return ts, v1


def build_manifest(*, data_id: str | None, request_id: str | None, ts: str) -> str:
    parts = []
    if data_id:
        parts.append(f"id:{data_id.lower()};")
    if request_id:
        parts.append(f"request-id:{request_id};")
    parts.append(f"ts:{ts};")
    return "".join(parts)


def sign(secret: str, manifest: str) -> str:
    return hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()


def verify_signature(
    *, secret: str, x_signature: str | None, request_id: str | None, data_id: str | None
) -> bool:
    """True sólo si la firma corresponde a esta notificación y a esta clave."""
    if not secret or not x_signature:
        return False
    ts, v1 = parse_signature_header(x_signature)
    if not ts or not v1:
        return False
    expected = sign(secret, build_manifest(data_id=data_id, request_id=request_id, ts=ts))
    return hmac.compare_digest(expected, v1.lower())
