#!/usr/bin/env python
"""run_backend.py — lanzador del backend de Oído para la etapa 1 (E1).

No modifica ningún archivo del repo. Hace cuatro cosas, en este orden:

1. Arma el entorno ANTES de importar `app` (la configuración se lee al
   importar). Respeta toda variable que ya venga seteada, así se puede
   relanzar con otra config:

       RATE_LIMIT_ENABLED=true SUBSCRIPTIONS_ENFORCED=true PORT=8000 \
         <venv>/bin/python run_backend.py

2. Siembra los datos demo UNA vez (`scripts.startup_seed` con
   SEED_DEMO_DATA=true y este mismo entorno). Deja una marca en
   `.seeded`; `E1_SKIP_SEED=1` lo saltea, `E1_FORCE_SEED=1` lo repite.

3. Parchea en memoria las URLs de terceros para que apunten al servidor de
   simulados (`fakes.py`, puerto 8901) y corta toda otra salida a internet
   desde el proceso (ni Neon, ni Render, ni Cloudinary, ni Resend reales).

4. Corre uvicorn como el contenedor de producción (un solo proceso).

Otros modos:
    run_backend.py --print-env          muestra el entorno efectivo (sin secretos)
    run_backend.py --module <módulo>    corre un módulo del backend con ese mismo
                                        entorno y parches (así corre el seed)
    run_backend.py --promote-admins     promueve a admin las cuentas de
                                        ADMIN_EMAILS sin reiniciar (bootstrap_admins.py)
"""

from __future__ import annotations

import base64
import logging
import os
import secrets
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

HARNESS = Path(__file__).resolve().parent  # código (versionado)
E1 = Path(os.environ.get("E1_DIR") or "/tmp/oido-e2e")  # estado y datos (fuera del repo)
STATE = E1 / "state"
STATE.mkdir(parents=True, exist_ok=True)
REPO = Path(os.environ.get("E1_REPO") or HARNESS.parent.parent)  # tools/e2e-local/../..
BACKEND = REPO / "backend"
ENV_FILE = STATE / ".env.e1"
SEED_MARK = STATE / ".seeded"
E1_DB = os.environ.get("E1_DB") or "oido_e1"
FAKES = os.environ.get("E1_FAKES_URL", "http://127.0.0.1:8901").rstrip("/")

ADMIN_EMAILS = ",".join(f"admin{n}@e1.test" for n in range(1, 10))

# Hosts de terceros que el backend puede llegar a llamar → prefijo en el fake.
REWRITE_HOSTS = {
    "api.resend.com": "/resend",
    "oauth2.googleapis.com": "/google",
    "api.cloudinary.com": "/cloudinary",
    "generativelanguage.googleapis.com": "/gemini",
    "overpass-api.de": "/overpass",
    "overpass.private.coffee": "/overpass",
    "overpass.kumi.systems": "/overpass",
}
PUSH_HOSTS = ("fcm.googleapis.com", "updates.push.services.mozilla.com", "push.apple.com", "notify.windows.com")
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}


def _generate_secrets() -> dict[str, str]:
    from cryptography.fernet import Fernet
    from py_vapid import Vapid

    # Comando de docs/reference/ACCESO_MODERNO.md ("Cómo generar el par de claves").
    vapid = Vapid()
    vapid.generate_keys()
    priv = vapid.private_key.private_numbers().private_value.to_bytes(32, "big")
    nums = vapid.public_key.public_numbers()
    pub = b"\x04" + nums.x.to_bytes(32, "big") + nums.y.to_bytes(32, "big")
    return {
        "JWT_SECRET_KEY": secrets.token_hex(32),
        "TWO_FACTOR_ENCRYPTION_KEY": Fernet.generate_key().decode(),
        "VAPID_PRIVATE_KEY": base64.urlsafe_b64encode(priv).rstrip(b"=").decode(),
        "VAPID_PUBLIC_KEY": base64.urlsafe_b64encode(pub).rstrip(b"=").decode(),
    }


