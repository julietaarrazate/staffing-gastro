"""Utilidades de seguridad: hashing de contraseñas y tokens JWT.

Mantiene la criptografía aislada del dominio para que los casos de uso
dependan de funciones puras y testeables.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.core.config import settings

# bcrypt sólo mira los primeros 72 bytes. passlib (hasta el 2026-10-21)
# cortaba en silencio y bcrypt 5 en cambio da error, así que se corta acá:
# si no, las contraseñas de más de 72 bytes guardadas con passlib dejarían de
# verificar. Una contraseña admite hasta 128 caracteres (schemas de identity).
_BCRYPT_MAX_BYTES = 72


def _bcrypt_input(plain_password: str) -> bytes:
    return plain_password.encode("utf-8")[:_BCRYPT_MAX_BYTES]

# Tipos de token emitidos
ACCESS_TOKEN = "access"
REFRESH_TOKEN = "refresh"


# --- Contraseñas ---
def hash_password(plain_password: str) -> str:
    """Devuelve el hash bcrypt de una contraseña en texto plano."""
    return bcrypt.hashpw(_bcrypt_input(plain_password), bcrypt.gensalt()).decode("ascii")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Compara una contraseña en texto plano contra su hash."""
    try:
        return bcrypt.checkpw(_bcrypt_input(plain_password), hashed_password.encode("ascii"))
    except ValueError:
        # Hash con formato inválido: no verifica, en vez de un 500.
        return False


# bcrypt tarda ~250 ms a costo 12 y es CPU puro. El backend corre en un solo
# proceso de uvicorn: llamado directo desde un handler async congela el event
# loop y con él a todos los usuarios. Los casos de uso usan estas variantes,
# que lo corren en un hilo (bcrypt suelta el GIL mientras calcula).
async def hash_password_async(plain_password: str) -> str:
    """`hash_password` en un hilo, sin bloquear el event loop."""
    return await asyncio.to_thread(hash_password, plain_password)


async def verify_password_async(plain_password: str, hashed_password: str) -> bool:
    """`verify_password` en un hilo, sin bloquear el event loop."""
    return await asyncio.to_thread(verify_password, plain_password, hashed_password)


# --- JWT ---
def _create_token(
    subject: str,
    token_type: str,
    expires_delta: timedelta,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    """Genera un access token de corta duración."""
    return _create_token(
        subject,
        ACCESS_TOKEN,
        timedelta(minutes=settings.access_token_expire_minutes),
        extra_claims,
    )


def create_refresh_token(
    subject: str, jti: str, extra_claims: dict[str, Any] | None = None
) -> str:
    """Genera un refresh token de larga duración.

    `jti` identifica la sesión (tabla `refresh_sessions`) para permitir
    revocación server-side y rotación (ADR-0002). Lo genera y persiste quien
    llama (capa de aplicación), no esta función. `extra_claims` lleva lo que
    tiene que sobrevivir a la rotación (la marca de sesión verificada en dos
    pasos, ADR-0023).
    """
    return _create_token(
        subject,
        REFRESH_TOKEN,
        timedelta(days=settings.refresh_token_expire_days),
        extra_claims={**(extra_claims or {}), "jti": jti},
    )


def decode_token(token: str) -> dict[str, Any]:
    """Decodifica y valida un JWT. Lanza jwt.PyJWTError si es inválido o expiró."""
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
