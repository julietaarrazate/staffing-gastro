"""Idempotencia de mutaciones críticas vía header `Idempotency-Key`.

Spec T1 cerrado: `product/IDEMPOTENCIA_SPEC.md` (transferencia de robustez de
Cuadra — sync offline idempotente — a Oído). Público phone-first con datos
móviles inestables: un doble-tap o un reintento automático tras un timeout no
debe duplicar una acción (publicar turno, postularse, asignar, etc.).

Mecanismo: el cliente genera un UUID por INTENTO y lo manda en el header
`Idempotency-Key`. Un reintento del mismo intento reusa la key; una acción
nueva genera una key nueva. Backend:

1. Sin header en un endpoint que lo soporta → modo *grace*: loguea y deja
   ejecutar normal (no rompe clientes viejos). Documentado que a futuro puede
   volverse obligatorio.
2. Con header y la key ya tiene una respuesta guardada → se devuelve esa
   respuesta tal cual (mismo status+body), sin re-ejecutar el handler.
3. Con header, la key existe pero SIN respuesta (in-flight o crash previo)
   → 409 "operación en curso".
4. Con header, la key existe pero el fingerprint del body no coincide con
   el guardado → 422 "misma clave, pedido distinto".
5. Key nueva → se reserva (insert + commit inmediato, visible para
   requests concurrentes), se ejecuta el handler, se guarda la respuesta
   (`recorder.save(...)`, llamado explícitamente al final de cada endpoint
   protegido). Patrón de dos fases (reserva y guardado en transacciones
   separadas de la misma sesión) en vez de una única transacción envolvente,
   para que la reserva sea visible de inmediato a un pedido concurrente con
   la misma key (ver `_find_existing` + `IntegrityError` abajo).

TTL: no hay scheduler en este repo (ver docs/reference/DEPLOY.md), así que la limpieza
de keys > 24h es perezosa: se borran oportunistamente cada vez que se reserva
una key nueva (`_lazy_cleanup`), no crítico para v1 (documentado en el spec).
"""

import hashlib
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, delete, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.core.database import Base, get_session
from app.core.types import GUID
from app.modules.identity.api.dependencies import get_current_user
from app.modules.identity.domain.entities import User

logger = logging.getLogger(__name__)

IDEMPOTENCY_KEY_HEADER = "Idempotency-Key"
_TTL = timedelta(hours=24)