def load_secrets() -> dict[str, str]:
    """Secretos de prueba, generados una vez y guardados en `.env.e1` (si se
    regeneraran, las sesiones y los secretos 2FA ya guardados dejarían de
    servir)."""
    if not ENV_FILE.exists():
        values = _generate_secrets()
        ENV_FILE.write_text(
            "# Secretos de PRUEBA de la etapa 1 (locales, no son de producción).\n"
            + "".join(f"{k}={v}\n" for k, v in values.items())
        )
        ENV_FILE.chmod(0o600)
    values = {}
    for line in ENV_FILE.read_text().splitlines():
        if line.strip() and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def build_env() -> None:
    defaults = {
        "DATABASE_URL": f"postgresql+asyncpg://oido:oido@localhost:5432/{E1_DB}",
        # `production` a propósito: el scheduler, la cookie del refresh
        # (Secure + SameSite=None), HSTS y /docs cerrado sólo se portan como
        # en producción así.
        "ENVIRONMENT": "production",
        "DEBUG": "false",
        "CORS_ORIGINS": "http://localhost:3100",
        "FRONTEND_URL": "http://localhost:3100",
        "API_PUBLIC_URL": "http://localhost:8000",
        "RESEND_API_KEY": "e1-fake",
        "GOOGLE_CLIENT_ID": "e1-fake.apps.googleusercontent.com",
        "CLOUDINARY_CLOUD_NAME": "oido-e1",
        "CLOUDINARY_API_KEY": "111111111111111",
        "CLOUDINARY_API_SECRET": "e1-fake-cloudinary-secret",
        "GEMINI_API_KEY": "e1-fake",
        "ADMIN_EMAILS": ADMIN_EMAILS,
        # En producción el PIN de "Explorar sin cuenta" está cargado
        # (PENDIENTE_OPERATIVO.md, 2026-10-10). Para apagarlo: GUEST_ACCESS_PIN=
        "GUEST_ACCESS_PIN": "246810",
        "RATE_LIMIT_ENABLED": "false",
        "SUBSCRIPTIONS_ENFORCED": "false",
        "MERCADOPAGO_ACCESS_TOKEN": "",
        "MERCADOPAGO_WEBHOOK_SECRET": "",
        "TURNSTILE_SECRET_KEY": "",
        "EDGE_SHARED_SECRET": "",
        "SENTRY_DSN": "",
        "PORT": "8000",
        **load_secrets(),
    }
    for key, value in defaults.items():
        os.environ.setdefault(key, value)
    # Sin proxy: este proceso no tiene por dónde salir a internet.
    for key in ("HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"):
        os.environ.pop(key, None)
    os.environ["NO_PROXY"] = os.environ["no_proxy"] = "*"

    host = urlsplit(os.environ["DATABASE_URL"].replace("+asyncpg", "")).hostname or ""
    if host not in LOCAL_HOSTS:
        sys.exit(f"[e1] DATABASE_URL apunta a '{host}', no a una base local. No arranco.")


def seed_once() -> None:
    if os.environ.get("E1_SKIP_SEED") == "1":
        return
    if SEED_MARK.exists() and os.environ.get("E1_FORCE_SEED") != "1":
        return
    print("[e1] sembrando datos demo (una sola vez)…", flush=True)
    result = subprocess.run(
        [sys.executable, str(Path(__file__).resolve()), "--module", "scripts.startup_seed"],
        cwd=BACKEND,
        env={**os.environ, "SEED_DEMO_DATA": "true", "E1_SKIP_SEED": "1"},
        capture_output=True,
        text=True,
    )
    (E1 / "logs").mkdir(exist_ok=True)
    (E1 / "logs" / "seed.log").write_text(result.stdout + "\n--- stderr ---\n" + result.stderr)
    if result.returncode != 0 or "omitido por error" in result.stdout or "Listo." not in result.stdout:
        print(f"[e1] ATENCIÓN: el seed falló (ver {E1 / 'logs' / 'seed.log'})", flush=True)
        return
    SEED_MARK.write_text("ok\n")
    print("[e1] datos demo sembrados", flush=True)


def install_network_guard() -> None:
    """Toda salida HTTP del proceso va al fake o se corta. Cubre `httpx`
    (Resend, Google, Cloudinary, Gemini, Overpass, Mercado Pago, Turnstile)
    y `requests` (pywebpush)."""
    import httpx
    import requests

    log = logging.getLogger("e1.red")
    original_async = httpx.AsyncHTTPTransport.handle_async_request
    original_sync = httpx.HTTPTransport.handle_request

    def _redirect(request: httpx.Request) -> None:
        host = request.url.host
        if host in LOCAL_HOSTS:
            return
        prefix = REWRITE_HOSTS.get(host)
        if prefix is None:
            log.warning("salida BLOQUEADA a %s (no hay simulado): %s %s", host, request.method, request.url.path)
            raise httpx.ConnectError(f"E1: salida bloqueada a {host}", request=request)
        target = httpx.URL(FAKES + prefix + request.url.raw_path.decode("ascii"))
        log.info("salida a %s reenviada al simulado: %s", host, target.path)
        request.url = target
        request.headers["host"] = target.netloc.decode("ascii")

    async def guarded_async(self, request):
        _redirect(request)
        return await original_async(self, request)

    def guarded_sync(self, request):
        _redirect(request)
        return original_sync(self, request)

    httpx.AsyncHTTPTransport.handle_async_request = guarded_async
    httpx.HTTPTransport.handle_request = guarded_sync

    original_send = requests.adapters.HTTPAdapter.send

    def guarded_send(self, request, **kwargs):
        parts = urlsplit(request.url)
        host = parts.hostname or ""
        if host not in LOCAL_HOSTS:
            if any(host == h or host.endswith("." + h) for h in PUSH_HOSTS):
                request.url = f"{FAKES}/push/{host}{parts.path}"
                log.info("push a %s reenviado al simulado", host)
            else:
                log.warning("salida BLOQUEADA a %s (requests)", host)
                raise requests.exceptions.ConnectionError(f"E1: salida bloqueada a {host}")
        return original_send(self, request, **kwargs)

    requests.adapters.HTTPAdapter.send = guarded_send


