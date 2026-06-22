"""Bootstrap de administradores.

Al iniciar la app, promueve a rol ADMIN los usuarios cuyos emails estén
listados en la variable de entorno `ADMIN_EMAILS`. Permite dar de alta al
primer administrador sin un endpoint de auto-registro (que el spec prohíbe).
Es idempotente: si el usuario ya es admin o no existe todavía, no hace nada.
"""

import logging

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.modules.identity.domain.value_objects import UserRole
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository

logger = logging.getLogger(__name__)


async def promote_configured_admins() -> None:
    emails = settings.admin_emails_list
    if not emails:
        return

    async with AsyncSessionLocal() as session:
        repo = SqlAlchemyUserRepository(session)
        for email in emails:
            user = await repo.get_by_email(email)
            if user is None:
                logger.info("ADMIN_EMAILS: %s todavía no está registrado, se omite", email)
                continue
            if user.role == UserRole.ADMIN:
                continue
            user.promote_to_admin()
            await repo.update(user)
            logger.info("ADMIN_EMAILS: %s promovido a administrador", email)
