"""Quién tiene la identidad verificada, para el servicio de turnos.

`ShiftService` lo recibe como una función (`identity_verified`): este es el
adaptador que la arma sobre el repositorio de verificación, para los dos
lugares que construyen el servicio (la API y el scheduler).
"""

from collections.abc import Awaitable, Callable
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.verification.domain.value_objects import ClaimType
from app.modules.verification.infrastructure.repositories import SqlAlchemyClaimRepository


def verificados_con(session: AsyncSession) -> Callable[[list[UUID]], Awaitable[set[UUID]]]:
    return lambda user_ids: SqlAlchemyClaimRepository(session).verified_user_ids(
        user_ids, ClaimType.DOCUMENTO_VERIFICADO
    )
