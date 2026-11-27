"""Rutas HTTP del módulo worker (perfil del trabajador)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.cloudinary import CloudinaryNotConfiguredError
from app.core.config import settings
from app.modules.identity.api.dependencies import get_current_user, require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.repositories import UserRepository
from app.modules.identity.domain.value_objects import UserRole
from app.modules.verification.api.dependencies import get_verification_service
from app.modules.verification.application.services import VerificationService
from app.modules.worker.api.dependencies import (
    EmployerWorkerRelation,
    get_employer_worker_relation,
    get_user_repository,
    get_worker_service,
)
from app.modules.worker.api.schemas import (
    AvailableNowInput,
    AvailableNowResponse,
    CvLinkResponse,
    WorkerEarningsResponse,
    WorkerProfileInput,
    WorkerProfileResponse,
)
from app.modules.worker.application.dtos import WorkerProfileData
from app.modules.worker.application.services import WorkerProfileService
from app.modules.worker.domain.entities import WorkerProfile
from app.modules.worker.domain.exceptions import (
    CvFileNotAcceptedError,
    CvFileReleasedError,
    CvNotFoundError,
    WorkerProfileAlreadyExistsError,
    WorkerProfileNotFoundError,
)

router = APIRouter(prefix="/workers", tags=["workers"])

ServiceDep = Annotated[WorkerProfileService, Depends(get_worker_service)]
UsersDep = Annotated[UserRepository, Depends(get_user_repository)]
VerificationDep = Annotated[VerificationService, Depends(get_verification_service)]
RelationDep = Annotated[EmployerWorkerRelation, Depends(get_employer_worker_relation)]
WorkerDep = Annotated[User, Depends(require_roles(UserRole.WORKER))]


def _to_data(payload: WorkerProfileInput) -> WorkerProfileData:
    sent = payload.model_fields_set
    return WorkerProfileData(
        **payload.model_dump(exclude={"cv_file"}),
        cv_file=payload.cv_file.to_domain() if payload.cv_file else None,
        # Una versión vieja de la app manda `cv_url` y no conoce `cv_file`.
        keep_cv_file="cv_url" in sent and "cv_file" not in sent,
    )


_CV_NOT_ACCEPTED = HTTPException(
    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
    detail="No pudimos guardar ese CV. Subilo de nuevo.",
)
_CV_RELEASED = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail=(
        "Ese CV ya lo cambiaste o lo sacaste desde otro lado. "
        "Volvé a abrir tu perfil para ver el que quedó."
    ),
)


async def _to_response(
    profile: WorkerProfile, users: UserRepository, verification: VerificationService
) -> WorkerProfileResponse:
    user = await users.get_by_id(profile.user_id)
    response = WorkerProfileResponse.model_validate(profile)
    response.full_name = user.full_name if user else None
    verified = await verification.verified_user_ids([profile.user_id])
    response.identidad_verificada = profile.user_id in verified
    response.verificacion_requerida = settings.verificacion_obligatoria
    response.cv_kind = "file" if profile.cv_file else "link" if profile.cv_url else None
    return response


@router.post(
    "/me/profile",
    response_model=WorkerProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear mi perfil de trabajador",
)
async def create_my_profile(
    payload: WorkerProfileInput, current_user: WorkerDep, service: ServiceDep, users: UsersDep, verification: VerificationDep
):
    try:
        profile = await service.create_profile(current_user.id, _to_data(payload))
    except WorkerProfileAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El perfil de trabajador ya existe",
        ) from exc
    except CvFileNotAcceptedError as exc:
        raise _CV_NOT_ACCEPTED from exc
    except CvFileReleasedError as exc:
        raise _CV_RELEASED from exc
    return await _to_response(profile, users, verification)


@router.get(
    "/me/profile",
    response_model=WorkerProfileResponse,
    summary="Ver mi perfil de trabajador",
)
async def get_my_profile(
    current_user: WorkerDep,
    service: ServiceDep,
    users: UsersDep,
    verification: VerificationDep,
):
    try:
        profile = await service.get_my_profile(current_user.id)
    except WorkerProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Todavía no creaste tu perfil de trabajador",
        ) from exc
    return await _to_response(profile, users, verification)


@router.put(
    "/me/profile",
    response_model=WorkerProfileResponse,
    summary="Actualizar mi perfil de trabajador",
)
async def update_my_profile(
    payload: WorkerProfileInput, current_user: WorkerDep, service: ServiceDep, users: UsersDep, verification: VerificationDep
):
    try:
        profile = await service.update_profile(current_user.id, _to_data(payload))
    except WorkerProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Todavía no creaste tu perfil de trabajador",
        ) from exc
    except CvFileNotAcceptedError as exc:
        raise _CV_NOT_ACCEPTED from exc
    except CvFileReleasedError as exc:
        raise _CV_RELEASED from exc
    return await _to_response(profile, users, verification)


@router.get(
    "/me/earnings",
    response_model=WorkerEarningsResponse,
    summary="Resumen de ganancias del trabajador autenticado",
)
async def get_my_earnings(current_user: WorkerDep, service: ServiceDep):
    try:
        summary = await service.get_my_earnings_summary(current_user.id)
    except WorkerProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Todavía no creaste tu perfil de trabajador",
        ) from exc
    return WorkerEarningsResponse(
        total_earned=summary.total_earned,
        this_month_earned=summary.this_month_earned,
        shifts_completed=summary.shifts_completed,
    )


def _available_now_response(profile: WorkerProfile) -> AvailableNowResponse:
    return AvailableNowResponse(
        active=profile.is_available_now,
        until=profile.available_now_until if profile.is_available_now else None,
    )


@router.post(
    "/me/available-now",
    response_model=AvailableNowResponse,
    summary='Prender "Disponible ahora" (ADR-0014)',
)
async def go_available_now(
    payload: AvailableNowInput, current_user: WorkerDep, service: ServiceDep
):
    try:
        profile = await service.go_available_now(
            current_user.id, payload.latitude, payload.longitude
        )
    except WorkerProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Todavía no creaste tu perfil de trabajador",
        ) from exc
    return _available_now_response(profile)


@router.get(
    "/me/available-now",
    response_model=AvailableNowResponse,
    summary='Ver el estado de "Disponible ahora" del trabajador autenticado',
)
async def get_available_now(current_user: WorkerDep, service: ServiceDep):
    try:
        profile = await service.get_my_profile(current_user.id)
    except WorkerProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Todavía no creaste tu perfil de trabajador",
        ) from exc
    return _available_now_response(profile)


@router.delete(
    "/me/available-now",
    status_code=status.HTTP_204_NO_CONTENT,
    summary='Apagar "Disponible ahora"',
)
async def stop_available_now(current_user: WorkerDep, service: ServiceDep) -> None:
    await service.stop_available_now(current_user.id)


# Lo que el perfil PÚBLICO no muestra. La coordenada del perfil es el
# domicilio que el trabajador marcó en el onboarding: el mapa del comercio
# ya la desplaza (`fuzz_point`, TECH_DEBT S4), y este endpoint la devolvía
# exacta a cualquier sesión con el `profile_id` que el mismo mapa entrega.
# La fecha de nacimiento tampoco hace falta: la vista pública usa `age`.
_PRIVATE_PROFILE_FIELDS = ("latitude", "longitude", "birth_date")
# El CV suele traer teléfono, email y domicilio: lo ve el dueño, admin y un
# comercio que tenga o haya tenido un turno o una postulación con esa persona.
# Antes lo veía cualquier sesión con el `profile_id` del mapa (revisión de
# seguridad 2026-10-20). Desde el 2026-11-19 (ADR-0021) ni siquiera ellos
# reciben una URL acá: ven qué CV hay y piden un link que vence (`cv-link`).
_CONTACT_PROFILE_FIELDS = ("cv_kind", "cv_filename")
# Sólo el dueño: la referencia del archivo (la manda de vuelta al guardar) y
# el link pegado a mano (lo edita). Una URL acá serviría sola, para siempre.
_OWNER_ONLY_FIELDS = ("cv_file", "cv_url")


async def _sees_contact(
    user: User, profile: WorkerProfile, relation: EmployerWorkerRelation
) -> bool:
    """¿Puede ver el CV? El dueño, admin, o un comercio con un turno o una
    postulación de esa persona (`EmployerWorkerRelation`)."""
    if user.id == profile.user_id or user.role == UserRole.ADMIN:
        return True
    return user.role == UserRole.EMPLOYER and await relation.exists(user.id, profile.id)


@router.get(
    "/{profile_id}",
    response_model=WorkerProfileResponse,
    summary="Ver el perfil público de un trabajador",
)
async def get_profile(
    profile_id: UUID,
    service: ServiceDep,
    users: UsersDep,
    verification: VerificationDep,
    relation: RelationDep,
    current_user: Annotated[User, Depends(get_current_user)],
):
    try:
        profile = await service.get_profile(profile_id)
    except WorkerProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil no encontrado",
        ) from exc
    response = await _to_response(profile, users, verification)
    if current_user.id == profile.user_id:
        return response
    hidden: list[str] = list(_OWNER_ONLY_FIELDS)
    if current_user.role != UserRole.ADMIN:
        hidden.extend(_PRIVATE_PROFILE_FIELDS)
    if not await _sees_contact(current_user, profile, relation):
        hidden.extend(_CONTACT_PROFILE_FIELDS)
    return response.model_copy(update={field: None for field in hidden})


@router.get(
    "/{profile_id}/cv-link",
    response_model=CvLinkResponse,
    summary="Link que vence para ver el CV de un trabajador (ADR-0021)",
)
async def get_cv_link(
    profile_id: UUID,
    service: ServiceDep,
    relation: RelationDep,
    current_user: Annotated[User, Depends(get_current_user)],
    download: bool = False,
):
    """El CV se abre con un link firmado que vence a los 5 minutos (con
    `download=true`, lo baja). Lo pide quien hoy puede verlo: el dueño, admin
    o un comercio con un turno o una postulación de esa persona. Perfil
    inexistente, sin CV o ajeno → 404 igual para todos: no se revela qué
    existe. Un link visto una vez no sirve cuando el vínculo termina."""
    try:
        profile = await service.get_profile(profile_id)
        if not await _sees_contact(current_user, profile, relation):
            raise CvNotFoundError(str(profile_id))
        link = service.cv_link(profile, download=download)
    except (WorkerProfileNotFoundError, CvNotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="CV no encontrado"
        ) from exc
    except CloudinaryNotConfiguredError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ver el CV no está configurado en este servidor",
        ) from exc
    return CvLinkResponse(url=link.url, expires_at=link.expires_at)
