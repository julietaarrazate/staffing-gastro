#!/usr/bin/env python
"""fakes.py — servicios de terceros SIMULADOS para la etapa 1 (E1) de Oído.

Un solo proceso FastAPI en el puerto 8901 (http) y 8902 (https, mismo
proceso; lo usa el kit para las subidas de archivos). Nada sale a internet.
Cada bloque devuelve lo que el producto espera leer (se armó leyendo el
código real de `backend/app/...` y `frontend/lib/...`):

  /resend/emails                  Resend            (backend)
  /mailbox                        casilla de prueba (kit)
  /google/tokeninfo               Google tokeninfo  (backend)
  /gsi/client.js                  Google Identity Services falso (navegador)
  /cloudinary/v1_1/<cloud>/...    Upload API: upload, destroy, rename, download
  /res/<cloud>/...                res.cloudinary.com (entrega de archivos)
  /gemini/v1beta/models/...       generateContent determinístico (backend)
  /nominatim/search               buscador de direcciones (navegador)
  /carto/...  /carto-tiles/...    estilo del mapa base, sprites, glyphs, tiles
  /placeholder/photo|avatar       imágenes demo (loremflickr / pravatar)
  /push/<host>/...  /push/outbox  servicio push (sólo registra el envío)
  /overpass/api/interpreter       OpenStreetMap Overpass (captación de leads)

Disparadores de error (por pedido, no globales: no molestan a otros agentes):
  IA:         texto con  E1_IA_CAIDA (503) · E1_IA_INVALIDA (JSON roto) · E1_IA_LENTA (8 s)
  Geocoder:   query con  e1error (503) · zzzz / xxxx (sin resultados)
  Cloudinary: nombre de archivo con  e1fail (500)
  Mails:      destinatario con  e1bounce (Resend responde 422)
"""

from __future__ import annotations

import base64
import colorsys
import hashlib
import html as html_lib
import json
import mimetypes
import os
import re
import struct
import threading
import time
import unicodedata
import uuid
import zlib
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

E1 = Path(os.environ.get("E1_DIR") or "/tmp/oido-e2e")
STATE = E1 / "state"  # certificado TLS y demás estado generado (fuera del repo)
MAILBOX = E1 / "mailbox.jsonl"
CLOUD = E1 / "cloud"
LOGS = E1 / "logs"
for _d in (CLOUD, LOGS, STATE):
    _d.mkdir(parents=True, exist_ok=True)

CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "oido-e1")
CLD_API_KEY = os.environ.get("CLOUDINARY_API_KEY", "111111111111111")
CLD_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET", "e1-fake-cloudinary-secret")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "e1-fake.apps.googleusercontent.com")
ART = timezone(timedelta(hours=-3))

app = FastAPI(title="Oído E1 — servicios simulados", docs_url=None, redoc_url=None)
# Los pedidos del navegador llegan por `route.fulfill` del kit con el origen
# de la app (http://localhost:3100): hace falta CORS abierto, como lo tienen
# Nominatim y Cloudinary de verdad.
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

_lock = threading.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _append_jsonl(path: Path, record: dict) -> None:
    with _lock:
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")


def _read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    out = []
    with _lock:
        lines = path.read_text(encoding="utf-8").splitlines()
    for line in lines:
        try:
            out.append(json.loads(line))
        except ValueError:
            continue
    return out


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "e1-fakes"}


# ─────────────────────────────── Resend ────────────────────────────────────
# backend/app/modules/notification/infrastructure/resend_email_sender.py:
# POST {from, to:[..], subject, html} con Authorization: Bearer; sólo mira el
# status (raise_for_status). Resend responde 200 {"id": "..."}.

_HREF = re.compile(r"""href\s*=\s*["']([^"']+)["']""", re.I)
_TAG = re.compile(r"<[^>]+>")


@app.post("/resend/emails")
async def resend_emails(request: Request):
    if not request.headers.get("authorization", "").lower().startswith("bearer "):
        return JSONResponse(
            {"statusCode": 401, "name": "missing_api_key", "message": "Missing API Key"}, 401
        )
    try:
        body = await request.json()
    except ValueError:
        return JSONResponse(
            {"statusCode": 422, "name": "validation_error", "message": "Invalid JSON"}, 422
        )
    to = body.get("to") or []
    if isinstance(to, str):
        to = [to]
    html = body.get("html") or ""
    if not to or not body.get("subject"):
        return JSONResponse(
            {"statusCode": 422, "name": "missing_required_field", "message": "Missing `to` or `subject`"},
            422,
        )
    if any("e1bounce" in addr.lower() for addr in to):
        return JSONResponse(
            {"statusCode": 422, "name": "validation_error", "message": "E1: rebote simulado"}, 422
        )
    mail_id = str(uuid.uuid4())
    links = [html_lib.unescape(h) for h in _HREF.findall(html)]
    text = re.sub(r"\s+", " ", html_lib.unescape(_TAG.sub(" ", html))).strip()
    record = {
        "id": mail_id,
        "ts": _now_iso(),
        "ts_ms": int(time.time() * 1000),
        "from": body.get("from"),
        "to": to[0].lower(),
        "to_all": [a.lower() for a in to],
        "subject": body.get("subject"),
        "html": html,
        "text": text[:2000],
        "links": links,
    }
    _append_jsonl(MAILBOX, record)
    return {"id": mail_id}


@app.get("/mailbox")
def mailbox(to: str | None = None, since_ms: int = 0, limit: int = 200):
    """Mails de una casilla, en orden de llegada. Sin `to`: los últimos."""
    mails = _read_jsonl(MAILBOX)
    if to:
        wanted = to.strip().lower()
        mails = [m for m in mails if wanted in m.get("to_all", [m.get("to")])]
    if since_ms:
        mails = [m for m in mails if m.get("ts_ms", 0) >= since_ms]
    return mails[-limit:]


# ─────────────────────────── Google tokeninfo ──────────────────────────────
# backend/app/modules/identity/infrastructure/google_token_verifier.py:
# GET ?id_token=...; 200 con {aud, email, email_verified, name}; otro status
# = token inválido. Google responde 400 {"error_description": "Invalid Value"}.


def _b64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


@app.get("/google/tokeninfo")
def google_tokeninfo(id_token: str = ""):
    invalid = JSONResponse({"error": "invalid_token", "error_description": "Invalid Value"}, 400)
    if not id_token.startswith("e1fake."):
        return invalid
    try:
        data = json.loads(_b64url_decode(id_token[len("e1fake."):]))
    except Exception:
        return invalid
    email = str(data.get("email") or "").strip()
    if not isinstance(data, dict) or not email:
        return invalid
    now = int(time.time())
    name = data.get("name") or email.split("@")[0]
    return {
        "iss": "https://accounts.google.com",
        "azp": GOOGLE_CLIENT_ID,
        # `aud` se puede forzar desde el token falso para probar el rechazo
        # de un token emitido para otra app.
        "aud": data.get("aud") or GOOGLE_CLIENT_ID,
        "sub": str(data.get("sub") or int(hashlib.sha1(email.encode()).hexdigest()[:15], 16)),
        "email": email,
        "email_verified": "false" if data.get("email_verified") is False else "true",
        "name": name,
        "picture": data.get("picture") or "",
        "given_name": name.split(" ")[0],
        "iat": str(now),
        "exp": str(now + 3600),
        "alg": "RS256",
        "kid": "e1-fake",
        "typ": "JWT",
    }


