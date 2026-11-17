"""Adaptador SQLAlchemy del ShiftRepository."""

import math
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from statistics import median
from uuid import UUID

from sqlalchemy import case, extract, func, or_, select, true, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.exc import StaleDataError

from app.modules.company.infrastructure.models import CompanyProfileModel
from app.modules.identity.domain.value_objects import UserStatus
from app.modules.identity.infrastructure.models import UserModel
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.exceptions import ShiftConcurrentModificationError
from app.modules.shift.domain.pay_benchmark import hourly_rate
from app.modules.shift.domain.repositories import (
    ShiftPeriodStats,
    ShiftPublicationStats,
    ShiftRepository,
    ShiftLiveCounts,
    ShiftReturnStats,
    ShiftTodayCounts,
    WorkerEarningsTotals,
)
from app.modules.shift.domain.value_objects import (
    OPEN_STATUSES,
    UNCOVERED_ELIGIBLE_STATUSES,
    ShiftStatus,
)
from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.worker.domain.value_objects import WorkerSkill

# Campos editables que se copian de la entidad al modelo.
_EDITABLE_FIELDS = (
    "position",
    "quantity",
    "start_at",
    "end_at",
    "pay_amount",
    "currency",
    "tips",
    "meal",
    "dress_code",
    "urgent",
    "address",
    "city",
    "latitude",
    "longitude",
    "title",
    "description",
    # Sólo los completa la publicación masiva de un evento (`create_event`):
    # en un alta/edición individual quedan en `None`, sin efecto.
    "event_id",
    "event_name",
)


def _minutes_between(dialect: str, start, end):
    """Minutos entre dos columnas de fecha, en SQL. Cada motor lo escribe
    distinto: Postgres (producción) resta y extrae los segundos; SQLite
    (tests) no tiene intervalos y usa `julianday` (días con decimales)."""
    if dialect == "postgresql":
        return extract("epoch", end - start) / 60.0
    return (func.julianday(end) - func.julianday(start)) * 1440.0


def _to_entity(model: ShiftModel) -> Shift:
    return Shift(
        id=model.id,
        company_id=model.company_id,
        position=WorkerSkill(model.position),
        quantity=model.quantity,
        start_at=model.start_at,
        end_at=model.end_at,
        pay_amount=model.pay_amount,
        currency=model.currency,
        tips=model.tips,
        meal=model.meal,
        dress_code=model.dress_code,
        urgent=model.urgent,
        address=model.address,
        city=model.city,
        latitude=model.latitude,
        longitude=model.longitude,
        title=model.title,
        description=model.description,
        status=ShiftStatus(model.status),
        worker_profile_id=model.worker_profile_id,
        en_route_latitude=model.en_route_latitude,
        en_route_longitude=model.en_route_longitude,
        en_route_at=model.en_route_at,
        check_in_latitude=model.check_in_latitude,
        check_in_longitude=model.check_in_longitude,
        check_in_at=model.check_in_at,
        check_out_latitude=model.check_out_latitude,
        check_out_longitude=model.check_out_longitude,
        check_out_at=model.check_out_at,
        paid_at=model.paid_at,
        no_show_at=model.no_show_at,
        last_no_show_worker_profile_id=model.last_no_show_worker_profile_id,
        checkin_reminder_sent_at=model.checkin_reminder_sent_at,
        departure_reminder_sent_at=model.departure_reminder_sent_at,
        event_id=model.event_id,
        event_name=model.event_name,
        published_at=model.published_at,
        first_assigned_at=model.first_assigned_at,
        first_confirmed_at=model.first_confirmed_at,
        escalated_at=model.escalated_at,
        created_at=model.created_at,
        updated_at=model.updated_at,
        version=model.version,
    )