class IdempotencyKeyModel(Base):
    """Tabla `idempotency_keys`: un registro por (usuario, key) de intento de
    mutación crítica. `response_status`/`response_body` quedan `NULL` hasta
    que el handler termina; mientras tanto, la key está "in-flight"."""

    __tablename__ = "idempotency_keys"
    __table_args__ = (
        # Único parcial (spec): un mismo usuario no puede reservar la misma
        # key dos veces. `user_id` ya es NOT NULL (FK a un usuario
        # autenticado), pero se deja explícito el `WHERE` para blindar el
        # índice ante un futuro uso con `user_id` nullable (p. ej. acciones
        # de sistema), sin cambiar el shape de la tabla.
        Index(
            "ux_idempotency_keys_user_id_key",
            "user_id",
            "key",
            unique=True,
            postgresql_where=text("user_id IS NOT NULL"),
            sqlite_where=text("user_id IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    request_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    response_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_body: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class IdempotencyReplay(Exception):
    """Ya existe una respuesta guardada para esta key: se debe devolver tal
    cual (mismo status+body), sin ejecutar el handler de nuevo. Capturada por
    un exception handler de nivel app — ver `app/main.py`."""

    def __init__(self, status_code: int, body: Any) -> None:
        self.status_code = status_code
        self.body = body


class IdempotencyRecorder:
    """Devuelto por la dependencia `idempotent`. Si el cliente mandó una key
    válida, `save(...)` persiste la respuesta al terminar el handler. Sin key
    (modo grace) es un no-op: el endpoint sigue funcionando igual que antes
    de esta feature."""

    def __init__(self, session: AsyncSession | None, row_id: uuid.UUID | None) -> None:
        self._session = session
        self._row_id = row_id

    @property
    def active(self) -> bool:
        return self._row_id is not None

    async def save(self, status_code: int, body: Any) -> None:
        if not self.active:
            return
        assert self._session is not None
        await self._session.execute(
            IdempotencyKeyModel.__table__.update()
            .where(IdempotencyKeyModel.id == self._row_id)
            .values(response_status=status_code, response_body=body)
        )
        await self._session.commit()


def _fingerprint(method: str, path: str, body: bytes) -> str:
    return hashlib.sha256(f"{method}:{path}:".encode() + body).hexdigest()


async def _find_existing(
    session: AsyncSession, user_id: uuid.UUID, key: str
) -> IdempotencyKeyModel | None:
    return await session.scalar(
        select(IdempotencyKeyModel).where(
            IdempotencyKeyModel.user_id == user_id,
            IdempotencyKeyModel.key == key,
        )
    )


def _resolve_existing(existing: IdempotencyKeyModel, fingerprint: str) -> None:
    """Lanza la excepción correspondiente para una key ya reservada. Nunca
    retorna normalmente: o hay 422/409, o `IdempotencyReplay` con la
    respuesta guardada."""
    if existing.request_fingerprint != fingerprint:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Esta Idempotency-Key ya se usó con un pedido distinto",
        )
    if existing.response_status is not None:
        raise IdempotencyReplay(existing.response_status, existing.response_body)
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Esta operación ya está en curso, reintentá en unos segundos",
    )


async def _lazy_cleanup(session: AsyncSession) -> None:
    """Borra keys vencidas (> 24h) de forma perezosa, sin scheduler. Se
    ejecuta sólo cuando se reserva una key nueva, para no pagar el costo en
    cada request protegido (no crítico para v1, spec §TTL)."""
    cutoff = datetime.now(timezone.utc) - _TTL
    await session.execute(delete(IdempotencyKeyModel).where(IdempotencyKeyModel.created_at < cutoff))


async def idempotent(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> IdempotencyRecorder:
    """Dependencia de FastAPI para proteger una mutación crítica.

    Se declara como el ÚLTIMO parámetro de dependencia del endpoint (después
    de la resolución de rol/perfil, p. ej. `company_id`/`worker_profile_id`)
    para que un 403 de rol falle antes de reservar la key.
    """
    key = request.headers.get(IDEMPOTENCY_KEY_HEADER)
    if not key:
        logger.info(
            "idempotency.missing_header path=%s method=%s user_id=%s",
            request.url.path,
            request.method,
            current_user.id,
        )
        return IdempotencyRecorder(None, None)

    body = await request.body()
    fingerprint = _fingerprint(request.method, request.url.path, body)

    existing = await _find_existing(session, current_user.id, key)
    if existing is not None:
        _resolve_existing(existing, fingerprint)

    await _lazy_cleanup(session)

    row = IdempotencyKeyModel(
        user_id=current_user.id,
        key=key,
        method=request.method,
        path=request.url.path,
        request_fingerprint=fingerprint,
    )
    session.add(row)
    try:
        await session.commit()
    except IntegrityError:
        # Carrera: otra request con la misma key ganó la reserva primero.
        await session.rollback()
        existing = await _find_existing(session, current_user.id, key)
        if existing is None:
            # No debería pasar (el índice único sólo puede fallar si ya hay
            # una fila con este user_id+key), pero ante una carrera muy
            # ajustada donde todavía no la vemos, no tiene sentido tirar un
            # 500: es la misma situación que "operación en curso".
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Esta operación ya está en curso, reintentá en unos segundos",
            )
        _resolve_existing(existing, fingerprint)
    # `row.id` ya está poblado por el default de Python (`uuid.uuid4`) desde
    # antes del flush del commit; no hace falta `session.refresh(row)` (que
    # además puede fallar espurioso bajo alta concurrencia).
    return IdempotencyRecorder(session, row.id)
