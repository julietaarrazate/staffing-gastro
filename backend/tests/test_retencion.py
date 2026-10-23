"""Retención del scheduler (2026-10-23): borra sesiones de refresh vencidas
hace más de 7 días y notificaciones LEÍDAS de más de 90 días. Lo demás queda."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.identity.infrastructure.models import RefreshSessionModel
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.notification.infrastructure.models import NotificationModel
from app.modules.shift.application import scheduler
from tests.conftest import register_user


async def _seed(session_factory: async_sessionmaker[AsyncSession], user_id) -> None:
    now = datetime.now(UTC)
    async with session_factory() as session:
        for label, expires, revoked in [
            ("vencida-hace-30d", now - timedelta(days=30), None),
            ("revocada-vencida-hace-8d", now - timedelta(days=8), now - timedelta(days=20)),
            ("vencida-hace-2d", now - timedelta(days=2), None),
            ("revocada-vigente", now + timedelta(days=5), now - timedelta(days=1)),
            ("vigente", now + timedelta(days=10), None),
        ]:
            session.add(
                RefreshSessionModel(
                    id=uuid4(), user_id=user_id, jti=label, expires_at=expires, revoked_at=revoked
                )
            )
        for title, age_days, read in [
            ("leida-vieja", 120, True),
            ("no-leida-vieja", 120, False),
            ("leida-reciente", 30, True),
            ("no-leida-reciente", 1, False),
        ]:
            session.add(
                NotificationModel(
                    id=uuid4(),
                    user_id=user_id,
                    title=title,
                    message="m",
                    read=read,
                    created_at=now - timedelta(days=age_days),
                )
            )
        await session.commit()


async def test_retencion_borra_solo_lo_vencido_y_leido(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession], monkeypatch
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    monkeypatch.setattr(scheduler, "_last_retention_run", None)
    await register_user(client, "retencion@example.com")
    async with session_factory() as session:
        user = await SqlAlchemyUserRepository(session).get_by_email("retencion@example.com")
    await _seed(session_factory, user.id)

    assert await scheduler.run_retention_cleanup() is None

    async with session_factory() as session:
        jtis = set(
            (await session.execute(select(RefreshSessionModel.jti).where(
                RefreshSessionModel.user_id == user.id
            ))).scalars()
        )
        titles = set((await session.execute(select(NotificationModel.title))).scalars())
    # El registro no crea sesión; quedan las vencidas hace menos de 7 días,
    # las revocadas vigentes (detección de reuso) y las vigentes.
    assert jtis == {"vencida-hace-2d", "revocada-vigente", "vigente"}
    assert titles == {"no-leida-vieja", "leida-reciente", "no-leida-reciente"}


async def test_retencion_corre_como_mucho_una_vez_por_dia(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession], monkeypatch
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    monkeypatch.setattr(
        scheduler, "_last_retention_run", datetime.now(UTC) - timedelta(hours=1)
    )
    await register_user(client, "retencion2@example.com")
    async with session_factory() as session:
        user = await SqlAlchemyUserRepository(session).get_by_email("retencion2@example.com")
    await _seed(session_factory, user.id)

    await scheduler.run_retention_cleanup()
    async with session_factory() as session:
        count = len((await session.execute(select(NotificationModel.id))).scalars().all())
    assert count == 4  # corrió hace 1 h: no vuelve a borrar

    await scheduler.run_retention_cleanup(force=True)
    async with session_factory() as session:
        count = len((await session.execute(select(NotificationModel.id))).scalars().all())
    assert count == 3
