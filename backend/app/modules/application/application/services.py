"""Casos de uso del módulo application (postulación del trabajador a un turno)."""

from uuid import UUID

from app.modules.application.domain.entities import EnrichedApplicant, ShiftApplication
from app.modules.application.domain.exceptions import (
    AlreadyAppliedError,
    ApplicationNotFoundError,
    ShiftNotApplicableError,
)
from app.modules.application.domain.repositories import ShiftApplicationRepository
from app.modules.company.domain.repositories import CompanyProfileRepository
from app.modules.identity.domain.repositories import UserRepository
from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.repositories import NotificationRepository
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.shift.domain.value_objects import OPEN_STATUSES
from app.modules.worker.domain.repositories import WorkerProfileRepository


class ApplicationService:
    """Gestiona las postulaciones de trabajadores a turnos abiertos.

    Es el lado "trabajador" del match: el trabajador se postula a un turno del
    feed (swipe derecha) y el comercio ve a sus postulantes y puede asignarles
    el turno con el flujo de asignación existente.
    """

    def __init__(
        self,
        applications: ShiftApplicationRepository,
        shifts: ShiftRepository,
        companies: CompanyProfileRepository,
        notifications: NotificationRepository,
        workers: WorkerProfileRepository,
        users: UserRepository,
    ) -> None:
        self._applications = applications
        self._shifts = shifts
        self._companies = companies
        self._notifications = notifications
        self._workers = workers
        self._users = users

    async def apply(
        self, worker_profile_id: UUID, shift_id: UUID
    ) -> ShiftApplication:
        """Registra el interés de un trabajador por un turno abierto."""
        shift = await self._shifts.get_by_id(shift_id)
        if shift is None or shift.status not in OPEN_STATUSES:
            raise ShiftNotApplicableError(str(shift_id))

        existing = await self._applications.get_by_shift_and_worker(
            shift_id, worker_profile_id
        )
        if existing is not None:
            raise AlreadyAppliedError(str(shift_id))

        application = await self._applications.add(
            ShiftApplication(shift_id=shift_id, worker_profile_id=worker_profile_id)
        )

        company = await self._companies.get_by_id(shift.company_id)
        if company is not None:
            await self._notify_new_applicant(company.user_id, shift, worker_profile_id)
        return application

    async def _notify_new_applicant(
        self, company_user_id: UUID, shift: Shift, worker_profile_id: UUID
    ) -> None:
        """Avisa al comercio con el mismo tipo de copy que hace efectivo un
        aviso de 'llegaron presupuestos' en apps de oficios: nombre de quien
        se postuló + cuántos postulantes hay en total + a qué turno, no un
        genérico 'un trabajador se postuló'."""
        position_label = shift.title or shift.position.value
        total = len(await self._applications.list_by_shift(shift.id))
        worker_name = await self._worker_full_name(worker_profile_id)
        title = f"{total} postulante{'s' if total != 1 else ''} para {position_label}"
        message = (
            f"{worker_name} se postuló a tu turno de {position_label}. "
            "Entrá para ver a todos los postulantes y elegir."
        )
        await self._notifications.add(
            Notification(
                user_id=company_user_id,
                type=NotificationType.NEW_APPLICANT,
                title=title,
                message=message,
                # Abre los postulantes de ESE turno (donde están las tarjetas
                # de cada candidato y el link a su perfil), no el panel general.
                link=f"/shifts/{shift.id}/candidates",
            )
        )

    async def _worker_full_name(self, worker_profile_id: UUID) -> str:
        worker = await self._workers.get_by_id(worker_profile_id)
        if worker is None:
            return "Un trabajador"
        user = await self._users.get_by_id(worker.user_id)
        return user.full_name if user is not None else "Un trabajador"

    async def list_applicants(
        self, company_id: UUID, shift_id: UUID
    ) -> list[EnrichedApplicant]:
        """Lista los postulantes a un turno propio del comercio, ya enriquecidos
        con los datos del trabajador (sin N+1, ver P2 en PERFORMANCE_REPORT.md)."""
        shift = await self._shifts.get_by_id(shift_id)
        # No-disclosure: turno ajeno o inexistente se trata igual (404).
        if shift is None or shift.company_id != company_id:
            raise ShiftNotApplicableError(str(shift_id))
        return await self._applications.list_by_shift_enriched(shift_id)

    async def list_my_applications(
        self, worker_profile_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[tuple[ShiftApplication, Shift | None]]:
        """Lista las postulaciones del trabajador, cada una con su turno embebido.

        El turno se resuelve con UN solo `list_by_ids` (`WHERE id IN (...)`),
        no con un GET por postulación: antes la pantalla de Matches disparaba N
        requests HTTP (una por postulación), cada una pagando el round-trip a la
        base remota. Ahora es 1 request + 1 query batch (ver
        `docs/PERFORMANCE_REPORT.md`)."""
        applications = await self._applications.list_by_worker(
            worker_profile_id, limit=limit, offset=offset
        )
        shift_ids = list({a.shift_id for a in applications})
        shifts_by_id = {s.id: s for s in await self._shifts.list_by_ids(shift_ids)}
        return [(a, shifts_by_id.get(a.shift_id)) for a in applications]

    async def withdraw(
        self, worker_profile_id: UUID, application_id: UUID
    ) -> ShiftApplication:
        """El trabajador retira su propia postulación PENDIENTE."""
        application = await self._applications.get_by_id(application_id)
        # No-disclosure: postulación ajena o inexistente se trata igual (404).
        if application is None or application.worker_profile_id != worker_profile_id:
            raise ApplicationNotFoundError(str(application_id))
        application.withdraw()
        return await self._applications.update(application)
