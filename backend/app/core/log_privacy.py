"""Datos personales en los logs: lo justo para investigar, nunca el dato
entero (revisión de seguridad 2026-10-20). Los logs de Render y los eventos
de Sentry los lee más gente y se guardan más tiempo que la base."""

import hashlib


def mask_email(email: str | None) -> str:
    """`julieta@gmail.com` → `j***@gmail.com`. Alcanza para reconocer de qué
    casilla se habla sin dejar el email completo en el log."""
    if not email or "@" not in email:
        return "***"
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}"


def email_log_key(email: str) -> str:
    """Identificador estable de un email que no lo revela (para claves de
    limitadores, que se loguean en cada 429)."""
    normalized = email.strip().lower().encode()
    return "email:" + hashlib.sha256(normalized).hexdigest()[:16]
