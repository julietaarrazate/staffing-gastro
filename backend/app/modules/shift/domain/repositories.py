"""Puerto del repositorio de turnos."""

from abc import ABC, abstractmethod
from collections.abc import Sequence
from uuid import UUID

from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.worker.domain.value_objects import WorkerSkill


class ShiftRepository(ABC):
    """Puerto de persistencia para Turno."""

    @abstractmethod
    async def add(self, shift: Shift) -> Shift:
        """Persiste un nuevo turno y lo devuelve."""

    @abstractmethod
    async def update(self, shift: Shift) -> Shift:
        """Actualiza un turno existente y lo devuelve."""

    @abstractmethod
    async def get_by_id(self, shift_id: UUID) -> Shift | None:
        """Busca un turno por su id."""

    @abstractmethod
    async def list_by_ids(self, shift_ids: Sequence[UUID]) -> list[Shift]:
        """Trae varios turnos por id en UNA query (`WHERE id IN (...)`).

        Evita el N+1 de red al resolver el detalle de una lista de
        postulaciones: en vez de un GET /shifts/{id} por postulación (cada uno
        pagando el round-trip a la base remota), el cliente pide las
        postulaciones ya con su turno embebido (ver `/applications/mine` y
        `docs/audits/PERFORMANCE_REPORT.md`)."""

    @abstractmethod
    async def list_by_company(
        self, company_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Shift]:
        """Lista los turnos publicados por un comercio (más recientes primero, paginado)."""

    @abstractmethod
    async def list_open(
        self,
        *,
        city: str | None = None,
        position: WorkerSkill | None = None,
        positions: list[WorkerSkill] | None = None,
        urgent: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Shift]:
        """Lista los turnos abiertos del feed público, con filtros opcionales (paginado).

        `position` filtra por un rubro puntual (override explícito, por
        ejemplo un filtro manual en la UI); `positions` filtra por varios a
        la vez (los rubros que eligió el trabajador en su perfil, para que
        el feed sólo le muestre lo que le sirve — ver `ShiftService.list_feed`).
        """

    @abstractmethod
    async def list_by_worker(
        self, worker_profile_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Shift]:
        """Lista los turnos asignados a un trabajador (más recientes primero, paginado)."""

    @abstractmethod
    async def list_by_worker_and_statuses(
        self, worker_profile_id: UUID, statuses: frozenset[ShiftStatus]
    ) -> list[Shift]:
        """Turnos de un trabajador en alguno de los estados dados, sin paginar.

        Uso interno (no expuesto por API): detectar solapamiento de horarios
        al confirmar un turno (regla de doble turno, `COMMITTED_STATUSES`)."""

    @abstractmethod
    async def list_awaiting_checkin(self) -> list[Shift]:
        """Turnos CONFIRMADO/EN_CAMINO (todavía sin check-in), sin paginar.

        Uso interno (no expuesto por API): el scheduler de asistencia
        (ADR-0008) los recorre para decidir —comparando `start_at` en
        Python, mismo criterio que `_naive` en `ShiftService` para no
        pelearse con el tz-naive de SQLite en tests— si mandar el
        recordatorio de check-in o marcar no-show automático."""

    @abstractmethod
    async def list_recently_filled(self, *, limit: int = 500) -> list[Shift]:
        """Turnos con `published_at` Y `first_assigned_at` seteados (los que
        aportan dato a la métrica de tiempo de cobertura), más recientes
        primero, acotado a `limit`.

        Uso interno (no expuesto por API): `AdminService.get_stats` calcula
        el promedio y el % cubierto en <10 min sobre esta muestra."""

    @abstractmethod
    async def list_open_awaiting_escalation(self) -> list[Shift]:
        """Turnos abiertos (`OPEN_STATUSES`) con `published_at` seteado y
        todavía sin escalar (`escalated_at` es `None`), sin paginar.

        Uso interno (no expuesto por API): el scheduler los recorre para
        decidir —comparando `published_at` en Python, mismo criterio que el
        resto de los chequeos del scheduler— si ya toca escalar la urgencia
        (`ShiftService.escalate_urgency`)."""