def _apply_fields(model: ShiftModel, shift: Shift) -> None:
    same_worker = model.worker_profile_id == shift.worker_profile_id
    for name in _EDITABLE_FIELDS:
        value = getattr(shift, name)
        if name == "position":
            value = value.value
        setattr(model, name, value)
    model.status = shift.status.value
    model.worker_profile_id = shift.worker_profile_id
    model.en_route_latitude = shift.en_route_latitude
    model.en_route_longitude = shift.en_route_longitude
    model.en_route_at = shift.en_route_at
    model.check_in_latitude = shift.check_in_latitude
    model.check_in_longitude = shift.check_in_longitude
    model.check_in_at = shift.check_in_at
    model.check_out_latitude = shift.check_out_latitude
    model.check_out_longitude = shift.check_out_longitude
    model.check_out_at = shift.check_out_at
    model.paid_at = shift.paid_at
    model.no_show_at = shift.no_show_at
    model.last_no_show_worker_profile_id = shift.last_no_show_worker_profile_id
    model.checkin_reminder_sent_at = shift.checkin_reminder_sent_at
    # La marca del recordatorio de salida la escribe el scheduler sin subir la
    # versión (`mark_departure_reminder_sent`, U103), así que una entidad leída
    # antes llega con None: no la pisamos mientras siga asignada la misma
    # persona. Si cambió o se desasignó, el reseteo del dominio sí va. Tras
    # un check-in o una cancelación (misma persona) la marca queda: el turno
    # ya no es CONFIRMADO y el scheduler no lo vuelve a mirar.
    if not (
        shift.departure_reminder_sent_at is None
        and model.departure_reminder_sent_at is not None
        and same_worker
    ):
        model.departure_reminder_sent_at = shift.departure_reminder_sent_at
    model.published_at = shift.published_at
    model.first_assigned_at = shift.first_assigned_at
    model.first_confirmed_at = shift.first_confirmed_at
    model.escalated_at = shift.escalated_at


def _from_active_company():
    """Condición «el comercio del turno tiene la cuenta activa» (ADR-0024):
    los turnos abiertos de un comercio suspendido no se ofrecen ni se escalan.

    Lectura que cruza con perfiles de comercio y usuarios, el mismo patrón que
    los candidatos de `matching` (sólo cuentas activas). Va como subconsulta
    en la misma sentencia: no suma un viaje a la base y la página paginada
    sale entera. Los comercios suspendidos son pocos."""
    inactive = (
        select(CompanyProfileModel.id)
        .join(UserModel, UserModel.id == CompanyProfileModel.user_id)
        .where(UserModel.status != UserStatus.ACTIVE.value)
    )
    return ShiftModel.company_id.not_in(inactive)


def _not_from_companies_of(emails: frozenset[str]):
    """Condición «el comercio del turno NO es una de estas cuentas» (cuentas
    de prueba e invitadas que se excluyen de las métricas de la beta). Mismo
    patrón de subconsulta que `_from_active_company`. El repo no conoce las
    constantes de identity/admin: la lista se la pasa quien llama."""
    if not emails:
        return true()
    excluded = (
        select(CompanyProfileModel.id)
        .join(UserModel, UserModel.id == CompanyProfileModel.user_id)
        .where(UserModel.email.in_(emails))
    )
    return ShiftModel.company_id.not_in(excluded)


def _utc_naive(value: datetime) -> datetime:
    """SQLite (tests) devuelve fechas sin zona y Postgres con zona: se
    comparan siempre en UTC sin zona."""
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


# Aviso corto: el turno empieza dentro de las 24 h de haberse publicado.
SHORT_NOTICE_MINUTES = 24 * 60


