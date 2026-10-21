"""Unidad de `RateLimiter`: consultar sin sumar y sumar sin chequear
(los usa el límite de login por email, que cuenta solo los fallidos)."""

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.rate_limit import RateLimiter


@pytest.fixture
def limiter(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    lim = RateLimiter(max_attempts=2, window_seconds=60, name="test_unidad")
    yield lim
    lim.reset()


def test_is_exceeded_does_not_count(limiter):
    for _ in range(5):
        assert limiter.is_exceeded("k") is False


def test_record_counts_without_raising(limiter):
    for _ in range(3):
        limiter.record("k")
    assert limiter.is_exceeded("k") is True
    assert limiter.is_exceeded("otra") is False


def test_check_still_counts_and_raises(limiter):
    limiter.check("k")
    limiter.check("k")
    with pytest.raises(HTTPException) as exc:
        limiter.check("k")
    assert exc.value.status_code == 429


def test_disabled_never_exceeds(limiter, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    limiter.record("k")
    limiter.record("k")
    assert limiter.is_exceeded("k") is False