# ─────────────────── Google Identity Services (navegador) ──────────────────
# frontend/components/GoogleAuthButton.tsx usa sólo `initialize({client_id,
# callback})` y `renderButton(parent, {theme, size, shape, text, locale})`.
# El botón real es un iframe de Google; acá es un <button> común.

_GSI_JS = r"""
/* Oído E1 — Google Identity Services SIMULADO. No es el script de Google. */
(function () {
  var cfg = null;
  function b64url(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function currentUser() {
    var u = window.__E1_GOOGLE_USER;
    if (!u) {
      try {
        var raw = window.localStorage.getItem("e1_google_user");
        if (raw) u = JSON.parse(raw);
      } catch (e) {}
    }
    if (!u) u = { email: "google.default@e1.test", name: "Usuaria Google E1", sub: "e1-default", picture: "" };
    return u;
  }
  function credential() { return "e1fake." + b64url(JSON.stringify(currentUser())); }
  function fire() {
    if (cfg && typeof cfg.callback === "function") {
      cfg.callback({ credential: credential(), select_by: "btn", clientId: cfg.client_id });
    }
  }
  var id = {
    initialize: function (config) { cfg = config || null; },
    renderButton: function (parent, options) {
      options = options || {};
      var dark = options.theme === "filled_black";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-e1-google", "1");
      btn.setAttribute("aria-label", "Continuar con Google (simulado)");
      btn.style.cssText = [
        "display:inline-flex", "align-items:center", "justify-content:center", "gap:10px",
        "height:40px", "min-width:240px", "max-width:100%", "padding:0 16px",
        "border-radius:" + (options.shape === "pill" ? "20px" : "4px"),
        "font:500 14px/1 Roboto,Arial,sans-serif", "cursor:pointer",
        "border:1px solid " + (dark ? "#202124" : "#dadce0"),
        "background:" + (dark ? "#202124" : "#ffffff"),
        "color:" + (dark ? "#e8eaed" : "#3c4043")
      ].join(";");
      var g = document.createElement("span");
      g.textContent = "G";
      g.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#fff;color:#4285f4;font-weight:700;font-size:13px";
      var label = document.createElement("span");
      label.textContent = "Continuar con Google (simulado)";
      btn.appendChild(g);
      btn.appendChild(label);
      btn.addEventListener("click", fire);
      parent.appendChild(btn);
    },
    prompt: function (listener) {
      if (typeof listener === "function") {
        listener({
          isNotDisplayed: function () { return true; },
          isSkippedMoment: function () { return false; },
          isDismissedMoment: function () { return false; },
          isDisplayMoment: function () { return false; },
          isDisplayed: function () { return false; },
          getNotDisplayedReason: function () { return "suppressed_by_user"; },
          getSkippedReason: function () { return ""; },
          getDismissedReason: function () { return ""; },
          getMomentType: function () { return "display"; }
        });
      }
    },
    cancel: function () {},
    disableAutoSelect: function () {},
    storeCredential: function (_c, cb) { if (typeof cb === "function") cb(); },
    revoke: function (_hint, cb) { if (typeof cb === "function") cb({ successful: true }); }
  };
  window.google = window.google || {};
  window.google.accounts = window.google.accounts || {};
  window.google.accounts.id = id;
  window.__E1_GSI_FAKE = true;
  if (typeof window.onGoogleLibraryLoad === "function") {
    try { window.onGoogleLibraryLoad(); } catch (e) {}
  }
})();
"""


@app.get("/gsi/client.js")
@app.get("/gsi/client")
def gsi_client():
    return Response(_GSI_JS, media_type="text/javascript; charset=utf-8")


# ─────────────────────────────── Cloudinary ────────────────────────────────
# Navegador (frontend/lib/cloudinary.ts): POST multipart a
# /v1_1/<cloud>/auto/upload con file, api_key, timestamp, signature,
# allowed_formats, folder, public_id, overwrite y, si es privado, type. Lee
# secure_url, public_id, resource_type, format, type.
# Backend (app/core/cloudinary.py): firma, destroy, rename (script) y el link
# de descarga privada GET /v1_1/<cloud>/<rt>/download.

_IMAGE_FORMATS = {"jpg", "png", "gif", "webp", "heic", "heif", "avif", "bmp", "tiff", "svg", "pdf"}
_VIDEO_FORMATS = {"mp4", "mov", "webm", "avi", "mkv"}
_MAX_BYTES = 10 * 1024 * 1024  # tope del plan gratis para imagen y raw
_CLD_INDEX = CLOUD / "_index.json"
_cld_assets: dict[str, dict] = {}
if _CLD_INDEX.exists():
    try:
        _cld_assets = json.loads(_CLD_INDEX.read_text(encoding="utf-8"))
    except ValueError:
        _cld_assets = {}


def _cld_save_index() -> None:
    tmp = _CLD_INDEX.with_suffix(".tmp")
    tmp.write_text(json.dumps(_cld_assets, ensure_ascii=False), encoding="utf-8")
    tmp.replace(_CLD_INDEX)


def _cld_sign(params: dict[str, str]) -> str:
    """Mismo algoritmo que `app/core/cloudinary.py::_sign`."""
    to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params))
    return hashlib.sha1(f"{to_sign}{CLD_API_SECRET}".encode()).hexdigest()


def _cld_error(status: int, message: str) -> JSONResponse:
    return JSONResponse({"error": {"message": message}}, status, headers={"X-Cld-Error": message})


def _cld_check_signature(params: dict[str, str]) -> JSONResponse | None:
    """Valida api_key + signature de un pedido firmado. None = ok."""
    signature = params.get("signature")
    if params.get("api_key") != CLD_API_KEY:
        return _cld_error(401, f"Unknown API key {params.get('api_key')}")
    signable = {
        k: v
        for k, v in params.items()
        if k not in ("file", "cloud_name", "resource_type", "api_key", "signature") and v != ""
    }
    expected = _cld_sign(signable)
    if signature != expected:
        to_sign = "&".join(f"{k}={signable[k]}" for k in sorted(signable))
        return _cld_error(401, f"Invalid Signature {signature}. String to sign - '{to_sign}'.")
    try:
        age = abs(time.time() - int(params.get("timestamp", "0")))
    except ValueError:
        age = 1e9
    if age > 3600:
        return _cld_error(400, f"Stale request - reported time is {params.get('timestamp')}")
    return None


