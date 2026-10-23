"""Verificación en dos pasos de las cuentas admin (ADR-0023).

Lógica pura, sin frameworks ni base: el código de 6 dígitos de una app
autenticadora (TOTP, RFC 6238 sobre HOTP, RFC 4226), el `otpauth://` que
lleva el QR, los códigos de recuperación y la regla de qué puede hacer una
sesión admin según su estado de verificación.

El TOTP está escrito acá con la biblioteca estándar (`hmac`, `hashlib`) en
vez de sumar `pyotp`: son veinte líneas, tienen los vectores de prueba
oficiales del RFC (`tests/test_dos_pasos_dominio.py`) y así no hay una
dependencia más que auditar. Las mismas razones, en el ADR.
"""

import base64
import hashlib
import hmac
import re
import secrets
import struct
from datetime import datetime, timedelta
from enum import Enum
from urllib.parse import quote

from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole

# --- TOTP (RFC 6238) ----------------------------------------------------------
# Los valores por defecto de Google Authenticator y de casi todas las apps:
# pasos de 30 s, 6 dígitos, HMAC-SHA1. Cambiarlos rompe la compatibilidad.
TOTP_PERIOD_SECONDS = 30
TOTP_DIGITS = 6
# Se acepta el paso actual y uno para cada lado (±30 s) por desfasaje del
# reloj del celular. Más ventana = más códigos válidos a la vez para adivinar.
TOTP_WINDOW_STEPS = 1
# 160 bits: el largo que recomienda RFC 4226 §4 para el secreto compartido.
SECRET_BYTES = 20
ISSUER = "Oído"

# --- Códigos de recuperación ---------------------------------------------------
RECOVERY_CODE_COUNT = 10
# Sin 0/o, 1/i/l: se copian a mano de un papel. 31 símbolos, 12 por código:
# ~59 bits por código. Alcanza para guardarlos con sha256 (no son contraseñas
# elegidas por una persona, son al azar), como los tokens de recuperación de
# contraseña.
_RECOVERY_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"
_RECOVERY_GROUPS = 3
_RECOVERY_GROUP_LEN = 4

# --- Desafío del login -----------------------------------------------------------
# Entre la contraseña (o Google) y el código: vence a los 5 minutos, sirve
# una vez y aguanta pocos errores antes de quemarse.
CHALLENGE_TTL = timedelta(minutes=5)
CHALLENGE_MAX_FAILED_ATTEMPTS = 5
# Tope por cuenta, sumando todos los desafíos: sin esto, quien tiene la
# contraseña pediría desafíos nuevos sin fin, cada uno con 5 intentos, desde
# IPs distintas. 10 errores en 15 minutos traban el paso del código un rato.
ACCOUNT_MAX_FAILED_ATTEMPTS = 10
ACCOUNT_LOCK_WINDOW = timedelta(minutes=15)


def generate_secret() -> str:
    """Secreto nuevo en base32 sin relleno (lo que esperan las apps)."""
    return base64.b32encode(secrets.token_bytes(SECRET_BYTES)).decode("ascii").rstrip("=")


def _secret_bytes(secret: str) -> bytes:
    cleaned = secret.strip().replace(" ", "").upper()
    return base64.b32decode(cleaned + "=" * (-len(cleaned) % 8))


def hotp(key: bytes, counter: int, digits: int = TOTP_DIGITS) -> str:
    """HOTP de RFC 4226 §5.3 (truncado dinámico) con HMAC-SHA1."""
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % (10**digits)).zfill(digits)


def time_step(now: datetime) -> int:
    """Número de paso de 30 s desde el epoch Unix para `now` (con zona)."""
    return int(now.timestamp()) // TOTP_PERIOD_SECONDS


def totp_code(secret: str, step: int) -> str:
    return hotp(_secret_bytes(secret), step)


def normalize_totp(code: str) -> str:
    return re.sub(r"\s", "", code)


def looks_like_totp(code: str) -> bool:
    """¿Es un código de la app (6 dígitos) y no uno de recuperación?"""
    return bool(re.fullmatch(rf"\d{{{TOTP_DIGITS}}}", normalize_totp(code)))


def match_totp(
    secret: str, code: str, now: datetime, *, last_used_step: int | None
) -> int | None:
    """Paso en el que `code` es válido, o None.

    Anti-replay (RFC 6238 §5.2): un paso igual o anterior al último usado no
    se acepta, así un código ya usado (o uno más viejo de la ventana) no
    vuelve a servir aunque siga dentro de los 30 s. Quien llama tiene que
    guardar el paso devuelto de forma atómica (ver
    `TwoFactorRepository.try_use_step`)."""
    candidate = normalize_totp(code)
    if not looks_like_totp(candidate):
        return None
    current = time_step(now)
    for offset in (0, -1, 1)[: 2 * TOTP_WINDOW_STEPS + 1]:
        step = current + offset
        if last_used_step is not None and step <= last_used_step:
            continue
        if hmac.compare_digest(totp_code(secret, step), candidate):
            return step
    return None


def provisioning_uri(secret: str, account_email: str, issuer: str = ISSUER) -> str:
    """`otpauth://` del QR (formato "Key Uri" de Google Authenticator)."""
    label = quote(f"{issuer}:{account_email}", safe=":@")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer, safe='')}"


def generate_recovery_codes(count: int = RECOVERY_CODE_COUNT) -> list[str]:
    """Códigos de un solo uso, `xxxx-xxxx-xxxx`. Se muestran una vez."""
    return [
        "-".join(
            "".join(secrets.choice(_RECOVERY_ALPHABET) for _ in range(_RECOVERY_GROUP_LEN))
            for _ in range(_RECOVERY_GROUPS)
        )
        for _ in range(count)
    ]


def normalize_recovery_code(code: str) -> str:
    """Minúsculas y sin guiones ni espacios: se acepta como se tipee."""
    return re.sub(r"[^0-9a-z]", "", code.lower())


def hash_recovery_code(code: str) -> str:
    return hashlib.sha256(normalize_recovery_code(code).encode("ascii")).hexdigest()


def hash_challenge_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


# --- Qué puede hacer una sesión admin ----------------------------------------------


class AdminGate(str, Enum):
    """Resultado de mirar una sesión admin. El valor es el `code` que la API
    devuelve en el 403 y que el frontend usa para saber adónde llevar."""

    GRANTED = "granted"
    # Admin sin la verificación activada: sólo puede activarla.
    SETUP_REQUIRED = "two_factor_setup_required"
    # Tiene la verificación activada pero esta sesión no pasó por el código
    # (sesión abierta antes de activarla, en otro dispositivo): a ingresar de
    # nuevo.
    VERIFICATION_REQUIRED = "two_factor_required"


def admin_gate(user: User, *, enabled: bool, session_verified: bool) -> AdminGate:
    """Trabajadores y comercios no cambian: siempre `GRANTED`. Un admin
    necesita la verificación activada y una sesión que haya pasado por el
    código."""
    if user.role != UserRole.ADMIN:
        return AdminGate.GRANTED
    if not enabled:
        return AdminGate.SETUP_REQUIRED
    if not session_verified:
        return AdminGate.VERIFICATION_REQUIRED
    return AdminGate.GRANTED
