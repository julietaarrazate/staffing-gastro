"""Datos personales en los logs (revisión de seguridad 2026-10-20)."""

from app.core.log_privacy import email_log_key, mask_email


def test_mask_email_keeps_only_first_letter_and_domain():
    assert mask_email("julieta@gmail.com") == "j***@gmail.com"
    assert mask_email("") == "***"
    assert mask_email(None) == "***"
    assert mask_email("sin-arroba") == "***"


def test_email_log_key_is_stable_and_does_not_reveal_the_email():
    key = email_log_key(" Julieta@Gmail.com ")
    assert key == email_log_key("julieta@gmail.com")
    assert "julieta" not in key