def _sniff_format(data: bytes, filename: str) -> str:
    head = data[:16]
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head.startswith(b"GIF8"):
        return "gif"
    if head[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if head.startswith(b"%PDF"):
        return "pdf"
    if data[4:8] == b"ftyp":
        brand = data[8:12]
        if brand in (b"heic", b"heix", b"mif1", b"heif"):
            return "heic"
        if brand == b"avif":
            return "avif"
        return "mp4"
    if head.startswith(b"PK\x03\x04") and filename.lower().endswith(".docx"):
        return "docx"
    if head.startswith(b"\xd0\xcf\x11\xe0"):
        return "doc"
    ext = Path(filename).suffix.lower().lstrip(".")
    return {"jpeg": "jpg"}.get(ext, ext or "bin")


def _image_size(data: bytes, fmt: str) -> tuple[int, int]:
    try:
        if fmt == "png":
            return struct.unpack(">II", data[16:24])
        if fmt == "gif":
            return struct.unpack("<HH", data[6:10])
        if fmt == "jpg":
            i = 2
            while i + 9 < len(data):
                if data[i] != 0xFF:
                    i += 1
                    continue
                marker = data[i + 1]
                if marker in (0xC0, 0xC1, 0xC2):
                    h, w = struct.unpack(">HH", data[i + 5 : i + 9])
                    return w, h
                i += 2 + struct.unpack(">H", data[i + 2 : i + 4])[0]
    except Exception:
        pass
    return 0, 0


def _cld_key(resource_type: str, delivery_type: str, public_id: str) -> str:
    return f"{resource_type}/{delivery_type}/{public_id}"


def _cld_path(asset: dict) -> Path:
    name = asset["public_id"] if asset["resource_type"] == "raw" else f"{asset['public_id']}.{asset['format']}"
    return CLOUD / asset["resource_type"] / asset["type"] / name


def _cld_public_view(asset: dict) -> dict:
    rt, dtype, pid = asset["resource_type"], asset["type"], asset["public_id"]
    suffix = "" if rt == "raw" else f".{asset['format']}"
    sig = ""
    if dtype != "upload":
        token = base64.urlsafe_b64encode(hashlib.sha1(f"{pid}{CLD_API_SECRET}".encode()).digest())
        sig = f"s--{token[:8].decode()}--/"
    path = f"{CLOUD_NAME}/{rt}/{dtype}/{sig}v{asset['version']}/{pid}{suffix}"
    out = {
        "asset_id": asset["asset_id"],
        "public_id": pid,
        "version": asset["version"],
        "version_id": asset["version_id"],
        "signature": _cld_sign({"public_id": pid, "version": str(asset["version"])}),
        "resource_type": rt,
        "created_at": asset["created_at"],
        "tags": [],
        "bytes": asset["bytes"],
        "type": dtype,
        "etag": asset["etag"],
        "placeholder": False,
        "url": f"http://res.cloudinary.com/{path}",
        "secure_url": f"https://res.cloudinary.com/{path}",
        "folder": asset.get("folder", ""),
        "access_mode": "public",
        "original_filename": asset.get("original_filename", ""),
        "api_key": CLD_API_KEY,
    }
    if rt != "raw":
        out.update(width=asset.get("width", 0), height=asset.get("height", 0), format=asset["format"])
        if asset["format"] == "pdf":
            out["pages"] = 1
    return out


@app.post("/cloudinary/v1_1/{cloud}/{resource_type}/upload")
async def cld_upload(cloud: str, resource_type: str, request: Request):
    if cloud != CLOUD_NAME:
        return _cld_error(401, f"Invalid cloud_name {cloud}")
    form = await request.form()
    upload = form.get("file")
    params = {k: v for k, v in form.items() if isinstance(v, str)}
    params.pop("file", None)

    if params.get("signature"):
        problem = _cld_check_signature(params)
        if problem is not None:
            return problem
    elif not params.get("upload_preset"):
        return _cld_error(401, "Must supply api_key")

    filename = ""
    if upload is None:
        return _cld_error(400, "Missing required parameter - file")
    if isinstance(upload, str):
        if not upload.startswith("data:") or "," not in upload:
            return _cld_error(400, "E1: sólo se aceptan archivos o data URIs (sin salida a internet)")
        header, payload = upload.split(",", 1)
        data = base64.b64decode(payload) if ";base64" in header else payload.encode()
        filename = "file." + (header.split("/")[-1].split(";")[0] or "bin")
    else:
        data = await upload.read()
        filename = upload.filename or "file"
    if not data:
        return _cld_error(400, "Empty file")
    if "e1fail" in filename.lower():
        return _cld_error(500, "E1: falla simulada del servicio de subida")

    fmt = _sniff_format(data, filename)
    if resource_type == "auto":
        rt = "image" if fmt in _IMAGE_FORMATS else "video" if fmt in _VIDEO_FORMATS else "raw"
    else:
        rt = resource_type
    if rt == "image" and fmt not in _IMAGE_FORMATS:
        return _cld_error(400, "Invalid image file")
    allowed = [f.strip() for f in params.get("allowed_formats", "").split(",") if f.strip()]
    if allowed and fmt not in {"jpg" if f == "jpeg" else f for f in allowed}:
        kind = "Image" if rt == "image" else "Video" if rt == "video" else "Raw"
        return _cld_error(400, f"{kind} file format {fmt} not allowed")
    if len(data) > _MAX_BYTES and rt != "video":
        return _cld_error(400, f"File size too large. Got {len(data)}. Maximum is {_MAX_BYTES}.")

    delivery_type = params.get("type") or "upload"
    public_id = params.get("public_id") or uuid.uuid4().hex[:20]
    folder = params.get("folder", "").strip("/")
    if folder:
        public_id = f"{folder}/{public_id}"
    if rt == "raw" and not public_id.endswith(f".{fmt}"):
        public_id = f"{public_id}.{fmt}"

    key = _cld_key(rt, delivery_type, public_id)
    with _lock:
        existing = _cld_assets.get(key)
    if existing and params.get("overwrite") == "false":
        return {**_cld_public_view(existing), "existing": True}

    width, height = _image_size(data, fmt) if rt == "image" else (0, 0)
    asset = {
        "asset_id": uuid.uuid4().hex,
        "public_id": public_id,
        "version": int(time.time()),
        "version_id": uuid.uuid4().hex,
        "resource_type": rt,
        "type": delivery_type,
        "format": fmt,
        "bytes": len(data),
        "width": width,
        "height": height,
        "etag": hashlib.md5(data).hexdigest(),
        "folder": folder,
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "original_filename": Path(filename).stem,
    }
    path = _cld_path(asset)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    with _lock:
        _cld_assets[key] = asset
        _cld_save_index()
    _append_jsonl(LOGS / "cloudinary.jsonl", {"ts": _now_iso(), "action": "upload", "key": key, "bytes": len(data)})
    return _cld_public_view(asset)


async def _signed_form(request: Request, cloud: str) -> tuple[dict[str, str], JSONResponse | None]:
    form = await request.form()
    params = {k: v for k, v in form.items() if isinstance(v, str)}
    if cloud != CLOUD_NAME:
        # Cloudinary responde 404 para un cloud_name inexistente en destroy
        # (lo dice el comentario de `DESTROY_DONE_RESULTS` en el producto).
        return params, _cld_error(404, f"Invalid cloud_name {cloud}")
    return params, _cld_check_signature(params)


@app.post("/cloudinary/v1_1/{cloud}/{resource_type}/destroy")
async def cld_destroy(cloud: str, resource_type: str, request: Request):
    params, problem = await _signed_form(request, cloud)
    if problem is not None:
        return problem
    key = _cld_key(resource_type, params.get("type") or "upload", params.get("public_id", ""))
    with _lock:
        asset = _cld_assets.pop(key, None)
        if asset:
            _cld_save_index()
    if asset is None:
        result = "not found"
    else:
        _cld_path(asset).unlink(missing_ok=True)
        result = "ok"
    _append_jsonl(LOGS / "cloudinary.jsonl", {"ts": _now_iso(), "action": "destroy", "key": key, "result": result})
    return {"result": result}


@app.post("/cloudinary/v1_1/{cloud}/{resource_type}/rename")
async def cld_rename(cloud: str, resource_type: str, request: Request):
    params, problem = await _signed_form(request, cloud)
    if problem is not None:
        return problem
    src_type = params.get("type") or "upload"
    dst_type = params.get("to_type") or src_type
    src_key = _cld_key(resource_type, src_type, params.get("from_public_id", ""))
    dst_key = _cld_key(resource_type, dst_type, params.get("to_public_id", ""))
    with _lock:
        asset = _cld_assets.get(src_key)
        if asset is None:
            return _cld_error(404, f"Resource not found - {params.get('from_public_id')}")
        if dst_key != src_key and dst_key in _cld_assets and params.get("overwrite") != "true":
            return _cld_error(400, f"to_public_id {params.get('to_public_id')} already exists")
        old_path = _cld_path(asset)
        moved = {**asset, "public_id": params.get("to_public_id", ""), "type": dst_type}
        new_path = _cld_path(moved)
        new_path.parent.mkdir(parents=True, exist_ok=True)
        if old_path != new_path and old_path.exists():
            old_path.replace(new_path)
        _cld_assets.pop(src_key, None)
        _cld_assets[dst_key] = moved
        _cld_save_index()
    return _cld_public_view(moved)


def _serve_file(path: Path, *, attachment: bool = False, cache: str = "public, max-age=3600") -> Response:
    media = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    headers = {"Cache-Control": cache}
    if attachment:
        headers["Content-Disposition"] = f'attachment; filename="{path.name}"'
    return Response(path.read_bytes(), media_type=media, headers=headers)


@app.get("/cloudinary/v1_1/{cloud}/{resource_type}/download")
def cld_download(cloud: str, resource_type: str, request: Request):
    """Link de descarga privada (`private_download_url`): firmado y con
    vencimiento (`expires_at`)."""
    params = dict(request.query_params)
    if cloud != CLOUD_NAME:
        return _cld_error(404, f"Invalid cloud_name {cloud}")
    problem = _cld_check_signature(params)
    if problem is not None:
        return problem
    try:
        expires_at = int(params.get("expires_at", "0"))
    except ValueError:
        expires_at = 0
    if expires_at and expires_at < time.time():
        return _cld_error(401, "Link expired")
    key = _cld_key(resource_type, params.get("type") or "upload", params.get("public_id", ""))
    with _lock:
        asset = _cld_assets.get(key)
    if asset is None or not _cld_path(asset).exists():
        return _cld_error(404, f"Resource not found - {params.get('public_id')}")
    return _serve_file(_cld_path(asset), attachment=bool(params.get("attachment")), cache="private, no-store")


_TRANSFORM = re.compile(r"^[a-z]{1,3}_[^,/]+(,[a-z]{1,3}_[^,/]+)*$")
_VERSION = re.compile(r"^v\d+$")
_SIGNATURE = re.compile(r"^s--[\w-]{8}--$")


@app.get("/res/{path:path}")
def cld_delivery(path: str):
    """`https://res.cloudinary.com/<path>` (el kit lo enruta acá). Ignora las
    transformaciones (`f_auto,q_auto,w_…`): entrega el original. Si el
    archivo no existe, una imagen placeholder (pedido del arnés; Cloudinary
    real daría 404)."""
    parts = [p for p in path.split("/") if p]
    if len(parts) < 4:
        return Response(placeholder_png("photo", 1), media_type="image/png")
    _cloud, resource_type, delivery_type, rest = parts[0], parts[1], parts[2], parts[3:]
    attachment = False
    avatar_hint = False
    while rest and (_SIGNATURE.match(rest[0]) or _TRANSFORM.match(rest[0]) or _VERSION.match(rest[0])):
        segment = rest.pop(0)
        attachment = attachment or "fl_attachment" in segment
        width = re.search(r"(?:^|,)w_(\d+)", segment)
        avatar_hint = avatar_hint or bool(width and int(width.group(1)) <= 200)
    name = "/".join(rest)
    if delivery_type in ("private", "authenticated"):
        # Privado de verdad: el original no se entrega por res.cloudinary.com.
        return Response(status_code=401, headers={"X-Cld-Error": "Resource is private"})
    file_path = CLOUD / resource_type / delivery_type / name
    if name and file_path.is_file() and CLOUD in file_path.resolve().parents:
        return _serve_file(file_path, attachment=attachment)
    if resource_type == "raw" or name.lower().endswith(".pdf"):
        return Response(status_code=404, headers={"X-Cld-Error": f"Resource not found {name}"})
    seed = int(hashlib.sha1(name.encode()).hexdigest()[:6], 16)
    kind = "avatar" if (avatar_hint or "perfil" in name) else "photo"
    return Response(placeholder_png(kind, seed % 24), media_type="image/png", headers={"X-E1-Placeholder": "1"})


# ───────────────────────── Imágenes placeholder ────────────────────────────


def _png(width: int, height: int, rows: list[bytes]) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + row for row in rows)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 6))
        + chunk(b"IEND", b"")
    )


