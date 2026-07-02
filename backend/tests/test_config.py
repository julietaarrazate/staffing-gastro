"""Tests de la normalización del DATABASE_URL (Settings)."""

from app.core.config import Settings


def _url(raw: str) -> str:
    return Settings(database_url=raw).database_url


def test_postgresql_scheme_becomes_asyncpg():
    assert _url("postgresql://u:p@host:5432/db").startswith("postgresql+asyncpg://")


def test_neon_style_url_translates_libpq_params():
    """El connection string de Neon trae sslmode/channel_binding (libpq), que
    asyncpg no acepta: deben quitarse y traducirse a ssl=require."""
    out = _url(
        "postgresql://u:p@ep-x.aws.neon.tech/db?sslmode=require&channel_binding=require"
    )
    assert out.startswith("postgresql+asyncpg://")
    assert "sslmode" not in out
    assert "channel_binding" not in out
    assert "ssl=require" in out


def test_sslmode_disable_does_not_force_ssl():
    out = _url("postgresql://u:p@host/db?sslmode=disable")
    assert "sslmode" not in out
    assert "ssl=" not in out


def test_plain_asyncpg_url_untouched():
    raw = "postgresql+asyncpg://staffya:staffya@localhost:5432/staffya"
    assert _url(raw) == raw
