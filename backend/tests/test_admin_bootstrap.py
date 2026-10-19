"""`ADMIN_EMAILS` promueve a admin al arrancar, pero sólo cuentas que
confirmaron su email: cualquiera puede registrarse con un email que todavía
no tiene cuenta, y si estaba en la lista, el próximo reinicio lo hacía admin."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.core.config import settings
from app.modules.admin import bootstrap
from app.modules.identity.infrastructure.models import UserModel
from tests.conftest import register_user

pytestmark = pytest.mark.asyncio


async def _role_of(session_factory, email: str) -> str:
    async with session_factory() as session:
        return (
            await session.execute(select(UserModel.role).where(UserModel.email == email))
        ).scalar_one()


async def test_unverified_account_is_not_promoted(
    client: AsyncClient, session_factory, monkeypatch: pytest.MonkeyPatch
):
    await register_user(client, email="futura-admin@oido.com.ar")
    monkeypatch.setattr(settings, "admin_emails", "futura-admin@oido.com.ar")
    monkeypatch.setattr(bootstrap, "AsyncSessionLocal", session_factory)

    await bootstrap.promote_configured_admins()

    assert await _role_of(session_factory, "futura-admin@oido.com.ar") == "worker"


async def test_verified_account_is_promoted(
    client: AsyncClient, session_factory, monkeypatch: pytest.MonkeyPatch
):
    await register_user(client, email="admin-real@oido.com.ar")
    async with session_factory() as session:
        await session.execute(
            update(UserModel)
            .where(UserModel.email == "admin-real@oido.com.ar")
            .values(is_verified=True)
        )
        await session.commit()
    monkeypatch.setattr(settings, "admin_emails", "admin-real@oido.com.ar")
    monkeypatch.setattr(bootstrap, "AsyncSessionLocal", session_factory)

    await bootstrap.promote_configured_admins()

    assert await _role_of(session_factory, "admin-real@oido.com.ar") == "admin"