def _rgb(h: float, s: float, l: float) -> bytes:
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return bytes((int(r * 255), int(g * 255), int(b * 255)))


@lru_cache(maxsize=96)
def placeholder_png(kind: str, seed: int) -> bytes:
    """Imagen neutra y obviamente de relleno. `avatar`: silueta; `photo`:
    degradé con un plato. El color cambia con `seed`."""
    hue = ((seed * 47) % 360) / 360
    if kind == "avatar":
        size = 160
        bg, fg = _rgb(hue, 0.30, 0.82), _rgb(hue, 0.30, 0.48)
        rows = []
        for y in range(size):
            row = bytearray()
            for x in range(size):
                head = (x - 80) ** 2 + (y - 62) ** 2 <= 30 * 30
                body = ((x - 80) / 58) ** 2 + ((y - 172) / 72) ** 2 <= 1
                row += fg if (head or body) else bg
            rows.append(bytes(row))
        return _png(size, size, rows)
    width, height = 300, 200
    rows = []
    for y in range(height):
        t = y / height
        base = _rgb((hue + 0.06 * t) % 1, 0.42, 0.80 - 0.28 * t)
        rim, plate = _rgb(hue, 0.15, 0.97), _rgb(hue, 0.25, 0.88)
        row = bytearray()
        for x in range(width):
            d = (x - 150) ** 2 + (y - 104) ** 2
            row += plate if d <= 38 * 38 else rim if d <= 54 * 54 else base
        rows.append(bytes(row))
    return _png(width, height, rows)


@app.get("/placeholder/{kind}")
def placeholder(kind: str, seed: str = "1"):
    try:
        n = int(seed)
    except ValueError:
        n = int(hashlib.sha1(seed.encode()).hexdigest()[:6], 16)
    kind = "avatar" if kind == "avatar" else "photo"
    return Response(
        placeholder_png(kind, n % 24),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400", "X-E1-Placeholder": "1"},
    )


# ──────────────────────────────── Gemini ───────────────────────────────────
# backend/app/core/gemini.py: POST .../models/<modelo>:generateContent con
# header x-goog-api-key y {systemInstruction, contents, generationConfig:
# {responseSchema}}; lee candidates[0].content.parts[0].text y lo parsea como
# JSON. Acá NO hay modelo: son reglas fijas, para probar la plomería.

_SKILLS = [
    ("ayudante_cocina", r"ayudantes? de cocina|ayudantes? cocina|bacher[oa]s?|lavacopas|lavaplatos"),
    ("personal_eventos", r"personal (?:de|para) eventos?|staff (?:de|para) eventos?"),
    ("personal_salon", r"personal de salon|ayudantes? de salon"),
    ("mozo", r"moz[oa]s?|camarer[oa]s?|meser[oa]s?"),
    ("bartender", r"bartenders?|barman|barmans|barmen|cocteler[oa]s?"),
    ("barista", r"baristas?|cafeter[oa]s?"),
    ("runner", r"runners?"),
    ("cocinero", r"cociner[oa]s?|chefs?|parriller[oa]s?|pizzer[oa]s?|sushiman"),
    ("cajero", r"cajer[oa]s?"),
    ("recepcionista", r"recepcionistas?|hostess|host"),
]
_NUM_WORDS = {
    "un": 1, "una": 1, "uno": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
    "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10,
}
_WEEKDAYS = {"lunes": 0, "martes": 1, "miercoles": 2, "jueves": 3, "viernes": 4, "sabado": 5, "domingo": 6}
_MONTHS = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7,
    "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}