def patch_product_urls() -> None:
    """Constantes de URL de terceros → simulados. Sólo en memoria."""
    import email_validator

    # El producto valida los mails con `EmailStr`, que rechaza el dominio
    # reservado `.test`. Las casillas de E1 son `@e1.test`: se habilita ese
    # dominio (y sólo eso) para este proceso.
    email_validator.TEST_ENVIRONMENT = True

    import app.core.gemini as gemini
    import app.modules.identity.infrastructure.google_token_verifier as google
    import app.modules.notification.infrastructure.resend_email_sender as resend
    from app.core.config import settings

    resend._RESEND_API_URL = f"{FAKES}/resend/emails"
    google._TOKENINFO_URL = f"{FAKES}/google/tokeninfo"
    gemini._gemini_url = lambda: f"{FAKES}/gemini/v1beta/models/{settings.gemini_model}:generateContent"
    # `cloudinary.API_BASE` NO se cambia: con esa base se arma también el link
    # de descarga privada que abre el NAVEGADOR del admin, y la CSP del
    # frontend sólo deja cargar imágenes `https:`. El link queda como en
    # producción (https://api.cloudinary.com/...): en el navegador lo enruta
    # el kit, y las llamadas del backend (destroy, rename) las reenvía
    # `install_network_guard`.


def main() -> None:
    build_env()
    args = sys.argv[1:]

    if args[:1] == ["--print-env"]:
        hidden = ("SECRET", "KEY", "PASSWORD", "TOKEN")
        for key in sorted(os.environ):
            if key.isupper() and any(
                key.startswith(p)
                for p in ("DATABASE", "ENVIRONMENT", "DEBUG", "CORS", "FRONTEND", "RESEND", "GOOGLE", "CLOUDINARY",
                          "GEMINI", "ADMIN", "RATE", "SUBSCRIPTIONS", "MERCADOPAGO", "TURNSTILE", "EDGE", "SENTRY",
                          "PORT", "JWT", "TWO_FACTOR", "VAPID", "GUEST", "API_PUBLIC")
            ):
                value = os.environ[key]
                print(f"{key}={'<oculto>' if any(h in key for h in hidden) and value else value}")
        return

    if args[:1] in (["--module"], ["--promote-admins"]):
        # Un comando suelto con el mismo entorno y los mismos parches que el
        # servidor: el seed (`--module scripts.startup_seed`) o promover a
        # admin las cuentas de ADMIN_EMAILS sin reiniciar el backend.
        sys.path.insert(0, str(BACKEND))
        os.chdir(BACKEND)
        install_network_guard()
        patch_product_urls()
        if args[0] == "--promote-admins":
            import asyncio

            from app.core.database import engine
            from app.modules.admin.bootstrap import promote_configured_admins

            async def _promote() -> None:
                try:
                    await promote_configured_admins()
                finally:
                    await engine.dispose()

            asyncio.run(_promote())
            return
        import runpy

        sys.argv = args[1:]
        runpy.run_module(args[1], run_name="__main__")
        return

    seed_once()
    # El servidor arranca SIN `SEED_DEMO_DATA` (como producción con el modo
    # demo apagado); el seed sólo corre en su propio paso, arriba.
    os.environ.pop("SEED_DEMO_DATA", None)

    sys.path.insert(0, str(BACKEND))
    os.chdir(BACKEND)
    install_network_guard()
    patch_product_urls()

    import uvicorn
    from app.main import app

    logging.getLogger("e1.red").setLevel(logging.INFO)
    port = int(os.environ["PORT"])
    print(
        f"[e1] backend en http://localhost:{port} · ENVIRONMENT={os.environ['ENVIRONMENT']} · "
        f"RATE_LIMIT_ENABLED={os.environ['RATE_LIMIT_ENABLED']} · "
        f"SUBSCRIPTIONS_ENFORCED={os.environ['SUBSCRIPTIONS_ENFORCED']} · simulados en {FAKES}",
        flush=True,
    )
    # Igual que el CMD del Dockerfile: un proceso, sin reload.
    uvicorn.run(app, host=os.environ.get("E1_BACKEND_HOST", "127.0.0.1"), port=port, log_level="info")


if __name__ == "__main__":
    main()
