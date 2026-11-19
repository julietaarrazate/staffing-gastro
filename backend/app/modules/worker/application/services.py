"""Casos de uso del módulo worker (perfil del trabajador)."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from app.core.tz import now_art
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.worker.application.dtos import WorkerProfileData
from app.modules.worker.domain.entities import WorkerProfile
from app.modules.worker.domain.exceptions import (
    CvFileNotAcceptedError,
    CvFileReleasedError,
    CvNotFoundError,
    WorkerProfileAlreadyExistsError,
    WorkerProfileNotFoundError,
)
from app.modules.worker.domain.repositories import (
    CvFileDeletionQueue,
    CvFileStorage,
    WorkerProfileRepository,
)
from app.modules.worker.domain.value_objects import CV_PROTECTED_DELIVERY, CvFile

# Un turno "ganado" es uno ya trabajado, cuente o no todavía como "cobrado"
# en el sistema — mismo criterio que `shifts_together` en
# `favorite/infrastructure/repositories.py`, que junta FINALIZADO/PAGADO
# como "turno completado" sin distinguir si ya se marcó el pago.
_EARNED_STATUSES = frozenset({ShiftStatus.FINALIZADO, ShiftStatus.PAGADO})

# Cuánto dura el link de un CV (ADR-0021, actualización 2026-11-19): alcanza
# para abrirlo o bajarlo; si se filtra, vence enseguida.
CV_LINK_TTL = timedelta(minutes=5)


@dataclass(frozen=True)
class CvLink:
    """Link para ver el CV. `expires_at` en `None` sólo para un link pegado a
    mano o un CV viejo todavía público (hasta correr el script)."""

    url: str
    expires_at: datetime | None


@dataclass(frozen=True)
class WorkerEarningsSummary:
    """Resumen de ganancias para el perfil del trabajador (pedido de
    Julieta: "un resumen de ganancias acumuladas ... por mes"). `total_earned`
    suma TODOS los turnos ya trabajados; `this_month_earned`, sólo los que
    ocurrieron en el mes calendario actual (hora de Argentina)."""

    total_earned: Decimal
    this_month_earned: Decimal
    shifts_completed: int


class WorkerProfileService:
    """Servicio de aplicación para gestionar el perfil del trabajador."""

    def __init__(
        self,
        profiles: WorkerProfileRepository,
        shifts: ShiftRepository,
        cv_files: CvFileStorage | None = None,
        cv_deletions: CvFileDeletionQueue | None = None,
    ) -> None:
        """`cv_files` y `cv_deletions` son el storage del CV y su cola de
        borrado (ADR-0021, actualización 2026-11-19). Sin `cv_files` no se
        acepta un CV subido nuevo ni se arman links; sin `cv_deletions` el
        archivo que se deja de usar no se borra (scripts de seed)."""
        self._profiles = profiles
        self._shifts = shifts
        self._cv_files = cv_files
        self._cv_deletions = cv_deletions

    async def create_profile(
        self, user_id: UUID, data: WorkerProfileData
    ) -> WorkerProfile:
        """Crea el perfil del trabajador. Falla si el usuario ya tiene uno."""
        if await self._profiles.exists_by_user_id(user_id):
            raise WorkerProfileAlreadyExistsError(str(user_id))

        profile = WorkerProfile(user_id=user_id)
        _apply(profile, data)
        await self._set_cv(profile, data)
        return await self._profiles.add(profile)

    async def update_profile(
        self, user_id: UUID, data: WorkerProfileData
    ) -> WorkerProfile:
        """Actualiza el perfil del trabajador autenticado. El CV que deja de
        usar (cambiado o sacado) se manda a borrar en el mismo commit."""
        profile = await self._profiles.get_by_user_id(user_id)
        if profile is None:
            raise WorkerProfileNotFoundError(str(user_id))
        _apply(profile, data)
        released = await self._set_cv(profile, data)
        if released is not None and self._cv_deletions is not None:
            await self._cv_deletions.enqueue([released])
        return await self._profiles.update(profile)

    async def _set_cv(
        self, profile: WorkerProfile, data: WorkerProfileData
    ) -> CvFile | None:
        """Pone el CV pedido y devuelve el archivo subido que dejó de usar.

        Un CV viejo todavía público (`cv_url` de Cloudinary, de antes del
        2026-11-19) que se cambia no se borra acá: desde la URL no se puede
        saber con certeza que sea un CV (podría ser una foto pegada como
        link). Lo borra `scripts/privatize_worker_cvs.py`, que mira la
        carpeta."""
        file, url, filename = await self._resolve_cv(profile, data)
        return profile.change_cv(file, url, filename)

    async def _resolve_cv(
        self, profile: WorkerProfile, data: WorkerProfileData
    ) -> tuple[CvFile | None, str | None, str | None]:
        file, url, filename = data.cv_file, data.cv_url or None, data.cv_filename
        if file is None and url and url != profile.cv_url:
            stored = self._cv_files.file_from_url(url) if self._cv_files else None
            if stored is not None:
                # Un archivo de Cloudinary no se guarda como link pegado.
                # Protegido es lo que manda una versión vieja de la app después
                # de subir el CV: se toma como archivo. Público ya no se acepta.
                if stored.delivery_type != CV_PROTECTED_DELIVERY:
                    raise CvFileNotAcceptedError(url)
                file, url = stored, None
        if file is None and not url and data.keep_cv_file:
            file = profile.cv_file
            filename = filename or profile.cv_filename
        if file is not None and file.same_file(profile.cv_file):
            # El mismo archivo: queda la referencia guardada (el formato que
            # mande el pedido no cambia qué archivo es).
            file = profile.cv_file
        elif file is not None:
            # Uno nuevo: tiene que ser protegido y de esta cuenta. Si no, quien
            # vio el link de otro (y con él el nombre del archivo) se lo podía
            # poner en su perfil y pedir links para siempre, o hacerlo borrar.
            if (
                file.delivery_type != CV_PROTECTED_DELIVERY
                or self._cv_files is None
                or not self._cv_files.was_uploaded_by(file, profile.user_id)
            ):
                raise CvFileNotAcceptedError(file.public_id)
            # Y no uno que ya se mandó a borrar: es un formulario abierto
            # desde antes de que la persona lo cambiara o lo sacara. Ponerlo
            # dejaría el perfil apuntando a un archivo borrado (y mandaría a
            # borrar el CV que está).
            if self._cv_deletions is not None and await self._cv_deletions.was_released(file):
                raise CvFileReleasedError(file.public_id)
        return file, url, filename

    def cv_link(
        self, profile: WorkerProfile, download: bool = False, now: datetime | None = None
    ) -> CvLink:
        """Link para ver el CV del perfil. Quién lo puede pedir lo decide la
        ruta (la misma regla que el resto de los datos de contacto).

        Archivo subido → link firmado que vence en `CV_LINK_TTL`. Link pegado
        a mano, o CV viejo todavía público → la URL tal cual (la primera la
        controla la persona; la segunda deja de existir al correr el
        script). Sin CV → `CvNotFoundError`."""
        if profile.cv_file is not None:
            if self._cv_files is None:
                raise RuntimeError("WorkerProfileService sin CvFileStorage")
            expires_at = (now or datetime.now(UTC)) + CV_LINK_TTL
            return CvLink(
                url=self._cv_files.link_for(profile.cv_file, expires_at, download),
                expires_at=expires_at,
            )
        if profile.cv_url:
            return CvLink(url=profile.cv_url, expires_at=None)
        raise CvNotFoundError(str(profile.id))

    async def get_my_profile(self, user_id: UUID) -> WorkerProfile:
        profile = await self._profiles.get_by_user_id(user_id)
        if profile is None:
            raise WorkerProfileNotFoundError(str(user_id))
        return profile

    async def get_profile(self, profile_id: UUID) -> WorkerProfile:
        profile = await self._profiles.get_by_id(profile_id)
        if profile is None:
            raise WorkerProfileNotFoundError(str(profile_id))
        return profile

    async def go_available_now(
        self, user_id: UUID, latitude: float, longitude: float
    ) -> WorkerProfile:
        """Prende "Disponible ahora" (ADR-0014): ver `WorkerProfile.go_available_now`."""
        profile = await self._profiles.get_by_user_id(user_id)
        if profile is None:
            raise WorkerProfileNotFoundError(str(user_id))
        profile.go_available_now(latitude, longitude)
        return await self._profiles.update(profile)

    async def stop_available_now(self, user_id: UUID) -> None:
        """Apaga "Disponible ahora" a mano. Idempotente: no falla si ya
        estaba apagado, ni si el perfil no existe (usado también best-effort
        desde `logout`, donde cualquier usuario puede no ser trabajador)."""
        profile = await self._profiles.get_by_user_id(user_id)
        if profile is None:
            return
        profile.stop_available_now()
        await self._profiles.update(profile)

    async def get_my_earnings_summary(self, user_id: UUID) -> WorkerEarningsSummary:
        profile = await self._profiles.get_by_user_id(user_id)
        if profile is None:
            raise WorkerProfileNotFoundError(str(user_id))

        # Mes calendario actual en hora argentina: [día 1 00:00, día 1 del mes
        # siguiente 00:00). La suma corre en la base, sin tope de filas.
        today = now_art()
        month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month_start = (
            month_start.replace(year=month_start.year + 1, month=1)
            if month_start.month == 12
            else month_start.replace(month=month_start.month + 1)
        )
        totals = await self._shifts.sum_worker_earnings(
            profile.id,
            _EARNED_STATUSES,
            window_start=month_start,
            window_end=next_month_start,
        )
        return WorkerEarningsSummary(
            total_earned=totals.total,
            this_month_earned=totals.in_window,
            shifts_completed=totals.count,
        )


def _apply(profile: WorkerProfile, data: WorkerProfileData) -> None:
    """Vuelca los datos editables sobre la entidad (sin tocar métricas). El
    CV va aparte (`WorkerProfileService._set_cv`)."""
    profile.photo_url = data.photo_url
    profile.birth_date = data.birth_date
    profile.city = data.city
    profile.bio = data.bio
    profile.latitude = data.latitude
    profile.longitude = data.longitude
    profile.skills = data.skills
    profile.years_experience = data.years_experience
    profile.languages = data.languages
    profile.certifications = data.certifications
    profile.is_available = data.is_available