_BARRIOS = [
    "Palermo", "Villa Crespo", "San Telmo", "Recoleta", "Belgrano", "Caballito", "Almagro",
    "Microcentro", "Puerto Madero", "Núñez", "Boedo", "Colegiales", "Chacarita", "Retiro",
    "Balvanera", "Flores", "Villa Urquiza", "Saavedra", "Barracas", "La Boca", "Once",
    "Monserrat", "San Nicolás", "Villa Devoto", "Parque Patricios", "Centro",
]
_HOUR = (
    r"(\d{1,2})(?:[:.](\d{2}))?\s*(?:hs?\b\.?)?\s*"
    r"(am\b|a\.m\.?|pm\b|p\.m\.?|de la manana|de la tarde|de la noche|de la madrugada)?"
)


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    return "".join(ch for ch in text if unicodedata.category(ch) != "Mn")


def _find_positions(t: str) -> list[tuple[str, int]]:
    """[(puesto, cantidad)] en el orden en que aparecen, sin repetir puesto."""
    hits: list[tuple[int, int, str]] = []
    for value, pattern in _SKILLS:
        for m in re.finditer(rf"\b(?:{pattern})\b", t):
            if any(m.start() < end and start < m.end() for start, end, _ in hits):
                continue
            hits.append((m.start(), m.end(), value))
    hits.sort()
    out: list[tuple[str, int]] = []
    for start, _end, value in hits:
        if any(v == value for v, _ in out):
            continue
        qty = 1
        before = re.search(r"(\d{1,2}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+$", t[:start])
        if before:
            token = before.group(1)
            qty = int(token) if token.isdigit() else _NUM_WORDS[token]
        out.append((value, max(1, min(qty, 50))))
    return out


