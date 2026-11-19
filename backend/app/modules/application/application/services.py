"""Casos de uso del módulo application (postulación del trabajador a un turno)."""

import logging
from datetime import datetime, timezone
from uuid import UUID

from app.modules.application.domain.entities import EnrichedApplicant, ShiftApplication
from app.modules.application.domain.exceptions import (
    AlreadyAppliedError,
    AlreadyUnassignedError,
    ApplicationNotFoundError,
    ShiftNotApplicableError,
)
from app.modules.application.domain.repositories import ShiftApplicationRepository
from app.modules.application.domain.value_objects import ApplicationStatus
from app.modules.company.domain.repositories import CompanyProfileRepository
from app.modules.identity.domain.repositories import UserRepository
from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.repositories import NotificationRepository
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.shift.domain.value_objects import OPEN_STATUSES
from app.modules.worker.domain.repositories import WorkerProfileRepository

logger = logging.getLogger(__name__)


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
        """Registra el interés de un trabajador por un turno abierto.

        Hay una sola postulación por (turno, trabajador). Si la que existe está
        RETIRADA (la canceló el trabajador, o el sistema por la regla de doble
        turno), postularse de nuevo la reactiva: vuelve a PENDIENTE con fecha
        nueva y el comercio recibe el aviso como con una postulación nueva. Es
        lo que promete la app al cancelar ("si sigue abierto, podés volver a
        postularte"). Cualquier otro estado es `AlreadyAppliedError`; si tuvo
        el turno asignado y lo dejó (DESASIGNADA), `AlreadyUnassignedError`:
        ya está en la lista del comercio, al final, y es el comercio quien
        decide si lo vuelve a elegir."""
        shift = await self._shifts.get_by_id(shift_id)
        if shift is None or shift.status not in OPEN_STATUSES:
            raise ShiftNotApplicableError(str(shift_id))
        if shift.is_reoffered and not shift.is_open_for_applications(
            datetime.now(timezone.utc)
        ):
            # Turno reofrecido (U080): se ofrece mientras le queden al menos 2
            # horas de horario (`Shift.offered_until`). Desde ahí, y hasta la
            # pasada que lo cierra como «no cubierto», ya no acepta
            # postulaciones.
            raise ShiftNotApplicableError(str(shift_id))
        company = await self._companies.get_by_id(shift.company_id)
        if not await self._account_active(company.user_id if company else None):
            # Comercio suspendido (ADR-0024): su turno está oculto y no acepta
            # postulaciones. Mismo error que un turno que no está abierto.
            raise ShiftNotApplicableError(str(shift_id))

        existing = await self._applications.get_by_shift_and_worker(
            shift_id, worker_profile_id
        )
        if existing is None:
            application = await self._applications.add(
                ShiftApplication(shift_id=shift_id, worker_profile_id=worker_profile_id)
            )
        elif existing.status == ApplicationStatus.RETIRADA:
            existing.reapply()
            application = await self._applications.update(existing)
        elif existing.status == ApplicationStatus.DESASIGNADA:
            raise AlreadyUnassignedError(str(shift_id))
        else:
            raise AlreadyAppliedError(str(shift_id))
        # El turno pudo asignarse o cancelarse entre la lectura de arriba y esta
        # escritura (CON-04): `_reject_pending_applicants` ya recorrió la lista
        # sin ver esta fila, y quedaría «pendiente» para siempre.
        application = await self._undo_if_shift_closed(application, shift_id)
        logger.info(
            "application.submitted",
            extra={
                "shift_id": str(shift_id),
                "worker_profile_id": str(worker_profile_id),
                # True cuando no es la primera vez: reactivó una retirada.
                "reapplied": existing is not None,
            },
        )

        # Ya tiene el turno (lo asignaron en el medio): no es un postulante
        # nuevo para el comercio.
        if company is not None and application.status == ApplicationStatus.PENDIENTE:
            await self._notify_new_applicant(company.user_id, shift, worker_profile_id)
        return application

    async def _undo_if_shift_closed(
        self, application: ShiftApplication, shift_id: UUID
    ) -> ShiftApplication:
        """Relee el turno ya con la postulación guardada; si dejó de estar
        abierto, la deshace y responde como ante un turno cerrado.

        Es correcto sin bloquear porque quien cierra el turno primero guarda el
        estado y recién después recorre las postulaciones pendientes: o esa
        pasada ve esta fila (y la rechaza), o esta relectura ve el turno
        cerrado. Se deshace con `withdraw`: queda RETIRADA, como si nunca se
        hubiera postulado (el comercio la tolera, ADR-0026 punto 5). Si en el
        medio el comercio ya la asignó, no es pendiente: se devuelve tal cual.

        Y si el turno se cerró porque el comercio le asignó el turno a ESTA
        persona (desde «Recomendados», antes de que existiera la fila), la
        postulación queda aceptada, no retirada: tiene el turno (revisión
        independiente del 2026-11-19)."""
        current = await self._shifts.get_by_id(shift_id)
        if current is not None and current.status in OPEN_STATUSES:
            return application
        latest = await self._applications.get_by_id(application.id)
        if latest is None or latest.status != ApplicationStatus.PENDIENTE:
            return latest or application
        if current is not None and current.worker_profile_id == latest.worker_profile_id:
            latest.accept()
            await self._applications.update(latest)
            return latest
        latest.withdraw()
        await self._applications.update(latest)
        raise ShiftNotApplicableError(str(shift_id))

    async def _account_active(self, user_id: UUID | None) -> bool:
        if user_id is None:
            return False
        user = await self._users.get_by_id(user_id)
        return user is not None and user.is_active

    async def _notify_new_applicant(
        self, company_user_id: UUID, shift: Shift, worker_profile_id: UUID
    ) -> None:
        """Avisa al comercio con el mismo tipo de copy que hace efectivo un
        aviso de 'llegaron presupuestos' en apps de oficios: nombre de quien
        se postuló + cuántos postulantes hay en total + a qué turno, no un
        genérico 'un trabajador se postuló'."""
        position_label = shift.title or shift.position.label
        # Los que están en carrera, igual que el contador del panel: sin las
        # retiradas ni quien tuvo el turno y lo dejó (G4).
        pending = await self._applications.count_pending_by_shift_ids([shift.id])
        total = max(pending.get(shift.id, 0), 1)
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
        con los datos del trabajador (sin N+1, ver P2 en PERFORMANCE_REPORT.md).

        Sin las cuentas suspendidas (ADR-0024): no se las puede asignar, el
        mismo criterio que «Recomendados» (lo filtra la consulta)."""
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
        `docs/audits/PERFORMANCE_REPORT.md`)."""
        applications = await self._applications.list_by_worker(
            worker_profile_id, limit=limit, offset=offset
        )
        shift_ids = list({a.shift_id for a in applications})
        shifts = await self._shifts.list_by_ids(shift_ids)
        # Los turnos de un comercio suspendido dejan de verse (ADR-0024): la
        # postulación se devuelve sin turno, como si ya no existiera, salvo el
        # que tiene asignado esta misma persona (puede estar trabajándolo).
        inactive = await self._shifts.companies_with_inactive_account(
            list({s.company_id for s in shifts})
        )
        shifts_by_id = {
            s.id: s
            for s in shifts
            if s.company_id not in inactive or s.worker_profile_id == worker_profile_id
        }
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
        updated = await self._applications.update(application)
        logger.info(
            "application.withdrawn",
            extra={
                "shift_id": str(application.shift_id),
                "worker_profile_id": str(worker_profile_id),
            },
        )
        await self._refresh_company_screen(application.shift_id)
        return updated

    async def _refresh_company_screen(self, shift_id: UUID) -> None:
        """Le pide al comercio que tiene abierta la lista de candidatos que la
        recargue (VIE-01): sin esto seguía mostrando a quien ya retiró su
        postulación y podía asignarle el turno. Sin aviso visible ni push, y
        sin romper el retiro si falla."""
        try:
            shift = await self._shifts.get_by_id(shift_id)
            company = (
                await self._companies.get_by_id(shift.company_id) if shift else None
            )
            if company is not None:
                await self._notifications.request_live_refresh(company.user_id)
        except Exception:
            logger.exception(
                "Refresco del comercio tras retirar: fallo inesperado, no se "
                "propaga (shift_id=%s)",
                shift_id,
            )
