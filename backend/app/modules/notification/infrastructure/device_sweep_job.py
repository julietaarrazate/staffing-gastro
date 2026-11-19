"""Barrido de dispositivos de cuentas con las sesiones revocadas, armado con
los adaptadores reales.

Un paso de la pasada de retención del scheduler en proceso
(`shift/application/scheduler.py`, inyectado desde `app/main.py` para no
cruzar capas): borra de `push_subscriptions` los dispositivos de las cuentas
que se quedaron sin sesión por una revocación. Cubre lo que el navegador no
puede avisar: las sesiones que el servidor revocó todas juntas (contraseña
restablecida, refresh reutilizado) y el cierre de sesión cuya baja nunca
llegó. La cuenta cuya sesión sólo venció por no abrir la app no se toca.

Qué cuentas son lo contesta identity por el puerto `SessionRevocations`
(`session_revocations.py`). El caso de uso es
`PushService.remove_devices_of_revoked_accounts`.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.database import AsyncSessionLocal
from app.modules.identity.infrastructure.repositories import (
    SqlAlchemyRefreshSessionRepository,
)
from app.modules.notification.application.services import PushService
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyPushSubscriptionRepository,
)
from app.modules.notification.infrastructure.session_revocations import (
    RefreshSessionRevocations,
)


async def sweep_devices_of_revoked_accounts(
    sessions: async_sessionmaker[AsyncSession],
) -> int:
    """Una pasada. Devuelve cuántos dispositivos borró."""
    async with sessions() as session:
        return await PushService(
            SqlAlchemyPushSubscriptionRepository(session)
        ).remove_devices_of_revoked_accounts(
            RefreshSessionRevocations(SqlAlchemyRefreshSessionRepository(session))
        )


async def run_device_sweep() -> int:
    """El paso que recibe el scheduler (`retention_steps`)."""
    return await sweep_devices_of_revoked_accounts(AsyncSessionLocal)