def _find_day(t: str, today: date) -> date | None:
    if re.search(r"\bpasado manana\b", t):
        return today + timedelta(days=2)
    if re.search(r"(?<!de la )(?<!a la )(?<!por la )(?<!esta )\bmanana\b", t):
        return today + timedelta(days=1)
    m = re.search(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b", t)
    if m:
        try:
            year = int(m.group(3)) if m.group(3) else today.year
            year += 2000 if year < 100 else 0
            day = date(year, int(m.group(2)), int(m.group(1)))
            if not m.group(3) and day < today:
                day = day.replace(year=year + 1)
            return day
        except ValueError:
            pass
    m = re.search(r"\b(\d{1,2}) de (" + "|".join(_MONTHS) + r")\b", t)
    if m:
        try:
            day = date(today.year, _MONTHS[m.group(2)], int(m.group(1)))
            return day if day >= today else day.replace(year=today.year + 1)
        except ValueError:
            pass
    for name, weekday in _WEEKDAYS.items():
        if re.search(rf"\b{name}\b", t):
            ahead = (weekday - today.weekday()) % 7
            return today + timedelta(days=ahead or 7)
    if re.search(r"\b(hoy|esta noche|esta tarde|ahora|ya mismo)\b", t):
        return today
    return None


def _to_24h(hour: int, qualifier: str | None, *, is_start: bool, position: str | None, t: str) -> int:
    q = (qualifier or "").replace(".", "")
    if q in ("pm", "de la tarde", "de la noche"):
        return hour + 12 if hour < 12 else hour
    if q in ("am", "de la manana", "de la madrugada"):
        return 0 if hour == 12 else hour
    if is_start and 1 <= hour <= 6:
        return hour + 12  # "a las 5" en gastronomía = 17:00
    if is_start and 7 <= hour <= 11 and (position == "bartender" or re.search(r"\bnoche\b", t)):
        return hour + 12
    return hour


def _find_times(t: str, position: str | None) -> tuple[tuple[int, int] | None, tuple[int, int] | None, int | None]:
    """(inicio, fin, duración en horas). Cada hora como (hh, mm)."""
    duration = None
    m = re.search(r"\b(\d{1,2})\s*horas?\b", t)
    if m:
        duration = int(m.group(1))
    for pattern in (
        rf"\b(?:de|desde)(?: las?)?\s+{_HOUR}\s*(?:a|hasta)(?: las?)?\s+{_HOUR}",
        rf"\bentre(?: las?)?\s+{_HOUR}\s*y(?: las?)?\s+{_HOUR}",
        rf"\b{_HOUR}\s*(?:a|hasta)(?: las?)?\s+{_HOUR}",
    ):
        m = re.search(pattern, t)
        if not m:
            continue
        h1, m1, q1, h2, m2, q2 = m.groups()
        if int(h1) > 24 or int(h2) > 24:
            continue
        if not q1 and q2:
            q1 = None
        start = (_to_24h(int(h1), q1, is_start=True, position=position, t=t) % 24, int(m1 or 0))
        end_hour = _to_24h(int(h2), q2, is_start=False, position=position, t=t) % 24
        if end_hour == 12 and not q2 and start[0] >= 13:
            end_hour = 0  # "de 20 a 12" = hasta la medianoche
        end = (end_hour, int(m2 or 0))
        return start, end, duration
    for pattern in (
        rf"\b(?:a las?|desde las?|arranca(?:ndo)?(?: a las?)?|empieza(?: a las?)?|tipo)\s+{_HOUR}",
        r"\b(\d{1,2})(?:[:.](\d{2}))?\s*(?:hs|h)\b()",
        r"\b(\d{1,2})(?:[:.](\d{2}))?\s*(am\b|a\.m\.?|pm\b|p\.m\.?|de la manana|de la tarde|de la noche)",
        r"\b(\d{1,2}):(\d{2})\b()",
    ):
        m = re.search(pattern, t)
        if m and int(m.group(1)) <= 24:
            hour = _to_24h(int(m.group(1)), m.group(3) or None, is_start=True, position=position, t=t) % 24
            return (hour, int(m.group(2) or 0)), None, duration
    return None, None, duration


def _find_pay(t: str) -> int | None:
    def amount(raw: str, suffix: str | None) -> int:
        value = int(re.sub(r"[.,]", "", raw))
        return value * 1000 if suffix and value < 1000 else value

    m = re.search(r"\$\s*(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(mil\b|k\b|lucas\b)?", t)
    if m:
        return amount(m.group(1), m.group(2))
    m = re.search(r"\b(\d{1,3})\s*(mil|k|lucas|luquitas)\b", t)
    if m:
        return amount(m.group(1), m.group(2))
    m = re.search(r"\b(\d{1,3}(?:[.,]\d{3})+|\d{4,7})\s*(?:pesos|ars)\b", t)
    if m:
        return amount(m.group(1), None)
    m = re.search(r"\b(?:pag\w+|por|ofrezco|ofrecemos|son|a)\s+(\d{1,3}(?:[.,]\d{3})+|\d{4,7})\b", t)
    if m and not re.match(r"^20\d\d$", m.group(1)):
        return amount(m.group(1), None)
    return None


_DRESS = re.compile(
    r"(camisa [a-záéíóúñ]+(?: y [a-záéíóúñ ]+)?|todo de [a-záéíóúñ]+|vestid[oa]s? de [a-záéíóúñ]+|"
    r"uniforme[^,.;]*|remera [a-záéíóúñ]+(?: [a-záéíóúñ]+)?|delantal[^,.;]*|elegante sport|de negro)",
    re.I,
)


def _iso(day: date, hm: tuple[int, int]) -> str:
    return f"{day.isoformat()}T{hm[0]:02d}:{hm[1]:02d}:00-03:00"


def _shift_fields(text: str, today: date, *, position: str | None) -> dict:
    """Campos de un turno (`_RESPONSE_SCHEMA`), con lo que falte en null."""
    t = _norm(text)
    day = _find_day(t, today)
    start, end, duration = _find_times(t, position)
    start_at = end_at = None
    if start is not None:
        day = day or today
        start_at = _iso(day, start)
        start_dt = datetime(day.year, day.month, day.day, start[0], start[1])
        if end is not None:
            end_dt = datetime(day.year, day.month, day.day, end[0], end[1])
            if end_dt <= start_dt:
                end_dt += timedelta(days=1)
        elif duration:
            end_dt = start_dt + timedelta(hours=duration)
        else:
            end_dt = None
        if end_dt is not None:
            end_at = _iso(end_dt.date(), (end_dt.hour, end_dt.minute))
    dress = _DRESS.search(text)
    return {
        "start_at": start_at,
        "end_at": end_at,
        "pay_amount": _find_pay(t),
        "urgent": bool(re.search(r"\b(urgente|urgencia|ya|ahora|hoy|cuanto antes|lo antes posible)\b", t)),
        "meal": bool(re.search(r"\b(comida|vianda|cena|almuerzo)\b", t)) and not re.search(r"\bsin (comida|vianda)\b", t),
        "tips": not re.search(r"\b(sin|no hay|no incluye|no tiene) propinas?\b", t),
        "dress_code": dress.group(1).strip()[:60] if dress else None,
    }


def _gemini_parse_shift(text: str, today: date) -> dict:
    positions = _find_positions(_norm(text))
    position = positions[0][0] if positions else "desconocido"
    return {"position": position, **_shift_fields(text, today, position=position)}


_NAME = re.compile(r"\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})\b")
_NOT_NAMES = {"Oído", "Oido", "Dni", "Hola", "Buenas", "Che"}


def _find_person_name(text: str) -> str | None:
    stripped = text.strip().lstrip("¿¡ ")
    for m in _NAME.finditer(stripped):
        if m.start() == 0 and len(m.group(1).split()) == 1:
            continue  # primera palabra de la oración
        name = m.group(1)
        if name.split()[0] in _NOT_NAMES:
            continue
        return name
    m = re.search(r"\ba ([a-záéíóúñ]{3,})\s*\??$", stripped)
    return m.group(1).capitalize() if m else None


def _gemini_assistant(text: str, today: date, context: str) -> dict:
    t = _norm(text)
    positions = _find_positions(t)
    first = positions[0][0] if positions else "desconocido"

    if re.search(r"\b(verific\w+|dni|identidad)\b", t):
        name = _find_person_name(text)
        if name:
            return {"intent": "consultar_verificacion", "verification_name": name}
        return {"intent": "desconocido"}
    if re.search(r"\bpostul\w+", t):
        day = _find_day(t, today)
        return {
            "intent": "ver_postulantes",
            "applicants_position": first,
            "applicants_date_hint": day.isoformat() if day else None,
        }
    if re.search(r"\b(que tengo|cuantos turnos|mis turnos|sin cubrir|como vienen|turnos (?:tengo|publicados|abiertos|urgentes))\b", t):
        query_filter = (
            "sin_cubrir" if "sin cubrir" in t
            else "urgentes" if re.search(r"\burgent", t)
            else "hoy" if re.search(r"\bhoy\b", t)
            else "todos"
        )
        return {"intent": "consultar_turnos", "query_filter": query_filter}
    if re.search(r"\b(buscame|mostrame|candidatos?|disponibles?|quien esta)\b", t):
        return {"intent": "buscar_candidatos", "search_position": first}
    if not positions:
        return {"intent": "desconocido"}

    fields = _shift_fields(text, today, position=first)
    if fields["pay_amount"] is None and context:
        # "El pago típico ronda $45.000." (AssistantService.build_context_summary)
        m = re.search(r"pago t[ií]pico ronda \$\s*([\d.]+)", context)
        if m:
            fields["pay_amount"] = int(m.group(1).replace(".", ""))
    if len(positions) >= 2:
        return {
            "intent": "crear_evento",
            "event_positions": [{"position": p, "quantity": q} for p, q in positions],
            **fields,
        }
    return {"intent": "crear_turno", "position": first, **fields}


def _gemini_worker(text: str, today: date) -> dict:
    t = _norm(text)
    positions = [p for p, _ in _find_positions(t)]
    zone = None
    for barrio in _BARRIOS:
        if re.search(rf"\b{_norm(barrio)}\b", t):
            zone = barrio
            break
    if zone is None:
        m = re.search(r"\ben ([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?: [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)", text)
        zone = m.group(1) if m else None
    radius = None
    m = re.search(r"\b(\d+(?:[.,]\d+)?)\s*(km|kms|kilometros?|cuadras)\b", t)
    if m:
        radius = float(m.group(1).replace(",", "."))
        if m.group(2) == "cuadras":
            radius = round(radius / 10, 1)
    date_filter = "hoy" if re.search(r"\b(hoy|ahora|ya|esta noche|esta tarde)\b", t) else "todos"
    intent = "buscar_turnos" if (positions or zone) else "desconocido"
    return {"intent": intent, "positions": positions, "zone_name": zone, "radius_km": radius, "date_filter": date_filter}


def _gemini_support(text: str) -> dict:
    subject = re.search(r"^Asunto:\s*(.*)$", text, re.M)
    category = re.search(r"^Categoría:\s*(.*)$", text, re.M)
    body = text.split("\n\n", 1)[1].strip() if "\n\n" in text else ""
    last = re.sub(r"\s+", " ", body.splitlines()[-1] if body else "").strip()
    asunto = subject.group(1).strip() if subject else "su consulta"
    return {
        "summary": (
            f"[Simulado E1] Consulta sobre «{asunto}»"
            f"{' (' + category.group(1).strip() + ')' if category else ''}. "
            f"Último mensaje: {last[:160] or 'sin texto'}"
        ),
        "suggested_reply": (
            f"Hola, gracias por escribirnos. Ya estamos revisando tu consulta sobre «{asunto}». "
            "¿Nos contás un poco más (qué pasó, cuándo y en qué pantalla) así lo resolvemos más rápido? "
            "Quedamos atentos."
        ),
    }


@app.post("/gemini/v1beta/models/{model_action:path}")
async def gemini_generate(model_action: str, request: Request):
    if not model_action.endswith(":generateContent"):
        return JSONResponse({"error": {"code": 404, "message": "E1: sólo generateContent", "status": "NOT_FOUND"}}, 404)
    if not request.headers.get("x-goog-api-key"):
        return JSONResponse(
            {"error": {"code": 403, "message": "Method doesn't allow unregistered callers.", "status": "PERMISSION_DENIED"}},
            403,
        )
    body = await request.json()
    system_parts = [p.get("text", "") for p in (body.get("systemInstruction") or {}).get("parts", [])]
    system = "\n".join(system_parts)
    text = "\n".join(
        p.get("text", "") for c in body.get("contents", []) for p in c.get("parts", [])
    )
    schema = (body.get("generationConfig") or {}).get("responseSchema") or {}
    props = set((schema.get("properties") or {}).keys())
    m = re.search(r"Hoy es (\d{4}-\d{2}-\d{2})", system)
    today = date.fromisoformat(m.group(1)) if m else datetime.now(ART).date()

    if "E1_IA_CAIDA" in text:
        return JSONResponse({"error": {"code": 503, "message": "E1: modelo sobrecargado (simulado)", "status": "UNAVAILABLE"}}, 503)
    if "E1_IA_LENTA" in text:
        import asyncio

        await asyncio.sleep(8)

    if "suggested_reply" in props:
        function, data = "suggest_ticket_reply", _gemini_support(text)
    elif "zone_name" in props:
        function, data = "interpret_worker_shift_query", _gemini_worker(text, today)
    elif "intent" in props:
        context = system_parts[1] if len(system_parts) > 1 else ""
        function, data = "interpret_assistant_query", _gemini_assistant(text, today, context)
    else:
        function, data = "parse_shift_text", _gemini_parse_shift(text, today)

    raw = "esto no es JSON {" if "E1_IA_INVALIDA" in text else json.dumps(data, ensure_ascii=False)
    _append_jsonl(
        LOGS / "gemini.jsonl",
        {"ts": _now_iso(), "function": function, "today": today.isoformat(), "text": text[:500], "output": data},
    )
    return {
        "candidates": [
            {"content": {"parts": [{"text": raw}], "role": "model"}, "finishReason": "STOP", "index": 0}
        ],
        "usageMetadata": {"promptTokenCount": 0, "candidatesTokenCount": 0, "totalTokenCount": 0},
        "modelVersion": model_action.split(":")[0] + "-e1-fake",
    }


# ─────────────────────────────── Nominatim ─────────────────────────────────
# frontend/lib/geocoder.ts: GET /search?format=jsonv2&addressdetails=1&
# countrycodes=ar&accept-language=es&limit=5&q=...; lee display_name (se
# queda con los 3 primeros segmentos), lat, lon y address.{city|town|…}.
# Las respuestas imitan la forma real de Nominatim para CABA: el número va
# ANTES de la calle en display_name y `city` es "Buenos Aires" (el barrio va
# en `suburb`).

_PLACES = [
    # (calle, altura, barrio, comuna, CP, lat, lon)
    ("Gorriti", "5000", "Palermo", "Comuna 14", "C1414", -34.58755, -58.43095),
    ("Honduras", "5500", "Palermo", "Comuna 14", "C1414", -34.58385, -58.43480),
    ("Avenida Santa Fe", "3200", "Palermo", "Comuna 14", "C1425", -34.58805, -58.41050),
    ("Thames", "1500", "Palermo", "Comuna 14", "C1414", -34.58930, -58.42850),
    ("Avenida Corrientes", "5200", "Villa Crespo", "Comuna 15", "C1414", -34.59850, -58.43700),
    ("Aguirre", "800", "Villa Crespo", "Comuna 15", "C1414", -34.59560, -58.44020),
    ("Defensa", "900", "San Telmo", "Comuna 1", "C1065", -34.61770, -58.37220),
    ("Balcarce", "700", "San Telmo", "Comuna 1", "C1064", -34.61500, -58.37120),
    ("Humberto Primo", "400", "San Telmo", "Comuna 1", "C1103", -34.62040, -58.37150),
]


def _nominatim_item(i: int, road: str, number: str, suburb: str, comuna: str, cp: str, lat: float, lon: float) -> dict:
    display = ", ".join(
        p for p in (number, road, suburb, "Buenos Aires", comuna, "Ciudad Autónoma de Buenos Aires", cp, "Argentina") if p
    )
    return {
        "place_id": 900000 + i,
        "licence": "E1 — datos simulados (no es OpenStreetMap)",
        "osm_type": "node",
        "osm_id": 5000000 + i,
        "lat": f"{lat:.7f}",
        "lon": f"{lon:.7f}",
        "category": "place",
        "type": "house",
        "place_rank": 30,
        "importance": round(0.4 - i * 0.01, 3),
        "addresstype": "place",
        "name": "",
        "display_name": display,
        "address": {
            **({"house_number": number} if number else {}),
            "road": road,
            "suburb": suburb,
            "city": "Buenos Aires",
            "state_district": comuna,
            "ISO3166-2-lvl8": "AR-C",
            "state": "Ciudad Autónoma de Buenos Aires",
            "postcode": cp,
            "country": "Argentina",
            "country_code": "ar",
        },
        "boundingbox": [f"{lat - 0.0005:.7f}", f"{lat + 0.0005:.7f}", f"{lon - 0.0005:.7f}", f"{lon + 0.0005:.7f}"],
    }


@app.get("/nominatim/search")
def nominatim_search(q: str = "", limit: int = 5):
    t = _norm(q).strip()
    if "e1error" in t:
        return JSONResponse({"error": "E1: geocoder caído (simulado)"}, 503)
    if not t or re.search(r"(zzz|xxx|qqq)", t):
        return []
    limit = max(1, min(limit, 5))
    number = re.search(r"\b(\d{1,5})\b", t)
    tokens = [tok for tok in re.findall(r"[a-z]{3,}", t) if tok not in ("avenida", "calle", "caba", "buenos", "aires")]
    scored = []
    for place in _PLACES:
        words = _norm(f"{place[0]} {place[2]}").split()
        score = sum(1 for tok in tokens if any(w.startswith(tok) for w in words))
        if score:
            scored.append((score, place))
    results = []
    if scored:
        scored.sort(key=lambda item: -item[0])
        chosen = [place for _score, place in scored[:limit]]
        # Entre 3 y 5: se completa con lo más cercano (mismo barrio primero),
        # como un geocoder que devuelve coincidencias parciales.
        barrio = chosen[0][2]
        for place in sorted(_PLACES, key=lambda p: p[2] != barrio):
            if len(chosen) >= min(3, limit):
                break
            if place not in chosen:
                chosen.append(place)
        for i, place in enumerate(chosen):
            road, default_number, suburb, comuna, cp, lat, lon = place
            street_hit = any(w.startswith(tok) for tok in tokens for w in _norm(road).split())
            results.append(
                _nominatim_item(i, road, number.group(1) if (number and street_hit) else default_number, suburb, comuna, cp, lat, lon)
            )
        return results
    # Sin coincidencia: dos resultados de Palermo con el texto buscado (la
    # altura exacta y, como hace Nominatim cuando no la encuentra, la calle).
    road = re.sub(r"\s*\d{1,5}\s*$", "", q.strip()).strip(" ,") or q.strip()
    road = road[:60].title() if road.islower() else road[:60]
    results.append(_nominatim_item(0, road, number.group(1) if number else "", "Palermo", "Comuna 14", "C1425", -34.58840, -58.42610))
    results.append(_nominatim_item(1, road, "", "Palermo Hollywood" if not number else "Palermo", "Comuna 14", "C1414", -34.58120, -58.43490))
    return results[:limit]


# ─────────────────────────────── Mapa base ─────────────────────────────────
# frontend/lib/map/style.ts pide https://basemaps.cartocdn.com/gl/voyager-gl-
# style/style.json. Acá: fondo neutro + una grilla GeoJSON cada ~1 km (para
# que se note el paneo/zoom y para que MapLibre use su worker, como con el
# estilo real; con un estilo sin fuentes el worker roto no se ve — lo explica
# frontend/e2e/mapa-worker.spec.ts). No es cartografía: no evaluar calles.


def _grid_geojson(step: float) -> dict:
    features = []
    lat0, lat1, lon0, lon1 = -34.72, -34.50, -58.56, -58.30
    for i in range(int(round((lat1 - lat0) / step)) + 1):
        lat = round(lat0 + i * step, 4)
        features.append({"type": "Feature", "properties": {}, "geometry": {"type": "LineString", "coordinates": [[lon0, lat], [lon1, lat]]}})
    for i in range(int(round((lon1 - lon0) / step)) + 1):
        lon = round(lon0 + i * step, 4)
        features.append({"type": "Feature", "properties": {}, "geometry": {"type": "LineString", "coordinates": [[lon, lat0], [lon, lat1]]}})
    return {"type": "FeatureCollection", "features": features}


_MAP_STYLE = {
    "version": 8,
    "name": "e1-base-neutra",
    "metadata": {"e1": "estilo simulado: fondo neutro + grilla, sin tiles"},
    "glyphs": "https://basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf",
    "sources": {
        # ~1 km entre líneas; la fina (~200 m) aparece al acercarse.
        "e1-grid": {"type": "geojson", "data": _grid_geojson(0.01)},
        "e1-grid-fina": {"type": "geojson", "data": _grid_geojson(0.002)},
    },
    "layers": [
        {"id": "background", "type": "background", "paint": {"background-color": "#eef0ee"}},
        {"id": "e1-grid-fina", "type": "line", "source": "e1-grid-fina", "minzoom": 13.5, "paint": {"line-color": "#e0e4e1", "line-width": 1}},
        {"id": "e1-grid", "type": "line", "source": "e1-grid", "paint": {"line-color": "#cfd5d0", "line-width": 1.5}},
    ],
}
_PNG_1X1 = _png(1, 1, [b"\x00\x00\x00"])


@app.get("/carto/{path:path}")
def carto(path: str):
    if path.endswith("style.json"):
        return JSONResponse(_MAP_STYLE, headers={"Cache-Control": "public, max-age=300"})
    if path.endswith(".json"):  # sprite.json / sprite@2x.json / tilejson
        return JSONResponse({})
    if path.endswith(".png"):
        return Response(_PNG_1X1, media_type="image/png")
    if path.endswith(".pbf"):  # glyphs: un PBF vacío es válido (sin glifos)
        return Response(b"", media_type="application/x-protobuf")
    return Response(status_code=204)


@app.get("/carto-tiles/{path:path}")
def carto_tiles(path: str):
    return Response(status_code=204)


# ──────────────────────────────── Web Push ─────────────────────────────────
# El backend (pywebpush) hace POST al endpoint de la suscripción. El lanzador
# reescribe los hosts de los servicios push hacia acá: se registra QUE salió
# un push hacia esa suscripción (no el contenido: viaja cifrado).


@app.post("/push/{host}/{path:path}")
async def push_send(host: str, path: str, request: Request):
    body = await request.body()
    _append_jsonl(
        LOGS / "push.jsonl",
        {
            "ts": _now_iso(),
            "ts_ms": int(time.time() * 1000),
            "endpoint": f"https://{host}/{path}",
            "ttl": request.headers.get("ttl"),
            "urgency": request.headers.get("urgency"),
            "content_encoding": request.headers.get("content-encoding"),
            "bytes": len(body),
        },
    )
    if "e1gone" in path:
        return Response(status_code=410)
    return Response(status_code=201)


@app.get("/push/outbox")
def push_outbox(endpoint: str = "", since_ms: int = 0):
    items = _read_jsonl(LOGS / "push.jsonl")
    return [i for i in items if endpoint in i.get("endpoint", "") and i.get("ts_ms", 0) >= since_ms]


# ──────────────────────────────── Overpass ─────────────────────────────────
# backend/app/modules/lead/infrastructure/overpass_place_source.py: POST
# data=<consulta>; lee elements[].{type,id,lat,lon|center,tags}.

_OSM_SAMPLE = [
    ("node", "restaurant", "La Esquina de Prueba", "Gorriti", "4801", "+54 11 4000-0001", "https://ejemplo-e1.test/esquina", "esquina.e1"),
    ("node", "bar", "Bar El Simulado", "Honduras", "5202", "+54 11 4000-0002", None, "bar.simulado.e1"),
    ("way", "cafe", "Café Arnés", "Thames", "1410", None, "https://ejemplo-e1.test/cafe", None),
    ("node", "pub", "Cervecería E1", "Costa Rica", "4650", "+54 11 4000-0004", None, None),
    ("node", "fast_food", "Empanadas de Prueba", "Avenida Córdoba", "5100", None, None, None),
    ("node", "ice_cream", "Heladería Ficticia", "Armenia", "1700", "+54 11 4000-0006", None, "helados.e1"),
    ("node", "restaurant", "", "Sin Nombre", "1", None, None, None),  # sin nombre: el producto lo descarta
]


@app.post("/overpass/api/interpreter")
async def overpass(request: Request):
    form = await request.form()
    query = str(form.get("data") or "")
    m = re.search(r'\["admin_level"="10"\]\s*\["name"="([^"]+)"\]', query)
    barrio = m.group(1) if m else "Palermo"
    if "e1error" in _norm(barrio):
        return Response(status_code=504)
    seed = int(hashlib.sha1(barrio.encode()).hexdigest()[:6], 16)
    elements = []
    for i, (kind, amenity, name, street, number, phone, website, instagram) in enumerate(_OSM_SAMPLE):
        tags = {"amenity": amenity, "addr:street": street, "addr:housenumber": number}
        if name:
            tags["name"] = f"{name} ({barrio})"
        if phone:
            tags["phone"] = phone
        if website:
            tags["website"] = website
        if instagram:
            tags["contact:instagram"] = instagram
        point = {"lat": round(-34.5880 + i * 0.0011, 6), "lon": round(-58.4300 + i * 0.0013, 6)}
        element = {"type": kind, "id": seed * 10 + i, "tags": tags}
        element.update({"center": point} if kind == "way" else point)
        elements.append(element)
    return {"version": 0.6, "generator": "E1 fake Overpass", "elements": elements}


def _ensure_tls_cert() -> tuple[str, str]:
    """Certificado autofirmado para el puerto HTTPS (sólo local). Hace falta
    porque las subidas de archivos del navegador a `api.cloudinary.com` no se
    pueden reenviar desde Node: Chromium no le entrega a Playwright el
    contenido de un archivo elegido del disco. El kit redirige ese pedido
    (https → https) a este puerto y el navegador manda el archivo él mismo."""
    cert_file, key_file = STATE / ".tls-cert.pem", STATE / ".tls-key.pem"
    if cert_file.exists() and key_file.exists():
        return str(cert_file), str(key_file)
    import ipaddress

    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "oido-e1-fakes")])
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=365))
        .add_extension(
            x509.SubjectAlternativeName([x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )
    cert_file.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_file.write_bytes(
        key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption())
    )
    key_file.chmod(0o600)
    return str(cert_file), str(key_file)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("E1_FAKES_PORT", "8901"))
    # Mismo proceso (misma memoria), dos puertos: 8901 http y 8902 https.
    cert_file, key_file = _ensure_tls_cert()
    tls = uvicorn.Server(
        uvicorn.Config(app, host="127.0.0.1", port=port + 1, log_level="info", ssl_certfile=cert_file, ssl_keyfile=key_file)
    )
    threading.Thread(target=tls.run, daemon=True, name="e1-fakes-https").start()
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
