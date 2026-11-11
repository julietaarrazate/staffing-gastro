#!/usr/bin/env python
"""bootstrap_admins.py — cuentas admin de prueba de la etapa 1 (idempotente).

- admin1@e1.test … admin8@e1.test: registradas, con el mail verificado,
  promovidas a admin y con la verificación en dos pasos YA activada
  (ADR-0023). Una por agente: un código TOTP no se puede reusar.
- admin9@e1.test: registrada, verificada y promovida, SIN activar la
  verificación (`enrolled: false`): es para probar ese alta por la UI.

Deja todo en `admin.json` (credenciales de PRUEBA, sólo locales):
  [{n, email, password, enrolled, totp_secret, recovery_codes}, …]

Necesita los simulados (8901) y el backend (8000) arriba. La promoción a
admin se hace con el mismo código del producto (`promote_configured_admins`)
vía `run_backend.py --promote-admins`, sin reiniciar el servidor.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import struct
import subprocess
import sys
import time
from pathlib import Path

import httpx

HARNESS = Path(__file__).resolve().parent  # código (versionado)
E1 = Path(os.environ.get("E1_DIR") or "/tmp/oido-e2e")  # estado y datos (fuera del repo)
STATE = E1 / "state"
STATE.mkdir(parents=True, exist_ok=True)
ADMIN_FILE = STATE / "admin.json"
TOTP_DIR = STATE / ".totp"
API = os.environ.get("E1_API_URL", "http://localhost:8000/api/v1")
FAKES = os.environ.get("E1_FAKES_URL", "http://127.0.0.1:8901")
ENROLLED = range(1, 9)
ALL = range(1, 10)


def totp(secret: str, step: int) -> str:
    """Igual que `identity/domain/two_factor.py`: 30 s, 6 dígitos, HMAC-SHA1."""
    cleaned = secret.strip().replace(" ", "").upper()
    key = base64.b32decode(cleaned + "=" * (-len(cleaned) % 8))
    digest = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % 1_000_000).zfill(6)


def load() -> dict[int, dict]:
    if not ADMIN_FILE.exists():
        return {}
    return {entry["n"]: entry for entry in json.loads(ADMIN_FILE.read_text())}


def save(entries: dict[int, dict]) -> None:
    ADMIN_FILE.write_text(json.dumps([entries[n] for n in sorted(entries)], indent=2, ensure_ascii=False) + "\n")
    ADMIN_FILE.chmod(0o600)


def verification_token(client: httpx.Client, email: str) -> str | None:
    for _ in range(40):
        mails = client.get(f"{FAKES}/mailbox", params={"to": email}).json()
        for mail in reversed(mails):
            for link in mail.get("links", []):
                m = re.search(r"/verificar-email\?token=([\w-]+)", link)
                if m:
                    return m.group(1)
        time.sleep(0.25)
    return None


def main() -> int:
    entries = load()
    client = httpx.Client(timeout=30, trust_env=False)
    try:
        client.get(API.replace("/api/v1", "") + "/health").raise_for_status()
        client.get(f"{FAKES}/health").raise_for_status()
    except Exception as exc:
        print(f"  ✗ admins: el backend o los simulados no responden ({exc})")
        return 1

    created = False
    for n in ALL:
        if n in entries:
            continue
        email = f"admin{n}@e1.test"
        password = f"E1-Admin{n}-{secrets.token_hex(4)}"
        res = client.post(
            f"{API}/auth/register",
            json={"email": email, "password": password, "full_name": f"Admin E1 {n}", "role": "worker", "accepted_terms": True},
        )
        if res.status_code == 409:
            print(f"  ✗ {email} ya existe en la base pero no está en admin.json: no sé su contraseña.")
            return 1
        res.raise_for_status()
        token = verification_token(client, email)
        if token is None:
            print(f"  ✗ no llegó el mail de verificación de {email} al simulado")
            return 1
        client.post(f"{API}/auth/verify-email", json={"token": token}).raise_for_status()
        entries[n] = {"n": n, "email": email, "password": password, "enrolled": False, "totp_secret": None, "recovery_codes": []}
        save(entries)
        created = True

    if created or any(os.environ.get(k) for k in ("E1_FORCE_PROMOTE",)):
        result = subprocess.run(
            [sys.executable, str(HARNESS / "run_backend.py"), "--promote-admins"],
            capture_output=True,
            text=True,
            env={**os.environ, "E1_SKIP_SEED": "1"},
        )
        if result.returncode != 0:
            print("  ✗ no se pudo promover a admin:\n" + result.stderr[-1500:])
            return 1

    TOTP_DIR.mkdir(exist_ok=True)
    for n in ENROLLED:
        entry = entries[n]
        if entry["enrolled"]:
            continue
        login = client.post(f"{API}/auth/login", json={"email": entry["email"], "password": entry["password"]})
        login.raise_for_status()
        body = login.json()
        if body.get("two_factor_required"):
            print(f"  ✗ {entry['email']} ya tiene la verificación activa y no tengo su secreto.")
            return 1
        if (body.get("user") or {}).get("role") != "admin":
            print(f"  ✗ {entry['email']} no quedó como admin (rol: {(body.get('user') or {}).get('role')})")
            return 1
        auth = {"Authorization": f"Bearer {body['access_token']}"}
        setup = client.post(f"{API}/auth/2fa/setup", json={}, headers=auth)
        setup.raise_for_status()
        secret = setup.json()["secret"]
        step = int(time.time()) // 30
        confirm = client.post(f"{API}/auth/2fa/confirm", json={"code": totp(secret, step)}, headers=auth)
        confirm.raise_for_status()
        entry.update(enrolled=True, totp_secret=secret, recovery_codes=confirm.json()["recovery_codes"])
        save(entries)
        # El paso usado al confirmar no se puede repetir: el kit arranca del siguiente.
        (TOTP_DIR / f"admin{n}.json").write_text(json.dumps({"lastStep": step}))

    # Chequeo final: los 8 piden código y el 9 entra a una sesión "sólo alta".
    problems = []
    for n in ALL:
        entry = entries[n]
        body = client.post(f"{API}/auth/login", json={"email": entry["email"], "password": entry["password"]}).json()
        needs_code = bool(body.get("two_factor_required"))
        if needs_code != entry["enrolled"]:
            problems.append(f"{entry['email']}: esperaba enrolled={entry['enrolled']}, el login dice {needs_code}")
        if not needs_code and (body.get("user") or {}).get("role") != "admin":
            problems.append(f"{entry['email']}: no es admin")
    if problems:
        print("  ✗ admins con problemas:\n    " + "\n    ".join(problems))
        return 1
    print(f"  ✓ admins de prueba listos: admin1..8 con 2FA, admin9 sin alta ({ADMIN_FILE})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
