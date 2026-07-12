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
from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.repositories import NotificationRepository
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.shift.domain.value_objects import OPEN_STATUSES


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
    ) -> None:
        self._applications = applications
        self._shifts = shifts
        self._companies = companies
        self._notifications = notifications

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
            await self._notifications.add(
                Notification(
                    user_id=company.user_id,
                    type=NotificationType.NEW_APPLICANT,
                    title="Nuevo postulante",
                    message="Un trabajador se postuló a uno de tus turnos.",
                )
            )
        return application

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
    ) -> list[ShiftApplication]:
        """Lista las postulaciones del trabajador (para su pantalla de Matches)."""
        return await self._applications.list_by_worker(
            worker_profile_id, limit=limit, offset=offset
        )

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
