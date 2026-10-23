"""Dominio de la verificación en dos pasos (ADR-0023), sin base ni HTTP.

El TOTP es propio (sin `pyotp`): estos son los vectores de prueba oficiales
de RFC 4226 (HOTP, apéndice D) y RFC 6238 (TOTP con SHA1, apéndice B).
"""

import base64
from datetime import UTC, datetime

import pytest

from app.modules.identity.domain.entities import User
from app.modules.identity.domain.exceptions import TwoFactorNotConfiguredError
from app.modules.identity.domain.two_factor import (
    AdminGate,
    admin_gate,
    generate_recovery_codes,
    generate_secret,
    hash_recovery_code,
    hotp,
    looks_like_totp,
    match_totp,
    provisioning_uri,
    time_step,
    totp_code,
)
from app.modules.identity.domain.value_objects import UserRole
from app.modules.identity.infrastructure.fernet_secret_cipher import FernetSecretCipher

RFC_KEY = b"12345678901234567890"
RFC_SECRET = base64.b32encode(RFC_KEY).decode()


@pytest.mark.parametrize(
    ("counter", "expected"),
    list(
        enumerate(
            ["755224", "287082", "359152", "969429", "338314",
             "254676", "287922", "162583", "399871", "520489"]
        )
    ),
)
def test_hotp_vectores_rfc4226(counter, expected):
    assert hotp(RFC_KEY, counter) == expected


@pytest.mark.parametrize(
    ("unix_time", "expected"),
    [
        (59, "94287082"),
        (1111111109, "07081804"),
        (1111111111, "14050471"),
        (1234567890, "89005924"),
        (2000000000, "69279037"),
        (20000000000, "65353130"),
    ],
)
def test_totp_vectores_rfc6238(unix_time, expected):
    step = time_step(datetime.fromtimestamp(unix_time, tz=UTC))
    assert hotp(RFC_KEY, step, digits=8) == expected
    # Con 6 dígitos (lo que usan las apps) son los últimos 6.
    assert totp_code(RFC_SECRET, step) == expected[-6:]


def test_secreto_nuevo_de_160_bits_en_base32():
    secret = generate_secret()
    assert len(secret) == 32 and secret.isupper()
    assert len(base64.b32decode(secret)) == 20
    assert generate_secret() != secret


def test_acepta_un_paso_para_cada_lado_y_no_mas():
    now = datetime(2026, 10, 23, 15, 0, 10, tzinfo=UTC)
    step = time_step(now)
    for offset in (-1, 0, 1):
        code = totp_code(RFC_SECRET, step + offset)
        assert match_totp(RFC_SECRET, code, now, last_used_step=None) == step + offset
    for offset in (-2, 2):
        code = totp_code(RFC_SECRET, step + offset)
        assert match_totp(RFC_SECRET, code, now, last_used_step=None) is None


def test_anti_replay_no_acepta_un_paso_ya_usado_ni_anterior():
    now = datetime(2026, 10, 23, 15, 0, 10, tzinfo=UTC)
    step = time_step(now)
    code = totp_code(RFC_SECRET, step)
    assert match_totp(RFC_SECRET, code, now, last_used_step=step) is None
    previous = totp_code(RFC_SECRET, step - 1)
    assert match_totp(RFC_SECRET, previous, now, last_used_step=step) is None
    following = totp_code(RFC_SECRET, step + 1)
    assert match_totp(RFC_SECRET, following, now, last_used_step=step) == step + 1


def test_codigo_con_espacios_sirve_y_basura_no():
    now = datetime(2026, 10, 23, 15, 0, 10, tzinfo=UTC)
    code = totp_code(RFC_SECRET, time_step(now))
    assert match_totp(RFC_SECRET, f"{code[:3]} {code[3:]}", now, last_used_step=None)
    assert match_totp(RFC_SECRET, "12345", now, last_used_step=None) is None
    assert match_totp(RFC_SECRET, "abcdef", now, last_used_step=None) is None
    assert looks_like_totp("123 456") and not looks_like_totp("abcd-efgh-jkmn")


def test_uri_del_qr_con_emisor_oido():
    uri = provisioning_uri("JBSWY3DPEHPK3PXP", "hola@oido.com.ar")
    assert uri == (
        "otpauth://totp/O%C3%ADdo:hola@oido.com.ar"
        "?secret=JBSWY3DPEHPK3PXP&issuer=O%C3%ADdo"
    )


def test_codigos_de_recuperacion():
    codes = generate_recovery_codes()
    assert len(codes) == 10 and len(set(codes)) == 10
    for code in codes:
        groups = code.split("-")
        assert len(groups) == 3 and all(len(g) == 4 for g in groups)
        assert not set(code) & set("01ilo")
    # Se acepta como se tipee: mayúsculas, sin guiones, con espacios.
    code = codes[0]
    variants = [code.upper(), code.replace("-", ""), code.replace("-", " ")]
    assert all(hash_recovery_code(v) == hash_recovery_code(code) for v in variants)
    assert hash_recovery_code(code) != hash_recovery_code(codes[1])
    assert len(hash_recovery_code(code)) == 64


@pytest.mark.parametrize(
    ("role", "enabled", "verified", "expected"),
    [
        (UserRole.WORKER, False, False, AdminGate.GRANTED),
        (UserRole.EMPLOYER, False, False, AdminGate.GRANTED),
        (UserRole.ADMIN, False, False, AdminGate.SETUP_REQUIRED),
        (UserRole.ADMIN, False, True, AdminGate.SETUP_REQUIRED),
        (UserRole.ADMIN, True, False, AdminGate.VERIFICATION_REQUIRED),
        (UserRole.ADMIN, True, True, AdminGate.GRANTED),
    ],
)
def test_que_puede_hacer_cada_sesion(role, enabled, verified, expected):
    user = User(email="x@oido.com.ar", hashed_password="h", role=role, full_name="X")
    assert admin_gate(user, enabled=enabled, session_verified=verified) is expected


def test_cifrado_ida_y_vuelta_y_rotacion_de_clave():
    from cryptography.fernet import Fernet

    old, new = Fernet.generate_key().decode(), Fernet.generate_key().decode()
    stored = FernetSecretCipher(old).encrypt("JBSWY3DPEHPK3PXP")
    assert "JBSWY3DPEHPK3PXP" not in stored
    # Rotación: la clave nueva primero, la vieja todavía descifra.
    assert FernetSecretCipher(f"{new},{old}").decrypt(stored) == "JBSWY3DPEHPK3PXP"
    with pytest.raises(TwoFactorNotConfiguredError):
        FernetSecretCipher(new).decrypt(stored)


def test_sin_clave_o_con_clave_invalida_no_esta_configurado():
    for key in ("", "no-es-una-clave"):
        cipher = FernetSecretCipher(key)
        assert cipher.is_configured is False
        with pytest.raises(TwoFactorNotConfiguredError):
            cipher.encrypt("x")