class SqlAlchemyShiftRepository(ShiftRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, shift: Shift) -> Shift:
        model = ShiftModel(id=shift.id, company_id=shift.company_id)
        _apply_fields(model, shift)
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def update(self, shift: Shift) -> Shift:
        """Guarda el turno sólo si nadie lo cambió desde que se leyó
        (ADR-0016). Dos chequeos, porque cubren ventanas distintas:

        1. Antes de escribir: la versión leída ahora de la base contra la que
           trae la entidad. Atrapa lo que pasó entre la lectura del caso de
           uso y este guardado (la ventana grande, la de las carreras reales).
        2. Al escribir: `version_id_col` agrega `WHERE version = ...` al
           UPDATE; si afecta 0 filas, `StaleDataError`. Atrapa la ventana
           chica entre el chequeo 1 y el commit."""
        model = await self._session.get(ShiftModel, shift.id, populate_existing=True)
        if model is None:
            raise ValueError("El turno no existe")
        if model.version != shift.version:
            raise ShiftConcurrentModificationError(str(shift.id))
        _apply_fields(model, shift)
        try:
            await self._session.commit()
        except StaleDataError as exc:
            await self._session.rollback()
            raise ShiftConcurrentModificationError(str(shift.id)) from exc
        await self._session.refresh(model)
        # Quien reuse la misma entidad para otro guardado en el mismo caso de
        # uso parte de la versión nueva, no de la que ya se consumió.
        shift.version = model.version
        return _to_entity(model)

    async def mark_departure_reminder_sent(
        self, shift_id: UUID, worker_profile_id: UUID, sent_at: datetime
    ) -> bool:
        # UPDATE masivo (Core): no pasa por `version_id_col`, así que no sube
        # la versión (ADR-0016: no genera conflictos falsos). Como la versión
        # ya no corta la carrera con el scheduler, el WHERE la corta: sólo se
        # marca si el turno sigue asignado/confirmado a la misma persona, sin marca
        # previa y sin «Va en camino». Dos pasadas a la vez: una sola gana.
        result = await self._session.execute(
            update(ShiftModel)
            .where(
                ShiftModel.id == shift_id,
                ShiftModel.worker_profile_id == worker_profile_id,
                ShiftModel.status.in_(
                    [ShiftStatus.ASIGNADO.value, ShiftStatus.CONFIRMADO.value]
                ),
                ShiftModel.departure_reminder_sent_at.is_(None),
                ShiftModel.en_route_at.is_(None),
            )
            .values(departure_reminder_sent_at=sent_at)
            .execution_options(synchronize_session=False)
        )
        await self._session.commit()
        return result.rowcount == 1

    async def get_by_id(self, shift_id: UUID) -> Shift | None:
        # `populate_existing`: siempre lo que hay en la base, no la copia del
        # identity map de la sesión. El scheduler usa una sesión por pasada y,
        # sin esto, decidía sobre un turno que un usuario ya había cambiado.
        model = await self._session.get(ShiftModel, shift_id, populate_existing=True)
        return _to_entity(model) if model else None

    async def companies_with_inactive_account(
        self, company_ids: Sequence[UUID]
    ) -> set[UUID]:
        if not company_ids:
            return set()
        stmt = (
            select(CompanyProfileModel.id)
            .join(UserModel, UserModel.id == CompanyProfileModel.user_id)
            .where(
                CompanyProfileModel.id.in_(list(company_ids)),
                UserModel.status != UserStatus.ACTIVE.value,
            )
        )
        result = await self._session.execute(stmt)
        return set(result.scalars().all())

    async def list_by_ids(self, shift_ids: Sequence[UUID]) -> list[Shift]:
        # Sin ids no hay query: `IN ()` es SQL inválido y además evita un
        # round-trip inútil a la base remota.
        if not shift_ids:
            return []
        stmt = select(ShiftModel).where(ShiftModel.id.in_(shift_ids))
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_by_company(
        self, company_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Shift]:
        stmt = (
            select(ShiftModel)
            .where(ShiftModel.company_id == company_id)
            .order_by(ShiftModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_by_worker(
        self, worker_profile_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Shift]:
        stmt = (
            select(ShiftModel)
            .where(ShiftModel.worker_profile_id == worker_profile_id)
            .order_by(ShiftModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_history_by_worker(
        self, worker_profile_id: UUID, *, limit: int = 50
    ) -> list[Shift]:
        stmt = (
            select(ShiftModel)
            .where(
                or_(
                    ShiftModel.worker_profile_id == worker_profile_id,
                    ShiftModel.last_no_show_worker_profile_id == worker_profile_id,
                )
            )
            .order_by(ShiftModel.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def sum_worker_earnings(
        self,
        worker_profile_id: UUID,
        statuses: frozenset[ShiftStatus],
        *,
        window_start: datetime,
        window_end: datetime,
    ) -> WorkerEarningsTotals:
        # Los límites se pasan en UTC: así comparan igual en Postgres y en
        # SQLite (que guarda los instantes sin zona, en UTC).
        window_start = window_start.astimezone(timezone.utc)
        window_end = window_end.astimezone(timezone.utc)
        in_window = (ShiftModel.start_at >= window_start) & (ShiftModel.start_at < window_end)
        stmt = select(
            func.sum(ShiftModel.pay_amount),
            func.count(ShiftModel.id),
            func.sum(case((in_window, ShiftModel.pay_amount))),
        ).where(
            ShiftModel.worker_profile_id == worker_profile_id,
            ShiftModel.status.in_([s.value for s in statuses]),
        )
        total, count, month = (await self._session.execute(stmt)).one()
        # SUM sobre cero filas es NULL: se informa como 0 sin decimales, igual
        # que antes de pasar la suma a la base.
        return WorkerEarningsTotals(
            total=Decimal(0) if total is None else Decimal(str(total)),
            count=int(count),
            in_window=Decimal(0) if month is None else Decimal(str(month)),
        )

    async def list_by_worker_and_statuses(
        self, worker_profile_id: UUID, statuses: frozenset[ShiftStatus]
    ) -> list[Shift]:
        stmt = select(ShiftModel).where(
            ShiftModel.worker_profile_id == worker_profile_id,
            ShiftModel.status.in_([s.value for s in statuses]),
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_by_event(self, company_id: UUID, event_id: UUID) -> list[Shift]:
        stmt = (
            select(ShiftModel)
            .where(ShiftModel.company_id == company_id, ShiftModel.event_id == event_id)
            .order_by(ShiftModel.start_at, ShiftModel.created_at)
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_by_company_and_statuses(
        self, company_id: UUID, statuses: frozenset[ShiftStatus]
    ) -> list[Shift]:
        stmt = select(ShiftModel).where(
            ShiftModel.company_id == company_id,
            ShiftModel.status.in_([s.value for s in statuses]),
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_awaiting_checkin(self) -> list[Shift]:
        stmt = select(ShiftModel).where(
            ShiftModel.status.in_(
                [ShiftStatus.CONFIRMADO.value, ShiftStatus.EN_CAMINO.value]
            )
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_recently_filled(
        self, *, exclude_company_emails: frozenset[str] = frozenset(), limit: int = 500
    ) -> list[Shift]:
        stmt = (
            select(ShiftModel)
            .where(
                ShiftModel.published_at.is_not(None),
                ShiftModel.first_confirmed_at.is_not(None),
                _not_from_companies_of(exclude_company_emails),
            )
            .order_by(ShiftModel.published_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_open_awaiting_escalation(self) -> list[Shift]:
        stmt = select(ShiftModel).where(
            ShiftModel.status.in_([s.value for s in OPEN_STATUSES]),
            ShiftModel.published_at.is_not(None),
            ShiftModel.escalated_at.is_(None),
            # Oculto mientras el comercio está suspendido (ADR-0024): escalar
            # avisaría de un turno que nadie puede ver. Si se reactiva, entra.
            _from_active_company(),
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_awaiting_coverage_check(self) -> list[Shift]:
        stmt = select(ShiftModel).where(
            ShiftModel.status.in_([s.value for s in UNCOVERED_ELIGIBLE_STATUSES])
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def hourly_pay_samples(
        self, pairs: Sequence[tuple[WorkerSkill, str]], *, since: datetime
    ) -> dict[tuple[WorkerSkill, str], list[Decimal]]:
        if not pairs:
            return {}
        # UNA consulta para todas las combinaciones de la página, con un OR de
        # ANDs en vez de una consulta por par. Se usa esta forma y no un
        # `tuple_(...).in_(...)` porque los row values no se comportan igual en
        # todos los dialectos, y acá conviven SQLite (tests) y Postgres (prod).
        conditions = [
            (ShiftModel.position == position) & (func.lower(ShiftModel.city) == city)
            for position, city in pairs
        ]
        stmt = (
            select(
                ShiftModel.position,
                func.lower(ShiftModel.city),
                ShiftModel.pay_amount,
                ShiftModel.start_at,
                ShiftModel.end_at,
            )
            .where(
                or_(*conditions),
                ShiftModel.status != ShiftStatus.BORRADOR,
                ShiftModel.created_at >= since,
            )
            .order_by(ShiftModel.created_at.desc())
            # Tope global, mismo criterio que `list_recently_filled`: una
            # referencia de mercado no mejora por leer decenas de miles de
            # filas. Con la ventana de 60 días y el filtro por puesto/ciudad
            # esto sobra; si algún día una combinación sola superara el tope,
            # habría que pasar a una consulta por grupo con ventana.
            .limit(2000)
        )
        result = await self._session.execute(stmt)

        samples: dict[tuple[WorkerSkill, str], list[Decimal]] = {}
        for position, city, pay, start, end in result.all():
            # La normalización a pago por hora vive en el dominio y se llama
            # desde acá en vez de reescribirla en SQL: la resta de fechas es
            # dialecto-específica y duplicarla dejaría la misma regla en dos
            # lugares que pueden divergir.
            rate = hourly_rate(pay, start, end)
            if rate is None:
                continue
            samples.setdefault((position, city), []).append(rate)
        return samples

    async def count_publication_stats(
        self, *, exclude_company_emails: frozenset[str] = frozenset()
    ) -> ShiftPublicationStats:
        # Una sola query con SUM/CASE (mismo patrón que
        # `UserRepository.count_stats`), no traer filas y contar en Python.
        # `completed` usa dos estados YA existentes del dominio
        # (`FINALIZADO`/`PAGADO`, `shift/domain/entities.py::finish`/
        # `mark_paid`) — no se inventa ningún estado nuevo.
        stmt = select(
            func.sum(case((ShiftModel.published_at.is_not(None), 1), else_=0)).label(
                "published"
            ),
            func.sum(
                case(
                    (
                        (ShiftModel.published_at.is_not(None))
                        & (ShiftModel.first_assigned_at.is_not(None)),
                        1,
                    ),
                    else_=0,
                )
            ).label("assigned"),
            func.sum(
                case(
                    (
                        (ShiftModel.published_at.is_not(None))
                        & (
                            ShiftModel.status.in_(
                                [ShiftStatus.FINALIZADO.value, ShiftStatus.PAGADO.value]
                            )
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("completed"),
        ).where(_not_from_companies_of(exclude_company_emails))
        row = (await self._session.execute(stmt)).one()
        return ShiftPublicationStats(
            published=row.published or 0,
            assigned=row.assigned or 0,
            completed=row.completed or 0,
        )

    @staticmethod
    def _open_stmt(
        *,
        city: str | None,
        position: WorkerSkill | None,
        positions: list[WorkerSkill] | None,
        urgent: bool | None,
    ):
        """Los turnos abiertos que todavía no empezaron, con los filtros del
        feed. Lo comparten `list_open` (paginado) y `list_open_unpaged`."""
        stmt = select(ShiftModel).where(
            ShiftModel.status.in_([s.value for s in OPEN_STATUSES]),
            # Un turno cuya hora ya pasó no tiene sentido ofrecerlo para
            # postularse (2026-09-16, Julieta probando la app real: "veo que
            # quedan puestos abiertos cuando ya pasó la fecha"). El scheduler
            # de "no cubierto" (ADR-0015) lo va a resolver a NO_CUBIERTO en
            # algún momento, pero hasta entonces —está en su período de
            # gracia— tampoco debería aparecer como disponible: nadie puede
            # llegar a tiempo a algo que ya empezó.
            #
            # `func.now()` en vez de comparar contra un `datetime.now()` de
            # Python a propósito: el resto del repo compara en Python
            # (`_naive`, ver `domain/repositories.py`) porque esos chequeos
            # del scheduler traen TODAS las filas sin paginar y deciden
            # después. Acá no se puede: `list_open` pagina con LIMIT/OFFSET,
            # así que el filtro tiene que ir en el WHERE para que la página
            # sea correcta. Dejar que cada motor calcule su propio "ahora"
            # evita el mismatch naive/aware entre SQLite (tests) y Postgres
            # (producción) que la comparación en Python evita de otra forma.
            ShiftModel.start_at > func.now(),
        )
        if city is not None:
            stmt = stmt.where(func.lower(ShiftModel.city) == city.lower())
        if position is not None:
            stmt = stmt.where(ShiftModel.position == position.value)
        elif positions is not None:
            stmt = stmt.where(ShiftModel.position.in_([p.value for p in positions]))
        if urgent is not None:
            stmt = stmt.where(ShiftModel.urgent.is_(urgent))
        return stmt.where(_from_active_company())

    async def list_open(
        self,
        *,
        city: str | None = None,
        position: WorkerSkill | None = None,
        positions: list[WorkerSkill] | None = None,
        urgent: bool | None = None,
        limit: int = 50,
        offset: int = 0,
        nearest_to: tuple[float, float] | None = None,
    ) -> list[Shift]:
        stmt = self._open_stmt(
            city=city, position=position, positions=positions, urgent=urgent
        )
        if nearest_to is not None:
            # Del más cercano al más lejano, en SQL y con aritmética que
            # entienden Postgres y SQLite (sin PostGIS ni funciones propias
            # de un motor): distancia en grados al cuadrado, con la longitud
            # achicada por el coseno de la latitud del origen. No es la
            # distancia exacta, pero ordena bien cerca del origen, que es
            # donde se decide qué entra en la página; quien llama la mide
            # exacta después. `IS NULL` da falso para los que tienen
            # coordenadas: van antes que los que no se pueden ubicar.
            lat, lng = nearest_to
            lng_scale = math.cos(math.radians(lat)) ** 2
            d_lat = ShiftModel.latitude - lat
            d_lng = ShiftModel.longitude - lng
            stmt = stmt.order_by(
                or_(ShiftModel.latitude.is_(None), ShiftModel.longitude.is_(None)),
                (d_lat * d_lat + d_lng * d_lng * lng_scale).asc(),
                ShiftModel.created_at.desc(),
            )
        else:
            # Urgentes primero, luego los más recientes.
            stmt = stmt.order_by(ShiftModel.urgent.desc(), ShiftModel.created_at.desc())
        result = await self._session.execute(stmt.limit(limit).offset(offset))
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_open_unpaged(
        self,
        *,
        city: str | None = None,
        position: WorkerSkill | None = None,
        positions: list[WorkerSkill] | None = None,
        urgent: bool | None = None,
        box: tuple[float, float, float, float] | None = None,
    ) -> list[Shift]:
        stmt = self._open_stmt(
            city=city, position=position, positions=positions, urgent=urgent
        )
        if box is not None:
            lat_min, lat_max, lng_min, lng_max = box
            stmt = stmt.where(
                or_(
                    ShiftModel.latitude.between(lat_min, lat_max)
                    & ShiftModel.longitude.between(lng_min, lng_max),
                    ShiftModel.latitude.is_(None),
                    ShiftModel.longitude.is_(None),
                )
            )
        # Sin LIMIT a propósito (ver el puerto). Orden estable para que el
        # resultado no dependa del motor.
        stmt = stmt.order_by(ShiftModel.created_at.desc())
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_live(self, *, limit: int = 200) -> list[Shift]:
        stmt = (
            select(ShiftModel)
            .where(
                ShiftModel.status.in_([s.value for s in UNCOVERED_ELIGIBLE_STATUSES]),
                ShiftModel.published_at.is_not(None),
            )
            .order_by(
                ShiftModel.urgent.desc(),
                # `IS NULL` da falso para los escalados: van antes.
                ShiftModel.escalated_at.is_(None),
                # Más reciente primero: con tope, lo que se corta es lo viejo
                # y no los turnos recién publicados.
                ShiftModel.published_at.desc(),
            )
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def count_live(self, *, day_start: datetime, day_end: datetime) -> ShiftLiveCounts:
        live = ShiftModel.status.in_(
            [s.value for s in UNCOVERED_ELIGIBLE_STATUSES]
        ) & ShiftModel.published_at.is_not(None)
        no_show_today = (ShiftModel.no_show_at >= day_start) & (ShiftModel.no_show_at < day_end)
        stmt = select(
            func.sum(case((live, 1), else_=0)).label("total"),
            func.sum(case((live & ShiftModel.urgent.is_(True), 1), else_=0)).label("urgent"),
            func.sum(case((live & ShiftModel.escalated_at.is_not(None), 1), else_=0)).label(
                "escalated"
            ),
            func.sum(case((no_show_today & ShiftModel.published_at.is_not(None), 1), else_=0)).label(
                "no_shows"
            ),
        )
        row = (await self._session.execute(stmt)).one()
        return ShiftLiveCounts(
            total=row.total or 0,
            urgent=row.urgent or 0,
            escalated=row.escalated or 0,
            no_shows=row.no_shows or 0,
        )

    async def list_no_shows(
        self, *, day_start: datetime, day_end: datetime, limit: int = 200
    ) -> list[Shift]:
        stmt = (
            select(ShiftModel)
            .where(ShiftModel.no_show_at >= day_start, ShiftModel.no_show_at < day_end)
            .order_by(ShiftModel.no_show_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def count_today(self, *, day_start: datetime, day_end: datetime) -> ShiftTodayCounts:
        # "De hoy" = el turno EMPIEZA en el día argentino [day_start, day_end):
        # un urgente de ayer o de mañana no es de la portada de hoy. Un turno
        # que cruza la medianoche cuenta en el día en que empieza.
        urgent_open = (
            ShiftModel.status.in_([s.value for s in OPEN_STATUSES])
            & ShiftModel.urgent.is_(True)
            & ShiftModel.published_at.is_not(None)
            & (ShiftModel.start_at >= day_start)
            & (ShiftModel.start_at < day_end)
        )
        no_show_today = (ShiftModel.no_show_at >= day_start) & (ShiftModel.no_show_at < day_end)
        stmt = select(
            func.sum(case((urgent_open, 1), else_=0)).label("urgent_uncovered"),
            func.sum(case((no_show_today, 1), else_=0)).label("no_shows_today"),
        )
        row = (await self._session.execute(stmt)).one()
        return ShiftTodayCounts(
            urgent_uncovered=row.urgent_uncovered or 0,
            no_shows_today=row.no_shows_today or 0,
        )

    async def count_period_stats(
        self,
        *,
        previous_start: datetime,
        current_start: datetime,
        end: datetime,
        exclude_company_emails: frozenset[str] = frozenset(),
    ) -> tuple[ShiftPeriodStats, ShiftPeriodStats]:
        published = ShiftModel.published_at
        confirmed = ShiftModel.first_confirmed_at
        dialect = self._session.get_bind().dialect.name
        minutes = _minutes_between(dialect, published, confirmed)
        notice_minutes = _minutes_between(dialect, published, ShiftModel.start_at)
        windows = {
            "cur": (published >= current_start) & (published < end),
            "prev": (published >= previous_start) & (published < current_start),
        }
        columns = []
        for key, in_window in windows.items():
            covered = in_window & confirmed.is_not(None)
            short_notice = covered & (notice_minutes <= SHORT_NOTICE_MINUTES)
            columns += [
                func.sum(case((in_window, 1), else_=0)).label(f"{key}_published"),
                func.sum(case((covered, 1), else_=0)).label(f"{key}_covered"),
                func.sum(case((covered & (minutes <= 10), 1), else_=0)).label(f"{key}_fast"),
                # AVG ignora los NULL: sólo promedia los cubiertos del período.
                func.avg(case((covered, minutes), else_=None)).label(f"{key}_avg"),
                func.sum(case((short_notice, 1), else_=0)).label(f"{key}_short"),
                func.sum(case((short_notice & (minutes <= 10), 1), else_=0)).label(
                    f"{key}_short_fast"
                ),
                func.sum(
                    case((covered & ShiftModel.check_in_at.is_not(None), 1), else_=0)
                ).label(f"{key}_fulfilled"),
                # COUNT(DISTINCT ...) ignora los NULL: cuenta comercios, no turnos.
                func.count(func.distinct(case((in_window, ShiftModel.company_id), else_=None))).label(
                    f"{key}_companies"
                ),
                func.count(func.distinct(case((covered, ShiftModel.company_id), else_=None))).label(
                    f"{key}_companies_covered"
                ),
            ]
        excluded = _not_from_companies_of(exclude_company_emails)
        stmt = select(*columns).where(published >= previous_start, published < end, excluded)
        row = (await self._session.execute(stmt)).one()

        # La mediana no se puede sacar con SUM/CASE (en Postgres sería
        # `percentile_cont`, que SQLite no tiene): se traen sólo los minutos de
        # los cubiertos de las dos ventanas y se calcula en Python. Con el
        # volumen de la beta (cientos de turnos por período) alcanza; si
        # creciera a decenas de miles, pasar a `percentile_cont` en Postgres.
        in_current = case((windows["cur"], 1), else_=0)
        median_rows = (
            await self._session.execute(
                select(in_current, minutes).where(
                    published >= previous_start,
                    published < end,
                    confirmed.is_not(None),
                    excluded,
                )
            )
        ).all()
        sample = {"cur": [], "prev": []}
        for is_current, mins in median_rows:
            sample["cur" if is_current else "prev"].append(float(mins))

        def _stats(key: str) -> ShiftPeriodStats:
            avg = getattr(row, f"{key}_avg")
            mins = sample[key]
            return ShiftPeriodStats(
                published=getattr(row, f"{key}_published") or 0,
                covered=getattr(row, f"{key}_covered") or 0,
                covered_under_10_min=getattr(row, f"{key}_fast") or 0,
                avg_minutes_to_cover=float(avg) if avg is not None else None,
                median_minutes_to_cover=median(mins) if mins else None,
                short_notice_covered=getattr(row, f"{key}_short") or 0,
                short_notice_under_10_min=getattr(row, f"{key}_short_fast") or 0,
                fulfilled=getattr(row, f"{key}_fulfilled") or 0,
                active_companies=getattr(row, f"{key}_companies") or 0,
                companies_with_covered=getattr(row, f"{key}_companies_covered") or 0,
            )

        return _stats("cur"), _stats("prev")

    async def count_return_stats(
        self,
        *,
        exclude_company_emails: frozenset[str] = frozenset(),
        window_days: int = 30,
        now: datetime | None = None,
    ) -> ShiftReturnStats:
        # Una fila por turno publicado (comercio, publicado, primera
        # confirmación) y el cálculo en Python: «publicó otro después de que
        # le funcionó» es una comparación entre filas del mismo comercio que
        # en SQL pide una autounión por ventana. Para el volumen de la beta
        # (miles de turnos) alcanza; si creciera, pasar a una consulta con
        # `MIN(first_confirmed_at)` por comercio y un EXISTS.
        stmt = select(
            ShiftModel.company_id, ShiftModel.published_at, ShiftModel.first_confirmed_at
        ).where(
            ShiftModel.published_at.is_not(None),
            _not_from_companies_of(exclude_company_emails),
        )
        rows = (await self._session.execute(stmt)).all()

        first_covered: dict[UUID, datetime] = {}
        publications: dict[UUID, list[datetime]] = {}
        for company_id, published_at, confirmed_at in rows:
            publications.setdefault(company_id, []).append(_utc_naive(published_at))
            if confirmed_at is not None:
                confirmed = _utc_naive(confirmed_at)
                if company_id not in first_covered or confirmed < first_covered[company_id]:
                    first_covered[company_id] = confirmed

        horizon = timedelta(days=window_days)
        # Sólo la cohorte madura: un comercio cuya primera confirmación fue
        # hace menos de `window_days` todavía no tuvo la ventana entera para
        # volver, y contarlo como «no volvió» bajaría el % por lo nuevo de la
        # muestra, no por falta de vuelta.
        cutoff = _utc_naive(now or datetime.now(timezone.utc)) - horizon
        mature = {cid: t0 for cid, t0 in first_covered.items() if t0 <= cutoff}
        returned = sum(
            1
            for company_id, t0 in mature.items()
            if any(t0 < p <= t0 + horizon for p in publications[company_id])
        )
        return ShiftReturnStats(sample_size=len(mature), returned=returned)
