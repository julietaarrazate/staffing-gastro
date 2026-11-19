"""Adaptador del puerto `SessionRevocations`: le pregunta a identity, por su
puerto de sesiones, qué cuentas se quedaron sin sesión por una revocación."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from app.core.config import settings
from app.modules.identity.domain.repositories import RefreshSessionRepository
from app.modules.notification.application.ports import SessionRevocations


class RefreshSessionRevocations(SessionRevocations):
    """Mira las sesiones de refresh de cada cuenta. Todos los ingresos crean
    una (contraseña, Google, invitado, código de dos pasos:
    `IdentityService._issue_tokens`; la renovación la guarda en la misma
    transacción que rota la anterior), y se revocan al cerrar sesión, al
    restablecer la contraseña, al suspender y cuando se reutiliza un refresh.

    Una revocada hace menos de lo que dura un access token todavía cuenta
    como viva: el alta de dos pasos y reclamar una cuenta con Google revocan
    primero y guardan la sesión nueva después, así que por un instante la
    cuenta no tiene ninguna fila viva con la sesión abierta. Sin el margen,
    un barrido que cayera justo ahí le borraría el dispositivo."""

    def __init__(self, sessions: RefreshSessionRepository) -> None:
        self._sessions = sessions

    async def ended_by_revocation(self, user_ids: list[UUID]) -> set[UUID]:
        return await self._sessions.user_ids_ended_by_revocation(
            user_ids,
            now=datetime.now(UTC),
            revoked_grace=timedelta(minutes=settings.access_token_expire_minutes),
        )
